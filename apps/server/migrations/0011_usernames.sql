DROP TABLE `invites`;--> statement-breakpoint
DROP TABLE `password_resets`;--> statement-breakpoint
ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (lower("username"));