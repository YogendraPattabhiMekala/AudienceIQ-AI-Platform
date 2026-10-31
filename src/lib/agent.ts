
import { catalog, definitionsForFields } from "./catalog";
import { interpretQuestion, planFromQuestion } from "./nl-planner";
import {
  QueryValidationError,
  validateSemanticQuery,
} from "./query-planner";
import { executeSemanticQuery } from "./query-executor";
import {
  getCustomerFreshness,
  productDataSourceLabel,
  warehouseAdapterName,
} from "./freshness";
import { db } from "@/db";
import { aiQueryLogs, customers } from "@/db/schema";
import { count, sql } from "drizzle-orm";
import type {
  QueryExplanation,
  SemanticQuery,
} from "./types";

const PLANNER_SCHEMA = `{
  "intent": "list_customers | aggregate | metric | distribution",
  "dimensions": string[],
  "metrics": string[],
  "filters": [{ "field": string, "operator": "eq|neq|gt|gte|lt|lte|in|between|contains", "value": unknown }],
  "groupBy": string[],
  "sort": [{ "field": string, "direction": "asc|desc" }],
  "limit": number
}`;

async function llmPlan(
  question: string
): Promise<SemanticQuery | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const baseUrl =
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1";

  const model =
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  const allowed = {
    dimensions: catalog.dimensions.map(
      (item) => item.name
    ),
    metrics: catalog.metrics.map(
      (item) => item.name
    ),
    operators: catalog.operators,
    definitions: catalog.definitions,
  };

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    12000
  );

  try {
    const response = await fetch(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: {
            type: "json_object",
          },
          messages: [
            {
              role: "system",
              content: `You are the AudienceIQ semantic query planner. Convert marketing questions into a governed JSON plan. Never emit SQL. Only use allow-listed fields. Schema: ${PLANNER_SCHEMA}. Allow-list: ${JSON.stringify(
                allowed
              )}. High value means lifetime_value > 1000. High churn means churn_score > 0.70. Recent purchase means days_since_last_purchase <= 90. Not engaged in 30 days means campaign_engagement_score < 0.25.`,
            },
            {
              role: "user",
              content: question,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: {
        message?: {
          content?: string;
        };
      }[];
    };

    const content =
      payload.choices?.[0]?.message?.content;

    if (!content) {
      return null;
    }

    return validateSemanticQuery(
      JSON.parse(content)
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isPercentageQuestion(
  question: string
): boolean {
  return /percent|percentage|what share|what %|how much of/i.test(
    question
  );
}

function getMetricCount(
  rows: Record<string, unknown>[]
): number {
  const row = rows[0];

  if (!row) {
    return 0;
  }

  const value =
    row.customer_count ??
    row.customerCount ??
    0;

  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

function summarize(
  plan: SemanticQuery,
  rows: Record<string, unknown>[],
  extras?: {
    percent?: number;
    question?: string;
  }
): string {
  if (plan.intent === "metric") {
    const metricCount = getMetricCount(rows);

    if (
      isPercentageQuestion(extras?.question ?? "") &&
      extras?.percent !== undefined
    ) {
      return `${(
        extras.percent * 100
      ).toFixed(1)}% of customers match the governed filters.`;
    }

    return `${metricCount.toLocaleString(
      "en-US"
    )} customers match the governed filters.`;
  }

  if (plan.intent === "aggregate") {
    const dimension =
      plan.groupBy[0] ?? "group";

    const top = rows[0];

    if (!top) {
      return "No grouped rows matched the semantic query.";
    }

    return `Top ${dimension} is ${String(
      top[dimension] ?? "unknown"
    )} based on ${plan.metrics.join(", ")}.`;
  }

  if (!rows.length) {
    return "No customers matched those governed filters.";
  }

  return `Returned ${rows.length} customer${
    rows.length === 1 ? "" : "s"
  } from the synchronized product store using ${
    plan.filters.length
  } semantic filter${
    plan.filters.length === 1 ? "" : "s"
  }.`;
}

export async function askAudienceIq(
  question: string
) {
  const trimmed = question.trim();

  if (!trimmed) {
    throw new QueryValidationError(
      "Enter a question about customers, scores, or segments."
    );
  }

  if (trimmed.length > 800) {
    throw new QueryValidationError(
      "Questions are limited to 800 characters."
    );
  }

  if (
    /(drop|delete|truncate|insert|update)\s+(table|from|into)/i.test(
      trimmed
    )
  ) {
    throw new QueryValidationError(
      "The agent cannot run arbitrary or destructive SQL. Ask a marketing question instead."
    );
  }

  const started = Date.now();

  let planner: "deterministic" | "llm" =
    "deterministic";

  let plan = planFromQuestion(trimmed);

  const llm = await llmPlan(trimmed);

  if (llm) {
    plan = llm;
    planner = "llm";
  }

  const executed =
    await executeSemanticQuery(plan);

  const freshness =
    await getCustomerFreshness();

  const resultRows =
    executed.rows as Record<string, unknown>[];

  let percent: number | undefined;

  if (plan.intent === "metric") {
    const [{ total }] = await db
      .select({
        total: count(),
      })
      .from(customers);

    const matching =
      getMetricCount(resultRows);

    percent =
      Number(total) > 0
        ? matching / Number(total)
        : 0;
  }

  const fields = [
    ...plan.dimensions,
    ...plan.metrics,
    ...plan.filters.map(
      (filter) => filter.field
    ),
    ...plan.groupBy,
  ];

  const explanation: QueryExplanation = {
    interpretedQuestion:
      interpretQuestion(trimmed),

    selectedDimensions:
      plan.dimensions,

    selectedMetrics:
      plan.metrics,

    appliedFilters:
      plan.filters,

    groupBy:
      plan.groupBy,

    businessDefinitions:
      definitionsForFields(fields),

    queryRepresentation:
      executed.representation,

    generatedQuery:
      executed.generatedQuery,

    dataSource:
      productDataSourceLabel(),

    warehouseAdapter:
      warehouseAdapterName(),

    dataFreshness: freshness
      ? freshness.freshnessLabel
      : "freshness unknown",

    synchronizedAt:
      freshness?.synchronizedAt ?? null,

    executionTimeMs:
      executed.executionTimeMs,

    planner,

    warnings:
      planner === "deterministic" &&
      !process.env.OPENAI_API_KEY
        ? [
            "DEMO_MODE planner: no LLM key configured. The governed deterministic planner produced this plan.",
          ]
        : [],
  };

  const chart = buildChart(
    plan,
    resultRows
  );

  const summary = summarize(
    plan,
    resultRows,
    {
      percent,
      question: trimmed,
    }
  );

  await db.insert(aiQueryLogs).values({
    id: `ask_${Date.now().toString(36)}`,

    question: trimmed,

    interpreted:
      explanation.interpretedQuestion,

    plan,

    explanation,

    resultCount:
      executed.rowCount,

    executionTimeMs:
      Date.now() - started,

    planner,

    createdAt:
      new Date().toISOString(),
  });

  return {
    question: trimmed,

    summary,

    percent:
      isPercentageQuestion(trimmed)
        ? percent ?? null
        : null,

    plan,

    explanation,

    rows:
      executed.rows,

    rowCount:
      executed.rowCount,

    chart,

    demoMode:
      process.env.DEMO_MODE !== "false",
  };
}

function buildChart(
  plan: SemanticQuery,
  rows: Record<string, unknown>[]
) {
  if (plan.intent === "metric") {
    return {
      type: "bar" as const,
      title: "Matching customers",
      data: [
        {
          label: "Customers",
          value: getMetricCount(rows),
        },
      ],
    };
  }

  if (
    (plan.intent === "aggregate" ||
      plan.intent === "distribution") &&
    plan.groupBy[0]
  ) {
    const dimension =
      plan.groupBy[0];

    const metric =
      plan.metrics.find(
        (item) =>
          item !== "customer_count"
      ) ?? "customer_count";

    return {
      type: "bar" as const,

      title:
        `${metric} by ${dimension}`,

      data: rows
        .slice(0, 12)
        .map((row) => ({
          label: String(
            row[dimension] ?? "—"
          ),

          value: Number(
            row[metric] ??
              row.customer_count ??
              0
          ),
        })),
    };
  }

  return {
    type: "bar" as const,

    title:
      "Lifetime value (result set)",

    data: rows
      .slice(0, 12)
      .map((row) => ({
        label:
          `${row.firstName ?? row.first_name ?? ""} ${
            row.lastName ?? row.last_name ?? ""
          }`.trim() ||
          String(row.id ?? ""),

        value: Number(
          row.lifetimeValue ??
            row.lifetime_value ??
            0
        ),
      })),
  };
}

export async function populationSnapshot() {
  const [row] = await db
    .select({
      customers: count(),

      avgLtv: sql<number>`
        avg(${customers.lifetimeValue})
      `,
    })
    .from(customers);

  return row;
}
