-- ============================================================================
-- Migration: v3 — feature expansion
--
-- Adds: Blacklist, Report, GameInvitation, GamePayment, GameEvaluation,
--       GameJoinRequest, AnalyticsEvent, UserActivityStats, banned flag on
--       User, isClosed + currency + paidGame flag + coverImageUrl on Game,
--       language field on User, evaluatedAt/evaluatedLevel on User.
--
-- This is a *forward-only* migration. All columns are nullable / defaulted so
-- existing rows are preserved.
-- ============================================================================

-- ---------- 1. User extensions ----------
ALTER TABLE `User`
  ADD COLUMN `language`           VARCHAR(8)  NULL,
  ADD COLUMN `isBanned`           BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN `bannedReason`       VARCHAR(280) NULL,
  ADD COLUMN `bannedAt`           DATETIME(3) NULL,
  ADD COLUMN `evaluatedSkillLevel` ENUM('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5','LEVEL_6') NULL,
  ADD COLUMN `evaluatedAt`        DATETIME(3) NULL,
  ADD INDEX `User_isBanned_idx`(`isBanned`);

-- ---------- 2. Game extensions ----------
ALTER TABLE `Game`
  ADD COLUMN `isClosed`      BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN `currency`      VARCHAR(8)  NOT NULL DEFAULT 'UAH',
  ADD COLUMN `isPaid`        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN `coverImageUrl` VARCHAR(500) NULL,
  ADD COLUMN `addressHint`   VARCHAR(280) NULL;

