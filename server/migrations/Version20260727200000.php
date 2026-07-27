<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Sichtbarkeit von Gruppen: öffentlich (steht im Verzeichnis, Beitritt für
 * jeden), nicht gelistet (nur über Link oder Code) und privat (nur Mitglieder
 * sehen sie). Bestehende Gruppen bleiben privat – so, wie sie angelegt wurden.
 */
final class Version20260727200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Gruppen bekommen eine Sichtbarkeit.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE fish_group ADD visibility VARCHAR(10) DEFAULT 'private' NOT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fish_group DROP visibility');
    }
}
