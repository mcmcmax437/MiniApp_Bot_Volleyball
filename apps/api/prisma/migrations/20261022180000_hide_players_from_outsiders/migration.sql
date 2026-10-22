-- Host can hide the player roster from people who have not joined the game.

ALTER TABLE `Game`
  ADD COLUMN `hidePlayersFromOutsiders` BOOLEAN NOT NULL DEFAULT false;
