ALTER TABLE `threads` ADD `addressed_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `threads` ADD `addressed_at` integer;--> statement-breakpoint
ALTER TABLE `threads` ADD `addressed_sha` text;