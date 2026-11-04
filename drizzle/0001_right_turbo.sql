ALTER TABLE `item` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `item` SET `name` = `name_bn`;
