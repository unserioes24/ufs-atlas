<?php

namespace App\Service;

/**
 * Liest eine PROFILE_x-Datei des Spiels (Easy Save 2).
 *
 * Satzformat: '~' + Schlüssellänge + Schlüssel + int32 Blocklänge + 0xFF
 *             + 4 Byte Typkennung + Wert.
 * Every byte position is checked, so an unknown data type cannot shift the
 * rest of the run.
 */
final class SaveParser
{
    private const T_INT = 0xE2A80856;
    private const T_FLOAT = 0x6E3ED76B;
    private const T_STRING = 0xFDE9F1EE;
    private const T_BOOL = 0xAD4D7C9C;

    /** @return array<string, int|float|string|bool> */
    public function parse(string $bytes): array
    {
        $out = [];
        $len = \strlen($bytes);
        for ($i = 0; $i < $len - 8; $i++) {
            if ($bytes[$i] !== "\x7E") {
                continue;
            }
            $kl = \ord($bytes[$i + 1]);
            if ($kl < 3 || $kl > 64 || $i + 2 + $kl + 5 > $len) {
                continue;
            }
            $key = substr($bytes, $i + 2, $kl);
            if (!preg_match('/^[A-Za-z0-9_\/]+$/', $key)) {
                continue;
            }
            $p = $i + 2 + $kl;
            $blob = unpack('l', substr($bytes, $p, 4))[1];
            $p += 4;
            if ($blob < 5 || $blob > 65536 || $p + $blob > $len) {
                continue;
            }
            if ($bytes[$p] !== "\xFF") {
                continue;
            }
            $type = unpack('V', substr($bytes, $p + 1, 4))[1];
            $vp = $p + 5;
            if ($type === self::T_INT && $vp + 4 <= $len) {
                $out[$key] = unpack('l', substr($bytes, $vp, 4))[1];
            } elseif ($type === self::T_FLOAT && $vp + 4 <= $len) {
                $out[$key] = unpack('g', substr($bytes, $vp, 4))[1];
            } elseif ($type === self::T_BOOL && $vp < $len) {
                $out[$key] = $bytes[$vp] !== "\x00";
            } elseif ($type === self::T_STRING && $vp < $len) {
                $sl = \ord($bytes[$vp]);
                if ($sl < 128 && $vp + 1 + $sl <= $len) {
                    $out[$key] = substr($bytes, $vp + 1, $sl);
                }
            }
        }

        return $out;
    }

