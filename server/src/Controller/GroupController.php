<?php

namespace App\Controller;

use App\Entity\FishGroup;
use App\Entity\GroupMember;
use App\Entity\User;
use App\Service\Auth;
use App\Service\GameData;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/groups')]
class GroupController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Auth $auth,
        private readonly GameData $game,
    ) {
    }

    private function requireUser(): ?User
    {
        return $this->auth->user();
    }

    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $out = [];
        foreach ($me->getMemberships() as $m) {
            $out[] = self::groupPayload($m->getGroup(), $me);
        }

        return $this->json(['groups' => $out]);
    }

    /**
     * Basic group data. The join code only goes to members – an open group
     * does not need one anyway.
     */
    public static function groupPayload(FishGroup $g, ?User $me, bool $member = true): array
    {
        return [
            'id' => $g->getId(),
            'name' => $g->getName(),
            'code' => $member ? $g->getJoinCode() : null,
            'visibility' => $g->getVisibility(),
            'members' => \count($g->getMembers()),
            'owner' => $me !== null && $g->getOwner()->getId() === $me->getId(),
            'ownerId' => $g->getOwner()->getId(),
            'ownerName' => $g->getOwner()->getName(),
            'member' => $member,
        ];
    }

    /** Directory of public groups, readable without an account. */
    #[Route('/public', methods: ['GET'])]
    public function directory(Request $request): JsonResponse
    {
        $me = $this->auth->user();
        $q = trim((string) $request->query->get('q', ''));
        $qb = $this->em->getRepository(FishGroup::class)->createQueryBuilder('g')
            ->where('g.visibility = :v')->setParameter('v', 'public')
            ->orderBy('g.createdAt', 'DESC')
            ->setMaxResults(50);
        if ($q !== '') {
            $qb->andWhere('g.name LIKE :q')->setParameter('q', '%' . $q . '%');
        }

        $mine = [];
        if ($me !== null) {
            foreach ($me->getMemberships() as $m) {
                $mine[$m->getGroup()->getId()] = true;
            }
        }
        $out = [];
        foreach ($qb->getQuery()->getResult() as $g) {
            $out[] = self::groupPayload($g, $me, isset($mine[$g->getId()]));
        }

        return $this->json(['groups' => $out]);
    }

    #[Route('', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $data = json_decode($request->getContent() ?: '{}', true) ?: [];
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 60) {
            return $this->json(['error' => 'Gruppenname muss zwischen 1 und 60 Zeichen lang sein.'], 400);
        }

        $code = $this->freeCode();
        $group = new FishGroup($name, $code, $me);
        $group->setVisibility((string) ($data['visibility'] ?? 'private'));
        $this->em->persist($group);
        $member = new GroupMember($group, $me);
        $this->em->persist($member);
        $this->em->flush();

        return $this->json(['ok' => true, 'group' => self::groupPayload($group, $me)]);
    }

    /** Change name, visibility and join code – owner only. */
    #[Route('/{id}', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function edit(int $id, Request $request): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $group = $this->em->getRepository(FishGroup::class)->find($id);
        if ($group === null) {
            return $this->json(['error' => 'Gruppe nicht gefunden.'], 404);
        }
        if ($group->getOwner()->getId() !== $me->getId()) {
            return $this->json(['error' => 'Nur wer die Gruppe angelegt hat, darf sie ändern.'], 403);
        }

        $data = json_decode($request->getContent() ?: '{}', true) ?: [];
        if (isset($data['name'])) {
            $name = trim((string) $data['name']);
            if ($name === '' || mb_strlen($name) > 60) {
                return $this->json(['error' => 'Gruppenname muss zwischen 1 und 60 Zeichen lang sein.'], 400);
            }
            $group->setName($name);
        }
        if (isset($data['visibility'])) {
            $group->setVisibility((string) $data['visibility']);
        }
        if (!empty($data['newCode'])) {
            $group->regenerateJoinCode($this->freeCode());
        }
        $this->em->flush();

        return $this->json(['ok' => true, 'group' => self::groupPayload($group, $me)]);
    }

    /** Remove a member; the owner cannot throw themselves out. */
    #[Route('/{id}/kick/{userId}', methods: ['POST'], requirements: ['id' => '\d+', 'userId' => '\d+'])]
    public function kick(int $id, int $userId): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $group = $this->em->getRepository(FishGroup::class)->find($id);
        if ($group === null) {
            return $this->json(['error' => 'Gruppe nicht gefunden.'], 404);
        }
        if ($group->getOwner()->getId() !== $me->getId()) {
            return $this->json(['error' => 'Nur wer die Gruppe angelegt hat, darf Mitglieder entfernen.'], 403);
        }
        if ($group->getOwner()->getId() === $userId) {
            return $this->json(['error' => 'Die Gruppe braucht ihren Besitzer.'], 400);
        }
        $other = $this->em->getRepository(User::class)->find($userId);
        $member = $other ? $this->em->getRepository(GroupMember::class)
            ->findOneBy(['group' => $group, 'user' => $other]) : null;
        if ($member !== null) {
            $this->em->remove($member);
            $this->em->flush();
        }

        return $this->json(['ok' => true]);
    }

    /** A short code that reads aloud well, without look-alike characters. */
    private function freeCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $code = '';
            for ($i = 0; $i < 6; $i++) {
                $code .= $alphabet[random_int(0, \strlen($alphabet) - 1)];
            }
            $taken = $this->em->getRepository(FishGroup::class)->findOneBy(['joinCode' => $code]);
        } while ($taken !== null);

        return $code;
    }

    #[Route('/join', methods: ['POST'])]
    public function join(Request $request): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $data = json_decode($request->getContent() ?: '{}', true) ?: [];
        $code = strtoupper(trim((string) ($data['code'] ?? '')));
        $id = (int) ($data['id'] ?? 0);

        // Join either by code or – for open groups – straight by the group
        // number from the directory or a link.
        $repo = $this->em->getRepository(FishGroup::class);
        $group = $code !== '' ? $repo->findOneBy(['joinCode' => $code]) : null;
        if ($group === null && $id > 0) {
            $found = $repo->find($id);
            if ($found !== null && $found->isOpen()) {
                $group = $found;
            }
        }
        if ($group === null) {
            return $this->json(['error' => 'Zu diesem Code gibt es keine Gruppe.'], 404);
        }
        $existing = $this->em->getRepository(GroupMember::class)->findOneBy(['group' => $group, 'user' => $me]);
        if ($existing === null) {
            $this->em->persist(new GroupMember($group, $me));
            $this->em->flush();
        }

        return $this->json(['ok' => true, 'group' => self::groupPayload($group, $me)]);
    }

    /**
     * Leaving. Whoever created the group takes it with them: without an owner
     * nobody could manage it any more.
     */
    #[Route('/{id}/leave', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function leave(int $id): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $group = $this->em->getRepository(FishGroup::class)->find($id);
        if ($group === null) {
            return $this->json(['ok' => true, 'deleted' => false]);
        }
        if ($group->getOwner()->getId() === $me->getId()) {
            $this->em->remove($group);
            $this->em->flush();

            return $this->json(['ok' => true, 'deleted' => true]);
        }

        $member = $this->em->getRepository(GroupMember::class)->findOneBy(['group' => $group, 'user' => $me]);
        if ($member !== null) {
            $this->em->remove($member);
            $this->em->flush();
        }

        return $this->json(['ok' => true, 'deleted' => false]);
    }

    /** Dissolve the group. Owner only, and it is final. */
    #[Route('/{id}', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $group = $this->em->getRepository(FishGroup::class)->find($id);
        if ($group === null) {
            return $this->json(['ok' => true]);
        }
        if ($group->getOwner()->getId() !== $me->getId()) {
            return $this->json(['error' => 'Nur wer die Gruppe angelegt hat, darf sie auflösen.'], 403);
        }
        $this->em->remove($group);
        $this->em->flush();

        return $this->json(['ok' => true]);
    }

    /** A group with all its boards. */
    #[Route('/{id}', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(int $id): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $group = $this->em->getRepository(FishGroup::class)->find($id);
        if ($group === null) {
            return $this->json(['error' => 'Gruppe nicht gefunden.'], 404);
        }
        // Open groups are visible to anyone, private ones only to members.
        $mine = $this->em->getRepository(GroupMember::class)->findOneBy(['group' => $group, 'user' => $me]);
        if ($mine === null && !$group->isOpen()) {
            return $this->json(['error' => 'Diese Gruppe ist privat.'], 403);
        }

        $members = [];
        foreach ($group->getMembers() as $m) {
            $u = $m->getUser();
            $p = $u->getProfile();
            $members[] = [
                'id' => $u->getId(),
                'name' => $u->getName(),
                'self' => $u->getId() === $me->getId(),
                'admin' => $u->getId() === $group->getOwner()->getId(),
                'hasProfile' => $p !== null,
                'fish' => $p?->getTotalFish() ?? 0,
                'bites' => $p?->getTotalBites() ?? 0,
                'weight' => $p ? round($p->getTotalWeight(), 2) : 0,
                'time' => $p?->getTotalTime() ?? 0,
                'score' => $p?->getPlayerScore() ?? 0,
                'level' => $p?->getPlayerLevel() ?? 0,
                'species' => $p?->getSpeciesCount() ?? 0,
                'fisheriesComplete' => $p?->getFisheriesComplete() ?? 0,
                'bigW' => $p ? round($p->getBiggestWeight(), 3) : 0,
                'bigWSpecies' => $p?->getBiggestWeightSpecies(),
                'bigL' => $p ? round($p->getBiggestLength(), 4) : 0,
                'bigLSpecies' => $p?->getBiggestLengthSpecies(),
                'topSpeciesWeight' => $p ? round($p->getTopSpeciesWeight(), 3) : 0,
                'topSpeciesKey' => $p?->getTopSpeciesKey(),
                'updatedAt' => $p?->getUpdatedAt()->format(\DateTimeInterface::ATOM),
            ];
        }

        $boards = [
            'biggestFish' => $this->rank($members, 'bigW', 'bigWSpecies'),
            'longestFish' => $this->rank($members, 'bigL', 'bigLSpecies'),
            'totalWeight' => $this->rank($members, 'weight'),
            'topSpeciesWeight' => $this->rank($members, 'topSpeciesWeight', 'topSpeciesKey'),
            'species' => $this->rank($members, 'species'),
            'fisheriesComplete' => $this->rank($members, 'fisheriesComplete'),
            'fish' => $this->rank($members, 'fish'),
            'time' => $this->rank($members, 'time'),
        ];

        return $this->json([
            'group' => self::groupPayload($group, $me, $mine !== null),
            'members' => $members,
            'boards' => $boards,
            'meta' => [
                'totalSpecies' => $this->game->totalSpecies(),
                'totalFisheries' => $this->game->totalFisheries(),
                'speciesNames' => $this->speciesNamesFor($members),
            ],
        ]);
    }

    /** @param array<int, array<string, mixed>> $members */
    private function rank(array $members, string $field, ?string $labelField = null): array
    {
        $rows = array_values(array_filter($members, static fn ($m) => ($m[$field] ?? 0) > 0));
        usort($rows, static fn ($a, $b) => $b[$field] <=> $a[$field]);

        return array_map(static fn ($m) => [
            'id' => $m['id'],
            'name' => $m['name'],
            'self' => $m['self'],
            'value' => $m[$field],
            'label' => $labelField ? ($m[$labelField] ?? null) : null,
        ], \array_slice($rows, 0, 20));
    }

    /** Only the species that appear in the boards – keeps the answer small. */
    private function speciesNamesFor(array $members): array
    {
        $keys = [];
        foreach ($members as $m) {
            foreach (['bigWSpecies', 'bigLSpecies', 'topSpeciesKey'] as $f) {
                if (!empty($m[$f])) {
                    $keys[$m[$f]] = true;
                }
            }
        }
        $out = [];
        foreach (array_keys($keys) as $k) {
            $out[$k] = $this->game->speciesName($k);
        }

        return $out;
    }
}
