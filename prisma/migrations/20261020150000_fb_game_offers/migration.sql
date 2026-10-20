-- Admin board of volleyball offers parsed from pasted Facebook posts.

CREATE TABLE `FbGameOffer` (
  `id` VARCHAR(191) NOT NULL,
  `rawText` TEXT NOT NULL,
  `status` VARCHAR(8) NOT NULL,
  `gameDate` DATETIME(3) NULL,
  `whenLabel` VARCHAR(80) NULL,
  `gameLevel` VARCHAR(40) NULL,
  `freePlaces` VARCHAR(20) NULL,
  `address` VARCHAR(240) NULL,
  `link` VARCHAR(500) NULL,
  `postedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `FbGameOffer_postedAt_idx`(`postedAt`),
  INDEX `FbGameOffer_gameDate_idx`(`gameDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
