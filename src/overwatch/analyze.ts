import type {
  GameConfigGetGameConfigResponse,
  ItemTradingGetPricesResponse,
  TransactionListItem
} from "@wareraprojects/api";
import type { WorkStatsItem } from "@wareraprojects/api";
import { mergeOverwatchThresholds } from "./config";
import type {
  ItemCatalogEntry,
  MarketPriceOutlierExample,
  NormalizedTransaction,
  OverwatchAuditInput,
  OverwatchAuditReport,
  OverwatchCaseDropCaseSummary,
  OverwatchCaseDropItemSummary,
  OverwatchCaseDropRarityComparison,
  OverwatchCategorySummary,
  OverwatchCounterpartySummary,
  OverwatchCraftCheckSummary,
  OverwatchMarketBenchmarkSummary,
  OverwatchPairAnalysisSummary,
  OverwatchPairSummary,
  OverwatchSeverity,
  OverwatchSignal,
  OverwatchSignalCode,
  OverwatchThresholds,
  OverwatchTimingAnomalySummary,
  OverwatchWeeklyCategorySummary,
  OverwatchWeeklySummary,
  SupportedTransactionType,
  WageObservationSummary
} from "./types";

type CategoryAccumulator = {
  type: SupportedTransactionType;
  transactionCount: number;
  moneyIn: number;
  moneyOut: number;
  itemInQuantity: number;
  itemOutQuantity: number;
  estimatedItemValueIn: number;
  estimatedItemValueOut: number;
};

type CounterpartyAccumulator = {
  key: string;
  displayName: string;
  kind: "user" | "country" | "mu" | "system" | "unknown";
  transactionCount: number;
  moneyIn: number;
  moneyOut: number;
  transactionTypeCounts: Partial<Record<SupportedTransactionType, number>>;
};

type PairAccumulator = {
  transactionType: SupportedTransactionType;
  sellerId: string;
  buyerId: string;
  totalQuantity: number;
  totalMoney: number;
  transactionCount: number;
};

type NormalizationContext = {
  subjectUserId: string;
  itemCatalog: Map<string, ItemCatalogEntry>;
  priceMap: Record<string, number>;
};

const KNOWN_TRANSACTION_TYPES: ReadonlySet<string> = new Set([
  "applicationFee",
  "trading",
  "itemMarket",
  "wage",
  "donation",
  "articleTip",
  "openCase",
  "craftItem",
  "dismantleItem",
  "battleLoot"
]);

const CATEGORY_ORDER: SupportedTransactionType[] = [
  "trading",
  "itemMarket",
  "wage",
  "donation",
  "articleTip",
  "openCase",
  "craftItem",
  "dismantleItem",
  "battleLoot",
  "applicationFee",
  "unknown"
];

const HIGH_VALUE_RARITIES = new Set(["legendary", "mythic"]);
const CASE_RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const CRAFT_SCRAP_COST_BY_RARITY: Record<string, number> = {
  common: 6,
  uncommon: 18,
  rare: 54,
  epic: 162,
  legendary: 486,
  mythic: 1458
};
const OFFICIAL_CASE_RATES: Record<
  string,
  { label: string; rarityShares: Partial<Record<string, number>> }
> = {
  case1: {
    label: "Case",
    rarityShares: {
      common: 0.62,
      uncommon: 0.3,
      rare: 0.071,
      epic: 0.0085,
      legendary: 0.0004,
      mythic: 0.0001
    }
  },
  case2: {
    label: "Elite Case",
    rarityShares: {
      uncommon: 0.5,
      rare: 0.32,
      epic: 0.15,
      legendary: 0.025,
      mythic: 0.005
    }
  }
};
const PAIR_ANALYSIS_TYPES = new Set<SupportedTransactionType>([
  "wage",
  "articleTip",
  "itemMarket"
]);
const MARKET_TIMING_TYPES = new Set<SupportedTransactionType>(["itemMarket"]);
const EXTERNAL_FLOW_TYPES = new Set<SupportedTransactionType>([
  "trading",
  "itemMarket",
  "wage",
  "donation",
  "articleTip",
  "applicationFee"
]);

function asTransactionType(value: string | undefined): SupportedTransactionType {
  if (!value || !KNOWN_TRANSACTION_TYPES.has(value)) {
    return "unknown";
  }

  return value as SupportedTransactionType;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getSeverityRank(severity: OverwatchSeverity): number {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    case "info":
    default:
      return 0;
  }
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getLocalDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function getWeekStart(isoDateTime: string, timezone: string): string {
  const date = new Date(isoDateTime);
  const { year, month, day } = getLocalDateParts(date, timezone);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDate.getUTCDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - diffToMonday);
  return toIsoDate(localDate);
}

function buildItemCatalog(
  gameConfig?: GameConfigGetGameConfigResponse | null
): Map<string, ItemCatalogEntry> {
  const catalog = new Map<string, ItemCatalogEntry>();
  const items = gameConfig?.items as Record<string, unknown> | undefined;

  if (!items) {
    return catalog;
  }

  for (const value of Object.values(items)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    const record = value as Record<string, unknown>;
    if (typeof record.code !== "string") {
      continue;
    }

    catalog.set(record.code, {
      code: record.code,
      rarity: typeof record.rarity === "string" ? record.rarity : undefined,
      type: typeof record.type === "string" ? record.type : undefined,
      usage: typeof record.usage === "string" ? record.usage : undefined
    });
  }

  return catalog;
}

function buildPriceMap(prices?: ItemTradingGetPricesResponse | null): Record<string, number> {
  const map: Record<string, number> = {};

  if (!prices) {
    return map;
  }

  for (const [key, value] of Object.entries(prices)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      map[key] = value;
    }
  }

  return map;
}

function normalizeQuantity(transaction: TransactionListItem): number {
  if (typeof transaction.quantity === "number" && Number.isFinite(transaction.quantity)) {
    return transaction.quantity;
  }

  if (
    transaction.item &&
    typeof transaction.item.quantity === "number" &&
    Number.isFinite(transaction.item.quantity)
  ) {
    return transaction.item.quantity;
  }

  return transaction.itemCode || transaction.item?.code ? 1 : 0;
}

function resolveCounterparty(
  transaction: TransactionListItem,
  role: NormalizedTransaction["role"],
  subjectUserId: string
): Pick<
  NormalizedTransaction,
  "counterpartyKey" | "counterpartyKind" | "counterpartyLabel"
> {
  if (role === "self") {
    return {
      counterpartyKey: `user:${subjectUserId}`,
      counterpartyKind: "user",
      counterpartyLabel: `user:${subjectUserId}`
    };
  }

  if (role === "buyer") {
    if (transaction.sellerId) {
      return {
        counterpartyKey: `user:${transaction.sellerId}`,
        counterpartyKind: "user",
        counterpartyLabel: `user:${transaction.sellerId}`
      };
    }

    if (transaction.sellerCountryId) {
      return {
        counterpartyKey: `country:${transaction.sellerCountryId}`,
        counterpartyKind: "country",
        counterpartyLabel: `country:${transaction.sellerCountryId}`
      };
    }

    if (transaction.sellerMuId) {
      return {
        counterpartyKey: `mu:${transaction.sellerMuId}`,
        counterpartyKind: "mu",
        counterpartyLabel: `mu:${transaction.sellerMuId}`
      };
    }

    return {
      counterpartyKey: "system",
      counterpartyKind: "system",
      counterpartyLabel: "system"
    };
  }

  if (role === "seller" && transaction.buyerId) {
    return {
      counterpartyKey: `user:${transaction.buyerId}`,
      counterpartyKind: "user",
      counterpartyLabel: `user:${transaction.buyerId}`
    };
  }

  return {
    counterpartyKey: "unknown",
    counterpartyKind: "unknown",
    counterpartyLabel: "unknown"
  };
}

