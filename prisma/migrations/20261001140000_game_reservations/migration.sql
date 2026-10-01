-- Admin-held anonymous seats that count toward game capacity.

CREATE TABLE `GameReservation` (
  `id` VARCHAR(191) NOT NULL,
  `gameId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `note` VARCHAR(80) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `GameReservation_gameId_idx`(`gameId`),
  INDEX `GameReservation_createdById_idx`(`createdById`),
  CONSTRAINT `GameReservation_gameId_fkey`
    FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `GameReservation_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
