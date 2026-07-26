<?php

namespace App\Service;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Anmeldung über die PHP-Sitzung. Für Uploads per curl gibt es zusätzlich
 * den API-Token des Kontos im Header X-Api-Token.
 */
final class Auth
{
    public function __construct(
        private readonly RequestStack $requests,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function login(User $user): void
    {
        $session = $this->requests->getSession();
        $session->migrate(true);
        $session->set('uid', $user->getId());
        $user->touchLogin();
        $this->em->flush();
    }

    public function logout(): void
    {
        $this->requests->getSession()->invalidate();
    }

    /** Aktives Konto aus der Sitzung. */
    public function user(): ?User
    {
        $req = $this->requests->getCurrentRequest();
        if ($req === null || !$req->hasSession()) {
            return null;
        }
        $uid = $req->getSession()->get('uid');

        return $uid ? $this->em->getRepository(User::class)->find($uid) : null;
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
}
