<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Profildetails aus dem Spielstand, „Angemeldet bleiben“ und die Frage, ob ein
 * Konto seinen Namen selbst gewählt hat.
 *
 * Neue Konten bekommen einen zufälligen Namen; solange niemand ihn geändert
 * hat, darf ein Spielstand-Import ihn durch den Anglernamen ersetzen. Für die
 * Konten, die es schon gibt, gilt jeder Name als selbst gewählt – außer den
 * alten Platzhaltern „Angler…“.
 */
final class Version20260727091500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Profildetails, Angemeldet-bleiben und selbst gewählte Namen.';
    }

    public function up(Schema $schema): void
    {
        // In drei Schritten, weil MariaDB eine JSON-Spalte nicht mit leerem
        // Inhalt anlegen darf: erst zulassen, füllen, dann festschreiben.
        $this->addSql('ALTER TABLE profile ADD details JSON DEFAULT NULL');
        $this->addSql("UPDATE profile SET details = '{}' WHERE details IS NULL");
        $this->addSql('ALTER TABLE profile MODIFY details JSON NOT NULL');

        $this->addSql('ALTER TABLE app_user ADD remember_hash VARCHAR(64) DEFAULT NULL');
        $this->addSql("ALTER TABLE app_user ADD remember_until DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        $this->addSql('ALTER TABLE app_user ADD name_picked TINYINT(1) DEFAULT 0 NOT NULL');

        $this->addSql("UPDATE app_user SET name_picked = 1 WHERE name NOT LIKE 'Angler%'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE app_user DROP name_picked');
        $this->addSql('ALTER TABLE app_user DROP remember_until');
        $this->addSql('ALTER TABLE app_user DROP remember_hash');
        $this->addSql('ALTER TABLE profile DROP details');
    }
}
