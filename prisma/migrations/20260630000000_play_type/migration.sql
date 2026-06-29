-- ============================================================================
-- Migration: PlayType — surface enum for games
--
-- Adds a `playType` enum column (INDOOR / OUTDOOR / BEACH) on `Game`, with
-- a default of OUTDOOR for back-compat with rows created before this column
-- existed.
--
-- The enum is declared inline on the column. MySQL stores ENUM values as
-- 1-based ordinals so adding new values at the end of the list is safe; do
-- not reorder the existing values without a follow-up data migration.
-- ============================================================================

-- 1. Add the column nullable so the ALTER works on the existing rows.
ALTER TABLE `Game`
  ADD COLUMN `playType` ENUM('INDOOR','OUTDOOR','BEACH') NULL,
  ADD INDEX  `Game_playType_idx` (`playType`);

-- 2. Backfill existing games with the safe default (OUTDOOR) before locking
--    the column NOT NULL.
UPDATE `Game` SET `playType` = 'OUTDOOR' WHERE `playType` IS NULL;

-- 3. Lock the default and NOT NULL so future inserts always carry a value.
ALTER TABLE `Game`
  MODIFY COLUMN `playType` ENUM('INDOOR','OUTDOOR','BEACH') NOT NULL DEFAULT 'OUTDOOR';