    /**
     * Folds the raw values into what the profile stores.
     *
     * @param array<string, mixed> $raw
     * @param array<string, string[]> $fisherySpecies  Revier-ID => Artenschlüssel
     * @param array<string, string> $fisherySaveKeys   Revier-ID => LEVELS/..._NAME
     */
    public function aggregate(array $raw, array $knownSpecies, array $fisherySpecies, array $fisherySaveKeys): array
    {
        $species = [];
        foreach ($raw as $k => $v) {
            if (!preg_match('/^([A-Z0-9_]+)_caughtCount$/', $k, $m)) {
                continue;
            }
            $n = (int) $v;
            if ($n <= 0) {
                continue;
            }
            $base = $m[1];
            $key = $this->normaliseSpecies($base, $knownSpecies);
            $w = isset($raw[$base . '_weight']) ? (float) $raw[$base . '_weight'] : 0.0;
            $l = isset($raw[$base . '_length']) ? (float) $raw[$base . '_length'] : 0.0;
            $sum = isset($raw[$base . '_caughtWeightSum']) ? (float) $raw[$base . '_caughtWeightSum'] : 0.0;
            $fishery = isset($raw[$base . '_fishery']) && \is_string($raw[$base . '_fishery']) ? $raw[$base . '_fishery'] : null;

            if (!isset($species[$key])) {
                $species[$key] = ['count' => 0, 'best' => 0.0, 'length' => 0.0, 'sum' => 0.0, 'fishery' => null];
            }
            $species[$key]['count'] += $n;
            $species[$key]['sum'] += $sum;
            if ($w > $species[$key]['best']) {
                $species[$key]['best'] = $w;
                $species[$key]['length'] = $l;
                $species[$key]['fishery'] = $fishery;
            }
        }

        $fisheries = [];
        foreach ($fisherySaveKeys as $id => $pre) {
            $val = static function (string $name) use ($raw, $pre): float {
                $k = $pre . '_Stats_' . $name;

                return isset($raw[$k]) ? (float) $raw[$k] : 0.0;
            };
            $st = [
                'fish' => (int) $val('fishCaught'),
                'bites' => (int) $val('bitesAmount'),
                'score' => (int) $val('score'),
                'time' => (int) $val('timeSpent'),
                'weight' => round($val('weightSum'), 3),
                'bigW' => round($val('biggestWeight'), 3),
                'bigL' => round($val('biggestLength'), 4),
            ];
            if ($st['fish'] || $st['bites'] || $st['time'] || $st['weight']) {
                $fisheries[$id] = $st;
            }
        }

        // Completed fisheries: every species of the fishery caught
        $complete = 0;
        foreach ($fisherySpecies as $id => $list) {
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
                $complete++;
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

        return [
            'player' => $this->player($raw),
            'species' => $species,
            'fisheries' => $fisheries,
            'totals' => $totals,
            'speciesCount' => \count($species),
            'fisheriesComplete' => $complete,
            'biggest' => ['weight' => $bigW, 'weightSpecies' => $bigWKey, 'length' => $bigL, 'lengthSpecies' => $bigLKey],
            'topSpecies' => ['weight' => $topSum, 'key' => $topKey],
        ];
    }

    /**
     * Details about the angler, including the five rod sets and how much gear
     * was bought per category. The browser reads the same keys; both have to
     * agree so that a save file uploaded through the API looks exactly like
     * one loaded locally.
     *
     * @param array<string, mixed> $raw
     */
    private function player(array $raw): array
    {
        $slots = [
            'ROD' => 'Rute', 'ICE_ROD' => 'Eisrute', 'REEL' => 'Rolle', 'LINE' => 'Schnur',
            'FLOAT' => 'Pose', 'HOOK' => 'Haken', 'BOILIE' => 'Boilie', 'FEEDER' => 'Feeder',
            'FEEDER_BAIT' => 'Feederköder', 'ROD_STAND' => 'Ständer', 'BITE_INDICATOR' => 'Bissanzeiger',
        ];

        $sets = [];
        for ($n = 1; $n <= 5; $n++) {
            $eq = $n === 1 ? 'currentEquipment_' : 'currentEquipment_' . $n . '_';
            $bt = $n === 1 ? 'currentBaits_' : 'currentBaits_' . $n . '_';
            $sfx = $n === 1 ? '' : $n . '_';

            $parts = [];
            foreach ($slots as $key => $label) {
                $v = $raw[$eq . $key] ?? null;
                if (\is_string($v) && $v !== '') {
                    $parts[] = ['slot' => $label, 'id' => $v];
                }
            }
            $baits = [];
            for ($i = 0; $i < 3; $i++) {
                $v = $raw[$bt . $i] ?? null;
                if (\is_string($v) && $v !== '') {
                    $baits[] = $v;
                }
            }
            if (!$parts && !$baits) {
                continue;
            }
            $sets[] = [
                'n' => $n, 'parts' => $parts, 'baits' => $baits,
                'depth' => $raw['currentFloatDepth' . $sfx] ?? null,
                'weight' => $raw['currentFloatWeight' . $sfx] ?? null,
                'hookSize' => $raw['currentHookSize' . $sfx] ?? null,
            ];
        }

        $owned = [];
        foreach ($raw as $k => $v) {
            if ($v !== true || !preg_match('/^([A-Z][A-Z0-9_]+)_isBought$/', $k, $m)) {
                continue;
            }
            preg_match('/^(ICE_ROD|ROD_STAND|FEEDER_BAIT|BITE_INDICATOR|[A-Z]+)/', $m[1], $c);
            $cat = $c[1] ?? 'SONST';
            $owned[$cat] = ($owned[$cat] ?? 0) + 1;
        }

        // The skill tree: one flag per step, e.g. skill_unlocked_MORE_EXP_2.
        // How many steps a skill has is counted from the keys the save file
        // carries - the game names only the first step of several of them.
        $steps = [];
        foreach ($raw as $k => $v) {
            if (!preg_match('/^skill_unlocked_(.+)_(\d+)$/', $k, $m)) {
                continue;
            }
            $steps[$m[1]][] = $v === true ? (int) $m[2] : 0;
        }
        $skills = [];
        foreach ($steps as $key => $list) {
            $skills[] = ['key' => $key, 'level' => max($list), 'steps' => \count($list)];
        }
        usort($skills, static fn (array $a, array $b) => [$b['level'], $a['key']] <=> [$a['level'], $b['key']]);

        return [
            'name' => \is_string($raw['playerName'] ?? null) ? $raw['playerName'] : '',
            'level' => (int) ($raw['playersLevel'] ?? 0),
            'score' => (int) ($raw['playersScore'] ?? 0),
            'money' => (int) ($raw['playersMoney'] ?? 0),
            'exp' => (int) ($raw['playersExperience'] ?? 0),
            'luck' => (float) ($raw['playersLuck'] ?? 0),
            'strength' => (float) ($raw['playersStrength'] ?? 0),
            'skillPoints' => (int) ($raw['skillPoints'] ?? 0),
            'skills' => $skills,
            'version' => \is_string($raw['gameVersion'] ?? null) ? $raw['gameVersion'] : null,
            'sets' => $sets,
            'owned' => $owned,
        ];
    }

    /**
     * Fold model variants onto the base species (BROWN_TROUT_B -> BROWN_TROUT),
     * but only where the base key really exists.
     *
     * @param array<string, mixed> $knownSpecies
     */
    private function normaliseSpecies(string $key, array $knownSpecies): string
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
