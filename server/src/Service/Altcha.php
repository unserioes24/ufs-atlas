<?php

namespace App\Service;

/**
 * ALTCHA: ein Rechennachweis statt eines Bilderrätsels, komplett auf dem
 * eigenen Server. Kein Dienst von außen, keine Cookies von Dritten.
 *
 * Ablauf (identisch zum offiziellen ALTCHA-Format, damit sich das Widget
 * jederzeit gegen dieses Backend austauschen ließe):
 *
 *   1. Der Server würfelt eine Zahl zwischen 0 und maxnumber, schickt
 *      SHA-256(salt + zahl) und eine HMAC-Signatur darüber.
 *   2. Der Browser probiert alle Zahlen durch, bis der Hash passt.
 *   3. Der Server rechnet nur einmal nach: Hash stimmt, Signatur stammt von
 *      ihm, Ablaufzeit nicht überschritten.
 *
 * Die Signatur macht eine eigene Ablage der offenen Aufgaben überflüssig;
 * gegen Mehrfachnutzung merkt sich die Sitzung die zuletzt ausgegebene.
 */
final class Altcha
{
    private const ALGORITHM = 'SHA-256';

    /** Rund eine halbe Sekunde Rechenzeit im Mittel – für Menschen unauffällig. */
    private const MAX_NUMBER = 50000;

    /** So lange ist eine ausgegebene Aufgabe gültig. */
    private const TTL = 900;

    public function __construct(private readonly string $secret)
    {
    }

    /** @return array{algorithm:string,challenge:string,salt:string,maxnumber:int,signature:string} */
    public function challenge(): array
    {
        $salt = bin2hex(random_bytes(12)) . '?expires=' . (time() + self::TTL);
        $number = random_int(0, self::MAX_NUMBER);
        $challenge = hash('sha256', $salt . $number);

        return [
            'algorithm' => self::ALGORITHM,
            'challenge' => $challenge,
            'salt' => $salt,
            'maxnumber' => self::MAX_NUMBER,
            'signature' => hash_hmac('sha256', $challenge, $this->secret),
        ];
    }

    /**
     * Prüft die Lösung des Browsers.
     *
     * @param string      $payload  base64-kodiertes JSON aus dem Formular
     * @param string|null $expected Aufgabe, die diese Sitzung zuletzt bekam
     *
     * @return string|null Fehlermeldung, oder null wenn alles stimmt
     */
    public function verify(string $payload, ?string $expected): ?string
    {
        $json = base64_decode($payload, true);
        $data = $json !== false ? json_decode($json, true) : null;
        if (!\is_array($data)) {
            return 'Die Bot-Prüfung fehlt. Bitte die Seite neu laden.';
        }

        $algorithm = (string) ($data['algorithm'] ?? '');
        $salt = (string) ($data['salt'] ?? '');
        $challenge = (string) ($data['challenge'] ?? '');
        $signature = (string) ($data['signature'] ?? '');
        $number = $data['number'] ?? null;
        if ($algorithm !== self::ALGORITHM || $salt === '' || $challenge === '' || !\is_int($number) || $number < 0) {
            return 'Die Bot-Prüfung ist unvollständig. Bitte die Seite neu laden.';
        }

        if ($expected === null || !hash_equals($expected, $challenge)) {
            return 'Die Bot-Prüfung ist nicht mehr gültig. Bitte erneut versuchen.';
        }
        if ($this->expiry($salt) < time()) {
            return 'Die Bot-Prüfung ist abgelaufen. Bitte erneut versuchen.';
        }
        if (!hash_equals(hash_hmac('sha256', $challenge, $this->secret), $signature)) {
            return 'Die Bot-Prüfung stammt nicht von diesem Server.';
        }
        if (!hash_equals($challenge, hash('sha256', $salt . $number))) {
            return 'Die Bot-Prüfung wurde nicht gelöst.';
        }

        return null;
    }

    /** Ablaufzeit steckt als Abfrageteil im Salt: "abc123?expires=1750000000". */
    private function expiry(string $salt): int
    {
        $pos = strpos($salt, '?');
        if ($pos === false) {
            return 0;
        }
        parse_str(substr($salt, $pos + 1), $params);

        return (int) ($params['expires'] ?? 0);
    }
}
