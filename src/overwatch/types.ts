import type {
  GameConfigGetGameConfigResponse,
  ItemTradingGetPricesResponse,
  TransactionListItem,
  UserGetUserLiteResponse
} from "@wareraprojects/api";
import type { WorkStatsItem } from "@wareraprojects/api";

export type SupportedTransactionType =
  | "applicationFee"
  | "trading"
  | "itemMarket"
  | "wage"
  | "donation"
  | "articleTip"
  | "openCase"
  | "craftItem"
  | "dismantleItem"
  | "battleLoot"
  | "unknown";

export type FetchableTransactionType = Exclude<SupportedTransactionType, "unknown">;

export type OverwatchSeverity = "high" | "medium" | "low" | "info";

export type OverwatchSignalCode =
  | "counterparty_concentration"
  | "one_way_flow"
  | "donation_spike"
  | "market_price_outlier"
  | "wage_outlier"
  | "case_drop_outlier"
  | "craft_scrap_mismatch"
  | "timing_anomaly";

export interface OverwatchThresholds {
  minMoneyflowForCounterpartySignal: number;
  counterpartyConcentrationShare: number;
  oneWayFlowShare: number;
  minDonationAmountForSignal: number;
  minDonationShareForSignal: number;
  minComparableMarketTransactions: number;
  minMarketPriceRatio: number;
  maxMarketPriceRatio: number;
  minCaseOpensForDistributionSignal: number;
  lowWageRatio: number;
  highWageRatio: number;
  wageBaselineRatio: number;
  pairMinMoney: number;
  pairMinTransactions: number;
  rapidSellerOfferTimingWindowMs: number;
  rapidBuyerTimingWindowMs: number;
}

export interface OverwatchAuditOptions {
  userId?: string;
  username?: string;
  timezone?: string;
  days?: number;
  maxPages?: number;
  transactionPageLimit?: number;
  includeTransactions?: boolean;
  transactionTypes?: FetchableTransactionType[];
  analysisMode?: "full" | "timing";
  thresholds?: Partial<OverwatchThresholds>;
  now?: Date;
  onProgress?: (event: OverwatchProgressEvent) => void;
}

export type OverwatchProgressStage =
  | "resolve_subject"
  | "fetch_transactions"
  | "fetch_supplemental"
  | "analyze"
  | "resolve_labels"
  | "write_output";

export type OverwatchProgressStatus = "start" | "update" | "done";

export interface OverwatchProgressEvent {
  stage: OverwatchProgressStage;
  status: OverwatchProgressStatus;
  message: string;
  current?: number;
  total?: number;
  page?: number;
  transactionCount?: number;
  requestName?: string;
  username?: string;
  userId?: string;
  elapsedMs?: number;
}

export interface ResolvedOverwatchSubject {
  userId: string;
  username: string;
  user: UserGetUserLiteResponse;
}

export interface ItemCatalogEntry {
  code: string;
  rarity?: string;
  type?: string;
  usage?: string;
}

export interface ItemValuationCoverage {
  pricedTransactionCount: number;
  totalItemTransactionCount: number;
  pricedTransactionShare: number;
  pricedQuantity: number;
  totalItemQuantity: number;
  pricedQuantityShare: number;
}

export interface OverwatchCategorySummary {
  type: SupportedTransactionType;
  transactionCount: number;
  moneyIn: number;
  moneyOut: number;
  netMoney: number;
  itemInQuantity: number;
  itemOutQuantity: number;
  estimatedItemValueIn: number;
  estimatedItemValueOut: number;
  estimatedNetWealthDelta: number;
}

export interface OverwatchWeeklyCategorySummary {
  type: SupportedTransactionType;
  moneyIn: number;
  moneyOut: number;
  netMoney: number;
}

export interface OverwatchWeeklySummary {
  weekStart: string;
  transactionCount: number;
  moneyIn: number;
  moneyOut: number;
  netMoney: number;
  estimatedItemValueIn: number;
  estimatedItemValueOut: number;
  estimatedNetWealthDelta: number;
  categories: OverwatchWeeklyCategorySummary[];
}

export interface OverwatchCaseDropRaritySummary {
  rarity: string;
  count: number;
  share: number;
}

export interface OverwatchCaseDropRarityComparison extends OverwatchCaseDropRaritySummary {
  expectedShare: number | null;
  expectedCount: number | null;
  deltaShare: number | null;
  zScore: number | null;
}

