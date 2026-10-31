
import { catalog } from "./catalog";
import { validateSemanticQuery } from "./query-planner";
import type { SemanticFilter, SemanticQuery } from "./types";

const CHANNELS = [
  "Paid Search",
  "Organic Search",
  "Email",
  "Referral",
  "Paid Social",
  "Affiliate",
  "Direct",
  "Partnership",
];

const CATEGORIES = [
  "Electronics",
  "Apparel",
  "Home",
  "Beauty",
  "Sports",
  "Outdoor",
  "Grocery",
];

function pushUnique(
  filters: SemanticFilter[],
  filter: SemanticFilter
) {
  if (
    !filters.some(
      (item) =>
        item.field === filter.field &&
        item.operator === filter.operator
    )
  ) {
    filters.push(filter);
  }
}

function detectCategory(
  question: string
): string | undefined {
  return CATEGORIES.find((item) =>
    question.includes(item.toLowerCase())
  );
}

function detectChannel(
  question: string
): string | undefined {
  return CHANNELS.find((item) =>
    question.includes(item.toLowerCase())
  );
}

function detectState(
  question: string
): string | undefined {
  const match = question.match(
    /\b(new york|california|texas|florida|washington|colorado|illinois|georgia|arizona|massachusetts)\b/
  );

  if (!match) return undefined;

  const map: Record<string, string> = {
    "new york": "NY",
    california: "CA",
    texas: "TX",
    florida: "FL",
    washington: "WA",
    colorado: "CO",
    illinois: "IL",
    georgia: "GA",
    arizona: "AZ",
    massachusetts: "MA",
  };

  return map[match[1]];
}

