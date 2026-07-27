<?php

namespace App\Service;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Sign-in through the PHP session. For uploads by curl there is also the
 * account's API token in the X-Api-Token header.
 *
 * Whoever wants to stay signed in gets a second cookie with a long random
 * value. Only its hash is stored, so a look into the database does not hand
 * anyone a valid session. On the next visit without a session it becomes a
 * new session, and the value is exchanged.
 */
final class Auth
{
    public const COOKIE = 'ufs_remember';

    /** How long such a cookie is good for. */
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
     * A cookie the caller has to attach to its response: Symfony only sets
     * cookies through the response, hence the detour.
     */
    public function pendingCookie(): ?Cookie
    {
        $c = $this->pending;
        $this->pending = null;

        return $c;
    }

    /** The active account from the session, or failing that from the cookie. */
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

    /** Account from session or API token – for endpoints that allow both. */
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
     * Signs in from the cookie. The value is account id plus secret; the hash
     * is compared with hash_equals so the runtime does not leak how close a
     * guess was.
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

        // Restore the session and swap the value, so an intercepted cookie
        // works exactly once.
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
