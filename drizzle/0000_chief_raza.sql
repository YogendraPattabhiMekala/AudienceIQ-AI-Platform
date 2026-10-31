CREATE TABLE "activations" (
	"id" text PRIMARY KEY NOT NULL,
	"segment_id" text NOT NULL,
	"segment_name" text NOT NULL,
	"destination" text NOT NULL,
	"status" text NOT NULL,
	"customer_count" integer NOT NULL,
	"segment_version" integer NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_query_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"interpreted" text NOT NULL,
	"plan" jsonb NOT NULL,
	"explanation" jsonb NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"execution_time_ms" integer NOT NULL,
	"planner" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_events" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"channel" text NOT NULL,
	"event_type" text NOT NULL,
	"event_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"age" integer NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text NOT NULL,
	"signup_date" timestamp NOT NULL,
	"acquisition_channel" text NOT NULL,
	"customer_status" text NOT NULL,
	"total_orders" integer NOT NULL,
	"total_revenue" real NOT NULL,
	"average_order_value" real NOT NULL,
	"lifetime_value" real NOT NULL,
	"last_purchase_date" timestamp NOT NULL,
	"days_since_last_purchase" integer NOT NULL,
	"favorite_category" text NOT NULL,
	"churn_score" real NOT NULL,
	"purchase_propensity_score" real NOT NULL,
	"product_fit_score" real NOT NULL,
	"campaign_engagement_score" real NOT NULL,
	"email_open_rate" real NOT NULL,
	"email_click_rate" real NOT NULL,
	"last_campaign_engagement" timestamp NOT NULL,
	"preferred_channel" text NOT NULL,
	"segment_memberships" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_updated_at" timestamp NOT NULL,
	"synchronized_at" timestamp NOT NULL,
	"pipeline_run_id" text NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"product_id" text,
	"order_date" timestamp NOT NULL,
	"amount" real NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"current_stage" text DEFAULT '' NOT NULL,
	"rows_processed" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration_ms" integer,
	"error" text,
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit_price" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"segment_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"computed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"combinator" text DEFAULT 'and' NOT NULL,
	"rules" jsonb NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"average_ltv" real DEFAULT 0 NOT NULL,
	"average_churn" real DEFAULT 0 NOT NULL,
	"total_revenue" real DEFAULT 0 NOT NULL,
	"average_engagement" real DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_computed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"dataset" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"source_updated_at" timestamp NOT NULL,
	"synchronized_at" timestamp NOT NULL,
	"pipeline_run_id" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'healthy' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_memberships" ADD CONSTRAINT "segment_memberships_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_memberships" ADD CONSTRAINT "segment_memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activations_created_idx" ON "activations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "campaign_events_customer_idx" ON "campaign_events" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "campaign_events_at_idx" ON "campaign_events" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX "customers_churn_idx" ON "customers" USING btree ("churn_score");--> statement-breakpoint
CREATE INDEX "customers_ltv_idx" ON "customers" USING btree ("lifetime_value");--> statement-breakpoint
CREATE INDEX "customers_state_idx" ON "customers" USING btree ("state");--> statement-breakpoint
CREATE INDEX "customers_category_idx" ON "customers" USING btree ("favorite_category");--> statement-breakpoint
CREATE INDEX "customers_status_idx" ON "customers" USING btree ("customer_status");--> statement-breakpoint
CREATE INDEX "customers_channel_idx" ON "customers" USING btree ("acquisition_channel");--> statement-breakpoint
CREATE INDEX "customers_recency_idx" ON "customers" USING btree ("days_since_last_purchase");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_date_idx" ON "orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "pipeline_runs_started_idx" ON "pipeline_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "segment_memberships_unique" ON "segment_memberships" USING btree ("segment_id","customer_id");--> statement-breakpoint
CREATE INDEX "segment_memberships_customer_idx" ON "segment_memberships" USING btree ("customer_id");