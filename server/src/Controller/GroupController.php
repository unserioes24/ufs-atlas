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
            $g = $m->getGroup();
            $out[] = [
                'id' => $g->getId(),
                'name' => $g->getName(),
                'code' => $g->getJoinCode(),
                'members' => \count($g->getMembers()),
                'owner' => $g->getOwner()->getId() === $me->getId(),
            ];
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

        // Kurzer, gut vorlesbarer Code ohne leicht verwechselbare Zeichen
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $code = '';
            for ($i = 0; $i < 6; $i++) {
                $code .= $alphabet[random_int(0, \strlen($alphabet) - 1)];
            }
            $taken = $this->em->getRepository(FishGroup::class)->findOneBy(['joinCode' => $code]);
        } while ($taken !== null);

        $group = new FishGroup($name, $code, $me);
        $this->em->persist($group);
        $member = new GroupMember($group, $me);
        $this->em->persist($member);
        $this->em->flush();

        return $this->json(['ok' => true, 'group' => ['id' => $group->getId(), 'name' => $name, 'code' => $code]]);
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
        $group = $this->em->getRepository(FishGroup::class)->findOneBy(['joinCode' => $code]);
        if ($group === null) {
            return $this->json(['error' => 'Zu diesem Code gibt es keine Gruppe.'], 404);
        }
        $existing = $this->em->getRepository(GroupMember::class)->findOneBy(['group' => $group, 'user' => $me]);
        if ($existing === null) {
            $this->em->persist(new GroupMember($group, $me));
            $this->em->flush();
        }

        return $this->json(['ok' => true, 'group' => ['id' => $group->getId(), 'name' => $group->getName()]]);
    }

    #[Route('/{id}/leave', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function leave(int $id): JsonResponse
    {
        $me = $this->requireUser();
        if ($me === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $group = $this->em->getRepository(FishGroup::class)->find($id);
        $member = $group ? $this->em->getRepository(GroupMember::class)->findOneBy(['group' => $group, 'user' => $me]) : null;
        if ($member !== null) {
            $this->em->remove($member);
            $this->em->flush();
        }

        return $this->json(['ok' => true]);
    }

    /** Gruppe mit allen Ranglisten. */
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
        $mine = $this->em->getRepository(GroupMember::class)->findOneBy(['group' => $group, 'user' => $me]);
        if ($mine === null) {
            return $this->json(['error' => 'Du bist kein Mitglied dieser Gruppe.'], 403);
        }

        $members = [];
        foreach ($group->getMembers() as $m) {
            $u = $m->getUser();
            $p = $u->getProfile();
            $members[] = [
                'id' => $u->getId(),
                'name' => $u->getName(),
                'self' => $u->getId() === $me->getId(),
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
            'group' => [
                'id' => $group->getId(),
                'name' => $group->getName(),
                'code' => $group->getJoinCode(),
                'owner' => $group->getOwner()->getId() === $me->getId(),
            ],
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

    /** Nur die Arten, die in den Ranglisten vorkommen – hält die Antwort klein. */
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
