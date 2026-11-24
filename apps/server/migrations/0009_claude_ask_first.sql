ALTER TABLE `api_keys` ADD `ask_first` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `cannot_ask` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `versions` ADD `via` text;