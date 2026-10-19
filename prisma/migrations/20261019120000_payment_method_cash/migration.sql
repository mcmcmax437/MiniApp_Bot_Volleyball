-- Track how a player paid (cash at the court). Null while unpaid.

CREATE TABLE IF NOT EXISTS `_PaymentMethod_probe` (`id` INT NOT NULL);
DROP TABLE `_PaymentMethod_probe`;

-- Prisma MySQL enums are created inline on the column for optional enums.
ALTER TABLE `GamePayment`
  ADD COLUMN `method` ENUM('CASH') NULL AFTER `isPaid`;
