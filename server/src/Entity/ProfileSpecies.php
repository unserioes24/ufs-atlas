<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Eine Zeile je gefangener Art – Grundlage aller Arten-Ranglisten. */
#[ORM\Entity]
#[ORM\Table(name: 'profile_species')]
#[ORM\Index(name: 'idx_species', columns: ['species_key'])]
#[ORM\Index(name: 'idx_best_weight', columns: ['best_weight'])]
class ProfileSpecies
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'species', targetEntity: Profile::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Profile $profile;

    #[ORM\Column(name: 'species_key', length: 60)]
    private string $speciesKey;

    #[ORM\Column] private int $count = 0;
    #[ORM\Column(name: 'best_weight', type: 'float')] private float $bestWeight = 0;
    #[ORM\Column(type: 'float')] private float $bestLength = 0;
    #[ORM\Column(type: 'float')] private float $sumWeight = 0;
    #[ORM\Column(length: 80, nullable: true)] private ?string $fishery = null;

    public function __construct(Profile $profile, string $key)
    {
        $this->profile = $profile;
        $this->speciesKey = $key;
    }

    public function getProfile(): Profile { return $this->profile; }
    public function getSpeciesKey(): string { return $this->speciesKey; }
    public function getCount(): int { return $this->count; }
    public function setCount(int $v): void { $this->count = $v; }
    public function getBestWeight(): float { return $this->bestWeight; }
    public function setBestWeight(float $v): void { $this->bestWeight = $v; }
    public function getBestLength(): float { return $this->bestLength; }
    public function setBestLength(float $v): void { $this->bestLength = $v; }
    public function getSumWeight(): float { return $this->sumWeight; }
    public function setSumWeight(float $v): void { $this->sumWeight = $v; }
    public function getFishery(): ?string { return $this->fishery; }
    public function setFishery(?string $v): void { $this->fishery = $v; }
}
