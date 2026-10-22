-- method was created as ENUM('CASH') only. That migration already ran,
-- so BANK has to be added in a new one.

ALTER TABLE `GamePayment`
  MODIFY COLUMN `method` ENUM('CASH', 'BANK') NULL;
