<?php

namespace App\Controller;

use App\Service\Auth;
use App\Service\GameData;
use App\Service\LocalImport;
use App\Service\Names;
use App\Service\ProfileWriter;
use App\Service\SaveParser;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/profile')]
class ProfileController extends AbstractController
{
    public function __construct(
        private readonly Auth $auth,
        private readonly SaveParser $parser,
        private readonly ProfileWriter $writer,
        private readonly GameData $game,
        private readonly LocalImport $local,
        private readonly Names $names,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function show(): JsonResponse
    {
        $user = $this->auth->user();
        if ($user === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }

        return $this->json([
            'user' => UserController::userPayload($user, true),
            'profile' => UserController::profilePayload($user->getProfile()),
        ]);
    }

    /**
     * Upload a save file. The body is the PROFILE_x file itself – either as
     * the multipart field "file" or as raw bytes.
     *
     * Authenticated by session or by the X-Api-Token header, so the upload can
     * also run from a scheduled task:
     *
     *   curl -H "X-Api-Token: ..." --data-binary "@PROFILE_0" \
     *        https://ufs-atlas.de/api/profile/upload
     */
    /**
     * The full state in the shape the browser keeps locally.
     *
     * When a save file is uploaded through the API the browser knows nothing
     * about it. On the next load it fetches the state here and adopts it if it
     * is newer than its own.
     */
    #[Route('/state', methods: ['GET'])]
    public function state(): JsonResponse
    {
        $user = $this->auth->user();
        if ($user === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $profile = $user->getProfile();
        if ($profile === null) {
            return $this->json(['state' => null]);
        }

        $caught = [];
        $bests = [];
        foreach ($profile->getSpecies() as $s) {
            $key = $s->getSpeciesKey();
            $caught[$key] = true;
            $bests[$key] = [
                'count' => $s->getCount(),
                'weight' => $s->getBestWeight(),
                'length' => $s->getBestLength(),
                'sum' => $s->getSumWeight(),
                'fishery' => $s->getFishery(),
            ];
        }

        $player = $profile->getDetails();
        $player['name'] = $profile->getAnglerName();
        $player['level'] = $profile->getPlayerLevel();
        $player['score'] = $profile->getPlayerScore();

        return $this->json([
            'state' => [
                'updatedAt' => $profile->getUpdatedAt()->format(\DateTimeInterface::ATOM),
                'caught' => $caught,
                'bests' => $bests,
                'stats' => [
                    'player' => $player,
                    'fisheries' => $profile->getFisheries(),
                    'bests' => $bests,
                    'total' => \count($caught),
                ],
            ],
        ]);
    }

    #[Route('/upload', methods: ['POST', 'PUT'])]
    public function upload(Request $request): JsonResponse
    {
        $user = $this->auth->userOrToken();
        if ($user === null) {
            return $this->json(['error' => 'Nicht angemeldet und kein gültiger API-Token.'], 401);
        }

        $file = $request->files->get('file');
        $bytes = $file !== null ? (string) file_get_contents($file->getPathname()) : $request->getContent();
        if (\strlen($bytes) < 64) {
            return $this->json(['error' => 'Keine Spielstanddaten empfangen.'], 400);
        }
        if (\strlen($bytes) > 8 * 1024 * 1024) {
            return $this->json(['error' => 'Datei ist zu groß für einen Spielstand.'], 413);
        }

        $raw = $this->parser->parse($bytes);
        if (!isset($raw['playerName']) && !isset($raw['playersLevel'])) {
            return $this->json(['error' => 'Das sieht nicht nach einer PROFILE-Datei aus.'], 400);
        }

        $agg = $this->parser->aggregate(
            $raw,
            $this->game->species(),
            $this->game->fisherySpecies(),
            $this->game->fisherySaveKeys(),
        );
        $profile = $this->writer->store($user, $agg);

        return $this->json([
            'ok' => true,
            'user' => UserController::userPayload($user, true),
            'profile' => UserController::profilePayload($profile),
        ]);
    }

    /**
     * Take the state from the browser: ticked species plus the values of the
     * save file loaded locally last. Replaces the profile just as completely
     * as an upload does.
     */
    #[Route('/import', methods: ['POST'])]
    public function import(Request $request): JsonResponse
    {
        $user = $this->auth->user();
        if ($user === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $data = json_decode($request->getContent() ?: '{}', true);
        if (!\is_array($data)) {
            return $this->json(['error' => 'Konnte die lokalen Daten nicht lesen.'], 400);
        }
        $caught = \is_array($data['caught'] ?? null) ? $data['caught'] : [];
        $bests = \is_array($data['bests'] ?? null) ? $data['bests'] : [];
        if (!$caught && !$bests) {
            return $this->json(['error' => 'Lokal ist nichts gespeichert, das sich übernehmen ließe.'], 400);
        }

        $agg = $this->local->toAggregate($data, $this->game->species(), $this->game->fisherySpecies());
        $profile = $this->writer->store($user, $agg);

        return $this->json([
            'ok' => true,
            'user' => UserController::userPayload($user, true),
            'profile' => UserController::profilePayload($profile),
        ]);
    }

    /** The user name is unique – it is the address of the profile. */
    #[Route('/name', methods: ['POST'])]
    public function rename(Request $request): JsonResponse
    {
        $user = $this->auth->user();
        if ($user === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $data = json_decode($request->getContent() ?: '{}', true) ?: [];
        $name = $this->names->normalize((string) ($data['name'] ?? ''));
        if (!$this->names->isValid($name)) {
            return $this->json([
                'error' => sprintf(
                    'Der Name braucht %d bis %d Zeichen (Buchstaben, Ziffern, Leerzeichen, . _ -).',
                    Names::MIN,
                    Names::MAX,
                ),
            ], 400);
        }
        if (!$this->names->isFree($name, $user)) {
            return $this->json(['error' => 'Diesen Namen hat schon jemand.'], 409);
        }

        $user->setName($name, true);
        try {
            $this->writer->flush();
        } catch (UniqueConstraintViolationException) {
            return $this->json(['error' => 'Diesen Namen hat schon jemand.'], 409);
        }

        return $this->json(['ok' => true, 'user' => UserController::userPayload($user, true)]);
    }
}
