CREATE TABLE `customer_catalogue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`product_id` text NOT NULL,
	`special_rate_paise` integer,
	`note` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`added_at` integer NOT NULL,
	`removed_at` integer,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cat_items_customer_idx` ON `customer_catalogue_items` (`customer_id`);--> statement-breakpoint
CREATE INDEX `cat_items_product_idx` ON `customer_catalogue_items` (`product_id`);--> statement-breakpoint
ALTER TABLE `colours` ADD `cost_paise` integer;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `cost_paise_snapshot` integer;--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `report_includes_profit` integer DEFAULT false NOT NULL;