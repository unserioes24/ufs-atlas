<?php

namespace App\Controller;

use App\Entity\Follow;
use App\Entity\Profile;
use App\Entity\User;
use App\Service\Auth;
use App\Service\GameData;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
class UserController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Auth $auth,
        private readonly GameData $game,
    ) {
    }

    /** Grunddaten eines Kontos; mit $self zusätzlich die privaten Felder. */
    public static function userPayload(User $user, bool $self = false): array
    {
        $p = $user->getProfile();
        $out = [
            'id' => $user->getId(),
            'name' => $user->getName(),
            'hasProfile' => $p !== null,
            'updatedAt' => $p?->getUpdatedAt()->format(\DateTimeInterface::ATOM),
        ];
        if ($self) {
            $out['email'] = $user->getEmail();
            $out['apiToken'] = $user->getApiToken();
        }

        return $out;
    }

    public static function profilePayload(?Profile $p): ?array
    {
        if ($p === null) {
            return null;
        }
        $species = [];
        foreach ($p->getSpecies() as $s) {
            $species[$s->getSpeciesKey()] = [
                'count' => $s->getCount(),
                'best' => round($s->getBestWeight(), 3),
                'length' => round($s->getBestLength(), 4),
                'sum' => round($s->getSumWeight(), 3),
                'fishery' => $s->getFishery(),
            ];
        }

        // Aus den Anglerdaten nur, was den Fortschritt zeigt – die Rutensets
        // bleiben dem eigenen Konto vorbehalten.
        $d = $p->getDetails();

        return [
            'anglerName' => $p->getAnglerName(),
            'level' => $p->getPlayerLevel(),
            'score' => $p->getPlayerScore(),
            'money' => (int) ($d['money'] ?? 0),
            'exp' => (int) ($d['exp'] ?? 0),
            'luck' => (float) ($d['luck'] ?? 0),
            'strength' => (float) ($d['strength'] ?? 0),
            'version' => $d['version'] ?? null,
            'owned' => \is_array($d['owned'] ?? null) ? $d['owned'] : [],
            'totals' => [
                'fish' => $p->getTotalFish(),
                'bites' => $p->getTotalBites(),
                'weight' => round($p->getTotalWeight(), 2),
                'time' => $p->getTotalTime(),
            ],
            'speciesCount' => $p->getSpeciesCount(),
            'fisheriesComplete' => $p->getFisheriesComplete(),
            'biggest' => [
                'weight' => round($p->getBiggestWeight(), 3),
                'weightSpecies' => $p->getBiggestWeightSpecies(),
                'length' => round($p->getBiggestLength(), 4),
                'lengthSpecies' => $p->getBiggestLengthSpecies(),
            ],
            'topSpecies' => ['weight' => round($p->getTopSpeciesWeight(), 3), 'key' => $p->getTopSpeciesKey()],
            'fisheries' => $p->getFisheries(),
            'species' => $species,
            'updatedAt' => $p->getUpdatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }

    /** Öffentliches Profil eines Anglers. */
    #[Route('/users/{id}', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(int $id): JsonResponse
    {
        return $this->publicProfile($this->em->getRepository(User::class)->find($id));
    }

    /**
     * Dasselbe Profil über den Anglernamen. Der Name ist eindeutig und steht in
     * der Adressleiste – damit lässt sich ein Profil weitergeben, ohne dass
     * jemand eine Nummer im Kopf behalten muss.
     */
    #[Route('/users/name/{name}', methods: ['GET'], requirements: ['name' => '.+'])]
    public function showByName(string $name): JsonResponse
    {
        $user = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->where('LOWER(u.name) = :n')->setParameter('n', mb_strtolower(trim($name)))
            ->setMaxResults(1)->getQuery()->getOneOrNullResult();

        return $this->publicProfile($user);
    }

    /**
     * Ist jemand angemeldet, liegt das eigene Profil gleich mit in der Antwort:
     * der Vergleich braucht beide Seiten und soll nicht zwei Anfragen kosten.
     */
    private function publicProfile(?User $user): JsonResponse
    {
        if ($user === null) {
            return $this->json(['error' => 'Unbekanntes Profil.'], 404);
        }
        $me = $this->auth->user();
        $follows = false;
        if ($me !== null) {
            $follows = null !== $this->em->getRepository(Follow::class)
                ->findOneBy(['follower' => $me, 'followed' => $user]);
        }

        $repo = $this->em->getRepository(Follow::class);

        // Im fremden Profil stehen nur die öffentlichen Gruppen; im eigenen
        // alle, denn dort wird die Mitgliedschaft auch verwaltet.
        $self = $me !== null && $me->getId() === $user->getId();
        $groups = [];
        foreach ($user->getMemberships() as $m) {
            $g = $m->getGroup();
            if (!$self && $g->getVisibility() !== 'public') {
                continue;
            }
            $groups[] = GroupController::groupPayload($g, $me, $self);
        }

        return $this->json([
            'groups' => $groups,
            'user' => self::userPayload($user),
            'profile' => self::profilePayload($user->getProfile()),
            'following' => $follows,
            'followers' => $repo->count(['followed' => $user]),
            'follows' => $repo->count(['follower' => $user]),
            'self' => $self,
            'me' => $me === null ? null : [
                'user' => self::userPayload($me),
                'profile' => self::profilePayload($me->getProfile()),
            ],
            'meta' => [
                'totalSpecies' => $this->game->totalSpecies(),
                'totalFisheries' => $this->game->totalFisheries(),
            ],
        ]);
    }

    /**
     * Wer folgt diesem Profil, und wem folgt es? Beide Listen sind öffentlich –
     * sie stehen so auch im Profil selbst.
     */
    #[Route('/users/{id}/follows', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function follows(int $id): JsonResponse
    {
        $user = $this->em->getRepository(User::class)->find($id);
        if ($user === null) {
            return $this->json(['error' => 'Unbekanntes Profil.'], 404);
        }
        $repo = $this->em->getRepository(Follow::class);

        $line = static function (User $u): array {
            $p = $u->getProfile();

            return [
                'id' => $u->getId(),
                'name' => $u->getName(),
                'species' => $p?->getSpeciesCount() ?? 0,
                'fish' => $p?->getTotalFish() ?? 0,
                'updatedAt' => $p?->getUpdatedAt()->format(\DateTimeInterface::ATOM),
            ];
        };

        $followers = [];
        foreach ($repo->findBy(['followed' => $user], ['id' => 'DESC'], 200) as $f) {
            $followers[] = $line($f->getFollower());
        }
        $following = [];
        foreach ($repo->findBy(['follower' => $user], ['id' => 'DESC'], 200) as $f) {
            $following[] = $line($f->getFollowed());
        }

        return $this->json(['followers' => $followers, 'following' => $following]);
    }

    /** Angler suchen, um ihnen zu folgen. */
    #[Route('/users', methods: ['GET'])]
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query->get('q', ''));
        $qb = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->leftJoin('u.profile', 'p')->addSelect('p')
            ->orderBy('p.totalFish', 'DESC')
            ->setMaxResults(25);
        if ($q !== '') {
            $qb->where('u.name LIKE :q')->setParameter('q', '%' . $q . '%');
        }
        $out = [];
        foreach ($qb->getQuery()->getResult() as $u) {
            $p = $u->getProfile();
            $out[] = [
                'id' => $u->getId(),
                'name' => $u->getName(),
                'fish' => $p?->getTotalFish() ?? 0,
                'species' => $p?->getSpeciesCount() ?? 0,
            ];
        }

        return $this->json(['users' => $out]);
    }

    #[Route('/follow/{id}', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function follow(int $id): JsonResponse
    {
        $me = $this->auth->user();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        if ($me->getId() === $id) {
            return $this->json(['error' => 'Sich selbst zu folgen bringt wenig.'], 400);
        }
        $other = $this->em->getRepository(User::class)->find($id);
        if ($other === null) {
            return $this->json(['error' => 'Unbekanntes Profil.'], 404);
        }
        $existing = $this->em->getRepository(Follow::class)->findOneBy(['follower' => $me, 'followed' => $other]);
        if ($existing === null) {
            $this->em->persist(new Follow($me, $other));
            $this->em->flush();
        }

        return $this->json(['ok' => true]);
    }

    #[Route('/follow/{id}', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function unfollow(int $id): JsonResponse
    {
        $me = $this->auth->user();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $other = $this->em->getRepository(User::class)->find($id);
        $existing = $other ? $this->em->getRepository(Follow::class)->findOneBy(['follower' => $me, 'followed' => $other]) : null;
        if ($existing !== null) {
            $this->em->remove($existing);
            $this->em->flush();
        }

        return $this->json(['ok' => true]);
    }

    /** Eigenes Profil plus alle, denen man folgt – die Datenbasis des Vergleichs. */
    #[Route('/following', methods: ['GET'])]
    public function following(): JsonResponse
    {
        $me = $this->auth->user();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $rows = $this->em->getRepository(Follow::class)->findBy(['follower' => $me]);
        $entries = [['user' => self::userPayload($me), 'profile' => self::profilePayload($me->getProfile()), 'self' => true]];
        foreach ($rows as $f) {
            $u = $f->getFollowed();
            $entries[] = ['user' => self::userPayload($u), 'profile' => self::profilePayload($u->getProfile()), 'self' => false];
        }

        return $this->json(['entries' => $entries]);
    }
}
