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

        return [
            'anglerName' => $p->getAnglerName(),
            'level' => $p->getPlayerLevel(),
            'score' => $p->getPlayerScore(),
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
        $user = $this->em->getRepository(User::class)->find($id);
        if ($user === null) {
            return $this->json(['error' => 'Unbekanntes Profil.'], 404);
        }
        $me = $this->auth->user();
        $follows = false;
        if ($me !== null) {
            $follows = null !== $this->em->getRepository(Follow::class)
                ->findOneBy(['follower' => $me, 'followed' => $user]);
        }

        return $this->json([
            'user' => self::userPayload($user),
            'profile' => self::profilePayload($user->getProfile()),
            'following' => $follows,
            'meta' => [
                'totalSpecies' => $this->game->totalSpecies(),
                'totalFisheries' => $this->game->totalFisheries(),
            ],
        ]);
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
