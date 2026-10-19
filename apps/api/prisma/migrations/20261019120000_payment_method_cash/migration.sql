-- How a player paid: CASH or BANK. Null / neither selected = unpaid.

ALTER TABLE `GamePayment`
  ADD COLUMN `method` ENUM('CASH', 'BANK') NULL AFTER `isPaid`;