export interface OverwatchCaseDropItemSummary {
  itemCode: string;
  rarity: string;
  count: number;
  share: number;
}

export interface OverwatchCaseDropCaseSummary {
  caseCode: string;
  caseLabel: string;
  totalOpenTransactions: number;
  totalObservedOutcomes: number;
  unknownOutcomeCount: number;
  expectedRatesKnown: boolean;
  chiSquare: number | null;
  highestPositiveZScore: number | null;
  highValueObservedCount: number | null;
  highValueExpectedCount: number | null;
  highValueObservedShare: number | null;
  highValueExpectedShare: number | null;
  highValueZScore: number | null;
  unexpectedObservedRarities: string[];
  outcomesByRarity: OverwatchCaseDropRarityComparison[];
  topDrops: OverwatchCaseDropItemSummary[];
}

export interface OverwatchCaseDropSummary {
  totalOpenTransactions: number;
  totalObservedOutcomes: number;
  unknownOutcomeCount: number;
  totalSpent: number;
  outcomesByRarity: OverwatchCaseDropRaritySummary[];
  topDrops: OverwatchCaseDropItemSummary[];
  byCaseType: OverwatchCaseDropCaseSummary[];
}

export interface OverwatchCounterpartySummary {
  key: string;
  displayName: string;
  kind: "user" | "country" | "mu" | "system" | "unknown";
  transactionCount: number;
  moneyIn: number;
  moneyOut: number;
  netMoney: number;
  flowTotal: number;
  flowShare: number;
  dominantTransactionTypes: SupportedTransactionType[];
  transactionTypeCounts: Partial<Record<SupportedTransactionType, number>>;
}

export interface WageObservationSummary {
  count: number;
  totalQuantity: number;
  totalMoney: number;
  averageRatio: number;
  minRatio: number;
  maxRatio: number;
  baselineRatio: number;
  belowAllowedRangeCount: number;
  aboveAllowedRangeCount: number;
}

export interface OverwatchPairSummary {
  transactionType: SupportedTransactionType;
  sellerId: string;
  buyerId: string;
  sellerLabel: string;
  buyerLabel: string;
  totalQuantity: number;
  totalMoney: number;
  transactionCount: number;
  averageRatio: number | null;
  vsAverage: number | null;
  perspective: "seller" | "buyer" | "other";
}

export interface OverwatchPairAnalysisSummary {
  baselineRatio: number;
  minMoney: number;
  minTransactions: number;
  totalPairCount: number;
  filteredPairCount: number;
  pairs: OverwatchPairSummary[];
}

export interface OverwatchWorkSummary {
  daysAnalyzed: number;
  totalWorkStatsAmount: number;
  totalWorkStatsWage: number;
  averageDailyWage: number;
  observedWages: WageObservationSummary;
  wagePairs: OverwatchPairSummary[];
}

export interface OverwatchCraftMismatchExample {
  transactionId: string;
  createdAt: string;
  craftedItemCode: string;
  craftedRarity: string;
  observedScraps: number;
  expectedScraps: number;
  deltaScraps: number;
}

export interface OverwatchCraftCheckSummary {
  totalCraftTransactions: number;
  checkedCraftTransactions: number;
  matchedCraftTransactions: number;
  mismatchedCraftTransactions: number;
  skippedCraftTransactions: number;
  nonScrapInputTransactions: number;
  unknownRarityTransactions: number;
  mismatchExamples: OverwatchCraftMismatchExample[];
}

export interface MarketPriceOutlierExample {
  transactionId: string;
  createdAt: string;
  type: SupportedTransactionType;
  direction: "in" | "out";
  itemCode: string;
  quantity: number;
  unitPrice: number;
  currentMarketPrice: number;
  ratio: number;
  counterparty: string;
}

export interface OverwatchMarketBenchmarkSummary {
  comparableTransactionCount: number;
  anomalousTransactionCount: number;
  anomalousMoneyVolume: number;
  examples: MarketPriceOutlierExample[];
}

export interface OverwatchTimingMetricSummary {
  count: number;
  minMs: number | null;
  averageMs: number | null;
  medianMs: number | null;
  maxMs: number | null;
}

