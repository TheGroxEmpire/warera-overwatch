import type {
  APIClient,
  GameConfigGetGameConfigResponse,
  ItemTradingGetPricesResponse,
  TransactionListItem,
  UserGetUserLiteResponse
} from "@wareraprojects/api";
import type { WorkStatsItem } from "@wareraprojects/api";
import { analyzeOverwatchData } from "./analyze";
import type {
  OverwatchAuditOptions,
  OverwatchAuditReport,
  OverwatchProgressEvent,
  ResolvedOverwatchSubject
} from "./types";

const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_PAGE_LIMIT = 100;

function emitProgress(
  options: OverwatchAuditOptions,
  event: OverwatchProgressEvent
) {
  options.onProgress?.(event);
}

function ensureUserSelector(options: OverwatchAuditOptions) {
  if (!options.userId && !options.username) {
    throw new Error("Provide either userId or username.");
  }
}

async function resolveByUserId(
  client: APIClient,
  userId: string,
  options: OverwatchAuditOptions
): Promise<ResolvedOverwatchSubject> {
  const startedAt = Date.now();
  const user = await client.user.getUserLite({ userId });
  emitProgress(options, {
    stage: "resolve_subject",
    status: "done",
    message: "Resolved account by user ID",
    username: user.username,
    userId: user._id,
    elapsedMs: Date.now() - startedAt
  });
  return {
    userId: user._id,
    username: user.username,
    user
  };
}

async function resolveByUsername(
  client: APIClient,
  username: string,
  options: OverwatchAuditOptions
): Promise<ResolvedOverwatchSubject> {
  const startedAt = Date.now();
  const search = await client.search.searchAnything({ searchText: username });
  if (!Array.isArray(search.userIds) || search.userIds.length === 0) {
    throw new Error(`No users found for username "${username}".`);
  }

  emitProgress(options, {
    stage: "resolve_subject",
    status: "update",
    message: `Found ${search.userIds.length} possible account IDs`,
    current: Math.min(search.userIds.length, 20),
    total: search.userIds.length,
    elapsedMs: Date.now() - startedAt
  });

  const candidates = await Promise.allSettled(
    search.userIds.slice(0, 20).map((userId) => client.user.getUserLite({ userId }))
  );

  const fulfilled = candidates
    .filter(
      (candidate): candidate is PromiseFulfilledResult<UserGetUserLiteResponse> =>
        candidate.status === "fulfilled"
    )
    .map((candidate) => candidate.value);

  const lowerUsername = username.toLowerCase();
  const exactMatch = fulfilled.find((candidate) => candidate.username.toLowerCase() === lowerUsername);
  if (exactMatch) {
    emitProgress(options, {
      stage: "resolve_subject",
      status: "done",
      message: "Resolved account by username",
      username: exactMatch.username,
      userId: exactMatch._id,
      elapsedMs: Date.now() - startedAt
    });
    return {
      userId: exactMatch._id,
      username: exactMatch.username,
      user: exactMatch
    };
  }

  if (fulfilled.length === 1) {
    emitProgress(options, {
      stage: "resolve_subject",
      status: "done",
      message: "Resolved single username candidate",
      username: fulfilled[0].username,
      userId: fulfilled[0]._id,
      elapsedMs: Date.now() - startedAt
    });
    return {
      userId: fulfilled[0]._id,
      username: fulfilled[0].username,
      user: fulfilled[0]
    };
  }

  const candidateNames = fulfilled.map((candidate) => candidate.username).join(", ");
  throw new Error(
    `Could not resolve an exact username match for "${username}". Candidates: ${candidateNames}`
  );
}

export async function resolveOverwatchSubject(
  client: APIClient,
  options: OverwatchAuditOptions
): Promise<ResolvedOverwatchSubject> {
  ensureUserSelector(options);

  emitProgress(options, {
    stage: "resolve_subject",
    status: "start",
    message: options.userId ? "Resolving account from user ID" : "Searching username"
  });

  if (options.userId) {
    return resolveByUserId(client, options.userId, options);
  }

  return resolveByUsername(client, options.username as string, options);
}

