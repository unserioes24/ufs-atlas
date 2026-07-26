<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Ein Konto folgt einem anderen; Grundlage für den direkten Vergleich. */
#[ORM\Entity]
#[ORM\Table(name: 'follow')]
#[ORM\UniqueConstraint(name: 'uniq_follow', columns: ['follower_id', 'followed_id'])]
class Follow
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'follower_id', nullable: false, onDelete: 'CASCADE')]
    private User $follower;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'followed_id', nullable: false, onDelete: 'CASCADE')]
    private User $followed;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(User $follower, User $followed)
    {
        $this->follower = $follower;
        $this->followed = $followed;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getFollower(): User { return $this->follower; }
    public function getFollowed(): User { return $this->followed; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
