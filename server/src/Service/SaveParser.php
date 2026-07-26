<?php

namespace App\Service;

/**
 * Liest eine PROFILE_x-Datei des Spiels (Easy Save 2).
 *
 * Satzformat: '~' + Schlüssellänge + Schlüssel + int32 Blocklänge + 0xFF
 *             + 4 Byte Typkennung + Wert.
 * Es wird jede Byteposition geprüft, damit ein unbekannter Datentyp den
 * restlichen Durchlauf nicht verschiebt.
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
     * Fasst die Rohwerte zu dem zusammen, was das Profil speichert.
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

        // Abgeschlossene Reviere: alle Arten des Reviers gefangen
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
            'player' => [
                'name' => \is_string($raw['playerName'] ?? null) ? $raw['playerName'] : '',
                'level' => (int) ($raw['playersLevel'] ?? 0),
                'score' => (int) ($raw['playersScore'] ?? 0),
                'money' => (int) ($raw['playersMoney'] ?? 0),
                'exp' => (int) ($raw['playersExperience'] ?? 0),
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

    /**
     * Modellvarianten einer Art zusammenführen (BROWN_TROUT_B -> BROWN_TROUT),
     * aber nur, wenn es den Basisschlüssel wirklich gibt.
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