async function collectTransactions(
  client: APIClient,
  userId: string,
  options: OverwatchAuditOptions
): Promise<TransactionListItem[]> {
  const startedAt = Date.now();
  const transactions: TransactionListItem[] = [];
  const seen = new Set<string>();
  const now = options.now ?? new Date();
  const days = options.days ?? DEFAULT_LOOKBACK_DAYS;
  const cursorEnd =
    typeof days === "number" && days > 0
      ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      : undefined;
  let page = 0;

  emitProgress(options, {
    stage: "fetch_transactions",
    status: "start",
    message:
      typeof options.days === "number"
        ? `Fetching transaction history for ${days} day(s)`
        : "Fetching full transaction history",
    page: 0,
    total: options.maxPages,
    transactionCount: 0
  });

  for await (const transactionPage of client.transaction.getPaginatedTransactions({
    userId,
    limit: options.transactionPageLimit ?? DEFAULT_PAGE_LIMIT,
    autoPaginate: true,
    maxPages: options.maxPages,
    cursorEnd
  })) {
    page += 1;
    for (const item of transactionPage.items) {
      if (typeof item._id === "string" && seen.has(item._id)) {
        continue;
      }
      if (typeof item._id === "string") {
        seen.add(item._id);
      }
      transactions.push(item);
    }

    emitProgress(options, {
      stage: "fetch_transactions",
      status: "update",
      message: "Fetched transaction page",
      page,
      total: options.maxPages,
      transactionCount: transactions.length,
      elapsedMs: Date.now() - startedAt
    });
  }

  emitProgress(options, {
    stage: "fetch_transactions",
    status: "done",
    message: "Finished transaction fetch",
    page,
    total: options.maxPages,
    transactionCount: transactions.length,
    elapsedMs: Date.now() - startedAt
  });

  return transactions;
}

type SupplementalData = {
  gameConfig: GameConfigGetGameConfigResponse | null;
  marketPrices: ItemTradingGetPricesResponse | null;
  workStats: WorkStatsItem[] | null;
};

async function fetchSupplementalData(
  client: APIClient,
  user: UserGetUserLiteResponse,
  days: number,
  timezone: string,
  options: OverwatchAuditOptions
): Promise<SupplementalData> {
  const startedAt = Date.now();
  let completed = 0;
  const total = 3;

  emitProgress(options, {
    stage: "fetch_supplemental",
    status: "start",
    message: "Fetching supporting datasets",
    current: completed,
    total
  });

  const track = async <T>(
    requestName: string,
    promise: Promise<T>
  ): Promise<T | null> => {
    const value = await promise.catch(() => null);
    completed += 1;
    emitProgress(options, {
      stage: "fetch_supplemental",
      status: completed === total ? "done" : "update",
      message: "Fetched supporting dataset",
      current: completed,
      total,
      requestName,
      elapsedMs: Date.now() - startedAt
    });
    return value;
  };

  const [gameConfig, marketPrices, workStats] = await Promise.all([
    track("gameConfig", client.gameConfig.getGameConfig()),
    track("itemTrading", client.itemTrading.getPrices()),
    track(
      "workStats",
      client.work
      .getStatsByUserId({
        userId: user._id,
        days,
        timezone
      })
    )
  ]);

  return {
    gameConfig,
    marketPrices,
    workStats
  };
}

function extractUserIdsFromReport(report: OverwatchAuditReport): string[] {
  const userIds = new Set<string>([report.user.userId]);

  for (const counterparty of report.summary.counterparties.slice(0, 50)) {
    if (counterparty.kind === "user" && counterparty.key.startsWith("user:")) {
      userIds.add(counterparty.key.slice("user:".length));
    }
  }

  for (const pair of report.summary.pairAnalysis.pairs) {
    if (pair.sellerId !== "unknown") {
      userIds.add(pair.sellerId);
    }
    if (pair.buyerId !== "unknown") {
      userIds.add(pair.buyerId);
    }
  }

  return [...userIds];
}

async function resolveUserDirectory(
  client: APIClient,
  userIds: string[],
  options: OverwatchAuditOptions
): Promise<Map<string, string>> {
  const directory = new Map<string, string>();
  const uniqueIds = [...new Set(userIds)].filter((userId) => userId && userId !== "unknown");
  const total = uniqueIds.length;
  const chunkSize = 50;
  let completed = 0;

  if (total === 0) {
    return directory;
  }

  emitProgress(options, {
    stage: "resolve_labels",
    status: "start",
    message: "Resolving user IDs to usernames",
    current: 0,
    total
  });

  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    const responses = await Promise.allSettled(
      chunk.map((userId) => client.user.getUserLite({ userId }))
    );

    for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
      const userId = chunk[chunkIndex];
      const response = responses[chunkIndex];
      if (response.status === "fulfilled") {
        directory.set(userId, response.value.username);
      }
    }

    completed += chunk.length;
    emitProgress(options, {
      stage: "resolve_labels",
      status: completed >= total ? "done" : "update",
      message: "Resolved usernames",
      current: Math.min(completed, total),
      total
    });
  }

  return directory;
}

