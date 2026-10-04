CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`author_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "comments_body_len" CHECK(length("comments"."body") <= 10000)
);
--> statement-breakpoint
CREATE INDEX `comments_thread` ON `comments` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`access_token_enc` text NOT NULL,
	`access_expires_at` integer NOT NULL,
	`refresh_token_enc` text NOT NULL,
	`refresh_expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_id` integer NOT NULL,
	`repo_full_name` text NOT NULL,
	`path` text NOT NULL,
	`commit_sha` text NOT NULL,
	`blob_sha` text,
	`anchor_kind` text NOT NULL,
	`quote_exact` text NOT NULL,
	`quote_prefix` text DEFAULT '' NOT NULL,
	`quote_suffix` text DEFAULT '' NOT NULL,
	`text_start` integer,
	`text_end` integer,
	`line_start` integer,
	`line_end` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` integer,
	`resolved_at` integer,
	`author_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `threads_repo_path` ON `threads` (`repo_id`,`path`,`status`);--> statement-breakpoint
CREATE INDEX `threads_repo_status` ON `threads` (`repo_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`login` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`updated_at` integer NOT NULL
);
