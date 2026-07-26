<?php

namespace App\Controller;

use App\Service\Auth;
use App\Service\GameData;
use App\Service\ProfileWriter;
use App\Service\SaveParser;
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
     * Spielstand hochladen. Der Rumpf ist die PROFILE_x-Datei selbst –
     * entweder als multipart-Feld "file" oder direkt als Rohdaten.
     *
     * Anmeldung über die Sitzung oder den Header X-Api-Token, damit sich der
     * Upload auch per Aufgabenplanung erledigen lässt:
     *
     *   curl -H "X-Api-Token: ..." --data-binary "@PROFILE_0" \
     *        https://fish.tobee94.de/api/profile/upload
     */
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

    #[Route('/name', methods: ['POST'])]
    public function rename(Request $request): JsonResponse
    {
        $user = $this->auth->user();
        if ($user === null) {
            return $this->json(['error' => 'Nicht angemeldet.'], 401);
        }
        $data = json_decode($request->getContent() ?: '{}', true) ?: [];
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 60) {
            return $this->json(['error' => 'Name muss zwischen 1 und 60 Zeichen lang sein.'], 400);
        }
        $user->setName($name);
        $this->writer->flush();

        return $this->json(['ok' => true, 'user' => UserController::userPayload($user, true)]);
    }
}