function applyUserDirectory(report: OverwatchAuditReport, directory: Map<string, string>) {
  const resolveUserLabel = (label: string): string => {
    if (!label.startsWith("user:")) {
      return label;
    }

    return directory.get(label.slice("user:".length)) ?? label;
  };

  for (const counterparty of report.summary.counterparties) {
    if (counterparty.kind === "user" && counterparty.key.startsWith("user:")) {
      const userId = counterparty.key.slice("user:".length);
      counterparty.displayName = directory.get(userId) ?? counterparty.displayName;
    }
  }

  for (const pair of report.summary.pairAnalysis.pairs) {
    pair.sellerLabel = directory.get(pair.sellerId) ?? pair.sellerLabel;
    pair.buyerLabel = directory.get(pair.buyerId) ?? pair.buyerLabel;
  }

  if (report.summary.work) {
    for (const pair of report.summary.work.wagePairs) {
      pair.sellerLabel = directory.get(pair.sellerId) ?? pair.sellerLabel;
      pair.buyerLabel = directory.get(pair.buyerId) ?? pair.buyerLabel;
    }
  }

  if (report.normalizedTransactions) {
    for (const transaction of report.normalizedTransactions) {
      if (transaction.counterpartyKind === "user" && transaction.counterpartyKey.startsWith("user:")) {
        const userId = transaction.counterpartyKey.slice("user:".length);
        transaction.counterpartyLabel = directory.get(userId) ?? transaction.counterpartyLabel;
      }
    }
  }

  for (const example of report.summary.timingAnalysis.rapidOfferFills) {
    example.counterparty = resolveUserLabel(example.counterparty);
  }

  for (const example of report.summary.timingAnalysis.rapidBuyGaps) {
    example.previousCounterparty = resolveUserLabel(example.previousCounterparty);
    example.counterparty = resolveUserLabel(example.counterparty);
  }

  for (const signal of report.suspiciousSignals) {
    for (const [userId, username] of directory.entries()) {
      const needle = `user:${userId}`;
      if (signal.summary.includes(needle)) {
        signal.summary = signal.summary.split(needle).join(username);
      }
      signal.evidence = signal.evidence.map((item) =>
        item.includes(needle) ? item.split(needle).join(username) : item
      );
    }
  }
}

export async function buildOverwatchReport(
  client: APIClient,
  options: OverwatchAuditOptions
): Promise<OverwatchAuditReport> {
  const timezone = options.timezone ?? "UTC";
  const days = options.days ?? DEFAULT_LOOKBACK_DAYS;
  const subject = await resolveOverwatchSubject(client, options);
  const [transactions, supplemental] = await Promise.all([
    collectTransactions(client, subject.userId, options),
    fetchSupplementalData(client, subject.user, days, timezone, options)
  ]);

  const analyzeStartedAt = Date.now();
  emitProgress(options, {
    stage: "analyze",
    status: "start",
    message: "Running audit rules",
    transactionCount: transactions.length
  });

  const report = analyzeOverwatchData({
    user: subject.user,
    transactions,
    gameConfig: supplemental.gameConfig,
    marketPrices: supplemental.marketPrices,
    workStats: supplemental.workStats,
    options: {
      days: options.days,
      includeTransactions: options.includeTransactions,
      thresholds: options.thresholds,
      timezone,
      now: options.now,
      maxPages: options.maxPages,
      transactionPageLimit: options.transactionPageLimit
    }
  });

  emitProgress(options, {
    stage: "analyze",
    status: "done",
    message: "Audit analysis complete",
    transactionCount: transactions.length,
    elapsedMs: Date.now() - analyzeStartedAt
  });

  const userDirectory = await resolveUserDirectory(
    client,
    extractUserIdsFromReport(report),
    options
  );
  applyUserDirectory(report, userDirectory);

  return report;
}
