<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'group_member')]
#[ORM\UniqueConstraint(name: 'uniq_group_user', columns: ['group_id', 'user_id'])]
class GroupMember
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'members', targetEntity: FishGroup::class)]
    #[ORM\JoinColumn(name: 'group_id', nullable: false, onDelete: 'CASCADE')]
    private FishGroup $group;

    #[ORM\ManyToOne(inversedBy: 'memberships', targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column]
    private \DateTimeImmutable $joinedAt;

    public function __construct(FishGroup $group, User $user)
    {
        $this->group = $group;
        $this->user = $user;
        $this->joinedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getGroup(): FishGroup { return $this->group; }
    public function getUser(): User { return $this->user; }
    public function getJoinedAt(): \DateTimeImmutable { return $this->joinedAt; }
}
