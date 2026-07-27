<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'app_user')]
#[ORM\UniqueConstraint(name: 'uniq_email', columns: ['email'])]
#[ORM\UniqueConstraint(name: 'uniq_name', columns: ['name'])]
class User
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    private string $email;

    /** Eindeutiger Anzeigename; wird beim Spielstand-Import vorbelegt. */
    #[ORM\Column(length: 60)]
    private string $name;

    /**
     * Hat sich das Konto den Namen selbst ausgesucht? Solange nicht, darf ein
     * Spielstand-Import den zufällig vergebenen Namen durch den Anglernamen
     * aus dem Spiel ersetzen.
     */
    #[ORM\Column(options: ['default' => false])]
    private bool $namePicked = false;

    /** Für den Upload per curl/Aufgabenplanung, ohne Sitzung. */
    #[ORM\Column(length: 64, unique: true)]
    private string $apiToken;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $lastLoginAt = null;

    /**
     * „Angemeldet bleiben“: nur der Hash des Kekswerts wird gespeichert, und
     * bei jedem Einsatz durch einen neuen ersetzt.
     */
    #[ORM\Column(length: 64, nullable: true)]
    private ?string $rememberHash = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $rememberUntil = null;

    #[ORM\OneToOne(mappedBy: 'user', targetEntity: Profile::class, cascade: ['persist', 'remove'])]
    private ?Profile $profile = null;

    /** @var Collection<int, GroupMember> */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: GroupMember::class, cascade: ['persist', 'remove'])]
    private Collection $memberships;

    public function __construct(string $email, string $name)
    {
        $this->email = $email;
        $this->name = $name;
        $this->apiToken = bin2hex(random_bytes(24));
        $this->createdAt = new \DateTimeImmutable();
        $this->memberships = new ArrayCollection();
    }

    public function getApiToken(): string { return $this->apiToken; }
    public function regenerateApiToken(): void { $this->apiToken = bin2hex(random_bytes(24)); }

    public function getId(): ?int { return $this->id; }
    public function getEmail(): string { return $this->email; }
    public function getName(): string { return $this->name; }
    public function setName(string $n, bool $picked = false): void
    {
        $this->name = $n;
        if ($picked) {
            $this->namePicked = true;
        }
    }
    public function isNamePicked(): bool { return $this->namePicked; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getLastLoginAt(): ?\DateTimeImmutable { return $this->lastLoginAt; }
    public function touchLogin(): void { $this->lastLoginAt = new \DateTimeImmutable(); }

    public function getRememberHash(): ?string { return $this->rememberHash; }
    public function getRememberUntil(): ?\DateTimeImmutable { return $this->rememberUntil; }
    public function setRemember(string $hash, \DateTimeImmutable $until): void
    {
        $this->rememberHash = $hash;
        $this->rememberUntil = $until;
    }
    public function clearRemember(): void
    {
        $this->rememberHash = null;
        $this->rememberUntil = null;
    }

    public function getProfile(): ?Profile { return $this->profile; }
    public function setProfile(?Profile $p): void { $this->profile = $p; }

    /** @return Collection<int, GroupMember> */
    public function getMemberships(): Collection { return $this->memberships; }
}