function normalizeTransaction(
  transaction: TransactionListItem,
  context: NormalizationContext
): NormalizedTransaction {
  const type = asTransactionType(transaction.transactionType);
  const itemCode = transaction.item?.code ?? transaction.itemCode;
  const itemMeta = itemCode ? context.itemCatalog.get(itemCode) : undefined;
  const quantity = normalizeQuantity(transaction);
  const money =
    typeof transaction.money === "number" && Number.isFinite(transaction.money)
      ? transaction.money
      : 0;

  const isBuyer = transaction.buyerId === context.subjectUserId;
  const isSeller = transaction.sellerId === context.subjectUserId;

  let role: NormalizedTransaction["role"] = "unknown";
  if (isBuyer && isSeller) {
    role = "self";
  } else if (isBuyer) {
    role = "buyer";
  } else if (isSeller) {
    role = "seller";
  }

  const { counterpartyKey, counterpartyKind, counterpartyLabel } = resolveCounterparty(
    transaction,
    role,
    context.subjectUserId
  );

  const moneyDelta = role === "buyer" ? -money : role === "seller" ? money : 0;
  const itemDeltaQuantity =
    !itemCode ? 0 : role === "buyer" ? quantity : role === "seller" ? -quantity : 0;
  const estimatedUnitPrice = itemCode ? context.priceMap[itemCode] : undefined;
  const estimatedItemValueDelta =
    typeof estimatedUnitPrice === "number"
      ? round(itemDeltaQuantity * estimatedUnitPrice)
      : 0;

  return {
    transactionId: transaction._id,
    createdAt: transaction.createdAt,
    type,
    role,
    counterpartyKey,
    counterpartyKind,
    counterpartyLabel,
    itemCode,
    itemRarity: itemMeta?.rarity,
    itemType: itemMeta?.type,
    quantity,
    money,
    moneyDelta: round(moneyDelta),
    itemDeltaQuantity,
    estimatedUnitPrice,
    estimatedItemValueDelta,
    original: transaction
  };
}

function createCategoryAccumulator(type: SupportedTransactionType): CategoryAccumulator {
  return {
    type,
    transactionCount: 0,
    moneyIn: 0,
    moneyOut: 0,
    itemInQuantity: 0,
    itemOutQuantity: 0,
    estimatedItemValueIn: 0,
    estimatedItemValueOut: 0
  };
}

function finalizeCategorySummary(acc: CategoryAccumulator): OverwatchCategorySummary {
  const netMoney = round(acc.moneyIn - acc.moneyOut);
  const estimatedNetWealthDelta = round(
    netMoney + acc.estimatedItemValueIn - acc.estimatedItemValueOut
  );

  return {
    type: acc.type,
    transactionCount: acc.transactionCount,
    moneyIn: round(acc.moneyIn),
    moneyOut: round(acc.moneyOut),
    netMoney,
    itemInQuantity: round(acc.itemInQuantity),
    itemOutQuantity: round(acc.itemOutQuantity),
    estimatedItemValueIn: round(acc.estimatedItemValueIn),
    estimatedItemValueOut: round(acc.estimatedItemValueOut),
    estimatedNetWealthDelta
  };
}

function summarizeCategories(
  transactions: NormalizedTransaction[]
): OverwatchCategorySummary[] {
  const byType = new Map<SupportedTransactionType, CategoryAccumulator>();

  for (const type of CATEGORY_ORDER) {
    byType.set(type, createCategoryAccumulator(type));
  }

  for (const transaction of transactions) {
    const summary = byType.get(transaction.type) ?? createCategoryAccumulator(transaction.type);
    summary.transactionCount += 1;

    if (transaction.moneyDelta >= 0) {
      summary.moneyIn += transaction.moneyDelta;
    } else {
      summary.moneyOut += Math.abs(transaction.moneyDelta);
    }

    if (transaction.itemDeltaQuantity >= 0) {
      summary.itemInQuantity += transaction.itemDeltaQuantity;
    } else {
      summary.itemOutQuantity += Math.abs(transaction.itemDeltaQuantity);
    }

    if (transaction.estimatedItemValueDelta >= 0) {
      summary.estimatedItemValueIn += transaction.estimatedItemValueDelta;
    } else {
      summary.estimatedItemValueOut += Math.abs(transaction.estimatedItemValueDelta);
    }

    byType.set(transaction.type, summary);
  }

  return [...byType.values()]
    .map(finalizeCategorySummary)
    .filter((summary) => summary.transactionCount > 0);
}

function summarizeWeekly(
  transactions: NormalizedTransaction[],
  timezone: string
): OverwatchWeeklySummary[] {
  const weekly = new Map<
    string,
    {
      transactionCount: number;
      moneyIn: number;
      moneyOut: number;
      estimatedItemValueIn: number;
      estimatedItemValueOut: number;
      categories: Map<SupportedTransactionType, CategoryAccumulator>;
    }
  >();

  for (const transaction of transactions) {
    const weekStart = getWeekStart(transaction.createdAt, timezone);
    const bucket = weekly.get(weekStart) ?? {
      transactionCount: 0,
      moneyIn: 0,
      moneyOut: 0,
      estimatedItemValueIn: 0,
      estimatedItemValueOut: 0,
      categories: new Map()
    };

    bucket.transactionCount += 1;
    if (transaction.moneyDelta >= 0) {
      bucket.moneyIn += transaction.moneyDelta;
    } else {
      bucket.moneyOut += Math.abs(transaction.moneyDelta);
    }

    if (transaction.estimatedItemValueDelta >= 0) {
      bucket.estimatedItemValueIn += transaction.estimatedItemValueDelta;
    } else {
      bucket.estimatedItemValueOut += Math.abs(transaction.estimatedItemValueDelta);
    }

    const category =
      bucket.categories.get(transaction.type) ?? createCategoryAccumulator(transaction.type);
    category.transactionCount += 1;
    if (transaction.moneyDelta >= 0) {
      category.moneyIn += transaction.moneyDelta;
    } else {
      category.moneyOut += Math.abs(transaction.moneyDelta);
    }
    bucket.categories.set(transaction.type, category);

    weekly.set(weekStart, bucket);
  }

  return [...weekly.entries()]
    .map(([weekStart, bucket]) => {
      const netMoney = round(bucket.moneyIn - bucket.moneyOut);
      const estimatedNetWealthDelta = round(
        netMoney + bucket.estimatedItemValueIn - bucket.estimatedItemValueOut
      );
      const categories: OverwatchWeeklyCategorySummary[] = [...bucket.categories.values()]
        .map((value) => ({
          type: value.type,
          moneyIn: round(value.moneyIn),
          moneyOut: round(value.moneyOut),
          netMoney: round(value.moneyIn - value.moneyOut)
        }))
        .sort((left, right) => Math.abs(right.netMoney) - Math.abs(left.netMoney));

      return {
        weekStart,
        transactionCount: bucket.transactionCount,
        moneyIn: round(bucket.moneyIn),
        moneyOut: round(bucket.moneyOut),
        netMoney,
        estimatedItemValueIn: round(bucket.estimatedItemValueIn),
        estimatedItemValueOut: round(bucket.estimatedItemValueOut),
        estimatedNetWealthDelta,
        categories
      };
    })
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));
}

function computeExpectedZScore(observedCount: number, sampleSize: number, expectedShare: number): number | null {
  if (sampleSize <= 0 || expectedShare < 0 || expectedShare > 1) {
    return null;
  }

  const expectedCount = sampleSize * expectedShare;
  const variance = sampleSize * expectedShare * (1 - expectedShare);
  if (variance <= 0) {
    return observedCount === expectedCount ? 0 : null;
  }

  return (observedCount - expectedCount) / Math.sqrt(variance);
}

