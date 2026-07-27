-- Invite read receipts + ignore outcome for host notifications.
ALTER TABLE `GameInvitation` ADD COLUMN `readAt` DATETIME(3) NULL;

ALTER TABLE `GameInvitation` MODIFY COLUMN `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'IGNORED') NOT NULL DEFAULT 'PENDING';
