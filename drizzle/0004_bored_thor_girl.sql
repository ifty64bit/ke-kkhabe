PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_day_item` (
	`day_id` text NOT NULL,
	`item_id` text NOT NULL,
	`total_cost` integer,
	`available` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`day_id`, `item_id`),
	FOREIGN KEY (`day_id`) REFERENCES `day`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "day_item_cost_nonneg" CHECK("__new_day_item"."total_cost" IS NULL OR "__new_day_item"."total_cost" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_day_item`("day_id", "item_id", "total_cost", "available") SELECT "day_id", "item_id", "total_cost", "available" FROM `day_item`;--> statement-breakpoint
DROP TABLE `day_item`;--> statement-breakpoint
ALTER TABLE `__new_day_item` RENAME TO `day_item`;--> statement-breakpoint
PRAGMA foreign_keys=ON;