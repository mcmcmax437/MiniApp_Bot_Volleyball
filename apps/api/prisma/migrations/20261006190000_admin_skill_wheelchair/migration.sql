-- Admin can lock a user's displayed skill score and/or show a wheelchair
-- icon in the skill badge instead of S1–S6.

ALTER TABLE `User`
  ADD COLUMN `skillLockedByAdmin` BOOLEAN NOT NULL DEFAULT false AFTER `evaluatedAt`,
  ADD COLUMN `showWheelchairBadge` BOOLEAN NOT NULL DEFAULT false AFTER `skillLockedByAdmin`;
