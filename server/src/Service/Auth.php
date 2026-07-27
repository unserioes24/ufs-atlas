<?php

namespace App\Service;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Anmeldung über die PHP-Sitzung. Für Uploads per curl gibt es zusätzlich
 * den API-Token des Kontos im Header X-Api-Token.
 *
 * Wer angemeldet bleiben möchte, bekommt einen zweiten Keks mit einem langen
 * Zufallswert. Gespeichert wird davon nur der Hash, damit ein Blick in die
 * Datenbank keine gültige Anmeldung verschafft. Beim nächsten Besuch ohne
 * Sitzung entsteht daraus eine neue Sitzung, und der Wert wird ausgetauscht.
 */
final class Auth
{
    public const COOKIE = 'ufs_remember';

    /** So lange gilt ein solcher Keks. */
    private const DAYS = 90;

    private ?Cookie $pending = null;

    public function __construct(
        private readonly RequestStack $requests,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function login(User $user, bool $remember = false): void
    {
        $session = $this->requests->getSession();
        $session->migrate(true);
        $session->set('uid', $user->getId());
        $user->touchLogin();

        if ($remember) {
            $this->issueCookie($user);
        }
        $this->em->flush();
    }

    public function logout(): void
    {
        $user = $this->user();
        if ($user !== null) {
            $user->clearRemember();
            $this->em->flush();
        }
        $this->requests->getSession()->invalidate();
        $this->pending = Cookie::create(self::COOKIE)->withValue('')->withExpires(1)->withPath('/');
    }

    /**
     * Ein Keks, den der Aufrufer an seine Antwort hängen muss: Symfony setzt
     * Kekse nur über die Antwort, deshalb dieser Umweg.
     */
    public function pendingCookie(): ?Cookie
    {
        $c = $this->pending;
        $this->pending = null;

        return $c;
    }

    /** Aktives Konto aus der Sitzung, ersatzweise aus dem Keks. */
    public function user(): ?User
    {
        $req = $this->requests->getCurrentRequest();
        if ($req === null) {
            return null;
        }
        if ($req->hasSession()) {
            $uid = $req->getSession()->get('uid');
            if ($uid) {
                return $this->em->getRepository(User::class)->find($uid);
            }
        }

        return $this->fromCookie();
    }

    /** Konto aus Sitzung oder API-Token – für Endpunkte, die beides erlauben. */
    public function userOrToken(): ?User
    {
        $user = $this->user();
        if ($user !== null) {
            return $user;
        }
        $req = $this->requests->getCurrentRequest();
        if ($req === null) {
            return null;
        }
        $token = $req->headers->get('X-Api-Token') ?: $req->query->get('token');
        if (!\is_string($token) || \strlen($token) < 20) {
            return null;
        }

        return $this->em->getRepository(User::class)->findOneBy(['apiToken' => $token]);
    }

    /**
     * Meldet anhand des Kekses an. Der Wert besteht aus Konto-Nummer und
     * Geheimnis; verglichen wird der Hash mit hash_equals, damit die Laufzeit
     * nicht verrät, wie weit ein geratener Wert stimmt.
     */
    private function fromCookie(): ?User
    {
        $req = $this->requests->getCurrentRequest();
        $raw = $req?->cookies->get(self::COOKIE);
        if (!\is_string($raw) || !str_contains($raw, ':')) {
            return null;
        }
        [$id, $secret] = explode(':', $raw, 2);
        if (!ctype_digit($id) || \strlen($secret) < 20) {
            return null;
        }

        $user = $this->em->getRepository(User::class)->find((int) $id);
        if ($user === null || $user->getRememberHash() === null) {
            return null;
        }
        $until = $user->getRememberUntil();
        if ($until === null || $until < new \DateTimeImmutable()) {
            return null;
        }
        if (!hash_equals($user->getRememberHash(), hash('sha256', $secret))) {
            return null;
        }

        // Sitzung wiederherstellen und den Wert austauschen, damit ein
        // abgefangener Keks nur ein einziges Mal trägt.
        $session = $this->requests->getSession();
        $session->migrate(true);
        $session->set('uid', $user->getId());
        $user->touchLogin();
        $this->issueCookie($user);
        $this->em->flush();

        return $user;
    }

    private function issueCookie(User $user): void
    {
        $secret = bin2hex(random_bytes(32));
        $until = new \DateTimeImmutable('+' . self::DAYS . ' days');
        $user->setRemember(hash('sha256', $secret), $until);

        $req = $this->requests->getCurrentRequest();
        $this->pending = Cookie::create(self::COOKIE)
            ->withValue($user->getId() . ':' . $secret)
            ->withExpires($until)
            ->withPath('/')
            ->withHttpOnly(true)
            ->withSecure($req !== null && $req->isSecure())
            ->withSameSite(Cookie::SAMESITE_LAX);
    }
}
