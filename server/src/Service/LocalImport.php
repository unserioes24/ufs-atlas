<?php

namespace App\Service;

/**
 * Takes the state kept in the browser (ticks plus the save file loaded last)
 * into the same shape an uploaded PROFILE file produces. Everything comes
 * from the client, so every value is checked and capped.
 */
final class LocalImport
{
    private const MAX_SPECIES = 1000;

    /**
     * @param array<string, mixed> $payload  {caught, bests, stats}
     * @param array<string, string[]> $fisherySpecies
     */
    public function toAggregate(array $payload, array $knownSpecies, array $fisherySpecies): array
    {
        $caught = \is_array($payload['caught'] ?? null) ? $payload['caught'] : [];
        $bests = \is_array($payload['bests'] ?? null) ? $payload['bests'] : [];
        $stats = \is_array($payload['stats'] ?? null) ? $payload['stats'] : [];

        $species = [];
        foreach ($bests as $key => $b) {
            if (!$this->isSpeciesKey($key) || !\is_array($b) || \count($species) >= self::MAX_SPECIES) {
                continue;
            }
            $species[$key] = [
                'count' => (int) $this->num($b['count'] ?? 0, 0, 1_000_000),
                'best' => $this->num($b['weight'] ?? 0, 0, 5000),
                'length' => $this->num($b['length'] ?? 0, 0, 50),
                'sum' => $this->num($b['sum'] ?? 0, 0, 10_000_000),
                'fishery' => \is_string($b['fishery'] ?? null) ? mb_substr($b['fishery'], 0, 80) : null,
            ];
        }
        // Species ticked by hand count too, even without catch data
        foreach ($caught as $key => $on) {
            if ($on && $this->isSpeciesKey($key) && !isset($species[$key]) && \count($species) < self::MAX_SPECIES) {
                $species[$key] = ['count' => 0, 'best' => 0.0, 'length' => 0.0, 'sum' => 0.0, 'fishery' => null];
            }
        }
        // Modellvarianten zusammenführen wie beim Spielstand-Upload
        $merged = [];
        foreach ($species as $key => $s) {
            $k = $this->normalise($key, $knownSpecies);
            if (!isset($merged[$k])) {
                $merged[$k] = $s;
                continue;
            }
            $merged[$k]['count'] += $s['count'];
            $merged[$k]['sum'] += $s['sum'];
            if ($s['best'] > $merged[$k]['best']) {
                $merged[$k]['best'] = $s['best'];
                $merged[$k]['length'] = $s['length'];
                $merged[$k]['fishery'] = $s['fishery'];
            }
        }
        $species = $merged;

        $fisheries = [];
        $rawFisheries = \is_array($stats['fisheries'] ?? null) ? $stats['fisheries'] : [];
        foreach ($rawFisheries as $id => $st) {
            if (!\is_string($id) || !isset($fisherySpecies[$id]) || !\is_array($st)) {
                continue;
            }
            $row = [
                'fish' => (int) $this->num($st['fish'] ?? 0, 0, 10_000_000),
                'bites' => (int) $this->num($st['bites'] ?? 0, 0, 10_000_000),
                'score' => (int) $this->num($st['score'] ?? 0, 0, 1_000_000_000),
                'time' => (int) $this->num($st['time'] ?? 0, 0, 100_000_000),
                'weight' => round($this->num($st['weight'] ?? 0, 0, 10_000_000), 3),
                'bigW' => round($this->num($st['bigW'] ?? 0, 0, 5000), 3),
                'bigL' => round($this->num($st['bigL'] ?? 0, 0, 50), 4),
            ];
            if ($row['fish'] || $row['bites'] || $row['time'] || $row['weight']) {
                $fisheries[$id] = $row;
            }
        }

        $complete = 0;
        foreach ($fisherySpecies as $list) {
            if (!$list) {
                continue;
            }
            $all = true;
            foreach ($list as $key) {
                if (!isset($species[$key])) {
                    $all = false;
                    break;
                }
            }
            if ($all) {
                ++$complete;
            }
        }

        $totals = ['fish' => 0, 'bites' => 0, 'weight' => 0.0, 'time' => 0];
        foreach ($fisheries as $st) {
            $totals['fish'] += $st['fish'];
            $totals['bites'] += $st['bites'];
            $totals['weight'] += $st['weight'];
            $totals['time'] += $st['time'];
        }

        $bigW = 0.0; $bigWKey = null; $bigL = 0.0; $bigLKey = null; $topSum = 0.0; $topKey = null;
        foreach ($species as $key => $s) {
            if ($s['best'] > $bigW) { $bigW = $s['best']; $bigWKey = $key; }
            if ($s['length'] > $bigL) { $bigL = $s['length']; $bigLKey = $key; }
            if ($s['sum'] > $topSum) { $topSum = $s['sum']; $topKey = $key; }
        }

        $player = \is_array($stats['player'] ?? null) ? $stats['player'] : [];

        return [
            // The extra details come back from the browser unchanged, so a state
            // adopted locally holds the same as an uploaded one.
            'player' => [
                'name' => \is_string($player['name'] ?? null) ? mb_substr($player['name'], 0, 60) : '',
                'level' => (int) $this->num($player['level'] ?? 0, 0, 1000),
                'score' => (int) $this->num($player['score'] ?? 0, 0, 1_000_000_000),
                'money' => (int) $this->num($player['money'] ?? 0, 0, 1_000_000_000),
                'exp' => (int) $this->num($player['exp'] ?? 0, 0, 1_000_000_000),
                'luck' => $this->num($player['luck'] ?? 0, 0, 100),
                'strength' => $this->num($player['strength'] ?? 0, 0, 100),
                'skillPoints' => (int) $this->num($player['skillPoints'] ?? 0, 0, 1000),
                'skills' => $this->skills($player['skills'] ?? null),
                'version' => \is_string($player['version'] ?? null) ? mb_substr($player['version'], 0, 40) : null,
                'sets' => \is_array($player['sets'] ?? null) ? \array_slice($player['sets'], 0, 5) : [],
                'owned' => \is_array($player['owned'] ?? null) ? $player['owned'] : [],
            ],
            'species' => $species,
            'fisheries' => $fisheries,
            'totals' => $totals,
            'speciesCount' => \count($species),
            'fisheriesComplete' => $complete,
            'biggest' => ['weight' => $bigW, 'weightSpecies' => $bigWKey, 'length' => $bigL, 'lengthSpecies' => $bigLKey],
            'topSpecies' => ['weight' => $topSum, 'key' => $topKey],
        ];
    }

