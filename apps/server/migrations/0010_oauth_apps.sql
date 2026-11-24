CREATE TABLE `oauth_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`auth_method` text NOT NULL,
	`secret_hash` text,
	`created_at` integer NOT NULL,
	`used_at` integer NOT NULL,
	`fresh_until` integer
);
--> statement-breakpoint
CREATE TABLE `oauth_codes` (
	`hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`code_challenge` text NOT NULL,
	`resource` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`grant_id` text,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `oauth_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`resource` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`expires_at` integer NOT NULL,
	`ask_first` integer DEFAULT true NOT NULL,
	`cannot_ask` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_grants_user` ON `oauth_grants` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`handle_hash` text NOT NULL,
	`client_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`state` text,
	`code_challenge` text NOT NULL,
	`resource` text NOT NULL,
	`ip` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`user_id` text,
	`session_id` text,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_requests_handle_hash_unique` ON `oauth_requests` (`handle_hash`);--> statement-breakpoint
CREATE INDEX `oauth_requests_ip` ON `oauth_requests` (`ip`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_tokens_grant` ON `oauth_tokens` (`grant_id`);