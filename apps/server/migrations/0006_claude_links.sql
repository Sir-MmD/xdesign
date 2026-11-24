CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_unique` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_user` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `claude_links` (
	`id` text PRIMARY KEY NOT NULL,
	`design_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`last_used_at` integer,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `claude_links_token_hash_unique` ON `claude_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `claude_links_design` ON `claude_links` (`design_id`);--> statement-breakpoint
CREATE TABLE `pictures` (
	`design_id` text NOT NULL,
	`step_id` text NOT NULL,
	`language` text NOT NULL,
	`look` text NOT NULL,
	`doc_version` integer NOT NULL,
	`media_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`design_id`, `step_id`, `language`),
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
