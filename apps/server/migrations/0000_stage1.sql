CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`design_id` text,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `audit_at` ON `audit` (`at`);--> statement-breakpoint
CREATE INDEX `audit_user` ON `audit` (`user_id`,`at`);--> statement-breakpoint
CREATE INDEX `audit_design` ON `audit` (`design_id`,`at`);--> statement-breakpoint
CREATE TABLE `design_docs` (
	`design_id` text PRIMARY KEY NOT NULL,
	`state` blob NOT NULL,
	`state_bytes` integer NOT NULL,
	`saved_at` integer NOT NULL,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `design_members` (
	`design_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`added_by` text,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`design_id`, `user_id`),
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `design_members_user` ON `design_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `designs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	`deleted_at` integer,
	`doc_version` integer DEFAULT 0 NOT NULL,
	`is_template` integer DEFAULT false NOT NULL,
	`template_meta` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `designs_owner` ON `designs` (`owner_id`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`note` text,
	`email` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_by` text,
	`used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_hash_unique` ON `invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`design_id` text NOT NULL,
	`sha256` text NOT NULL,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`original_name` text,
	`uploaded_by` text,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `media_design` ON `media` (`design_id`);--> statement-breakpoint
CREATE INDEX `media_sha256` ON `media` (`sha256`);--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_resets_token_hash_unique` ON `password_resets` (`token_hash`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	`user_agent` text,
	`ip` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_site_owner` integer DEFAULT false NOT NULL,
	`disabled_at` integer,
	`created_at` integer NOT NULL,
	`last_seen_at` integer,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (lower("email"));