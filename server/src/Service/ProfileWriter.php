<?php

namespace App\Service;

use App\Entity\Profile;
use App\Entity\ProfileSpecies;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/** Schreibt das Ergebnis eines Spielstand-Imports in das Profil eines Kontos. */
final class ProfileWriter
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Names $names,
    ) {
    }

    public function flush(): void
    {
        $this->em->flush();
    }

    /** Überschreibt das Profil vollständig. */
    public function store(User $user, array $agg): Profile
    {
        $profile = $user->getProfile();
        if ($profile === null) {
            $profile = new Profile($user);
            $user->setProfile($profile);
            $this->em->persist($profile);
        } else {
            // Artenzeilen ersetzen statt ergänzen: ein Import ist die neue Wahrheit
            foreach ($profile->getSpecies() as $old) {
                $this->em->remove($old);
            }
            $profile->clearSpecies();
            $this->em->flush();
        }

        $name = trim((string) ($agg['player']['name'] ?? ''));
        if ($name !== '') {
            $profile->setAnglerName($name);
            // Nur einen noch nie gewählten Namen überschreiben; er muss eindeutig bleiben.
            if ($user->getName() === '' || preg_match('/^Angler(-\d+|-[0-9a-f]{8})?$/', $user->getName())) {
                $user->setName($this->names->unique($name, $user));
            }
        }
        $profile->setPlayerLevel((int) ($agg['player']['level'] ?? 0));
        $profile->setPlayerScore((int) ($agg['player']['score'] ?? 0));

        $profile->setTotalFish((int) ($agg['totals']['fish'] ?? 0));
        $profile->setTotalBites((int) ($agg['totals']['bites'] ?? 0));
        $profile->setTotalWeight((float) ($agg['totals']['weight'] ?? 0));
        $profile->setTotalTime((int) ($agg['totals']['time'] ?? 0));

        $profile->setSpeciesCount((int) ($agg['speciesCount'] ?? 0));
        $profile->setFisheriesComplete((int) ($agg['fisheriesComplete'] ?? 0));

        $profile->setBiggestWeight((float) ($agg['biggest']['weight'] ?? 0));
        $profile->setBiggestWeightSpecies($agg['biggest']['weightSpecies'] ?? null);
        $profile->setBiggestLength((float) ($agg['biggest']['length'] ?? 0));
        $profile->setBiggestLengthSpecies($agg['biggest']['lengthSpecies'] ?? null);

        $profile->setTopSpeciesWeight((float) ($agg['topSpecies']['weight'] ?? 0));
        $profile->setTopSpeciesKey($agg['topSpecies']['key'] ?? null);

        $profile->setFisheries($agg['fisheries'] ?? []);
        $profile->setCaught(array_keys($agg['species'] ?? []));
        $profile->touch();

        foreach (($agg['species'] ?? []) as $key => $s) {
            $row = new ProfileSpecies($profile, (string) $key);
            $row->setCount((int) $s['count']);
            $row->setBestWeight((float) $s['best']);
            $row->setBestLength((float) $s['length']);
            $row->setSumWeight((float) $s['sum']);
            $row->setFishery($s['fishery'] ?? null);
            $profile->addSpecies($row);
            $this->em->persist($row);
        }

        $this->em->flush();

        return $profile;
    }
}
