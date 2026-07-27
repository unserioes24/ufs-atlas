<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * One-time login code. Only the hash is stored; expired or used codes are
 * cleaned up the next time one is sent.
 */
#[ORM\Entity]
#[ORM\Table(name: 'login_code')]
#[ORM\Index(name: 'idx_email', columns: ['email'])]
class LoginCode
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    private string $email;

    #[ORM\Column(length: 255)]
    private string $codeHash;

    #[ORM\Column]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column]
    private int $attempts = 0;

    #[ORM\Column]
    private bool $used = false;

    public function __construct(string $email, string $codeHash, \DateTimeImmutable $expiresAt)
    {
        $this->email = $email;
        $this->codeHash = $codeHash;
        $this->expiresAt = $expiresAt;
    }

    public function getId(): ?int { return $this->id; }
    public function getEmail(): string { return $this->email; }
    public function getCodeHash(): string { return $this->codeHash; }
    public function getExpiresAt(): \DateTimeImmutable { return $this->expiresAt; }
    public function isExpired(): bool { return $this->expiresAt < new \DateTimeImmutable(); }
    public function getAttempts(): int { return $this->attempts; }
    public function addAttempt(): void { $this->attempts++; }
    public function isUsed(): bool { return $this->used; }
    public function markUsed(): void { $this->used = true; }
}