export interface OverwatchTimingPatternCluster {
  eligibleSampleCount: number;
  sampleCount: number;
  share: number;
  clusterWindowMs: number;
  maxConsideredMs: number;
  minMs: number;
  averageMs: number;
  medianMs: number;
  maxMs: number;
  standardDeviationMs: number;
  coefficientOfVariation: number;
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface OverwatchRapidOfferPostGapExample {
  previousTransactionId: string;
  previousCreatedAt: string;
  previousOfferCreatedAt: string;
  previousType: SupportedTransactionType;
  previousItemCode: string;
  previousQuantity: number;
  previousMoney: number;
  previousCounterparty: string;
  transactionId: string;
  createdAt: string;
  offerCreatedAt: string;
  gapMs: number;
  effectiveThresholdMs: number;
  itemChanged: boolean;
  priceChanged: boolean;
  type: SupportedTransactionType;
  itemCode: string;
  quantity: number;
  money: number;
  counterparty: string;
}

export interface OverwatchRapidBuyGapExample {
  previousTransactionId: string;
  previousCreatedAt: string;
  previousType: SupportedTransactionType;
  previousItemCode: string;
  previousQuantity: number;
  previousMoney: number;
  previousCounterparty: string;
  transactionId: string;
  createdAt: string;
  gapMs: number;
  type: SupportedTransactionType;
  itemCode: string;
  quantity: number;
  money: number;
  counterparty: string;
}

export interface OverwatchTimingAnomalySummary {
  sellerThresholdMs: number;
  sellerDuplicateThresholdMs: number;
  sellerItemTransactionCount: number;
  rapidOfferPostGapCount: number;
  offerPostGapStats: OverwatchTimingMetricSummary;
  regularOfferPostGapPattern: OverwatchTimingPatternCluster | null;
  rapidOfferPostGaps: OverwatchRapidOfferPostGapExample[];
  buyerThresholdMs: number;
  buyerItemTransactionCount: number;
  rapidBuyGapCount: number;
  buyGapStats: OverwatchTimingMetricSummary;
  regularBuyGapPattern: OverwatchTimingPatternCluster | null;
  rapidBuyGaps: OverwatchRapidBuyGapExample[];
}

export interface OverwatchSignal {
  code: OverwatchSignalCode;
  severity: OverwatchSeverity;
  title: string;
  summary: string;
  evidence: string[];
}

export interface NormalizedTransaction {
  transactionId: string;
  createdAt: string;
  type: SupportedTransactionType;
  role: "buyer" | "seller" | "self" | "unknown";
  counterpartyKey: string;
  counterpartyLabel: string;
  counterpartyKind: "user" | "country" | "mu" | "system" | "unknown";
  itemCode?: string;
  itemRarity?: string;
  itemType?: string;
  quantity: number;
  money: number;
  moneyDelta: number;
  itemDeltaQuantity: number;
  estimatedUnitPrice?: number;
  estimatedItemValueDelta: number;
  original: TransactionListItem;
}

export interface OverwatchAuditInput {
  user: UserGetUserLiteResponse;
  transactions: TransactionListItem[];
  gameConfig?: GameConfigGetGameConfigResponse | null;
  marketPrices?: ItemTradingGetPricesResponse | null;
  workStats?: WorkStatsItem[] | null;
  options?: Omit<OverwatchAuditOptions, "userId" | "username" | "onProgress">;
}

export interface OverwatchAuditReport {
  generatedAt: string;
  timezone: string;
  lookbackDays?: number;
  user: {
    userId: string;
    username: string;
    countryId: string;
    accountCreatedAt: string;
    wealth: {
      rank: number;
      tier: string;
      value: number;
    };
    casesOpened: {
      rank: number;
      tier: string;
      value: number;
    };
  };
  coverage: {
    transactionCount: number;
    oldestTransactionAt?: string;
    newestTransactionAt?: string;
  };
  summary: {
    moneyIn: number;
    moneyOut: number;
    netMoney: number;
    estimatedItemValueIn: number;
    estimatedItemValueOut: number;
    estimatedNetWealthDelta: number;
    itemValuationCoverage: ItemValuationCoverage;
    categories: OverwatchCategorySummary[];
    weekly: OverwatchWeeklySummary[];
    caseDrops: OverwatchCaseDropSummary;
    counterparties: OverwatchCounterpartySummary[];
    work: OverwatchWorkSummary | null;
    craftChecks: OverwatchCraftCheckSummary;
    pairAnalysis: OverwatchPairAnalysisSummary;
    marketBenchmarks: OverwatchMarketBenchmarkSummary;
    timingAnalysis: OverwatchTimingAnomalySummary;
  };
  suspiciousSignals: OverwatchSignal[];
  notes: string[];
  normalizedTransactions?: NormalizedTransaction[];
}
