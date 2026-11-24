ALTER TABLE `designs` ADD `step_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `designs` ADD `languages` text DEFAULT '[]' NOT NULL;