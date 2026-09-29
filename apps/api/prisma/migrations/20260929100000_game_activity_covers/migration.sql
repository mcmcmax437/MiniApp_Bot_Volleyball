-- Custom second field photo + durable join/leave activity log (admin timeline).

ALTER TABLE `Game`
  ADD COLUMN `coverImageUrl2` VARCHAR(500) NULL AFTER `coverImageUrl`;

CREATE TABLE `GameActivity` (
  `id` VARCHAR(191) NOT NULL,
  `gameId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `kind` ENUM('JOINED', 'LEFT') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `GameActivity_gameId_createdAt_idx`(`gameId`, `createdAt`),
  INDEX `GameActivity_userId_idx`(`userId`),
  CONSTRAINT `GameActivity_gameId_fkey`
    FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `GameActivity_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
