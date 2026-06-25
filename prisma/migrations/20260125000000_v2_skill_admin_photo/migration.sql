-- ============================================================================
-- Migration: v2 — 6-level skill enum, admin role, photo URL, audit log
--
-- This migration is hand-written so it is safe to run against a database
-- that already has the v1 schema (SkillLevel = BEGINNER/INTERMEDIATE/ADVANCED/
-- PRO). MySQL doesn't support ALTER TYPE directly, so we create a new column
-- with the new enum, copy data across, then drop the old column and rename.
--
-- The `skillLevel` column on User is nullable, so the copy is data-preserving.
-- On Game, all existing rows have a value (NOT NULL), so we map them all.
-- ============================================================================

-- ---------- 1. New SkillLevel enum values ----------
-- MySQL's ENUM type stores the allowed values on the column itself, so the
-- only way to "rename" an enum value is to ALTER the column. To preserve
-- existing data, we go through a temporary column.
ALTER TABLE `User` ADD COLUMN `skillLevel_new` ENUM('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5','LEVEL_6') NULL;
ALTER TABLE `Game` ADD COLUMN `skillLevel_new` ENUM('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5','LEVEL_6') NOT NULL;

-- Map old values → new values
UPDATE `User` SET `skillLevel_new` = 'LEVEL_1' WHERE `skillLevel` = 'BEGINNER';
UPDATE `User` SET `skillLevel_new` = 'LEVEL_3' WHERE `skillLevel` = 'INTERMEDIATE';
UPDATE `User` SET `skillLevel_new` = 'LEVEL_4' WHERE `skillLevel` = 'ADVANCED';
UPDATE `User` SET `skillLevel_new` = 'LEVEL_6' WHERE `skillLevel` = 'PRO';

UPDATE `Game` SET `skillLevel_new` = 'LEVEL_1' WHERE `skillLevel` = 'BEGINNER';
UPDATE `Game` SET `skillLevel_new` = 'LEVEL_3' WHERE `skillLevel` = 'INTERMEDIATE';
UPDATE `Game` SET `skillLevel_new` = 'LEVEL_4' WHERE `skillLevel` = 'ADVANCED';
UPDATE `Game` SET `skillLevel_new` = 'LEVEL_6' WHERE `skillLevel` = 'PRO';

-- Drop the old column, rename the new one
ALTER TABLE `User` DROP COLUMN `skillLevel`;
ALTER TABLE `User` CHANGE COLUMN `skillLevel_new` `skillLevel` ENUM('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5','LEVEL_6') NULL;

ALTER TABLE `Game` DROP COLUMN `skillLevel`;
ALTER TABLE `Game` CHANGE COLUMN `skillLevel_new` `skillLevel` ENUM('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5','LEVEL_6') NOT NULL;

-- ---------- 2. photoUrl ----------
ALTER TABLE `User` ADD COLUMN `photoUrl` VARCHAR(191) NULL;

-- ---------- 3. role (USER default, ADMIN explicit) ----------
ALTER TABLE `User` ADD COLUMN `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER';
CREATE INDEX `User_role_idx` ON `User`(`role`);

-- ---------- 4. AuditLog ----------
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AuditLog_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey`
    FOREIGN KEY (`actorId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- 5. Add Game.hostId index (matches the schema) ----------
CREATE INDEX `Game_hostId_idx` ON `Game`(`hostId`);

-- ---------- 6. Add Venue.status index (matches the schema) ----------
CREATE INDEX `Venue_status_idx` ON `Venue`(`status`);
