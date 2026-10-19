-- Track how a player paid (cash at the court). Null while unpaid.

ALTER TABLE `GamePayment`
  ADD COLUMN `method` ENUM('CASH') NULL AFTER `isPaid`;
