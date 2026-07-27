<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Ausgangsstand: das Schema, wie es bis hierher aus den Entities abgeleitet
 * wurde. Auf einer bestehenden Datenbank wird diese Fassung beim ersten Start
 * nur verbucht, nicht ausgeführt – die Tabellen stehen dort längst.
 */
final class Version20260727090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ausgangsstand: Konten, Profile, Arten, Anmeldecodes, Gruppen und Folgen.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE app_user (
                id INT AUTO_INCREMENT NOT NULL,
                email VARCHAR(180) NOT NULL,
                name VARCHAR(60) NOT NULL,
                api_token VARCHAR(64) NOT NULL,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                last_login_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX uniq_email (email),
                UNIQUE INDEX uniq_name (name),
                UNIQUE INDEX uniq_user_api_token (api_token),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE login_code (
                id INT AUTO_INCREMENT NOT NULL,
                email VARCHAR(180) NOT NULL,
                code_hash VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                attempts INT NOT NULL,
                used TINYINT(1) NOT NULL,
                INDEX idx_email (email),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE profile (
                id INT AUTO_INCREMENT NOT NULL,
                user_id INT NOT NULL,
                angler_name VARCHAR(60) NOT NULL,
                player_level INT NOT NULL,
                player_score INT NOT NULL,
                total_fish INT NOT NULL,
                total_bites INT NOT NULL,
                total_weight DOUBLE PRECISION NOT NULL,
                total_time INT NOT NULL,
                species_count INT NOT NULL,
                fisheries_complete INT NOT NULL,
                biggest_weight DOUBLE PRECISION NOT NULL,
                biggest_weight_species VARCHAR(60) DEFAULT NULL,
                biggest_length DOUBLE PRECISION NOT NULL,
                biggest_length_species VARCHAR(60) DEFAULT NULL,
                top_species_weight DOUBLE PRECISION NOT NULL,
                top_species_key VARCHAR(60) DEFAULT NULL,
                fisheries JSON NOT NULL,
                caught JSON NOT NULL,
                updated_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX uniq_profile_user (user_id),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE profile_species (
                id INT AUTO_INCREMENT NOT NULL,
                profile_id INT NOT NULL,
                species_key VARCHAR(60) NOT NULL,
                `count` INT NOT NULL,
                best_weight DOUBLE PRECISION NOT NULL,
                best_length DOUBLE PRECISION NOT NULL,
                sum_weight DOUBLE PRECISION NOT NULL,
                fishery VARCHAR(80) DEFAULT NULL,
                INDEX idx_species (species_key),
                INDEX idx_best_weight (best_weight),
                INDEX idx_profile_species_profile (profile_id),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE fish_group (
                id INT AUTO_INCREMENT NOT NULL,
                owner_id INT NOT NULL,
                name VARCHAR(60) NOT NULL,
                join_code VARCHAR(12) NOT NULL,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX uniq_join_code (join_code),
                INDEX idx_fish_group_owner (owner_id),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE group_member (
                id INT AUTO_INCREMENT NOT NULL,
                group_id INT NOT NULL,
                user_id INT NOT NULL,
                joined_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX uniq_group_user (group_id, user_id),
                INDEX idx_group_member_user (user_id),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE follow (
                id INT AUTO_INCREMENT NOT NULL,
                follower_id INT NOT NULL,
                followed_id INT NOT NULL,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX uniq_follow (follower_id, followed_id),
                INDEX idx_follow_followed (followed_id),
                PRIMARY KEY (id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
            SQL);

        $this->addSql('ALTER TABLE profile ADD CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE profile_species ADD CONSTRAINT fk_profile_species_profile FOREIGN KEY (profile_id) REFERENCES profile (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE fish_group ADD CONSTRAINT fk_fish_group_owner FOREIGN KEY (owner_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE group_member ADD CONSTRAINT fk_group_member_group FOREIGN KEY (group_id) REFERENCES fish_group (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE group_member ADD CONSTRAINT fk_group_member_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE follow ADD CONSTRAINT fk_follow_follower FOREIGN KEY (follower_id) REFERENCES app_user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE follow ADD CONSTRAINT fk_follow_followed FOREIGN KEY (followed_id) REFERENCES app_user (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE follow DROP FOREIGN KEY fk_follow_followed');
        $this->addSql('ALTER TABLE follow DROP FOREIGN KEY fk_follow_follower');
        $this->addSql('ALTER TABLE group_member DROP FOREIGN KEY fk_group_member_user');
        $this->addSql('ALTER TABLE group_member DROP FOREIGN KEY fk_group_member_group');
        $this->addSql('ALTER TABLE fish_group DROP FOREIGN KEY fk_fish_group_owner');
        $this->addSql('ALTER TABLE profile_species DROP FOREIGN KEY fk_profile_species_profile');
        $this->addSql('ALTER TABLE profile DROP FOREIGN KEY fk_profile_user');
        $this->addSql('DROP TABLE follow');
        $this->addSql('DROP TABLE group_member');
        $this->addSql('DROP TABLE fish_group');
        $this->addSql('DROP TABLE profile_species');
        $this->addSql('DROP TABLE profile');
        $this->addSql('DROP TABLE login_code');
        $this->addSql('DROP TABLE app_user');
    }
}
