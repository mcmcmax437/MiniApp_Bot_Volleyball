-- Session context for admin engagement breakdowns.
ALTER TABLE `AppSession` ADD COLUMN `platform` VARCHAR(191) NULL;
ALTER TABLE `AppSession` ADD COLUMN `language` VARCHAR(191) NULL;
ALTER TABLE `AppSession` ADD COLUMN `city` VARCHAR(191) NULL;

CREATE INDEX `AppSession_platform_idx` ON `AppSession`(`platform`);
CREATE INDEX `AppSession_language_idx` ON `AppSession`(`language`);