export function planFromQuestion(
  question: string
): SemanticQuery {
  const q = question
    .toLowerCase()
    .replace(/[?]/g, "")
    .trim();

  const filters: SemanticFilter[] = [];

  let intent: SemanticQuery["intent"] =
    "list_customers";

  let groupBy: string[] = [];
  let metrics: string[] = [];

  let sort: SemanticQuery["sort"] = [
    {
      field: "lifetime_value",
      direction: "desc",
    },
  ];

  let dimensions: string[] = [];
  let limit = 100;

  const wantsHighValue =
    /high[- ]value|highest lifetime|highest ltv|\bltv\b|lifetime value/.test(q);

  const wantsChurn = /churn/.test(q);

  const wantsRecentPurchase =
    /last 90|past 90|purchased (during|in) the last|purchased recently|recent purchase/.test(q);

  const wantsLowEngagement =
    /not engaged|stopped engaging|have not engaged|no campaign|without campaign/.test(q);

  const wantsPropensity = /propens/.test(q);

  const wantsElectronics =
    q.includes("electronics");

  const wantsPercent =
    /percent|percentage|what share|what %/.test(q);

  const wantsCount =
    /how many customers|number of customers|count of customers|customer count/.test(q);

  const wantsCompare =
    /compare|across|by segment/.test(q);

  const wantsChannels =
    /acquisition channel/.test(q);

  const wantsStates =
    /which states|by state|highest average customer value/.test(q);

  const wantsAudience =
    /create an audience|build (a |an )?audience|segment of/.test(q);

  // Apply semantic filters.

  if (
    wantsHighValue &&
    !/highest lifetime value$/.test(q)
  ) {
    pushUnique(filters, {
      field: "lifetime_value",
      operator: "gt",
      value: 1000,
    });
  }

  if (wantsChurn) {
    const numeric = q.match(
      /churn[^\d]*(\d{2,3})\s*%/
    );

    const threshold = numeric
      ? Number(numeric[1]) / 100
      : 0.7;

    pushUnique(filters, {
      field: "churn_score",
      operator: "gt",
      value: threshold,
    });
  }

  if (wantsRecentPurchase) {
    pushUnique(filters, {
      field: "days_since_last_purchase",
      operator: "lte",
      value: 90,
    });
  }

  if (wantsLowEngagement) {
    pushUnique(filters, {
      field: "campaign_engagement_score",
      operator: "lt",
      value: 0.25,
    });

    pushUnique(filters, {
      field: "days_since_last_purchase",
      operator: "lte",
      value: 90,
    });
  }

  if (wantsPropensity) {
    pushUnique(filters, {
      field: "purchase_propensity_score",
      operator: "gte",
      value: 0.65,
    });
  }

  if (
    wantsElectronics ||
    detectCategory(q) === "Electronics"
  ) {
    pushUnique(filters, {
      field: "favorite_category",
      operator: "eq",
      value: "Electronics",
    });
  } else {
    const category = detectCategory(q);

    if (category) {
      pushUnique(filters, {
        field: "favorite_category",
        operator: "eq",
        value: category,
      });
    }
  }

  const channel = detectChannel(q);

  if (channel) {
    pushUnique(filters, {
      field: "acquisition_channel",
      operator: "eq",
      value: channel,
    });
  }

  const state = detectState(q);

  if (state) {
    pushUnique(filters, {
      field: "state",
      operator: "eq",
      value: state,
    });
  }

  if (
    /active customers|status active/.test(q)
  ) {
    pushUnique(filters, {
      field: "customer_status",
      operator: "eq",
      value: "active",
    });
  }

  // Determine query intent.

  if (
    (wantsPercent || wantsCount) &&
    wantsChurn
  ) {
    intent = "metric";
    metrics = ["customer_count"];
    sort = [];
    limit = 1;
  } else if (wantsChannels) {
    intent = "aggregate";
    groupBy = ["acquisition_channel"];

    metrics = [
      "lifetime_value",
      "customer_count",
      "churn_score",
    ];

    dimensions = ["acquisition_channel"];

    sort = [
      {
        field: "lifetime_value",
        direction: "desc",
      },
    ];

    limit = 20;
  } else if (wantsStates) {
    intent = "aggregate";
    groupBy = ["state"];

    metrics = [
      "lifetime_value",
      "customer_count",
    ];

    dimensions = ["state"];

    sort = [
      {
        field: "lifetime_value",
        direction: "desc",
      },
    ];

    limit = 25;
  } else if (wantsCompare) {
    intent = "aggregate";
    groupBy = ["customer_status"];

    metrics = [
      "churn_score",
      "lifetime_value",
      "customer_count",
    ];

    dimensions = ["customer_status"];

    sort = [
      {
        field: "churn_score",
        direction: "desc",
      },
    ];
  } else if (
    /highest lifetime value|highest ltv/.test(q) &&
    !wantsChurn
  ) {
    intent = "list_customers";

    sort = [
      {
        field: "lifetime_value",
        direction: "desc",
      },
    ];

    limit = 25;
  }

  if (wantsAudience) {
    intent = "list_customers";
    limit = 200;
  }

  if (
    !metrics.length &&
    intent === "list_customers"
  ) {
    metrics = [
      "lifetime_value",
      "churn_score",
      "campaign_engagement_score",
    ];

    dimensions = [
      "customer_id",
      "first_name",
      "last_name",
      "email",
      "state",
      "favorite_category",
    ];
  }

  const planned = validateSemanticQuery({
    intent,
    dimensions,
    metrics,
    filters,
    groupBy,
    sort,
    limit,
  });

  return planned;
}

export const EXAMPLE_QUESTIONS = [
  "Which customers have the highest lifetime value?",
  "Show high-value customers at risk of churn.",
  "Which acquisition channels produce the highest LTV?",
  "Compare churn risk across customer segments.",
  "Which customers purchased recently but stopped engaging with campaigns?",
  "Create an audience of high-propensity customers interested in electronics.",
  "What percentage of customers have churn risk above 70%?",
  "How many customers have churn risk above 70%?",
  "Which states have the highest average customer value?",
  "Show high-value customers with churn risk above 70% who purchased during the last 90 days but have not engaged with a campaign during the last 30 days.",
];

export function interpretQuestion(
  question: string
): string {
  const plan = planFromQuestion(question);

  if (plan.intent === "aggregate") {
    return `Break down ${plan.metrics.join(
      ", "
    )} by ${plan.groupBy.join(
      ", "
    )} using governed semantic fields.`;
  }

  if (plan.intent === "metric") {
    return `Compute a population metric using ${
      plan.filters.length
        ? "the stated filters"
        : "the full customer base"
    }.`;
  }

  if (!plan.filters.length) {
    return `List customers ranked by ${
      plan.sort[0]?.field ??
      "lifetime_value"
    }.`;
  }

  return `Find customers matching ${
    plan.filters.length
  } governed rule${
    plan.filters.length === 1
      ? ""
      : "s"
  } from the semantic layer (${catalog.name}).`;
}
