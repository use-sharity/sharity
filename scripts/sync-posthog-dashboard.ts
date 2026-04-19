import dotenv from "dotenv";

import { EVENTS } from "../lib/posthog/events";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", quiet: true });

const DASHBOARD_NAME = "PMF Dashboard";
const DASHBOARD_DESCRIPTION =
  "Product-market fit dashboard for Sharity's owner -> borrower -> exchange loop.";
const MANAGED_TAG = "sharity-pmf";
const DEFAULT_POSTHOG_APP_HOST = "https://us.posthog.com";

type Dashboard = {
  id: number;
  name: string;
  description?: string;
  deleted?: boolean;
  tags?: string[];
};

type Insight = {
  id: number;
  name: string;
  description?: string;
  query?: unknown;
  dashboards?: number[];
  tags?: string[];
};

type PaginatedResponse<T> = {
  count?: number;
  next?: string | null;
  results: T[];
};

type PostHogConfig = {
  appHost: string;
  environmentId: string;
  personalApiKey: string;
};

type InsightDefinition = {
  key: string;
  name: string;
  description: string;
  query: unknown;
};

type SyncResult = {
  name: string;
  action: "created" | "updated" | "unchanged";
  id: number;
};

function getRequiredEnvVar(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function getConfig(): PostHogConfig {
  const appHost =
    process.env.POSTHOG_APP_HOST?.replace(/\/$/, "") ??
    DEFAULT_POSTHOG_APP_HOST;

  return {
    appHost,
    environmentId: getRequiredEnvVar("POSTHOG_ENVIRONMENT_ID"),
    personalApiKey: getRequiredEnvVar("POSTHOG_PERSONAL_API_KEY"),
  };
}

function getApiUrl(config: PostHogConfig, path: string): string {
  return `${config.appHost}/api/environments/${config.environmentId}${path}`;
}

async function postHogRequest<T>(
  config: PostHogConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(getApiUrl(config, path), {
    ...options,
    headers: {
      Authorization: `Bearer ${config.personalApiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `PostHog API request failed: ${response.status} ${response.statusText} ${path}\n${body}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function listAll<T>(config: PostHogConfig, path: string): Promise<T[]> {
  const results: T[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await postHogRequest<PaginatedResponse<T>>(
      config,
      `${path}${separator}limit=${limit}&offset=${offset}`,
    );

    results.push(...page.results);

    if (!page.next || page.results.length === 0) {
      return results;
    }

    offset += limit;
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );

    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hasTag(item: { tags?: string[] }, tag: string): boolean {
  return item.tags?.includes(tag) ?? false;
}

function getInsightTag(key: string): string {
  return `${MANAGED_TAG}:${key}`;
}

function getManagedTags(key: string): string[] {
  return [MANAGED_TAG, getInsightTag(key)];
}

function getDashboardUrl(config: PostHogConfig, dashboardId: number): string {
  return `${config.appHost}/dashboard/${dashboardId}`;
}

const INSIGHTS: InsightDefinition[] = [
  {
    key: "successful-exchange-rate",
    name: "Successful Exchange Rate",
    description:
      "Funnel conversion from requested item to completed physical handoff over the last 30 days.",
    query: {
      kind: "InsightVizNode",
      source: {
        kind: "FunnelsQuery",
        series: [
          {
            kind: "EventsNode",
            event: EVENTS.CLAIM_REQUESTED,
            name: EVENTS.CLAIM_REQUESTED,
            custom_name: "Claim requested",
          },
          {
            kind: "EventsNode",
            event: EVENTS.EXCHANGE_COMPLETED,
            name: EVENTS.EXCHANGE_COMPLETED,
            custom_name: "Exchange completed",
          },
        ],
        dateRange: {
          date_from: "-30d",
        },
        filterTestAccounts: false,
        funnelsFilter: {
          funnelWindowInterval: 30,
          funnelWindowIntervalUnit: "day",
          funnelVizType: "steps",
        },
      },
    },
  },
  {
    key: "supply-activation-rate",
    name: "Supply Activation Rate",
    description: "Request-to-listing ratio over the last 30 days.",
    query: {
      kind: "InsightVizNode",
      source: {
        kind: "TrendsQuery",
        series: [
          {
            kind: "EventsNode",
            event: EVENTS.CLAIM_REQUESTED,
            name: EVENTS.CLAIM_REQUESTED,
            custom_name: "Requests",
            math: "total",
          },
          {
            kind: "EventsNode",
            event: EVENTS.ITEM_LISTED,
            name: EVENTS.ITEM_LISTED,
            custom_name: "Listings",
            math: "total",
          },
        ],
        trendsFilter: {
          display: "BoldNumber",
          formula: "A / B",
        },
        dateRange: {
          date_from: "-30d",
        },
        interval: "week",
        filterTestAccounts: false,
      },
    },
  },
  {
    key: "repeat-usage-rate",
    name: "Repeat Usage Rate",
    description:
      "Lifecycle view of new, returning, resurrecting, and dormant exchange participants over the last 30 days.",
    query: {
      kind: "InsightVizNode",
      source: {
        kind: "LifecycleQuery",
        series: [
          {
            kind: "EventsNode",
            event: EVENTS.EXCHANGE_COMPLETED,
            name: EVENTS.EXCHANGE_COMPLETED,
            custom_name: "Exchange completed",
          },
        ],
        dateRange: {
          date_from: "-30d",
        },
        interval: "week",
        filterTestAccounts: false,
      },
    },
  },
  {
    key: "time-to-first-exchange",
    name: "Time to First Exchange",
    description:
      "Funnel time from first identified session to first completed exchange.",
    query: {
      kind: "InsightVizNode",
      source: {
        kind: "FunnelsQuery",
        series: [
          {
            kind: "EventsNode",
            event: "$identify",
            name: "$identify",
            custom_name: "Identified",
          },
          {
            kind: "EventsNode",
            event: EVENTS.EXCHANGE_COMPLETED,
            name: EVENTS.EXCHANGE_COMPLETED,
            custom_name: "Exchange completed",
          },
        ],
        dateRange: {
          date_from: "-30d",
        },
        filterTestAccounts: false,
        funnelsFilter: {
          funnelWindowInterval: 30,
          funnelWindowIntervalUnit: "day",
          funnelVizType: "time_to_convert",
        },
      },
    },
  },
];

async function findOrCreateDashboard(config: PostHogConfig): Promise<{
  dashboard: Dashboard;
  action: "created" | "reused";
}> {
  const dashboards = await listAll<Dashboard>(config, "/dashboards/");
  const existingDashboard = dashboards.find(
    (dashboard) => dashboard.name === DASHBOARD_NAME && !dashboard.deleted,
  );

  if (existingDashboard) {
    return { dashboard: existingDashboard, action: "reused" };
  }

  const dashboard = await postHogRequest<Dashboard>(config, "/dashboards/", {
    method: "POST",
    body: JSON.stringify({
      name: DASHBOARD_NAME,
      description: DASHBOARD_DESCRIPTION,
      pinned: true,
      tags: [MANAGED_TAG],
    }),
  });

  return { dashboard, action: "created" };
}

function buildInsightPayload(
  definition: InsightDefinition,
  dashboardId: number,
): Record<string, unknown> {
  return {
    name: definition.name,
    description: definition.description,
    query: definition.query,
    dashboards: [dashboardId],
    tags: getManagedTags(definition.key),
    favorited: true,
  };
}

function shouldUpdateInsight(
  insight: Insight,
  payload: Record<string, unknown>,
): boolean {
  return (
    insight.name !== payload.name ||
    insight.description !== payload.description ||
    stableStringify(insight.query) !== stableStringify(payload.query) ||
    stableStringify(insight.dashboards ?? []) !==
      stableStringify(payload.dashboards) ||
    stableStringify(insight.tags ?? []) !== stableStringify(payload.tags)
  );
}

async function syncInsights(
  config: PostHogConfig,
  dashboardId: number,
): Promise<SyncResult[]> {
  const existingInsights = await listAll<Insight>(config, "/insights/");
  const results: SyncResult[] = [];

  for (const definition of INSIGHTS) {
    const syncTag = getInsightTag(definition.key);
    const payload = buildInsightPayload(definition, dashboardId);
    const existingInsight = existingInsights.find(
      (insight) => hasTag(insight, syncTag) || insight.name === definition.name,
    );

    if (!existingInsight) {
      const created = await postHogRequest<Insight>(config, "/insights/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      results.push({
        name: definition.name,
        action: "created",
        id: created.id,
      });
      continue;
    }

    if (!shouldUpdateInsight(existingInsight, payload)) {
      results.push({
        name: definition.name,
        action: "unchanged",
        id: existingInsight.id,
      });
      continue;
    }

    const updated = await postHogRequest<Insight>(
      config,
      `/insights/${existingInsight.id}/`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    results.push({
      name: definition.name,
      action: "updated",
      id: updated.id,
    });
  }

  return results;
}

async function main(): Promise<void> {
  const config = getConfig();

  console.log(
    `Syncing ${DASHBOARD_NAME} in PostHog environment ${config.environmentId}`,
  );

  const { dashboard, action } = await findOrCreateDashboard(config);
  const results = await syncInsights(config, dashboard.id);

  console.log(`Dashboard ${action}: ${DASHBOARD_NAME} (#${dashboard.id})`);

  for (const result of results) {
    console.log(`Insight ${result.action}: ${result.name} (#${result.id})`);
  }

  console.log(`Dashboard URL: ${getDashboardUrl(config, dashboard.id)}`);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
