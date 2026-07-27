<?php

namespace App\Controller;

use App\Entity\LoginCode;
use App\Entity\User;
use App\Service\Altcha;
use App\Service\Auth;
use App\Service\Names;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mailer\Exception\ExceptionInterface as MailerException;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/auth')]
class AuthController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Auth $auth,
        private readonly Names $names,
        private readonly Altcha $altcha,
    ) {
    }

    /**
     * Rechenaufgabe für die Bot-Prüfung. Der Browser löst sie, bevor er einen
     * Anmeldecode anfordert; die Sitzung merkt sich die zuletzt ausgegebene,
     * damit dieselbe Lösung nicht mehrfach zählt.
     */
    #[Route('/challenge', methods: ['GET'])]
    public function challenge(Request $request): JsonResponse
    {
        $challenge = $this->altcha->challenge();
        $request->getSession()->set('altcha', $challenge['challenge']);

        return $this->json($challenge);
    }

    /** Schickt einen Einmalcode. Antwortet immer gleich, damit sich keine Konten abfragen lassen. */
    #[Route('/request', methods: ['POST'])]
    public function request(Request $request, MailerInterface $mailer, LoggerInterface $logger): JsonResponse
    {
        $data = json_decode($request->getContent() ?: '{}', true) ?: [];
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->json(['error' => 'Bitte eine gültige E-Mail-Adresse angeben.'], 400);
        }

        // Bot-Prüfung vor allem anderen: sie kostet Rechenzeit, das Verschicken
        // von Post an fremde Adressen soll nicht umsonst zu haben sein.
        $session = $request->getSession();
        $problem = $this->altcha->verify((string) ($data['altcha'] ?? ''), $session->get('altcha'));
        if ($problem !== null) {
            return $this->json(['error' => $problem], 400);
        }
        $session->remove('altcha');

        // Abgelaufene Codes derselben Adresse aufräumen und Missbrauch bremsen
        $repo = $this->em->getRepository(LoginCode::class);
        $recent = $repo->createQueryBuilder('c')
            ->where('c.email = :e')->setParameter('e', $email)
            ->andWhere('c.expiresAt > :now')->setParameter('now', new \DateTimeImmutable('-14 minutes'))
            ->getQuery()->getResult();
        if (\count($recent) >= 5) {
            return $this->json(['error' => 'Zu viele Anfragen. Bitte später erneut versuchen.'], 429);
        }
        foreach ($repo->findBy(['email' => $email]) as $old) {
            if ($old->isExpired() || $old->isUsed()) {
                $this->em->remove($old);
            }
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $entry = new LoginCode($email, password_hash($code, PASSWORD_DEFAULT), new \DateTimeImmutable('+15 minutes'));
        $this->em->persist($entry);
        $this->em->flush();

        $mail = (new Email())
            ->to($email)
            ->subject('Dein Anmeldecode für UFS Atlas')
            ->text("Dein Anmeldecode lautet: {$code}\n\n"
                . "Er ist 15 Minuten gültig.\n"
                . "Wenn du dich nicht anmelden wolltest, ignoriere diese Nachricht einfach.\n");

        // Ein fehlender oder falscher MAILER_DSN ist ein Betriebsfehler, kein
        // Programmfehler: verständlich antworten statt eine 500-Seite zeigen.
        try {
            $mailer->send($mail);
        } catch (MailerException $e) {
            $logger->error('Anmeldecode konnte nicht versandt werden: ' . $e->getMessage());
            $this->em->remove($entry);
            $this->em->flush();

            return $this->json(['error' => 'Der Mailversand ist gerade nicht möglich. Bitte später erneut versuchen.'], 503);
        }

        return $this->json(['ok' => true]);
    }

    #[Route('/verify', methods: ['POST'])]
    public function verify(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent() ?: '{}', true) ?: [];
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $code = preg_replace('/\D+/', '', (string) ($data['code'] ?? ''));
        if (!$email || !$code) {
            return $this->json(['error' => 'E-Mail und Code angeben.'], 400);
        }

        $entry = $this->em->getRepository(LoginCode::class)->createQueryBuilder('c')
            ->where('c.email = :e')->setParameter('e', $email)
            ->andWhere('c.used = false')
            ->orderBy('c.id', 'DESC')->setMaxResults(1)
            ->getQuery()->getOneOrNullResult();

        if ($entry === null || $entry->isExpired()) {
            return $this->json(['error' => 'Code ist abgelaufen. Bitte einen neuen anfordern.'], 400);
        }
        if ($entry->getAttempts() >= 5) {
            return $this->json(['error' => 'Zu viele Fehlversuche. Bitte einen neuen Code anfordern.'], 429);
        }
        if (!password_verify($code, $entry->getCodeHash())) {
            $entry->addAttempt();
            $this->em->flush();

            return $this->json(['error' => 'Code stimmt nicht.'], 400);
        }

        $entry->markUsed();
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
        if ($user === null) {
            // Neue Konten bekommen einen zufälligen Namen. Ein Spielstand-Import
            // überschreibt ihn später durch den Anglernamen aus dem Spiel.
            // Namen sind eindeutig. Der Zufallsname wird vorher geprüft; greifen
            // zwei Anmeldungen im selben Augenblick zum gleichen, entscheidet
            // der Index in der Datenbank. Dann ist der Code noch unverbraucht
            // und ein zweiter Versuch führt sofort zum Ziel.
            $user = new User($email, $this->names->random());
            try {
                $this->em->persist($user);
                $this->em->flush();
            } catch (UniqueConstraintViolationException) {
                return $this->json(['error' => 'Das hat sich überschnitten. Bitte den Code noch einmal abschicken.'], 409);
            }
        }

        $remember = (bool) ($data['remember'] ?? false);
        $this->auth->login($user, $remember);

        $response = $this->json(['ok' => true, 'user' => UserController::userPayload($user)]);
        $cookie = $this->auth->pendingCookie();
        if ($cookie !== null) {
            $response->headers->setCookie($cookie);
        }

        return $response;
    }

    #[Route('/logout', methods: ['POST'])]
    public function logout(): JsonResponse
    {
        $this->auth->logout();

        $response = $this->json(['ok' => true]);
        $cookie = $this->auth->pendingCookie();
        if ($cookie !== null) {
            $response->headers->setCookie($cookie);
        }

        return $response;
    }

    /** Aktueller Anmeldezustand, wird beim Laden der Seite abgefragt. */
    #[Route('/me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->auth->user();
        if ($user === null) {
            return $this->json(['user' => null]);
        }

        // Kam die Anmeldung aus dem Keks, wurde dessen Wert gerade erneuert.
        $response = $this->json(['user' => UserController::userPayload($user, true)]);
        $cookie = $this->auth->pendingCookie();
        if ($cookie !== null) {
            $response->headers->setCookie($cookie);
        }

        return $response;
    }

    #[Route('/token/new', methods: ['POST'])]
    public function newToken(): JsonResponse
    {
        $user = $this->auth->user();
        if ($user === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $user->regenerateApiToken();
        $this->em->flush();

        return $this->json(['token' => $user->getApiToken()]);
    }
}