    private function isSpeciesKey(mixed $key): bool
    {
        return \is_string($key) && $key !== '' && \strlen($key) <= 64 && preg_match('/^[A-Z0-9_]+$/', $key) === 1;
    }

    /**
     * The skill tree as the browser read it out of the save file. Shape and
     * bounds are checked here as well - this arrives over the wire.
     *
     * @return list<array{key: string, level: int, steps: int}>
     */
    private function skills(mixed $raw): array
    {
        if (!\is_array($raw)) {
            return [];
        }
        $out = [];
        foreach (\array_slice($raw, 0, 50) as $s) {
            if (!\is_array($s) || !\is_string($s['key'] ?? null)) {
                continue;
            }
            $key = mb_substr($s['key'], 0, 64);
            if (preg_match('/^[A-Z0-9_]+$/', $key) !== 1) {
                continue;
            }
            $steps = (int) $this->num($s['steps'] ?? 0, 0, 20);
            $out[] = [
                'key' => $key,
                'level' => (int) $this->num($s['level'] ?? 0, 0, $steps),
                'steps' => $steps,
            ];
        }

        return $out;
    }

    private function num(mixed $v, float $min, float $max): float
    {
        if (!is_numeric($v)) {
            return $min;
        }
        $f = (float) $v;
        if (is_nan($f) || is_infinite($f)) {
            return $min;
        }

        return max($min, min($max, $f));
    }

    /** @param array<string, mixed> $knownSpecies */
    private function normalise(string $key, array $knownSpecies): string
    {
        if (isset($knownSpecies[$key])) {
            return $key;
        }
        if (preg_match('/^(.*)_[A-Z]{1,2}$/', $key, $m) && isset($knownSpecies[$m[1]])) {
            return $m[1];
        }

        return $key;
    }
}
