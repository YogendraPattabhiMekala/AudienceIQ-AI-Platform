-- AudienceIQ logical warehouse layers.
-- Production: Snowflake databases RAW / STAGING / ANALYTICS / SEMANTIC
-- Demo: the local PostgreSQL adapter materializes the product-facing grain.

-- RAW ---------------------------------------------------------------
-- RAW.CUSTOMERS, RAW.ORDERS, RAW.CAMPAIGN_EVENTS, RAW.PRODUCTS
-- Landed as-is from source extracts. No business logic.

-- STAGING -----------------------------------------------------------
-- STG_CUSTOMERS: typed, deduplicated, canonical channels/emails.
-- STG_ORDERS: completed vs refunded flags, currency normalized.
-- STG_CAMPAIGN_EVENTS: event_type allow-list, timestamps in UTC.

-- ANALYTICS ---------------------------------------------------------
-- CUSTOMER_360: one row per customer with commerce + engagement grain.
-- CUSTOMER_SCORES: churn, propensity, product fit, engagement.
-- CUSTOMER_ENGAGEMENT: rolling open/click windows.
-- CUSTOMER_SEGMENTS: membership snapshot by segment version.

-- SEMANTIC ----------------------------------------------------------
-- SEMANTIC.CUSTOMER_MARKETING is the only surface the agent may query.
-- Definitions live in data/semantic/catalog.json.

create view if not exists semantic_customer_marketing as
select
  id as customer_id,
  first_name,
  last_name,
  email,
  age,
  city,
  state,
  country,
  signup_date,
  acquisition_channel,
  customer_status,
  favorite_category,
  preferred_channel,
  last_purchase_date,
  last_campaign_engagement,
  total_orders,
  total_revenue,
  average_order_value,
  lifetime_value,
  days_since_last_purchase,
  churn_score,
  purchase_propensity_score,
  product_fit_score,
  campaign_engagement_score,
  email_open_rate,
  email_click_rate
from customers;
