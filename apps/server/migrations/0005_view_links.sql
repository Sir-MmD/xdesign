CREATE TABLE `view_links` (
	`id` text PRIMARY KEY NOT NULL,
	`design_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`last_used_at` integer,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `view_links_token_hash_unique` ON `view_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `view_links_design` ON `view_links` (`design_id`);