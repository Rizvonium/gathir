CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'category' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `colours` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`hex` text NOT NULL,
	`pieces` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `colours_product_idx` ON `colours` (`product_id`);--> statement-breakpoint
CREATE TABLE `customer_events` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text,
	`note` text DEFAULT '' NOT NULL,
	`due_at` integer,
	`done_at` integer,
	`notification_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_customer_idx` ON `customer_events` (`customer_id`);--> statement-breakpoint
CREATE INDEX `events_due_idx` ON `customer_events` (`due_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`whatsapp_ok` integer DEFAULT true NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`tag` text DEFAULT 'regular' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`likes_json` text DEFAULT '{"colours":[],"crafts":[]}' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `customers_deleted_idx` ON `customers` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`file_name` text NOT NULL,
	`thumb_name` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photos_product_idx` ON `photos` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text,
	`craft` text DEFAULT '' NOT NULL,
	`material` text DEFAULT '' NOT NULL,
	`size` text DEFAULT '' NOT NULL,
	`rate_paise` integer DEFAULT 0 NOT NULL,
	`cost_paise` integer,
	`notes` text DEFAULT '' NOT NULL,
	`one_of_a_kind` integer DEFAULT false NOT NULL,
	`cover_photo_id` text,
	`is_sample` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_idx` ON `products` (`code`);--> statement-breakpoint
CREATE INDEX `products_deleted_idx` ON `products` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`period_from` integer,
	`period_to` integer,
	`file_name` text,
	`customer_id` text,
	`summary_json` text DEFAULT '{}' NOT NULL,
	`fingerprint` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`colour_id` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`product_code_snapshot` text DEFAULT '' NOT NULL,
	`colour_name_snapshot` text NOT NULL,
	`colour_hex_snapshot` text DEFAULT '' NOT NULL,
	`photo_snapshot_name` text,
	`qty` integer NOT NULL,
	`rate_paise` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_no` text NOT NULL,
	`customer_id` text,
	`customer_name_snapshot` text,
	`customer_phone_snapshot` text,
	`payment` text DEFAULT 'cash' NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`cancelled_at` integer,
	`report_id` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sales_created_idx` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE TABLE `shop_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`shop_name` text DEFAULT '' NOT NULL,
	`seller_name` text DEFAULT '' NOT NULL,
	`seller_code` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`upi_id` text DEFAULT '' NOT NULL,
	`owner_whatsapp` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`low_stock_level` integer DEFAULT 1 NOT NULL,
	`catalogue_style` text DEFAULT 'bazaar' NOT NULL,
	`catalogue_options_json` text DEFAULT '{}' NOT NULL,
	`report_includes_customer_phones` integer DEFAULT true NOT NULL,
	`showroom_shows_exact_counts` integer DEFAULT false NOT NULL,
	`pin_hash_set` integer DEFAULT false NOT NULL,
	`onboarded_at` integer,
	`last_backup_at` integer,
	`product_seq` integer DEFAULT 0 NOT NULL,
	`bill_seq` integer DEFAULT 0 NOT NULL,
	`report_seq` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`colour_id` text NOT NULL,
	`product_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`sale_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`colour_id`) REFERENCES `colours`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moves_colour_idx` ON `stock_moves` (`colour_id`);--> statement-breakpoint
CREATE INDEX `moves_created_idx` ON `stock_moves` (`created_at`);