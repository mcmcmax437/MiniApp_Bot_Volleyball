-- Waitlist for full games + durable reminder send log.
CREATE TABLE `GameWaitlist` (
    `id` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastNotifiedAt` DATETIME(3) NULL,

    UNIQUE INDEX `GameWaitlist_gameId_userId_key`(`gameId`, `userId`),
    INDEX `GameWaitlist_gameId_idx`(`gameId`),
    INDEX `GameWaitlist_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GameReminderSent` (
    `id` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `offsetMinutes` INTEGER NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GameReminderSent_gameId_userId_offsetMinutes_key`(`gameId`, `userId`, `offsetMinutes`),
    INDEX `GameReminderSent_gameId_idx`(`gameId`),
    INDEX `GameReminderSent_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GameWaitlist` ADD CONSTRAINT `GameWaitlist_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameWaitlist` ADD CONSTRAINT `GameWaitlist_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GameReminderSent` ADD CONSTRAINT `GameReminderSent_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameReminderSent` ADD CONSTRAINT `GameReminderSent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
