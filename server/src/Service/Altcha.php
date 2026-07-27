<?php

namespace App\Service;

/**
 * ALTCHA: a proof of work instead of a picture puzzle, served entirely from
 * this server. No outside service, no third-party cookies.
 *
 * The flow follows the official ALTCHA format, so the widget could be
 * swapped against this backend at any time:
 *
 *   1. The server picks a number between 0 and maxnumber and sends
 *      SHA-256(salt + number) together with an HMAC signature over it.
 *   2. The browser tries every number until the hash matches.
 *   3. The server checks once: hash matches, signature is its own, the
 *      challenge has not expired.
 *
 * The signature removes the need to store open challenges; against replay
 * the session remembers the one handed out last.
 */
final class Altcha
{
    private const ALGORITHM = 'SHA-256';

    /** About half a second of work on average – unnoticeable for a person. */
    private const MAX_NUMBER = 50000;

    /** How long a handed-out challenge stays valid. */
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
     * Checks the browser's answer.
     *
     * @param string      $payload  base64-encoded JSON from the form
     * @param string|null $expected the challenge this session received last
     *
     * @return string|null an error message, or null when everything fits
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
