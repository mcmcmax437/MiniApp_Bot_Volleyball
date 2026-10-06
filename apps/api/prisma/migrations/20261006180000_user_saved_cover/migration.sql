-- Host's reusable court cover photo (one image, reused when creating games).

ALTER TABLE `User`
  ADD COLUMN `savedCoverImageUrl` VARCHAR(500) NULL AFTER `photoUrl`;