-- ---------- 3. Blacklist ----------
CREATE TABLE `Blacklist` (
    `id`         VARCHAR(191) NOT NULL,
    `ownerId`    VARCHAR(191) NOT NULL,
    `blockedId`  VARCHAR(191) NOT NULL,
    `reason`     VARCHAR(280) NULL,
    `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Blacklist_ownerId_idx`(`ownerId`),
    INDEX `Blacklist_blockedId_idx`(`blockedId`),
    UNIQUE INDEX `Blacklist_ownerId_blockedId_key`(`ownerId`, `blockedId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Blacklist` ADD CONSTRAINT `Blacklist_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Blacklist` ADD CONSTRAINT `Blacklist_blockedId_fkey`
    FOREIGN KEY (`blockedId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- 4. Reports ----------
CREATE TABLE `Report` (
    `id`         VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `targetId`   VARCHAR(191) NOT NULL,
    `gameId`     VARCHAR(191) NULL,
    `reason`     ENUM('TOXIC','SKIPPED_GAME','HARASSMENT','CHEATING','OTHER') NOT NULL,
    `details`    VARCHAR(1000) NULL,
    `status`     ENUM('OPEN','REVIEWED','DISMISSED') NOT NULL DEFAULT 'OPEN',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Report_targetId_idx`(`targetId`),
    INDEX `Report_reporterId_idx`(`reporterId`),
    INDEX `Report_status_idx`(`status`),
    INDEX `Report_gameId_idx`(`gameId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Report` ADD CONSTRAINT `Report_reporterId_fkey`
    FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Report` ADD CONSTRAINT `Report_targetId_fkey`
    FOREIGN KEY (`targetId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Report` ADD CONSTRAINT `Report_gameId_fkey`
    FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Report` ADD CONSTRAINT `Report_reviewedBy_fkey`
    FOREIGN KEY (`reviewedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- 5. GameInvitation ----------
CREATE TABLE `GameInvitation` (
    `id`         VARCHAR(191) NOT NULL,
    `gameId`     VARCHAR(191) NOT NULL,
    `inviterId`  VARCHAR(191) NOT NULL,
    `inviteeId`  VARCHAR(191) NOT NULL,
    `status`     ENUM('PENDING','ACCEPTED','DECLINED') NOT NULL DEFAULT 'PENDING',
    `respondedAt` DATETIME(3) NULL,
    `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GameInvitation_inviteeId_idx`(`inviteeId`),
    INDEX `GameInvitation_inviterId_idx`(`inviterId`),
    INDEX `GameInvitation_gameId_idx`(`gameId`),
    UNIQUE INDEX `GameInvitation_gameId_inviteeId_key`(`gameId`, `inviteeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GameInvitation` ADD CONSTRAINT `GameInvitation_gameId_fkey`
    FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameInvitation` ADD CONSTRAINT `GameInvitation_inviterId_fkey`
    FOREIGN KEY (`inviterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameInvitation` ADD CONSTRAINT `GameInvitation_inviteeId_fkey`
    FOREIGN KEY (`inviteeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- 6. GameJoinRequest (for closed lobbies) ----------
CREATE TABLE `GameJoinRequest` (
    `id`         VARCHAR(191) NOT NULL,
    `gameId`     VARCHAR(191) NOT NULL,
    `userId`     VARCHAR(191) NOT NULL,
    `status`     ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    `decidedBy`  VARCHAR(191) NULL,
    `decidedAt`  DATETIME(3) NULL,
    `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GameJoinRequest_gameId_idx`(`gameId`),
    INDEX `GameJoinRequest_userId_idx`(`userId`),
    INDEX `GameJoinRequest_status_idx`(`status`),
    UNIQUE INDEX `GameJoinRequest_gameId_userId_key`(`gameId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GameJoinRequest` ADD CONSTRAINT `GameJoinRequest_gameId_fkey`
    FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameJoinRequest` ADD CONSTRAINT `GameJoinRequest_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameJoinRequest` ADD CONSTRAINT `GameJoinRequest_decidedBy_fkey`
    FOREIGN KEY (`decidedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- 7. GamePayment (per-player payment tracking) ----------
CREATE TABLE `GamePayment` (
    `id`         VARCHAR(191) NOT NULL,
    `gameId`     VARCHAR(191) NOT NULL,
    `userId`     VARCHAR(191) NOT NULL,
    `amount`     INT          NOT NULL,
    `currency`   VARCHAR(8)   NOT NULL DEFAULT 'UAH',
    `isPaid`     BOOLEAN      NOT NULL DEFAULT FALSE,
    `paidAt`     DATETIME(3)  NULL,
    `note`       VARCHAR(280) NULL,
    `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GamePayment_gameId_idx`(`gameId`),
    INDEX `GamePayment_userId_idx`(`userId`),
    UNIQUE INDEX `GamePayment_gameId_userId_key`(`gameId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GamePayment` ADD CONSTRAINT `GamePayment_gameId_fkey`
    FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GamePayment` ADD CONSTRAINT `GamePayment_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- 8. GameEvaluation (post-game skill feedback) ----------
CREATE TABLE `GameEvaluation` (
    `id`           VARCHAR(191) NOT NULL,
    `gameId`       VARCHAR(191) NOT NULL,
    `evaluatorId`  VARCHAR(191) NOT NULL,
    `evaluateeId`  VARCHAR(191) NOT NULL,
    `skillLevel`   ENUM('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5','LEVEL_6') NOT NULL,
    `note`         VARCHAR(500) NULL,
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GameEvaluation_gameId_idx`(`gameId`),
    INDEX `GameEvaluation_evaluatorId_idx`(`evaluatorId`),
    INDEX `GameEvaluation_evaluateeId_idx`(`evaluateeId`),
    UNIQUE INDEX `GameEvaluation_gameId_evaluatorId_evaluateeId_key`(`gameId`, `evaluatorId`, `evaluateeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GameEvaluation` ADD CONSTRAINT `GameEvaluation_gameId_fkey`
    FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameEvaluation` ADD CONSTRAINT `GameEvaluation_evaluatorId_fkey`
    FOREIGN KEY (`evaluatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameEvaluation` ADD CONSTRAINT `GameEvaluation_evaluateeId_fkey`
    FOREIGN KEY (`evaluateeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- 9. AnalyticsEvent ----------
CREATE TABLE `AnalyticsEvent` (
    `id`         VARCHAR(191) NOT NULL,
    `userId`     VARCHAR(191) NULL,
    `type`       VARCHAR(64)  NOT NULL, -- e.g. 'click', 'screen_view', 'game_join'
    `screen`     VARCHAR(64)  NULL,
    `target`     VARCHAR(64)  NULL,    -- element label / selector
    `meta`       JSON         NULL,
    `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalyticsEvent_type_idx`(`type`),
    INDEX `AnalyticsEvent_screen_idx`(`screen`),
    INDEX `AnalyticsEvent_target_idx`(`target`),
    INDEX `AnalyticsEvent_createdAt_idx`(`createdAt`),
    INDEX `AnalyticsEvent_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AnalyticsEvent` ADD CONSTRAINT `AnalyticsEvent_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- 10. UserActivityStats (denormalized rollups for #1.1) ----------
CREATE TABLE `UserActivityStats` (
    `userId`            VARCHAR(191) NOT NULL,
    `gamesHosted`       INT          NOT NULL DEFAULT 0,
    `gamesAttended`     INT          NOT NULL DEFAULT 0,
    `gamesCancelled`    INT          NOT NULL DEFAULT 0,
    `lastActiveAt`      DATETIME(3)  NULL,
    `avgSessionsPerWeek` FLOAT        NOT NULL DEFAULT 0,
    `updatedAt`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserActivityStats` ADD CONSTRAINT `UserActivityStats_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;