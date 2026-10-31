import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    age: integer("age").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    country: text("country").notNull(),
    signupDate: timestamp("signup_date", { mode: "string" }).notNull(),
    acquisitionChannel: text("acquisition_channel").notNull(),
    customerStatus: text("customer_status").notNull(),
    totalOrders: integer("total_orders").notNull(),
    totalRevenue: real("total_revenue").notNull(),
    averageOrderValue: real("average_order_value").notNull(),
    lifetimeValue: real("lifetime_value").notNull(),
    lastPurchaseDate: timestamp("last_purchase_date", { mode: "string" }).notNull(),
    daysSinceLastPurchase: integer("days_since_last_purchase").notNull(),
    favoriteCategory: text("favorite_category").notNull(),
    churnScore: real("churn_score").notNull(),
    purchasePropensityScore: real("purchase_propensity_score").notNull(),
    productFitScore: real("product_fit_score").notNull(),
    campaignEngagementScore: real("campaign_engagement_score").notNull(),
    emailOpenRate: real("email_open_rate").notNull(),
    emailClickRate: real("email_click_rate").notNull(),
    lastCampaignEngagement: timestamp("last_campaign_engagement", {
      mode: "string",
    }).notNull(),
    preferredChannel: text("preferred_channel").notNull(),
    segmentMemberships: jsonb("segment_memberships").$type<string[]>().notNull().default([]),
    sourceUpdatedAt: timestamp("source_updated_at", { mode: "string" }).notNull(),
    synchronizedAt: timestamp("synchronized_at", { mode: "string" }).notNull(),
    pipelineRunId: text("pipeline_run_id").notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [
    index("customers_churn_idx").on(table.churnScore),
    index("customers_ltv_idx").on(table.lifetimeValue),
    index("customers_state_idx").on(table.state),
    index("customers_category_idx").on(table.favoriteCategory),
    index("customers_status_idx").on(table.customerStatus),
    index("customers_channel_idx").on(table.acquisitionChannel),
    index("customers_recency_idx").on(table.daysSinceLastPurchase),
    index("customers_email_idx").on(table.email),
    index("customers_name_idx").on(table.lastName, table.firstName),
  ],
);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unitPrice: real("unit_price").notNull(),
});

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    productId: text("product_id").references(() => products.id),
    orderDate: timestamp("order_date", { mode: "string" }).notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull(),
  },
  (table) => [
    index("orders_customer_idx").on(table.customerId),
    index("orders_date_idx").on(table.orderDate),
  ],
);

export const campaignEvents = pgTable(
  "campaign_events",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    campaignName: text("campaign_name").notNull(),
    channel: text("channel").notNull(),
    eventType: text("event_type").notNull(),
    eventAt: timestamp("event_at", { mode: "string" }).notNull(),
  },
  (table) => [
    index("campaign_events_customer_idx").on(table.customerId),
    index("campaign_events_at_idx").on(table.eventAt),
  ],
);

export const segments = pgTable("segments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  combinator: text("combinator").notNull().default("and"),
  rules: jsonb("rules")
    .$type<
      {
        field: string;
        operator: string;
        value: string | number | string[] | number[];
      }[]
    >()
    .notNull(),
  memberCount: integer("member_count").notNull().default(0),
  averageLtv: real("average_ltv").notNull().default(0),
  averageChurn: real("average_churn").notNull().default(0),
  totalRevenue: real("total_revenue").notNull().default(0),
  averageEngagement: real("average_engagement").notNull().default(0),
  version: integer("version").notNull().default(1),
  lastComputedAt: timestamp("last_computed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const segmentMemberships = pgTable(
  "segment_memberships",
  {
    id: serial("id").primaryKey(),
    segmentId: text("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    computedAt: timestamp("computed_at", { mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("segment_memberships_unique").on(table.segmentId, table.customerId),
    index("segment_memberships_customer_idx").on(table.customerId),
  ],
);

export const activations = pgTable(
  "activations",
  {
    id: text("id").primaryKey(),
    segmentId: text("segment_id")
      .notNull()
      .references(() => segments.id),
    segmentName: text("segment_name").notNull(),
    destination: text("destination").notNull(),
    status: text("status").notNull(),
    customerCount: integer("customer_count").notNull(),
    segmentVersion: integer("segment_version").notNull(),
    message: text("message").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }),
  },
  (table) => [index("activations_created_idx").on(table.createdAt)],
);

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull(),
    currentStage: text("current_stage").notNull().default(""),
    rowsProcessed: integer("rows_processed").notNull().default(0),
    rowsFailed: integer("rows_failed").notNull().default(0),
    startedAt: timestamp("started_at", { mode: "string" }).notNull(),
    endedAt: timestamp("ended_at", { mode: "string" }),
    durationMs: integer("duration_ms"),
    error: text("error"),
    stages: jsonb("stages")
      .$type<
        {
          name: string;
          status: string;
          startedAt: string;
          endedAt?: string;
          detail?: string;
        }[]
      >()
      .notNull()
      .default([]),
  },
  (table) => [index("pipeline_runs_started_idx").on(table.startedAt)],
);

export const syncState = pgTable("sync_state", {
  dataset: text("dataset").primaryKey(),
  label: text("label").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at", { mode: "string" }).notNull(),
  synchronizedAt: timestamp("synchronized_at", { mode: "string" }).notNull(),
  pipelineRunId: text("pipeline_run_id").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  status: text("status").notNull().default("healthy"),
});

export const aiQueryLogs = pgTable("ai_query_logs", {
  id: text("id").primaryKey(),
  question: text("question").notNull(),
  interpreted: text("interpreted").notNull(),
  plan: jsonb("plan").notNull(),
  explanation: jsonb("explanation").notNull(),
  resultCount: integer("result_count").notNull().default(0),
  executionTimeMs: integer("execution_time_ms").notNull(),
  planner: text("planner").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type Segment = typeof segments.$inferSelect;
export type Activation = typeof activations.$inferSelect;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type SyncState = typeof syncState.$inferSelect;
