<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * Genau ein Profil je Konto. Ein Spielstand-Import überschreibt es vollständig;
 * die Kennzahlen liegen zusätzlich als Spalten vor, damit Ranglisten in SQL
 * ohne JSON-Auswertung laufen.
 */
#[ORM\Entity]
#[ORM\Table(name: 'profile')]
class Profile
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\OneToOne(inversedBy: 'profile', targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 60)]
    private string $anglerName = '';

    #[ORM\Column] private int $playerLevel = 0;
    #[ORM\Column] private int $playerScore = 0;

    #[ORM\Column] private int $totalFish = 0;
    #[ORM\Column] private int $totalBites = 0;
    #[ORM\Column(type: 'float')] private float $totalWeight = 0;
    #[ORM\Column] private int $totalTime = 0;

    #[ORM\Column] private int $speciesCount = 0;
    #[ORM\Column] private int $fisheriesComplete = 0;

    #[ORM\Column(type: 'float')] private float $biggestWeight = 0;
    #[ORM\Column(length: 60, nullable: true)] private ?string $biggestWeightSpecies = null;
    #[ORM\Column(type: 'float')] private float $biggestLength = 0;
    #[ORM\Column(length: 60, nullable: true)] private ?string $biggestLengthSpecies = null;

    /** Schwerste Gesamtmasse einer einzelnen Art. */
    #[ORM\Column(type: 'float')] private float $topSpeciesWeight = 0;
    #[ORM\Column(length: 60, nullable: true)] private ?string $topSpeciesKey = null;

    /** Rohdaten des Imports, für spätere Auswertungen. */
    #[ORM\Column(type: 'json')] private array $fisheries = [];
    #[ORM\Column(type: 'json')] private array $caught = [];

    /**
     * Alles zum Angler, was über Name, Stufe und Punkte hinausgeht: Geld,
     * Erfahrung, Glück, Kraft, die fünf Rutensets und die gekaufte Ausrüstung.
     * Damit lässt sich der Stand im Browser vollständig wiederherstellen.
     */
    #[ORM\Column(type: 'json')] private array $details = [];

    #[ORM\Column] private \DateTimeImmutable $updatedAt;

    /** @var Collection<int, ProfileSpecies> */
    #[ORM\OneToMany(mappedBy: 'profile', targetEntity: ProfileSpecies::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $species;

    public function __construct(User $user)
    {
        $this->user = $user;
        $this->updatedAt = new \DateTimeImmutable();
        $this->species = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getUser(): User { return $this->user; }

    public function getAnglerName(): string { return $this->anglerName; }
    public function setAnglerName(string $v): void { $this->anglerName = $v; }
    public function getPlayerLevel(): int { return $this->playerLevel; }
    public function setPlayerLevel(int $v): void { $this->playerLevel = $v; }
    public function getPlayerScore(): int { return $this->playerScore; }
    public function setPlayerScore(int $v): void { $this->playerScore = $v; }

    public function getTotalFish(): int { return $this->totalFish; }
    public function setTotalFish(int $v): void { $this->totalFish = $v; }
    public function getTotalBites(): int { return $this->totalBites; }
    public function setTotalBites(int $v): void { $this->totalBites = $v; }
    public function getTotalWeight(): float { return $this->totalWeight; }
    public function setTotalWeight(float $v): void { $this->totalWeight = $v; }
    public function getTotalTime(): int { return $this->totalTime; }
    public function setTotalTime(int $v): void { $this->totalTime = $v; }

    public function getSpeciesCount(): int { return $this->speciesCount; }
    public function setSpeciesCount(int $v): void { $this->speciesCount = $v; }
    public function getFisheriesComplete(): int { return $this->fisheriesComplete; }
    public function setFisheriesComplete(int $v): void { $this->fisheriesComplete = $v; }

    public function getBiggestWeight(): float { return $this->biggestWeight; }
    public function setBiggestWeight(float $v): void { $this->biggestWeight = $v; }
    public function getBiggestWeightSpecies(): ?string { return $this->biggestWeightSpecies; }
    public function setBiggestWeightSpecies(?string $v): void { $this->biggestWeightSpecies = $v; }
    public function getBiggestLength(): float { return $this->biggestLength; }
    public function setBiggestLength(float $v): void { $this->biggestLength = $v; }
    public function getBiggestLengthSpecies(): ?string { return $this->biggestLengthSpecies; }
    public function setBiggestLengthSpecies(?string $v): void { $this->biggestLengthSpecies = $v; }

    public function getTopSpeciesWeight(): float { return $this->topSpeciesWeight; }
    public function setTopSpeciesWeight(float $v): void { $this->topSpeciesWeight = $v; }
    public function getTopSpeciesKey(): ?string { return $this->topSpeciesKey; }
    public function setTopSpeciesKey(?string $v): void { $this->topSpeciesKey = $v; }

    public function getFisheries(): array { return $this->fisheries; }
    public function setFisheries(array $v): void { $this->fisheries = $v; }
    public function getCaught(): array { return $this->caught; }
    public function setCaught(array $v): void { $this->caught = $v; }
    public function getDetails(): array { return $this->details; }
    public function setDetails(array $v): void { $this->details = $v; }

    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
    public function touch(): void { $this->updatedAt = new \DateTimeImmutable(); }

    /** @return Collection<int, ProfileSpecies> */
    public function getSpecies(): Collection { return $this->species; }
    public function clearSpecies(): void { $this->species->clear(); }
    public function addSpecies(ProfileSpecies $s): void { $this->species->add($s); }
}
