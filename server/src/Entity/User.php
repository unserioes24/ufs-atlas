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

    /** Für den Upload per curl/Aufgabenplanung, ohne Sitzung. */
    #[ORM\Column(length: 64, unique: true)]
    private string $apiToken;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $lastLoginAt = null;

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
    public function setName(string $n): void { $this->name = $n; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getLastLoginAt(): ?\DateTimeImmutable { return $this->lastLoginAt; }
    public function touchLogin(): void { $this->lastLoginAt = new \DateTimeImmutable(); }
    public function getProfile(): ?Profile { return $this->profile; }
    public function setProfile(?Profile $p): void { $this->profile = $p; }

    /** @return Collection<int, GroupMember> */
    public function getMemberships(): Collection { return $this->memberships; }
}
