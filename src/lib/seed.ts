import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appMeta, customers } from "@/db/schema";
import { recomputeAllSegments } from "./segments";
import { resultRows } from "./result-rows";

const SEED_VERSION = "audienceiq-v4";
const CUSTOMER_COUNT = 3200;

export async function isSeeded(): Promise<boolean> {
  try {
    const rows = await db.select().from(appMeta).where(eq(appMeta.key, "seed_version")).limit(1);
    return rows[0]?.value === SEED_VERSION;
  } catch {
    return false;
  }
}

export async function ensureSeeded(): Promise<{ seeded: boolean; customerCount: number; tookMs: number }> {
  const started = Date.now();
  if (await isSeeded()) {
    const countRows = resultRows<{ count: number }>(
      await db.execute(sql`select count(*)::int as count from customers`),
    );
    const customerCount = Number(countRows[0]?.count ?? 0);
    return { seeded: false, customerCount, tookMs: Date.now() - started };
  }

  await db.execute(sql`truncate table
    ai_query_logs, activations, segment_memberships, segments,
    campaign_events, orders, products, pipeline_runs, sync_state, customers, app_meta
    restart identity cascade`);

  await db.execute(sql`
    insert into products (id, name, category, unit_price)
    values
      ('PRD-1001', 'Aether Headphones', 'Electronics', 249),
      ('PRD-1002', 'Nimbus Laptop Sleeve', 'Electronics', 79),
      ('PRD-1003', 'Solstice Jacket', 'Apparel', 189),
      ('PRD-1004', 'Harbor Knit', 'Apparel', 68),
      ('PRD-1005', 'Kiln Pour-Over', 'Home', 42),
      ('PRD-1006', 'Lumen Desk Lamp', 'Home', 120),
      ('PRD-1007', 'Cascade Serum', 'Beauty', 54),
      ('PRD-1008', 'Peak Trail Mix', 'Grocery', 12),
      ('PRD-1009', 'Ridge Daypack', 'Outdoor', 156),
      ('PRD-1010', 'Volt Runners', 'Sports', 138)
  `);

  await db.execute(sql`
    insert into customers (
      id, first_name, last_name, email, age, city, state, country, signup_date,
      acquisition_channel, customer_status, total_orders, total_revenue, average_order_value,
      lifetime_value, last_purchase_date, days_since_last_purchase, favorite_category,
      churn_score, purchase_propensity_score, product_fit_score, campaign_engagement_score,
      email_open_rate, email_click_rate, last_campaign_engagement, preferred_channel,
      segment_memberships, source_updated_at, synchronized_at, pipeline_run_id, updated_at
    )
    select
      'CUS-' || lpad(i::text, 6, '0') as id,
      (array['Avery','Jordan','Riley','Quinn','Cameron','Hayden','Rowan','Skyler','Parker','Reese','Finley','Sage','Drew','Kendall','Morgan','Casey','Taylor','Jamie','Elliot','Harper','Logan','Nolan','Peyton','Reagan','Sydney','Emerson','Marley','Dakota','Charlie','Frankie'])[1 + (i * 13) % 30] as first_name,
      (array['Nguyen','Patel','Brooks','Ramirez','Cole','Shah','Bennett','Diaz','Hughes','Klein','Mahoney','Iyer','Walsh','Petrov','Okonkwo','Berg','Sato','Rossi','Dubois','Nielsen','Costa','Alvarez','Khan','Okafor','Silva','Novak','Brandt','Farah','Cohen','Larsen'])[1 + (i * 17) % 30] as last_name,
      lower(
        (array['Avery','Jordan','Riley','Quinn','Cameron','Hayden','Rowan','Skyler','Parker','Reese','Finley','Sage','Drew','Kendall','Morgan','Casey','Taylor','Jamie','Elliot','Harper','Logan','Nolan','Peyton','Reagan','Sydney','Emerson','Marley','Dakota','Charlie','Frankie'])[1 + (i * 13) % 30]
        || '.' ||
        (array['Nguyen','Patel','Brooks','Ramirez','Cole','Shah','Bennett','Diaz','Hughes','Klein','Mahoney','Iyer','Walsh','Petrov','Okonkwo','Berg','Sato','Rossi','Dubois','Nielsen','Costa','Alvarez','Khan','Okafor','Silva','Novak','Brandt','Farah','Cohen','Larsen'])[1 + (i * 17) % 30]
        || '.' || i::text || '@example.com'
      ) as email,
      22 + (i * 5) % 43 as age,
      (array['Austin','Denver','Seattle','Chicago','Boston','Atlanta','Miami','Portland','Nashville','Phoenix','Dallas','Raleigh','Minneapolis','San Diego','Brooklyn','Boulder','Madison','Tampa','Oakland','Pittsburgh'])[1 + (i * 7) % 20] as city,
      (array['TX','CO','WA','IL','MA','GA','FL','OR','TN','AZ','TX','NC','MN','CA','NY','CO','WI','FL','CA','PA'])[1 + (i * 7) % 20] as state,
      (array['US','US','US','US','US','US','US','US','US','CA','GB','US'])[1 + (i * 3) % 12] as country,
      (timestamp '2022-01-08' + ((i * 11) % 980) * interval '1 day')::timestamp as signup_date,
      (array['Paid Search','Organic Search','Email','Referral','Paid Social','Affiliate','Direct','Partnership'])[1 + (i * 5) % 8] as acquisition_channel,
      (array['active','active','active','at_risk','active','dormant','churned','active'])[1 + (i * 9) % 8] as customer_status,
      1 + (i * 7) % 36 as total_orders,
      round(((80 + (i * 37) % 4200) + case when i <= 240 then 1400 else 0 end)::numeric, 2) as total_revenue,
      round((((80 + (i * 37) % 4200) + case when i <= 240 then 1400 else 0 end)::numeric) / (1 + (i * 7) % 36), 2) as average_order_value,
      round(((80 + (i * 37) % 4200) + case when i <= 240 then 1400 else 0 end)::numeric, 2) as lifetime_value,
      (now() - ((case
        when i <= 240 then 8 + (i % 70)
        when i % 11 = 0 then 12 + (i % 20)
        when i % 5 = 0 then 40 + (i % 50)
        else 20 + (i * 11) % 360
      end) * interval '1 day'))::timestamp as last_purchase_date,
      case
        when i <= 240 then 8 + (i % 70)
        when i % 11 = 0 then 12 + (i % 20)
        when i % 5 = 0 then 40 + (i % 50)
        else 20 + (i * 11) % 360
      end as days_since_last_purchase,
      (array['Electronics','Apparel','Home','Beauty','Sports','Outdoor','Grocery'])[1 + (i * 3) % 7] as favorite_category,
      round((case
        when i <= 240 then 0.71 + (i % 26) * 0.01
        when i % 13 = 0 then 0.78 + (i % 12) * 0.015
        else least(0.97, greatest(0.04, 0.12 + ((i * 19) % 86) * 0.01
          + case when (20 + (i * 11) % 360) > 180 then 0.18 else 0 end
          - case when (i % 5 = 0) then 0.12 else 0 end))
      end)::numeric, 3) as churn_score,
      round((case
        when i <= 240 then 0.22 + (i % 20) * 0.01
        else least(0.96, greatest(0.05, 0.85 - (
          case
            when i <= 240 then 8 + (i % 70)
            else 20 + (i * 11) % 360
          end
        ) * 0.002 + ((i * 3) % 17) * 0.01))
      end)::numeric, 3) as purchase_propensity_score,
      round((0.18 + ((i * 23) % 75) * 0.01)::numeric, 3) as product_fit_score,
      round((case
        when i <= 240 then 0.04 + (i % 18) * 0.01
        when i % 17 = 0 then 0.08 + (i % 10) * 0.01
        else least(0.95, 0.12 + ((i * 29) % 80) * 0.01)
      end)::numeric, 3) as campaign_engagement_score,
      round((0.12 + ((i * 31) % 70) * 0.01)::numeric, 3) as email_open_rate,
      round((0.02 + ((i * 31) % 70) * 0.004)::numeric, 3) as email_click_rate,
      (now() - ((case
        when i <= 240 then 32 + (i % 40)
        when i % 17 = 0 then 40 + (i % 50)
        else (i * 8) % 120
      end) * interval '1 day'))::timestamp as last_campaign_engagement,
      (array['email','sms','push','paid_social','direct_mail'])[1 + (i * 11) % 5] as preferred_channel,
      '[]'::jsonb as segment_memberships,
      (now() - interval '26 minutes')::timestamp as source_updated_at,
      (now() - interval '3 minutes')::timestamp as synchronized_at,
      'run_seed_001' as pipeline_run_id,
      now()::timestamp as updated_at
    from generate_series(1, ${sql.raw(String(CUSTOMER_COUNT))}) as g(i)
  `);

  await db.execute(sql`
    insert into orders (id, customer_id, product_id, order_date, amount, category, status)
    select
      'ORD-' || lpad(i::text, 6, '0'),
      'CUS-' || lpad(((i - 1) % ${sql.raw(String(CUSTOMER_COUNT))} + 1)::text, 6, '0'),
      (array['PRD-1001','PRD-1002','PRD-1003','PRD-1004','PRD-1005','PRD-1006','PRD-1007','PRD-1008','PRD-1009','PRD-1010'])[1 + (i * 3) % 10],
      (now() - ((i * 5) % 400) * interval '1 day')::timestamp,
      round((24 + (i * 13) % 420)::numeric, 2),
      (array['Electronics','Apparel','Home','Beauty','Sports','Outdoor','Grocery'])[1 + (i * 3) % 7],
      (array['completed','completed','completed','refunded','completed'])[1 + i % 5]
    from generate_series(1, 4800) as g(i)
  `);

  await db.execute(sql`
    insert into campaign_events (id, customer_id, campaign_name, channel, event_type, event_at)
    select
      'EVT-' || lpad(i::text, 6, '0'),
      'CUS-' || lpad(((i * 5) % ${sql.raw(String(CUSTOMER_COUNT))} + 1)::text, 6, '0'),
      (array['Spring Refresh','LTV Winback','Category Launch','Loyalty Digest','Cart Nudge'])[1 + i % 5],
      (array['email','sms','paid_social','push'])[1 + i % 4],
      (array['delivered','open','click','conversion','unsub'])[1 + (i * 2) % 5],
      (now() - ((i * 3) % 140) * interval '1 day')::timestamp
    from generate_series(1, 3600) as g(i)
  `);

  await db.execute(sql`
    insert into segments (
      id, name, description, combinator, rules, member_count, average_ltv, average_churn,
      total_revenue, average_engagement, version, last_computed_at, created_at, updated_at
    ) values
    (
      'seg_hvcr',
      'High Value Churn Risk',
      'High-LTV customers with elevated churn who still purchased recently but are disengaged from campaigns.',
      'and',
      '[{"field":"lifetime_value","operator":"gt","value":1000},{"field":"churn_score","operator":"gt","value":0.7},{"field":"days_since_last_purchase","operator":"lt","value":90},{"field":"campaign_engagement_score","operator":"lt","value":0.25}]'::jsonb,
      0, 0, 0, 0, 0, 1, now()::timestamp, now()::timestamp, now()::timestamp
    ),
    (
      'seg_hpe',
      'High Propensity Electronics',
      'Customers with strong purchase propensity whose favorite category is Electronics.',
      'and',
      '[{"field":"purchase_propensity_score","operator":"gte","value":0.65},{"field":"favorite_category","operator":"eq","value":"Electronics"}]'::jsonb,
      0, 0, 0, 0, 0, 1, now()::timestamp, now()::timestamp, now()::timestamp
    ),
    (
      'seg_loyal',
      'Loyal High Engagement',
      'Active high-value customers who still engage with campaigns.',
      'and',
      '[{"field":"lifetime_value","operator":"gte","value":800},{"field":"campaign_engagement_score","operator":"gte","value":0.55},{"field":"customer_status","operator":"eq","value":"active"}]'::jsonb,
      0, 0, 0, 0, 0, 1, now()::timestamp, now()::timestamp, now()::timestamp
    ),
    (
      'seg_winback',
      'Winback Dormant',
      'Previously valuable customers with long purchase recency.',
      'and',
      '[{"field":"days_since_last_purchase","operator":"gt","value":180},{"field":"lifetime_value","operator":"gte","value":400}]'::jsonb,
      0, 0, 0, 0, 0, 1, now()::timestamp, now()::timestamp, now()::timestamp
    )
  `);

  await db.execute(sql`
    insert into pipeline_runs (
      id, workflow_id, trigger, status, current_stage, rows_processed, rows_failed,
      started_at, ended_at, duration_ms, error, stages
    ) values
    (
      'run_seed_001', 'wf_sync_seed', 'seed', 'completed', 'application',
      ${sql.raw(String(CUSTOMER_COUNT))}, 0,
      (now() - interval '18 minutes')::timestamp,
      (now() - interval '3 minutes')::timestamp,
      900000, null,
      '[
        {"name":"raw_extract","status":"completed","startedAt":"seed","detail":"Synthetic raw customers, orders, campaign events"},
        {"name":"validation","status":"completed","startedAt":"seed","detail":"Schema, null, and type checks passed"},
        {"name":"normalization","status":"completed","startedAt":"seed","detail":"Emails lowercased, channels canonicalized"},
        {"name":"derived_features","status":"completed","startedAt":"seed","detail":"Recency, AOV, LTV recomputed"},
        {"name":"model_scores","status":"completed","startedAt":"seed","detail":"Churn, propensity, product fit, engagement"},
        {"name":"warehouse_model","status":"completed","startedAt":"seed","detail":"LOCAL adapter wrote ANALYTICS.CUSTOMER_360"},
        {"name":"semantic_model","status":"completed","startedAt":"seed","detail":"semantic_customer_marketing published"},
        {"name":"product_sync","status":"completed","startedAt":"seed","detail":"PostgreSQL product store refreshed"},
        {"name":"dynamic_segments","status":"completed","startedAt":"seed","detail":"Membership recomputed"}
      ]'::jsonb
    ),
    (
      'run_hist_002', 'wf_sync_nightly', 'schedule', 'completed', 'application',
      ${sql.raw(String(CUSTOMER_COUNT))}, 12,
      (now() - interval '26 hours')::timestamp,
      (now() - interval '25 hours')::timestamp,
      3600000, null,
      '[{"name":"raw_extract","status":"completed","startedAt":"hist","detail":"Nightly extract"},{"name":"product_sync","status":"completed","startedAt":"hist","detail":"12 rows quarantined"}]'::jsonb
    )
  `);

  await db.execute(sql`
    insert into sync_state (dataset, label, source_updated_at, synchronized_at, pipeline_run_id, row_count, status)
    values
      ('customer_360', 'Customer Data', (now() - interval '26 minutes')::timestamp, (now() - interval '3 minutes')::timestamp, 'run_seed_001', ${sql.raw(String(CUSTOMER_COUNT))}, 'healthy'),
      ('customer_scores', 'Scores', (now() - interval '40 minutes')::timestamp, (now() - interval '18 minutes')::timestamp, 'run_seed_001', ${sql.raw(String(CUSTOMER_COUNT))}, 'healthy'),
      ('customer_segments', 'Segments', (now() - interval '20 minutes')::timestamp, (now() - interval '4 minutes')::timestamp, 'run_seed_001', 4, 'healthy'),
      ('campaign_engagement', 'Campaign Engagement', (now() - interval '35 minutes')::timestamp, (now() - interval '12 minutes')::timestamp, 'run_seed_001', 3600, 'healthy')
  `);

  await db.execute(sql`
    insert into activations (
      id, segment_id, segment_name, destination, status, customer_count, segment_version, message, created_at, completed_at
    ) values
    (
      'act_demo_001', 'seg_loyal', 'Loyal High Engagement', 'email', 'completed', 0, 1,
      'Simulated export to Email ESP audience Loyal_High_Engagement.',
      (now() - interval '6 hours')::timestamp,
      (now() - interval '6 hours')::timestamp
    )
  `);

  await recomputeAllSegments();

  await db.insert(appMeta).values({
    key: "seed_version",
    value: SEED_VERSION,
    updatedAt: new Date().toISOString(),
  });

  const countRows = await db.select({ c: sql<number>`count(*)` }).from(customers);
  return {
    seeded: true,
    customerCount: Number(countRows[0]?.c ?? 0),
    tookMs: Date.now() - started,
  };
}