function toTopDropRows(
  byItem: Map<string, { itemCode: string; rarity: string; count: number }>,
  observedOutcomes: number,
  limit: number
): OverwatchCaseDropItemSummary[] {
  return [...byItem.values()]
    .map((item) => ({
      itemCode: item.itemCode,
      rarity: item.rarity,
      count: item.count,
      share: observedOutcomes === 0 ? 0 : round(item.count / observedOutcomes, 4)
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}

function buildCaseTypeSummary(args: {
  caseCode: string;
  totalOpenTransactions: number;
  totalObservedOutcomes: number;
  unknownOutcomeCount: number;
  byRarity: Map<string, number>;
  byItem: Map<string, { itemCode: string; rarity: string; count: number }>;
}): OverwatchCaseDropCaseSummary {
  const officialRates = OFFICIAL_CASE_RATES[args.caseCode];
  const expectedRatesKnown = Boolean(officialRates);
  const observedRarities = [...args.byRarity.keys()];
  const rarityOrder = expectedRatesKnown
    ? CASE_RARITY_ORDER
    : [...observedRarities].sort((left, right) => left.localeCompare(right));
  const additionalRarities = observedRarities
    .filter((rarity) => !rarityOrder.includes(rarity))
    .sort((left, right) => left.localeCompare(right));
  const allRarities = [...rarityOrder, ...additionalRarities];

  let chiSquare = 0;
  let highestPositiveZScore: number | null = null;
  const unexpectedObservedRarities: string[] = [];

  const outcomesByRarity: OverwatchCaseDropRarityComparison[] = allRarities.map((rarity) => {
    const count = args.byRarity.get(rarity) ?? 0;
    const share = args.totalObservedOutcomes === 0 ? 0 : round(count / args.totalObservedOutcomes, 4);
    const expectedShare = officialRates?.rarityShares[rarity] ?? (expectedRatesKnown ? 0 : null);
    const expectedCount =
      expectedShare === null ? null : round(args.totalObservedOutcomes * expectedShare, 4);
    const deltaShare = expectedShare === null ? null : round(share - expectedShare, 4);
    const rawZScore =
      expectedShare === null
        ? null
        : computeExpectedZScore(count, args.totalObservedOutcomes, expectedShare);
    const zScore = rawZScore === null ? null : round(rawZScore, 3);

    if (expectedShare === 0 && count > 0) {
      unexpectedObservedRarities.push(rarity);
    } else if (typeof rawZScore === "number" && rawZScore > 0) {
      highestPositiveZScore =
        highestPositiveZScore === null ? rawZScore : Math.max(highestPositiveZScore, rawZScore);
    }

    if (expectedShare !== null && expectedShare > 0 && expectedCount !== null) {
      chiSquare += ((count - expectedCount) ** 2) / expectedCount;
    }

    return {
      rarity,
      count,
      share,
      expectedShare: expectedShare === null ? null : round(expectedShare, 4),
      expectedCount,
      deltaShare,
      zScore
    };
  });

  const highValueObservedCount = outcomesByRarity
    .filter((item) => HIGH_VALUE_RARITIES.has(item.rarity))
    .reduce((sum, item) => sum + item.count, 0);
  const highValueObservedShare =
    args.totalObservedOutcomes === 0 ? null : round(highValueObservedCount / args.totalObservedOutcomes, 4);
  const highValueExpectedShare = officialRates
    ? round(
        Object.entries(officialRates.rarityShares).reduce(
          (sum, [rarity, share]) =>
            sum + (HIGH_VALUE_RARITIES.has(rarity) && typeof share === "number" ? share : 0),
          0
        ),
        4
      )
    : null;
  const highValueExpectedCount =
    highValueExpectedShare === null ? null : round(args.totalObservedOutcomes * highValueExpectedShare, 4);
  const rawHighValueZScore =
    highValueExpectedShare === null
      ? null
      : computeExpectedZScore(highValueObservedCount, args.totalObservedOutcomes, highValueExpectedShare);

  return {
    caseCode: args.caseCode,
    caseLabel: officialRates?.label ?? args.caseCode,
    totalOpenTransactions: args.totalOpenTransactions,
    totalObservedOutcomes: args.totalObservedOutcomes,
    unknownOutcomeCount: args.unknownOutcomeCount,
    expectedRatesKnown,
    chiSquare: expectedRatesKnown ? round(chiSquare, 3) : null,
    highestPositiveZScore:
      highestPositiveZScore === null ? null : round(highestPositiveZScore, 3),
    highValueObservedCount: expectedRatesKnown ? highValueObservedCount : null,
    highValueExpectedCount,
    highValueObservedShare,
    highValueExpectedShare,
    highValueZScore: rawHighValueZScore === null ? null : round(rawHighValueZScore, 3),
    unexpectedObservedRarities,
    outcomesByRarity,
    topDrops: toTopDropRows(args.byItem, args.totalObservedOutcomes, 5)
  };
}

function summarizeCaseDrops(transactions: NormalizedTransaction[]) {
  const openCaseTransactions = transactions.filter((transaction) => transaction.type === "openCase");
  const byRarity = new Map<string, number>();
  const byItem = new Map<string, { itemCode: string; rarity: string; count: number }>();
  const byCaseType = new Map<
    string,
    {
      totalOpenTransactions: number;
      totalObservedOutcomes: number;
      unknownOutcomeCount: number;
      byRarity: Map<string, number>;
      byItem: Map<string, { itemCode: string; rarity: string; count: number }>;
    }
  >();
  let observedOutcomes = 0;
  let unknownOutcomeCount = 0;
  let totalSpent = 0;

  for (const transaction of openCaseTransactions) {
    if (transaction.moneyDelta < 0) {
      totalSpent += Math.abs(transaction.moneyDelta);
    }

    const openedCaseCode =
      typeof transaction.original.itemCode === "string" ? transaction.original.itemCode : "unknown";
    const caseType = byCaseType.get(openedCaseCode) ?? {
      totalOpenTransactions: 0,
      totalObservedOutcomes: 0,
      unknownOutcomeCount: 0,
      byRarity: new Map<string, number>(),
      byItem: new Map<string, { itemCode: string; rarity: string; count: number }>()
    };
    caseType.totalOpenTransactions += 1;

    if (!transaction.itemCode || transaction.itemType === "case") {
      const unknownCount = Math.max(1, transaction.quantity || 1);
      unknownOutcomeCount += unknownCount;
      caseType.unknownOutcomeCount += unknownCount;
      byCaseType.set(openedCaseCode, caseType);
      continue;
    }

    const rarity = transaction.itemRarity ?? "unknown";
    const count = Math.max(1, Math.abs(transaction.itemDeltaQuantity) || transaction.quantity || 1);
    observedOutcomes += count;
    caseType.totalObservedOutcomes += count;
    byRarity.set(rarity, (byRarity.get(rarity) ?? 0) + count);
    caseType.byRarity.set(rarity, (caseType.byRarity.get(rarity) ?? 0) + count);

    const itemSummary = byItem.get(transaction.itemCode) ?? {
      itemCode: transaction.itemCode,
      rarity,
      count: 0
    };
    itemSummary.count += count;
    byItem.set(transaction.itemCode, itemSummary);

    const caseItemSummary = caseType.byItem.get(transaction.itemCode) ?? {
      itemCode: transaction.itemCode,
      rarity,
      count: 0
    };
    caseItemSummary.count += count;
    caseType.byItem.set(transaction.itemCode, caseItemSummary);
    byCaseType.set(openedCaseCode, caseType);
  }

  const outcomesByRarity = [...byRarity.entries()]
    .map(([rarity, count]) => ({
      rarity,
      count,
      share: observedOutcomes === 0 ? 0 : round(count / observedOutcomes, 4)
    }))
    .sort((left, right) => right.count - left.count);

  return {
    totalOpenTransactions: openCaseTransactions.length,
    totalObservedOutcomes: observedOutcomes,
    unknownOutcomeCount,
    totalSpent: round(totalSpent),
    outcomesByRarity,
    topDrops: toTopDropRows(byItem, observedOutcomes, 10),
    byCaseType: [...byCaseType.entries()]
      .map(([caseCode, summary]) =>
        buildCaseTypeSummary({
          caseCode,
          totalOpenTransactions: summary.totalOpenTransactions,
          totalObservedOutcomes: summary.totalObservedOutcomes,
          unknownOutcomeCount: summary.unknownOutcomeCount,
          byRarity: summary.byRarity,
          byItem: summary.byItem
        })
      )
      .sort((left, right) => right.totalOpenTransactions - left.totalOpenTransactions)
  };
}

function summarizeCounterparties(
  transactions: NormalizedTransaction[]
): OverwatchCounterpartySummary[] {
  const counterpartyMap = new Map<string, CounterpartyAccumulator>();
  let externalMoneyflow = 0;

  for (const transaction of transactions) {
    const key = transaction.counterpartyKey;
    const acc = counterpartyMap.get(key) ?? {
      key,
      displayName: transaction.counterpartyLabel,
      kind: transaction.counterpartyKind,
      transactionCount: 0,
      moneyIn: 0,
      moneyOut: 0,
      transactionTypeCounts: {}
    };

    acc.transactionCount += 1;
    if (transaction.moneyDelta >= 0) {
      acc.moneyIn += transaction.moneyDelta;
    } else {
      acc.moneyOut += Math.abs(transaction.moneyDelta);
    }
    acc.transactionTypeCounts[transaction.type] =
      (acc.transactionTypeCounts[transaction.type] ?? 0) + 1;

    counterpartyMap.set(key, acc);
  }

  const summaries = [...counterpartyMap.values()].map((acc) => {
    const flowTotal = acc.moneyIn + acc.moneyOut;
    const hasExternalFlow = Object.keys(acc.transactionTypeCounts).some((transactionType) =>
      EXTERNAL_FLOW_TYPES.has(transactionType as SupportedTransactionType)
    );

    if (acc.kind !== "system" && acc.kind !== "unknown" && hasExternalFlow) {
      externalMoneyflow += flowTotal;
    }

    const dominantTransactionTypes = Object.entries(acc.transactionTypeCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([type]) => type as SupportedTransactionType);

    return {
      key: acc.key,
      displayName: acc.displayName,
      kind: acc.kind,
      transactionCount: acc.transactionCount,
      moneyIn: round(acc.moneyIn),
      moneyOut: round(acc.moneyOut),
      netMoney: round(acc.moneyIn - acc.moneyOut),
      flowTotal: round(flowTotal),
      flowShare: 0,
      dominantTransactionTypes,
      transactionTypeCounts: acc.transactionTypeCounts
    };
  });

  return summaries
    .map((summary) => ({
      ...summary,
      flowShare:
        externalMoneyflow > 0 &&
        summary.kind !== "system" &&
        summary.kind !== "unknown"
          ? round(summary.flowTotal / externalMoneyflow, 4)
          : 0
    }))
    .sort((left, right) => right.flowTotal - left.flowTotal);
}

function summarizePairAnalysis(
  transactions: NormalizedTransaction[],
  subjectUserId: string,
  thresholds: OverwatchThresholds
): OverwatchPairAnalysisSummary {
  const pairMap = new Map<string, PairAccumulator>();

  for (const transaction of transactions) {
    if (!PAIR_ANALYSIS_TYPES.has(transaction.type)) {
      continue;
    }

    const sellerId = transaction.original.sellerId ?? "unknown";
    const buyerId = transaction.original.buyerId ?? "unknown";
    const key = `${transaction.type}|${sellerId}|${buyerId}`;
    const pair = pairMap.get(key) ?? {
      transactionType: transaction.type,
      sellerId,
      buyerId,
      totalQuantity: 0,
      totalMoney: 0,
      transactionCount: 0
    };

    pair.totalQuantity += transaction.quantity;
    pair.totalMoney += transaction.money;
    pair.transactionCount += 1;
    pairMap.set(key, pair);
  }

  const allPairs: OverwatchPairSummary[] = [...pairMap.values()]
    .map((pair) => {
      const averageRatio =
        pair.totalQuantity > 0 ? round(pair.totalMoney / pair.totalQuantity, 4) : null;
      let vsAverage: number | null = null;
      const perspective: OverwatchPairSummary["perspective"] =
        pair.sellerId === subjectUserId
          ? "seller"
          : pair.buyerId === subjectUserId
          ? "buyer"
          : "other";

      if (pair.transactionType === "wage" && pair.totalQuantity > 0) {
        const base = pair.totalQuantity * thresholds.wageBaselineRatio - pair.totalMoney;
        vsAverage = round(pair.sellerId === subjectUserId ? -base : base, 3);
      }

      return {
        transactionType: pair.transactionType,
        sellerId: pair.sellerId,
        buyerId: pair.buyerId,
        sellerLabel: pair.sellerId,
        buyerLabel: pair.buyerId,
        totalQuantity: round(pair.totalQuantity),
        totalMoney: round(pair.totalMoney, 4),
        transactionCount: pair.transactionCount,
        averageRatio,
        vsAverage,
        perspective
      };
    })
    .sort((left, right) => right.totalMoney - left.totalMoney);

  const filteredPairs = allPairs.filter(
    (pair) =>
      pair.totalMoney >= thresholds.pairMinMoney &&
      pair.transactionCount >= thresholds.pairMinTransactions
  );

  return {
    baselineRatio: thresholds.wageBaselineRatio,
    minMoney: thresholds.pairMinMoney,
    minTransactions: thresholds.pairMinTransactions,
    totalPairCount: allPairs.length,
    filteredPairCount: filteredPairs.length,
    pairs: filteredPairs.slice(0, 50)
  };
}

function summarizeWork(
  workStats: WorkStatsItem[] | null | undefined,
  transactions: NormalizedTransaction[],
  thresholds: OverwatchThresholds,
  pairAnalysis: OverwatchPairAnalysisSummary
) {
  const wageTransactions = transactions.filter(
    (transaction) =>
      transaction.type === "wage" &&
      transaction.quantity > 0 &&
      transaction.money > 0
  );

  const wageRatios = wageTransactions
    .map((transaction) => transaction.money / transaction.quantity)
    .filter((value) => Number.isFinite(value) && value > 0);

  const totalWageQuantity = round(
    wageTransactions.reduce((sum, transaction) => sum + transaction.quantity, 0)
  );
  const totalWageMoney = round(
    wageTransactions.reduce((sum, transaction) => sum + transaction.money, 0),
    4
  );

  const observedWages: WageObservationSummary = {
    count: wageRatios.length,
    totalQuantity: totalWageQuantity,
    totalMoney: totalWageMoney,
    averageRatio:
      totalWageQuantity === 0
        ? 0
        : round(totalWageMoney / totalWageQuantity, 4),
    minRatio: wageRatios.length === 0 ? 0 : round(Math.min(...wageRatios), 4),
    maxRatio: wageRatios.length === 0 ? 0 : round(Math.max(...wageRatios), 4),
    baselineRatio: thresholds.wageBaselineRatio,
    belowAllowedRangeCount: 0,
    aboveAllowedRangeCount: 0
  };

  for (const ratio of wageRatios) {
      if (ratio < thresholds.wageBaselineRatio * thresholds.lowWageRatio) {
        observedWages.belowAllowedRangeCount += 1;
      }
      if (ratio > thresholds.wageBaselineRatio * thresholds.highWageRatio) {
        observedWages.aboveAllowedRangeCount += 1;
      }
  }

  if (!workStats && observedWages.count === 0) {
    return null;
  }

  const totalWorkStatsAmount = round(
    (workStats ?? []).reduce((sum, item) => sum + (Number.isFinite(item.total) ? item.total : 0), 0)
  );
  const totalWorkStatsWage = round(
    (workStats ?? []).reduce((sum, item) => sum + (Number.isFinite(item.wage) ? item.wage : 0), 0)
  );
  const averageDailyWage =
    workStats && workStats.length > 0 ? round(totalWorkStatsWage / workStats.length) : 0;

  return {
    daysAnalyzed: workStats?.length ?? 0,
    totalWorkStatsAmount,
    totalWorkStatsWage,
    averageDailyWage,
    observedWages,
    wagePairs: pairAnalysis.pairs.filter((pair) => pair.transactionType === "wage").slice(0, 20)
  };
}

function summarizeCraftChecks(transactions: NormalizedTransaction[]): OverwatchCraftCheckSummary {
  const craftTransactions = transactions.filter((transaction) => transaction.type === "craftItem");
  const mismatchExamples: OverwatchCraftCheckSummary["mismatchExamples"] = [];
  let checkedCraftTransactions = 0;
  let nonScrapInputTransactions = 0;
  let unknownRarityTransactions = 0;

  for (const transaction of craftTransactions) {
    const inputItemCode =
      typeof transaction.original.itemCode === "string" ? transaction.original.itemCode : undefined;
    if (inputItemCode !== "scraps") {
      nonScrapInputTransactions += 1;
      continue;
    }

    const craftedRarity = transaction.itemRarity?.toLowerCase();
    const expectedScraps =
      craftedRarity && CRAFT_SCRAP_COST_BY_RARITY[craftedRarity] !== undefined
        ? CRAFT_SCRAP_COST_BY_RARITY[craftedRarity]
        : undefined;
    if (expectedScraps === undefined) {
      unknownRarityTransactions += 1;
      continue;
    }

    const observedScraps =
      typeof transaction.original.quantity === "number" && Number.isFinite(transaction.original.quantity)
        ? transaction.original.quantity
        : transaction.quantity;
    if (!Number.isFinite(observedScraps)) {
      unknownRarityTransactions += 1;
      continue;
    }

    checkedCraftTransactions += 1;
    if (Math.abs(observedScraps - expectedScraps) > 1e-9) {
      mismatchExamples.push({
        transactionId: transaction.transactionId,
        createdAt: transaction.createdAt,
        craftedItemCode: transaction.itemCode ?? "unknown",
        craftedRarity: craftedRarity ?? "unknown",
        observedScraps: round(observedScraps, 4),
        expectedScraps,
        deltaScraps: round(observedScraps - expectedScraps, 4)
      });
    }
  }

  mismatchExamples.sort((left, right) => Math.abs(right.deltaScraps) - Math.abs(left.deltaScraps));

  return {
    totalCraftTransactions: craftTransactions.length,
    checkedCraftTransactions,
    matchedCraftTransactions: checkedCraftTransactions - mismatchExamples.length,
    mismatchedCraftTransactions: mismatchExamples.length,
    skippedCraftTransactions: craftTransactions.length - checkedCraftTransactions,
    nonScrapInputTransactions,
    unknownRarityTransactions,
    mismatchExamples: mismatchExamples.slice(0, 20)
  };
}

function summarizeMarketBenchmarks(
  transactions: NormalizedTransaction[],
  thresholds: OverwatchThresholds
): OverwatchMarketBenchmarkSummary {
  const examples: MarketPriceOutlierExample[] = [];
  let comparableTransactionCount = 0;
  let anomalousTransactionCount = 0;
  let anomalousMoneyVolume = 0;

  for (const transaction of transactions) {
    if (
      transaction.type !== "trading" &&
      transaction.type !== "itemMarket"
    ) {
      continue;
    }

    if (
      !transaction.itemCode ||
      typeof transaction.estimatedUnitPrice !== "number" ||
      transaction.quantity <= 0 ||
      transaction.money <= 0
    ) {
      continue;
    }

    comparableTransactionCount += 1;
    const unitPrice = transaction.money / transaction.quantity;
    const ratio = unitPrice / transaction.estimatedUnitPrice;

    if (
      ratio < thresholds.minMarketPriceRatio ||
      ratio > thresholds.maxMarketPriceRatio
    ) {
      anomalousTransactionCount += 1;
      anomalousMoneyVolume += transaction.money;
      examples.push({
        transactionId: transaction.transactionId,
        createdAt: transaction.createdAt,
        type: transaction.type,
        direction: transaction.moneyDelta >= 0 ? "in" : "out",
        itemCode: transaction.itemCode,
        quantity: transaction.quantity,
        unitPrice: round(unitPrice),
        currentMarketPrice: round(transaction.estimatedUnitPrice),
        ratio: round(ratio, 3),
        counterparty: transaction.counterpartyLabel
      });
    }
  }

  return {
    comparableTransactionCount,
    anomalousTransactionCount,
    anomalousMoneyVolume: round(anomalousMoneyVolume),
    examples: examples
      .sort((left, right) => Math.abs(right.ratio - 1) - Math.abs(left.ratio - 1))
      .slice(0, 10)
  };
}

function buildItemValuationCoverage(transactions: NormalizedTransaction[]) {
  let totalItemTransactionCount = 0;
  let pricedTransactionCount = 0;
  let totalItemQuantity = 0;
  let pricedQuantity = 0;

  for (const transaction of transactions) {
    if (!transaction.itemCode || transaction.quantity <= 0) {
      continue;
    }

    totalItemTransactionCount += 1;
    totalItemQuantity += Math.abs(transaction.quantity);

    if (typeof transaction.estimatedUnitPrice === "number") {
      pricedTransactionCount += 1;
      pricedQuantity += Math.abs(transaction.quantity);
    }
  }

  return {
    pricedTransactionCount,
    totalItemTransactionCount,
    pricedTransactionShare:
      totalItemTransactionCount === 0
        ? 0
        : round(pricedTransactionCount / totalItemTransactionCount, 4),
    pricedQuantity,
    totalItemQuantity,
    pricedQuantityShare:
      totalItemQuantity === 0 ? 0 : round(pricedQuantity / totalItemQuantity, 4)
  };
}

function getElapsedMilliseconds(startAt: string | undefined, endAt: string | undefined): number | null {
  const startMs = Date.parse(startAt ?? "");
  const endMs = Date.parse(endAt ?? "");

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }

  return endMs - startMs;
}

function getMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function getStandardDeviation(values: number[], average: number): number {
  if (values.length === 0) {
    return 0;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function summarizeTimingMetric(values: number[]): OverwatchTimingAnomalySummary["offerPostGapStats"] {
  if (values.length === 0) {
    return {
      count: 0,
      minMs: null,
      averageMs: null,
      medianMs: null,
      maxMs: null
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const median = getMedian(sorted);

  return {
    count: sorted.length,
    minMs: sorted[0] ?? null,
    averageMs: round(average, 2),
    medianMs: median === null ? null : round(median, 2),
    maxMs: sorted[sorted.length - 1] ?? null
  };
}

function findRegularTimingPattern(
  samples: Array<{ valueMs: number; createdAt: string }>,
  thresholds: OverwatchThresholds
): OverwatchTimingAnomalySummary["regularOfferPostGapPattern"] {
  const minSampleCount = 5;
  const maxConsideredMs = Math.max(thresholds.rapidTimingWindowMs * 2, 1500);
  const clusterWindowMs = Math.max(Math.round(thresholds.rapidTimingWindowMs * 0.15), 150);
  const eligible = samples
    .filter((sample) => sample.valueMs <= maxConsideredMs)
    .sort(
      (left, right) =>
        left.valueMs - right.valueMs || left.createdAt.localeCompare(right.createdAt)
    );

  if (eligible.length < minSampleCount) {
    return null;
  }

  let bestStart = 0;
  let bestEnd = 0;
  let end = 0;

  for (let start = 0; start < eligible.length; start += 1) {
    if (end < start) {
      end = start;
    }

    while (
      end < eligible.length &&
      eligible[end] &&
      eligible[start] &&
      eligible[end].valueMs - eligible[start].valueMs <= clusterWindowMs
    ) {
      end += 1;
    }

    const currentCount = end - start;
    const bestCount = bestEnd - bestStart;
    const currentRange =
      currentCount > 0
        ? (eligible[end - 1]?.valueMs ?? 0) - (eligible[start]?.valueMs ?? 0)
        : Number.POSITIVE_INFINITY;
    const bestRange =
      bestCount > 0
        ? (eligible[bestEnd - 1]?.valueMs ?? 0) - (eligible[bestStart]?.valueMs ?? 0)
        : Number.POSITIVE_INFINITY;
    const currentAverage =
      currentCount > 0
        ? eligible
            .slice(start, end)
            .reduce((sum, sample) => sum + sample.valueMs, 0) / currentCount
        : Number.POSITIVE_INFINITY;
    const bestAverage =
      bestCount > 0
        ? eligible
            .slice(bestStart, bestEnd)
            .reduce((sum, sample) => sum + sample.valueMs, 0) / bestCount
        : Number.POSITIVE_INFINITY;

    if (
      currentCount > bestCount ||
      (currentCount === bestCount &&
        (currentRange < bestRange ||
          (currentRange === bestRange && currentAverage < bestAverage)))
    ) {
      bestStart = start;
      bestEnd = end;
    }
  }

  const cluster = eligible.slice(bestStart, bestEnd);
  if (cluster.length < minSampleCount) {
    return null;
  }

  const share = cluster.length / eligible.length;
  if (share < 0.5 && cluster.length < minSampleCount + 2) {
    return null;
  }

  const values = cluster.map((sample) => sample.valueMs);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = getMedian(values) ?? average;
  const standardDeviation = getStandardDeviation(values, average);
  const chronological = [...cluster].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );

  return {
    eligibleSampleCount: eligible.length,
    sampleCount: cluster.length,
    share: round(share, 4),
    clusterWindowMs,
    maxConsideredMs,
    minMs: Math.min(...values),
    averageMs: round(average, 2),
    medianMs: round(median, 2),
    maxMs: Math.max(...values),
    standardDeviationMs: round(standardDeviation, 2),
    coefficientOfVariation: average === 0 ? 0 : round(standardDeviation / average, 4),
    firstObservedAt: chronological[0]?.createdAt ?? "",
    lastObservedAt: chronological[chronological.length - 1]?.createdAt ?? ""
  };
}

function summarizeTimingAnalysis(
  transactions: NormalizedTransaction[],
  thresholds: OverwatchThresholds
): OverwatchTimingAnomalySummary {
  const rapidOfferPostGaps: OverwatchTimingAnomalySummary["rapidOfferPostGaps"] = [];
  const offerPostGapSamples: Array<{ valueMs: number; createdAt: string }> = [];
  const offerPostGapValues: number[] = [];
  const rapidBuyGaps: OverwatchTimingAnomalySummary["rapidBuyGaps"] = [];
  const buyGapSamples: Array<{ valueMs: number; createdAt: string }> = [];
  const buyGapValues: number[] = [];
  type SellerOfferTransaction = NormalizedTransaction & {
    itemCode: string;
    original: NormalizedTransaction["original"] & { offerCreatedAt: string };
  };
  const sellerOfferTransactions = transactions
    .filter(
      (transaction): transaction is SellerOfferTransaction =>
        MARKET_TIMING_TYPES.has(transaction.type) &&
        transaction.role === "seller" &&
        typeof transaction.itemCode === "string" &&
        transaction.quantity > 0 &&
        typeof transaction.original.offerCreatedAt === "string"
    )
    .sort((left, right) => {
      const leftOfferCreatedAt = left.original.offerCreatedAt ?? "";
      const rightOfferCreatedAt = right.original.offerCreatedAt ?? "";
      return (
        leftOfferCreatedAt.localeCompare(rightOfferCreatedAt) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.transactionId.localeCompare(right.transactionId)
      );
    });

  let previousSellerOfferTransaction: SellerOfferTransaction | null = null;
  let previousBuyerItemTransaction: NormalizedTransaction | null = null;

  for (const transaction of sellerOfferTransactions) {
    const offerCreatedAt = transaction.original.offerCreatedAt;
    if (!offerCreatedAt) {
      continue;
    }

    if (previousSellerOfferTransaction) {
      const gapMs = getElapsedMilliseconds(
        previousSellerOfferTransaction.original.offerCreatedAt,
        offerCreatedAt
      );
      if (gapMs !== null) {
        offerPostGapSamples.push({
          valueMs: gapMs,
          createdAt: offerCreatedAt
        });
        offerPostGapValues.push(gapMs);
        if (gapMs < thresholds.rapidTimingWindowMs) {
          rapidOfferPostGaps.push({
            previousTransactionId: previousSellerOfferTransaction.transactionId,
            previousCreatedAt: previousSellerOfferTransaction.createdAt,
            previousOfferCreatedAt: previousSellerOfferTransaction.original.offerCreatedAt,
            previousType: previousSellerOfferTransaction.type,
            previousItemCode: previousSellerOfferTransaction.itemCode ?? "-",
            previousQuantity: previousSellerOfferTransaction.quantity,
            previousMoney: previousSellerOfferTransaction.money,
            previousCounterparty: previousSellerOfferTransaction.counterpartyLabel,
            transactionId: transaction.transactionId,
            createdAt: transaction.createdAt,
            offerCreatedAt,
            gapMs,
            type: transaction.type,
            itemCode: transaction.itemCode,
            quantity: transaction.quantity,
            money: transaction.money,
            counterparty: transaction.counterpartyLabel
          });
        }
      }
    }

    previousSellerOfferTransaction = transaction;
  }

  for (const transaction of transactions) {
    if (!MARKET_TIMING_TYPES.has(transaction.type) || !transaction.itemCode || transaction.quantity <= 0) {
      continue;
    }

    if (transaction.role !== "buyer") {
      continue;
    }

    if (previousBuyerItemTransaction) {
      const gapMs = getElapsedMilliseconds(previousBuyerItemTransaction.createdAt, transaction.createdAt);
      if (gapMs !== null) {
        buyGapSamples.push({
          valueMs: gapMs,
          createdAt: transaction.createdAt
        });
        buyGapValues.push(gapMs);
        if (gapMs < thresholds.rapidTimingWindowMs) {
          rapidBuyGaps.push({
            previousTransactionId: previousBuyerItemTransaction.transactionId,
            previousCreatedAt: previousBuyerItemTransaction.createdAt,
            previousType: previousBuyerItemTransaction.type,
            previousItemCode: previousBuyerItemTransaction.itemCode ?? "-",
            previousQuantity: previousBuyerItemTransaction.quantity,
            previousMoney: previousBuyerItemTransaction.money,
            previousCounterparty: previousBuyerItemTransaction.counterpartyLabel,
            transactionId: transaction.transactionId,
            createdAt: transaction.createdAt,
            gapMs,
            type: transaction.type,
            itemCode: transaction.itemCode,
            quantity: transaction.quantity,
            money: transaction.money,
            counterparty: transaction.counterpartyLabel
          });
        }
      }
    }

    previousBuyerItemTransaction = transaction;
  }

  rapidOfferPostGaps.sort(
    (left, right) =>
      left.gapMs - right.gapMs || left.offerCreatedAt.localeCompare(right.offerCreatedAt)
  );
  rapidBuyGaps.sort(
    (left, right) =>
      left.gapMs - right.gapMs || left.createdAt.localeCompare(right.createdAt)
  );

  return {
    thresholdMs: thresholds.rapidTimingWindowMs,
    sellerItemTransactionCount: sellerOfferTransactions.length,
    rapidOfferPostGapCount: rapidOfferPostGaps.length,
    offerPostGapStats: summarizeTimingMetric(offerPostGapValues),
    regularOfferPostGapPattern: findRegularTimingPattern(offerPostGapSamples, thresholds),
    rapidOfferPostGaps,
    buyerItemTransactionCount: buyGapValues.length + (previousBuyerItemTransaction ? 1 : 0),
    rapidBuyGapCount: rapidBuyGaps.length,
    buyGapStats: summarizeTimingMetric(buyGapValues),
    regularBuyGapPattern: findRegularTimingPattern(buyGapSamples, thresholds),
    rapidBuyGaps
  };
}

function pushSignal(
  signals: OverwatchSignal[],
  code: OverwatchSignalCode,
  severity: OverwatchSeverity,
  title: string,
  summary: string,
  evidence: string[]
) {
  signals.push({ code, severity, title, summary, evidence });
}

function buildSignals(args: {
  thresholds: OverwatchThresholds;
  categories: OverwatchCategorySummary[];
  caseDrops: ReturnType<typeof summarizeCaseDrops>;
  counterparties: OverwatchCounterpartySummary[];
  marketBenchmarks: OverwatchMarketBenchmarkSummary;
  work: ReturnType<typeof summarizeWork>;
  craftChecks: OverwatchCraftCheckSummary;
  timingAnalysis: OverwatchTimingAnomalySummary;
}) {
  const {
    thresholds,
    categories,
    caseDrops,
    counterparties,
    marketBenchmarks,
    work,
    craftChecks,
    timingAnalysis
  } = args;
  const signals: OverwatchSignal[] = [];

  const topCounterparty = counterparties.find(
    (counterparty) => counterparty.kind !== "system" && counterparty.kind !== "unknown"
  );

  if (
    topCounterparty &&
    topCounterparty.flowTotal >= thresholds.minMoneyflowForCounterpartySignal &&
    topCounterparty.flowShare >= thresholds.counterpartyConcentrationShare
  ) {
    pushSignal(
      signals,
      "counterparty_concentration",
      topCounterparty.flowShare >= 0.65 ? "high" : "medium",
      "Counterparty concentration",
      `${topCounterparty.displayName} accounts for ${round(
        topCounterparty.flowShare * 100
      )}% of external moneyflow.`,
      [
        `Flow total: ${round(topCounterparty.flowTotal)}`,
        `Net money: ${round(topCounterparty.netMoney)}`,
        `Dominant types: ${topCounterparty.dominantTransactionTypes.join(", ") || "none"}`
      ]
    );
  }

  for (const counterparty of counterparties.slice(0, 5)) {
    const flowTotal = counterparty.moneyIn + counterparty.moneyOut;
    const imbalance = flowTotal === 0 ? 0 : Math.abs(counterparty.netMoney) / flowTotal;
    if (
      counterparty.kind !== "system" &&
      counterparty.kind !== "unknown" &&
      flowTotal >= thresholds.minMoneyflowForCounterpartySignal &&
      imbalance >= thresholds.oneWayFlowShare
    ) {
      pushSignal(
        signals,
        "one_way_flow",
        imbalance >= 0.95 ? "high" : "medium",
        "One-way asset flow",
        `${counterparty.displayName} shows ${round(imbalance * 100)}% net imbalance.`,
        [
          `Money in: ${round(counterparty.moneyIn)}`,
          `Money out: ${round(counterparty.moneyOut)}`,
          `Transaction count: ${counterparty.transactionCount}`
        ]
      );
    }
  }

  const donationSummary = categories.find((category) => category.type === "donation");
  const totalOutflow = categories.reduce((sum, category) => sum + category.moneyOut, 0);
  if (
    donationSummary &&
    donationSummary.moneyOut >= thresholds.minDonationAmountForSignal &&
    totalOutflow > 0 &&
    donationSummary.moneyOut / totalOutflow >= thresholds.minDonationShareForSignal
  ) {
    pushSignal(
      signals,
      "donation_spike",
      donationSummary.moneyOut / totalOutflow >= 0.5 ? "high" : "medium",
      "Donation-heavy outflow",
      `Donations account for ${round((donationSummary.moneyOut / totalOutflow) * 100)}% of all tracked expenses.`,
      [
        `Donation outflow: ${round(donationSummary.moneyOut)}`,
        `Total expenses: ${round(totalOutflow)}`
      ]
    );
  }

  if (
    marketBenchmarks.comparableTransactionCount >= thresholds.minComparableMarketTransactions &&
    marketBenchmarks.anomalousTransactionCount > 0
  ) {
    const topExample = marketBenchmarks.examples[0];
    pushSignal(
      signals,
      "market_price_outlier",
      marketBenchmarks.anomalousTransactionCount >= 5 ? "high" : "medium",
      "Off-market pricing",
      `${marketBenchmarks.anomalousTransactionCount} tracked trades are far from current public market prices.`,
      [
        `Comparable trades: ${marketBenchmarks.comparableTransactionCount}`,
        `Anomalous money volume: ${round(marketBenchmarks.anomalousMoneyVolume)}`,
        topExample
          ? `Largest example: ${topExample.itemCode} at ${topExample.unitPrice} (${topExample.ratio}x market)`
          : "No example available"
      ]
    );
  }

  if (work) {
    if (work.observedWages.belowAllowedRangeCount > 0 || work.observedWages.aboveAllowedRangeCount > 0) {
      pushSignal(
        signals,
        "wage_outlier",
        work.observedWages.belowAllowedRangeCount + work.observedWages.aboveAllowedRangeCount >= 3
          ? "high"
          : "medium",
        "Wage outliers",
        `${work.observedWages.belowAllowedRangeCount} wage payments are below and ${work.observedWages.aboveAllowedRangeCount} are above the ratio band around the expected wage baseline.`,
        [
          `Observed wage ratio range: ${round(work.observedWages.minRatio, 4)} to ${round(work.observedWages.maxRatio, 4)}`,
          `Expected ratio band: ${round(work.observedWages.baselineRatio * thresholds.lowWageRatio, 4)} to ${round(work.observedWages.baselineRatio * thresholds.highWageRatio, 4)}`,
          `Observed weighted average ratio: ${round(work.observedWages.averageRatio, 4)}`
        ]
      );
    }
  }

  for (const caseSummary of caseDrops.byCaseType) {
    if (
      !caseSummary.expectedRatesKnown ||
      caseSummary.totalObservedOutcomes < thresholds.minCaseOpensForDistributionSignal
    ) {
      continue;
    }

    const severity =
      caseSummary.unexpectedObservedRarities.length > 0 ||
      (caseSummary.highValueZScore ?? 0) >= 5 ||
      (caseSummary.highestPositiveZScore ?? 0) >= 5 ||
      (caseSummary.chiSquare ?? 0) >= 25
        ? "high"
        : (caseSummary.highValueZScore ?? 0) >= 3 ||
          (caseSummary.highestPositiveZScore ?? 0) >= 3 ||
          (caseSummary.chiSquare ?? 0) >= 16
        ? "medium"
        : null;

    if (!severity) {
      continue;
    }

    const strongestRarity = caseSummary.outcomesByRarity
      .filter((item) => item.expectedShare !== null && item.deltaShare !== null && item.deltaShare > 0)
      .sort(
        (left, right) =>
          (right.zScore ?? Number.NEGATIVE_INFINITY) - (left.zScore ?? Number.NEGATIVE_INFINITY)
      )[0];

    pushSignal(
      signals,
      "case_drop_outlier",
      severity,
      "Case distribution vs official rates",
      `${caseSummary.caseLabel} drops are above the official rarity distribution baseline.`,
      [
        `Case code: ${caseSummary.caseCode}`,
        `Observed outcomes: ${caseSummary.totalObservedOutcomes}`,
        caseSummary.highValueObservedShare !== null && caseSummary.highValueExpectedShare !== null
          ? `Legendary+ observed: ${round(caseSummary.highValueObservedShare * 100, 2)}% vs expected ${round(caseSummary.highValueExpectedShare * 100, 2)}%`
          : `No high-rarity comparison available`,
        caseSummary.highValueZScore !== null
          ? `Legendary+ z-score: ${caseSummary.highValueZScore}`
          : `Legendary+ z-score unavailable`,
        strongestRarity && strongestRarity.expectedShare !== null && strongestRarity.deltaShare !== null
          ? `Largest positive rarity delta: ${strongestRarity.rarity} observed ${round(strongestRarity.share * 100, 2)}% vs expected ${round(strongestRarity.expectedShare * 100, 2)}%`
          : `No positive rarity delta found`,
        caseSummary.unexpectedObservedRarities.length > 0
          ? `Unexpected observed rarities: ${caseSummary.unexpectedObservedRarities.join(", ")}`
          : `Chi-square score: ${caseSummary.chiSquare ?? "n/a"}`
      ]
    );
  }

  if (craftChecks.mismatchedCraftTransactions > 0) {
    const topMismatch = craftChecks.mismatchExamples[0];
    pushSignal(
      signals,
      "craft_scrap_mismatch",
      "high",
      "Craft scrap mismatch",
      `${craftChecks.mismatchedCraftTransactions} craft transactions consumed scrap amounts inconsistent with the official crafting cost table.`,
      [
        `Checked craft transactions: ${craftChecks.checkedCraftTransactions}`,
        `Matched craft transactions: ${craftChecks.matchedCraftTransactions}`,
        topMismatch
          ? `Largest mismatch: ${topMismatch.craftedItemCode} (${topMismatch.craftedRarity}) used ${topMismatch.observedScraps} scraps, expected ${topMismatch.expectedScraps}`
          : "No mismatch example available",
        craftChecks.skippedCraftTransactions > 0
          ? `Skipped craft transactions: ${craftChecks.skippedCraftTransactions}`
          : "All craft transactions were checkable"
      ]
    );
  }

  const regularOfferPostPattern = timingAnalysis.regularOfferPostGapPattern;
  const regularBuyPattern = timingAnalysis.regularBuyGapPattern;
  if (
    timingAnalysis.rapidOfferPostGapCount > 0 ||
    timingAnalysis.rapidBuyGapCount > 0 ||
    regularOfferPostPattern ||
    regularBuyPattern
  ) {
    const fastestOfferPostGap = timingAnalysis.rapidOfferPostGaps[0];
    const fastestBuyGap = timingAnalysis.rapidBuyGaps[0];
    const regularOfferPostPatternSampleCount = regularOfferPostPattern?.sampleCount ?? 0;
    const regularBuyPatternSampleCount = regularBuyPattern?.sampleCount ?? 0;
    const severity =
      timingAnalysis.rapidOfferPostGapCount + timingAnalysis.rapidBuyGapCount >= 10 ||
      regularOfferPostPatternSampleCount >= 7 ||
      regularBuyPatternSampleCount >= 7
        ? "high"
        : "medium";
    const summaryParts: string[] = [];

    if (timingAnalysis.rapidOfferPostGapCount > 0) {
      summaryParts.push(
        `${timingAnalysis.rapidOfferPostGapCount} seller-side item-market offer postings landed within ${timingAnalysis.thresholdMs}ms of the previous observed posting`
      );
    }
    if (timingAnalysis.rapidBuyGapCount > 0) {
      summaryParts.push(
        `${timingAnalysis.rapidBuyGapCount} buyer-side item-market purchases landed within ${timingAnalysis.thresholdMs}ms of the previous buy`
      );
    }

    if (regularOfferPostPattern) {
      summaryParts.push(
        `offer-post gaps clustered tightly at ${regularOfferPostPattern.minMs}-${regularOfferPostPattern.maxMs}ms across ${regularOfferPostPattern.sampleCount}/${regularOfferPostPattern.eligibleSampleCount} observed sold offers`
      );
    }
    if (regularBuyPattern) {
      summaryParts.push(
        `buy gaps clustered tightly at ${regularBuyPattern.minMs}-${regularBuyPattern.maxMs}ms across ${regularBuyPattern.sampleCount}/${regularBuyPattern.eligibleSampleCount} item-market purchases`
      );
    }

    pushSignal(
      signals,
      "timing_anomaly",
      severity,
      "Suspicious item-market timing patterns",
      `${summaryParts.join(", ")}.`,
      [
        `Seller-side sold offer postings checked: ${timingAnalysis.sellerItemTransactionCount}`,
        `Buyer-side item-market purchases checked: ${timingAnalysis.buyerItemTransactionCount}`,
        fastestOfferPostGap
          ? `Fastest offer-post gap: ${fastestOfferPostGap.previousItemCode} -> ${fastestOfferPostGap.itemCode} in ${fastestOfferPostGap.gapMs}ms`
          : "No rapid offer-post gap example",
        fastestBuyGap
          ? `Fastest buy gap: ${fastestBuyGap.previousItemCode} -> ${fastestBuyGap.itemCode} in ${fastestBuyGap.gapMs}ms`
          : "No rapid buy-gap example",
        regularOfferPostPattern
          ? `Offer-post cadence cluster: ${regularOfferPostPattern.sampleCount}/${regularOfferPostPattern.eligibleSampleCount} samples between ${regularOfferPostPattern.minMs}ms and ${regularOfferPostPattern.maxMs}ms (stddev ${regularOfferPostPattern.standardDeviationMs}ms, CV ${regularOfferPostPattern.coefficientOfVariation})`
          : "No repeated offer-post cadence detected",
        regularBuyPattern
          ? `Buy-gap cadence cluster: ${regularBuyPattern.sampleCount}/${regularBuyPattern.eligibleSampleCount} samples between ${regularBuyPattern.minMs}ms and ${regularBuyPattern.maxMs}ms (stddev ${regularBuyPattern.standardDeviationMs}ms, CV ${regularBuyPattern.coefficientOfVariation})`
          : "No repeated buy-gap cadence detected"
      ]
    );
  }

  return signals.sort((left, right) => {
    const severityDelta = getSeverityRank(right.severity) - getSeverityRank(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

export function analyzeOverwatchData(input: OverwatchAuditInput): OverwatchAuditReport {
  const timezone = input.options?.timezone ?? "UTC";
  const generatedAt = (input.options?.now ?? new Date()).toISOString();
  const thresholds = mergeOverwatchThresholds(input.options?.thresholds);
  const itemCatalog = buildItemCatalog(input.gameConfig);
  const priceMap = buildPriceMap(input.marketPrices);
  const sortedTransactions = [...input.transactions].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );

  const normalizedTransactions = sortedTransactions.map((transaction) =>
    normalizeTransaction(transaction, {
      subjectUserId: input.user._id,
      itemCatalog,
      priceMap
    })
  );

  const categories = summarizeCategories(normalizedTransactions);
  const weekly = summarizeWeekly(normalizedTransactions, timezone);
  const caseDrops = summarizeCaseDrops(normalizedTransactions);
  const counterparties = summarizeCounterparties(normalizedTransactions);
  const pairAnalysis = summarizePairAnalysis(normalizedTransactions, input.user._id, thresholds);
  const work = summarizeWork(
    input.workStats,
    normalizedTransactions,
    thresholds,
    pairAnalysis
  );
  const craftChecks = summarizeCraftChecks(normalizedTransactions);
  const marketBenchmarks = summarizeMarketBenchmarks(normalizedTransactions, thresholds);
  const timingAnalysis = summarizeTimingAnalysis(normalizedTransactions, thresholds);
  const valuationCoverage = buildItemValuationCoverage(normalizedTransactions);

  const moneyIn = round(categories.reduce((sum, category) => sum + category.moneyIn, 0));
  const moneyOut = round(categories.reduce((sum, category) => sum + category.moneyOut, 0));
  const estimatedItemValueIn = round(
    categories.reduce((sum, category) => sum + category.estimatedItemValueIn, 0)
  );
  const estimatedItemValueOut = round(
    categories.reduce((sum, category) => sum + category.estimatedItemValueOut, 0)
  );
  const netMoney = round(moneyIn - moneyOut);
  const estimatedNetWealthDelta = round(
    netMoney + estimatedItemValueIn - estimatedItemValueOut
  );

  const notes = [
    "Current wealth is taken directly from the API field user.rankings.userWealth.value.",
    "Moneyflow direction assumes buyer pays money and seller or seller entity receives money.",
    "Estimated item valuation uses the current public item market price feed and will undercount items without market prices.",
    "Weekly and headline transaction deltas are derived from transaction history and priced items only; they are not historical API wealth snapshots.",
    "Official case rarity tables are baked in for case1 (Case) and case2 (Elite Case); unknown case codes fall back to summary-only reporting.",
    "Craft checks compare craftItem scrap usage against the official rarity ladder: common 6, uncommon 18, rare 54, epic 162, legendary 486, mythic 1458.",
    `Timing analysis tracks two separate itemMarket timing behaviors: seller-side offer posting cadence inferred from settled sales via offerCreatedAt, and buyer-side consecutive purchase gaps. These are reported separately to avoid conflating buying scripts with selling scripts.`
  ];

  const suspiciousSignals = buildSignals({
    thresholds,
    categories,
    caseDrops,
    counterparties,
    marketBenchmarks,
    work,
    craftChecks,
    timingAnalysis
  });

  const oldestTransactionAt = normalizedTransactions[0]?.createdAt;
  const newestTransactionAt = normalizedTransactions[normalizedTransactions.length - 1]?.createdAt;

  return {
    generatedAt,
    timezone,
    lookbackDays: input.options?.days,
    user: {
      userId: input.user._id,
      username: input.user.username,
      countryId: input.user.country,
      accountCreatedAt: input.user.createdAt,
      wealth: {
        rank: input.user.rankings.userWealth.rank,
        tier: input.user.rankings.userWealth.tier,
        value: input.user.rankings.userWealth.value
      },
      casesOpened: {
        rank: input.user.rankings.userCasesOpened.rank,
        tier: input.user.rankings.userCasesOpened.tier,
        value: input.user.rankings.userCasesOpened.value
      }
    },
    coverage: {
      transactionCount: normalizedTransactions.length,
      oldestTransactionAt,
      newestTransactionAt
    },
    summary: {
      moneyIn,
      moneyOut,
      netMoney,
      estimatedItemValueIn,
      estimatedItemValueOut,
      estimatedNetWealthDelta,
      itemValuationCoverage: valuationCoverage,
      categories,
      weekly,
      caseDrops,
      counterparties,
      work,
      craftChecks,
      pairAnalysis,
      marketBenchmarks,
      timingAnalysis
    },
    suspiciousSignals,
    notes,
    normalizedTransactions: input.options?.includeTransactions === false ? undefined : normalizedTransactions
  };
}
