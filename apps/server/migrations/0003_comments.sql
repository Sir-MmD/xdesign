CREATE TABLE `comment_reads` (
	`user_id` text NOT NULL,
	`design_id` text NOT NULL,
	`last_read_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `design_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`design_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`anchor` text,
	`author_id` text,
	`body` text NOT NULL,
	`mentions` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`resolved_at` integer,
	`resolved_by` text,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `comments_design` ON `comments` (`design_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_thread` ON `comments` (`thread_id`);