<?php

namespace App\Service;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * User names are unique: they are how a profile is found in search and in
 * groups. The database carries the same index; this only checks beforehand
 * so the error message can be a readable one.
 */
final class Names
{
    public const MIN = 3;
    public const MAX = 32;

    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    /** Normalise whitespace, drop control and special characters. */
    public function normalize(string $wish): string
    {
        $n = preg_replace('/\s+/u', ' ', $wish) ?? '';
        $n = preg_replace('/[^\p{L}\p{N} ._-]/u', '', $n) ?? '';

        return trim($n);
    }

    public function isValid(string $name): bool
    {
        $len = mb_strlen($name);

        return $len >= self::MIN && $len <= self::MAX;
    }

    /** Free means: no other account carries it (compared case-insensitively). */
    public function isFree(string $name, ?User $except = null): bool
    {
        $found = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->where('LOWER(u.name) = :n')->setParameter('n', mb_strtolower($name))
            ->setMaxResults(1)->getQuery()->getOneOrNullResult();

        return $found === null || ($except !== null && $found->getId() === $except->getId());
    }

    /**
     * Words for the names of new accounts. Deliberately harmless and with no
     * bearing on a person – the name can be changed at any time.
     */
    private const WORDS = [
        'Blinker', 'Wobbler', 'Spinner', 'Pose', 'Feeder', 'Boilie', 'Drilling', 'Kescher',
        'Rolle', 'Schnur', 'Grundblei', 'Nymphe', 'Streamer', 'Angelrute', 'Bissanzeiger',
        'Uferkante', 'Seerose', 'Schilfgras', 'Kiesbank', 'Altarm', 'Strudel', 'Buhne',
        'Morgennebel', 'Abendrot', 'Windstille', 'Wolkenbruch', 'Mondlicht', 'Sonnenbank',
        'Hecht', 'Zander', 'Karpfen', 'Schleie', 'Barbe', 'Aland', 'Rotauge', 'Wels',
        'Forelle', 'Saibling', 'Aesche', 'Quappe', 'Doebel', 'Brasse', 'Karausche',
    ];

    /** A random word with a number attached, e.g. "Blinker482". */
    public function random(): string
    {
        for ($try = 0; $try < 50; $try++) {
            $name = self::WORDS[random_int(0, \count(self::WORDS) - 1)] . random_int(100, 9999);
            if ($this->isFree($name)) {
                return $name;
            }
        }

        // Should never happen; then chance alone decides.
        return 'Angler' . bin2hex(random_bytes(4));
    }

    /** Appends -2, -3 … until the name is free. */
    public function unique(string $wish, ?User $except = null): string
    {
        $base = $this->normalize($wish);
        if (mb_strlen($base) < self::MIN) {
            $base = 'Angler';
        }
        $base = mb_substr($base, 0, self::MAX);

        $name = $base;
        for ($i = 2; !$this->isFree($name, $except); $i++) {
            if ($i > 999) {
                return 'Angler-' . bin2hex(random_bytes(4));
            }
            $suffix = '-' . $i;
            $name = mb_substr($base, 0, self::MAX - mb_strlen($suffix)) . $suffix;
        }

        return $name;
    }
}
