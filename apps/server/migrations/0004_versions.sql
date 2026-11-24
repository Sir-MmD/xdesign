CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`design_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`state` blob NOT NULL,
	`doc_version` integer NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `versions_design` ON `versions` (`design_id`,`created_at`);