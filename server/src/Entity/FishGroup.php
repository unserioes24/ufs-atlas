<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/** Gruppe von Anglern; Beitritt über einen kurzen Code. */
#[ORM\Entity]
#[ORM\Table(name: 'fish_group')]
#[ORM\UniqueConstraint(name: 'uniq_join_code', columns: ['join_code'])]
class FishGroup
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 60)]
    private string $name;

    #[ORM\Column(name: 'join_code', length: 12)]
    private string $joinCode;

    /**
     * Wer die Gruppe sehen und ihr beitreten darf:
     *
     *   public   im Verzeichnis sichtbar, Beitritt für jeden
     *   unlisted nicht im Verzeichnis, aber über Link oder Code offen
     *   private  nur Mitglieder sehen sie, Beitritt nur über den Code
     */
    public const VISIBILITIES = ['public', 'unlisted', 'private'];

    #[ORM\Column(length: 10, options: ['default' => 'private'])]
    private string $visibility = 'private';

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $owner;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, GroupMember> */
    #[ORM\OneToMany(mappedBy: 'group', targetEntity: GroupMember::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $members;

    public function __construct(string $name, string $joinCode, User $owner)
    {
        $this->name = $name;
        $this->joinCode = $joinCode;
        $this->owner = $owner;
        $this->createdAt = new \DateTimeImmutable();
        $this->members = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $v): void { $this->name = $v; }
    public function getJoinCode(): string { return $this->joinCode; }
    public function regenerateJoinCode(string $code): void { $this->joinCode = $code; }

    public function getVisibility(): string { return $this->visibility; }
    public function setVisibility(string $v): void
    {
        $this->visibility = \in_array($v, self::VISIBILITIES, true) ? $v : 'private';
    }
    /** Öffentlich und nicht gelistet stehen jedem offen, privat nur über den Code. */
    public function isOpen(): bool { return $this->visibility !== 'private'; }
    public function getOwner(): User { return $this->owner; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    /** @return Collection<int, GroupMember> */
    public function getMembers(): Collection { return $this->members; }
    public function addMember(GroupMember $m): void { $this->members->add($m); }
}
