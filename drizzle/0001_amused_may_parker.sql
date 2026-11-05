ALTER TABLE `settlement` ADD `status` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `settlement` ADD `decided_by` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `settlement` ADD `decided_at` integer;--> statement-breakpoint
ALTER TABLE `settlement` ADD `reject_reason` text;--> statement-breakpoint
CREATE INDEX `settlement_to_status_idx` ON `settlement` (`to_user_id`,`status`);