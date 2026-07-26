<?php

namespace App\Service;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Benutzernamen sind eindeutig: unter ihnen findet man ein Profil in der Suche
 * und in Gruppen. Die Datenbank hat denselben Index, hier wird nur vorab
 * geprüft, damit es eine verständliche Fehlermeldung gibt.
 */
final class Names
{
    public const MIN = 3;
    public const MAX = 32;

    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    /** Leerzeichen vereinheitlichen, Steuer- und Sonderzeichen entfernen. */
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

    /** Frei heißt: kein anderes Konto trägt ihn (Vergleich ohne Groß-/Kleinschreibung). */
    public function isFree(string $name, ?User $except = null): bool
    {
        $found = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->where('LOWER(u.name) = :n')->setParameter('n', mb_strtolower($name))
            ->setMaxResults(1)->getQuery()->getOneOrNullResult();

        return $found === null || ($except !== null && $found->getId() === $except->getId());
    }

    /** Hängt -2, -3 … an, bis der Name frei ist. */
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
