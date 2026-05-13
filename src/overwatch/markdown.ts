import type {
  NormalizedTransaction,
  OverwatchAuditReport,
  OverwatchCategorySummary,
  OverwatchCounterpartySummary,
  OverwatchSignal,
  OverwatchWeeklySummary,
  SupportedTransactionType
} from "./types";

type RenderOverwatchMarkdownOptions = {
  weeklyDetailLinks?: Record<string, string>;
};

type RenderWeeklyDetailMarkdownOptions = {
  mainReportLink?: string;
  maxTransactionsPerSection?: number | "all";
};

type WeeklyCounterpartySummary = {
  displayName: string;
  kind: "user" | "country" | "mu" | "system" | "unknown";
  transactionCount: number;
  moneyIn: number;
  moneyOut: number;
  netMoney: number;
  flowTotal: number;
  dominantTransactionTypes: SupportedTransactionType[];
};

type CategoryItemSummaryRow = {
  itemCode: string;
  direction: "in" | "out";
  transactionCount: number;
  totalQuantity: number;
  totalMoney: number;
  averageUnitPrice: number | null;
  minUnitPrice: number | null;
  maxUnitPrice: number | null;
};

const ITEM_MARKET_SUMMARY_TYPES = new Set<SupportedTransactionType>(["trading", "itemMarket"]);
const OMIT_FULL_CATEGORY_TRANSACTION_DETAILS = new Set<SupportedTransactionType>([
  "openCase",
  "dismantleItem"
]);

function escapeCell(value: string | number | undefined): string {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function nullablePercent(value: number | null | undefined): string {
  return typeof value === "number" ? percent(value) : "n/a";
}

function money(value: number): string {
  return value.toFixed(2);
}

function quantity(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function nullableNumber(value: number | null | undefined, digits = 3): string {
  return typeof value === "number" ? value.toFixed(digits) : "n/a";
}

function unitPrice(value: number | null | undefined): string {
  return typeof value === "number" ? value.toFixed(2) : "n/a";
}

function seconds(value: number): string {
  return value.toFixed(3);
}

function milliseconds(value: number): string {
  return `${Math.round(value)}ms`;
}

function millisecondsToSeconds(value: number): string {
  return seconds(value / 1000);
}

function preciseMilliseconds(value: number | null | undefined): string {
  return typeof value === "number" ? `${value.toFixed(1).replace(/\.0$/, "")}ms` : "n/a";
}

function formatTimingMetricSummary(
  metric:
    | OverwatchAuditReport["summary"]["timingAnalysis"]["offerPostGapStats"]
    | OverwatchAuditReport["summary"]["timingAnalysis"]["buyGapStats"]
    | undefined
): string {
  if (!metric || metric.count === 0) {
    return "none";
  }

  return [
    `${metric.count} samples`,
    `min ${preciseMilliseconds(metric.minMs)}`,
    `avg ${preciseMilliseconds(metric.averageMs)}`,
    `median ${preciseMilliseconds(metric.medianMs)}`,
    `max ${preciseMilliseconds(metric.maxMs)}`
  ].join(" | ");
}

function renderTable(headers: string[], rows: Array<Array<string | number | undefined>>): string {
  const headerRow = `| ${headers.map(escapeCell).join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`).join("\n");
  return [headerRow, separator, body].filter(Boolean).join("\n");
}

function renderHtmlTable(
  headers: string[],
  rows: Array<Array<string | number | undefined>>
): string {
  const headerRow = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("\n");

  return [
    "<table>",
    "<thead>",
    headerRow,
    "</thead>",
    "<tbody>",
    bodyRows,
    "</tbody>",
    "</table>"
  ].join("\n");
}

function renderSignals(signals: OverwatchSignal[]): string {
  if (signals.length === 0) {
    return "No anomaly rules fired for the selected window.";
  }

  return signals
    .map((signal) => {
      const evidence = signal.evidence.map((item) => `- ${item}`).join("\n");
      return `### ${signal.severity.toUpperCase()} - ${signal.title}\n${signal.summary}\n${evidence}`;
    })
    .join("\n\n");
}

function renderCategoryTable(categories: OverwatchCategorySummary[]): string {
  return renderTable(
    ["Type", "Count", "Income", "Expense", "Net", "Item In", "Item Out"],
    categories.map((category) => [
      category.type,
      category.transactionCount,
      money(category.moneyIn),
      money(category.moneyOut),
      money(category.netMoney),
      category.itemInQuantity,
      category.itemOutQuantity
    ])
  );
}

function renderCounterpartyTable(counterparties: OverwatchCounterpartySummary[]): string {
  return renderTable(
    ["Counterparty", "Kind", "Count", "Flow", "Net", "Share", "Types"],
    counterparties.slice(0, 10).map((counterparty) => [
      counterparty.displayName,
      counterparty.kind,
      counterparty.transactionCount,
      money(counterparty.flowTotal),
      money(counterparty.netMoney),
      percent(counterparty.flowShare),
      counterparty.dominantTransactionTypes.join(", ")
    ])
  );
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

function getWeekTransactions(report: OverwatchAuditReport, weekStart: string): NormalizedTransaction[] {
  return (report.normalizedTransactions ?? []).filter(
    (transaction) => getWeekStart(transaction.createdAt, report.timezone) === weekStart
  );
}

function summarizeTransactionSet(transactions: NormalizedTransaction[]) {
  let moneyIn = 0;
  let moneyOut = 0;
  let estimatedItemValueIn = 0;
  let estimatedItemValueOut = 0;

  for (const transaction of transactions) {
    if (transaction.moneyDelta >= 0) {
      moneyIn += transaction.moneyDelta;
    } else {
      moneyOut += Math.abs(transaction.moneyDelta);
    }

    if (transaction.estimatedItemValueDelta >= 0) {
      estimatedItemValueIn += transaction.estimatedItemValueDelta;
    } else {
      estimatedItemValueOut += Math.abs(transaction.estimatedItemValueDelta);
    }
  }

  const netMoney = moneyIn - moneyOut;
  const estimatedNetWealthDelta = netMoney + estimatedItemValueIn - estimatedItemValueOut;

  return {
    moneyIn,
    moneyOut,
    netMoney,
    estimatedItemValueIn,
    estimatedItemValueOut,
    estimatedNetWealthDelta
  };
}

function buildWeeklyCounterpartySummaries(
  transactions: NormalizedTransaction[]
): WeeklyCounterpartySummary[] {
  const counterpartyMap = new Map<
    string,
    {
      displayName: string;
      kind: "user" | "country" | "mu" | "system" | "unknown";
      transactionCount: number;
      moneyIn: number;
      moneyOut: number;
      typeCounts: Partial<Record<SupportedTransactionType, number>>;
    }
  >();

  for (const transaction of transactions) {
    const summary = counterpartyMap.get(transaction.counterpartyKey) ?? {
      displayName: transaction.counterpartyLabel,
      kind: transaction.counterpartyKind,
      transactionCount: 0,
      moneyIn: 0,
      moneyOut: 0,
      typeCounts: {}
    };

    summary.transactionCount += 1;
    if (transaction.moneyDelta >= 0) {
      summary.moneyIn += transaction.moneyDelta;
    } else {
      summary.moneyOut += Math.abs(transaction.moneyDelta);
    }
    summary.typeCounts[transaction.type] = (summary.typeCounts[transaction.type] ?? 0) + 1;
    counterpartyMap.set(transaction.counterpartyKey, summary);
  }

  return [...counterpartyMap.values()]
    .map((summary) => ({
      displayName: summary.displayName,
      kind: summary.kind,
      transactionCount: summary.transactionCount,
      moneyIn: summary.moneyIn,
      moneyOut: summary.moneyOut,
      netMoney: summary.moneyIn - summary.moneyOut,
      flowTotal: summary.moneyIn + summary.moneyOut,
      dominantTransactionTypes: Object.entries(summary.typeCounts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([type]) => type as SupportedTransactionType)
    }))
    .sort((left, right) => right.flowTotal - left.flowTotal);
}

function renderWeeklyCounterpartyTable(transactions: NormalizedTransaction[]): string {
  const counterparties = buildWeeklyCounterpartySummaries(transactions);
  if (counterparties.length === 0) {
    return "No counterparties found for this week.";
  }

  return renderTable(
    ["Counterparty", "Kind", "Count", "Flow", "Net", "Types"],
    counterparties.slice(0, 15).map((counterparty) => [
      counterparty.displayName,
      counterparty.kind,
      counterparty.transactionCount,
      money(counterparty.flowTotal),
      money(counterparty.netMoney),
      counterparty.dominantTransactionTypes.join(", ")
    ])
  );
}

function transactionDirection(transaction: NormalizedTransaction): string {
  if (transaction.moneyDelta > 0) {
    return "received";
  }
  if (transaction.moneyDelta < 0) {
    return "paid";
  }
  if (transaction.itemDeltaQuantity > 0) {
    return "item in";
  }
  if (transaction.itemDeltaQuantity < 0) {
    return "item out";
  }
  if (transaction.role === "self") {
    return "self";
  }

  return transaction.role;
}

function getTransactionImpact(transaction: NormalizedTransaction): number {
  return Math.max(
    Math.abs(transaction.moneyDelta),
    Math.abs(transaction.estimatedItemValueDelta),
    Math.abs(transaction.money)
  );
}

function renderTransactionTable(
  transactions: NormalizedTransaction[],
  maxRows: number | "all",
  options: { includeType?: boolean } = {}
): string {
  const includeType = options.includeType ?? true;
  const headers = [
    "Date",
    ...(includeType ? ["Type"] : []),
    "Direction",
    "Item",
    "Qty",
    "Money",
    "Net",
    "Est. Item Value",
    "Counterparty",
    "TX"
  ];

  const limit = maxRows === "all" ? transactions.length : maxRows;
  const rows = transactions.slice(0, limit).map((transaction) => [
    transaction.createdAt,
    ...(includeType ? [transaction.type] : []),
    transactionDirection(transaction),
    transaction.itemCode ?? "-",
    quantity(transaction.quantity),
    money(transaction.money),
    money(transaction.moneyDelta),
    money(transaction.estimatedItemValueDelta),
    transaction.counterpartyLabel,
    transaction.transactionId
  ]);

  return renderTable(headers, rows);
}

function renderDetailsBlock(summary: string, content: string): string {
  return ["<details>", `<summary>${escapeHtml(summary)}</summary>`, "", content, "", "</details>"].join(
    "\n"
  );
}

function renderTableSection(args: {
  headers: string[];
  rows: Array<Array<string | number | undefined>>;
  rowLimit: number | "all";
  emptyMessage: string;
  detailsLabel: string;
  allowFullDetails?: boolean;
  omittedMessage?: string;
}): string {
  if (args.rows.length === 0) {
    return args.emptyMessage;
  }

  const allowFullDetails = args.allowFullDetails ?? true;
  const previewCount = args.rowLimit === "all" ? args.rows.length : args.rowLimit;
  const previewRows = args.rows.slice(0, previewCount);
  const sections = [renderTable(args.headers, previewRows)];

  if (args.rowLimit !== "all" && args.rows.length > previewCount) {
    if (allowFullDetails) {
      sections.push(
        "",
        renderDetailsBlock(
          `Show all ${args.detailsLabel} (${args.rows.length} rows)`,
          renderHtmlTable(args.headers, args.rows)
        )
      );
    } else {
      sections.push(
        "",
        args.omittedMessage ??
          `Full ${args.detailsLabel} table omitted here because it contains ${args.rows.length} rows.`
      );
    }
  }

  return sections.join("\n");
}

function buildCategoryItemSummaryRows(
  categoryType: SupportedTransactionType,
  transactions: NormalizedTransaction[]
): CategoryItemSummaryRow[] {
  if (!ITEM_MARKET_SUMMARY_TYPES.has(categoryType)) {
    return [];
  }

  const itemMap = new Map<
    string,
    {
      itemCode: string;
      direction: "in" | "out";
      transactionCount: number;
      totalQuantity: number;
      totalMoney: number;
      minUnitPrice: number | null;
      maxUnitPrice: number | null;
    }
  >();

  for (const transaction of transactions) {
    if (!transaction.itemCode || transaction.quantity <= 0) {
      continue;
    }

    const direction =
      transaction.itemDeltaQuantity > 0 ? "in" : transaction.itemDeltaQuantity < 0 ? "out" : null;
    if (!direction) {
      continue;
    }

    const key = `${transaction.itemCode}|${direction}`;
    const summary = itemMap.get(key) ?? {
      itemCode: transaction.itemCode,
      direction,
      transactionCount: 0,
      totalQuantity: 0,
      totalMoney: 0,
      minUnitPrice: null,
      maxUnitPrice: null
    };

    summary.transactionCount += 1;
    summary.totalQuantity += Math.abs(transaction.itemDeltaQuantity) || transaction.quantity;
    summary.totalMoney += transaction.money;

    if (transaction.quantity > 0 && transaction.money > 0) {
      const currentUnitPrice = transaction.money / transaction.quantity;
      summary.minUnitPrice =
        summary.minUnitPrice === null ? currentUnitPrice : Math.min(summary.minUnitPrice, currentUnitPrice);
      summary.maxUnitPrice =
        summary.maxUnitPrice === null ? currentUnitPrice : Math.max(summary.maxUnitPrice, currentUnitPrice);
    }

    itemMap.set(key, summary);
  }

  return [...itemMap.values()]
    .map((summary) => ({
      itemCode: summary.itemCode,
      direction: summary.direction,
      transactionCount: summary.transactionCount,
      totalQuantity: summary.totalQuantity,
      totalMoney: summary.totalMoney,
      averageUnitPrice:
        summary.totalQuantity > 0 && summary.totalMoney > 0
          ? summary.totalMoney / summary.totalQuantity
          : null,
      minUnitPrice: summary.minUnitPrice,
      maxUnitPrice: summary.maxUnitPrice
    }))
    .sort((left, right) => right.totalMoney - left.totalMoney);
}

function renderCategoryItemSummary(
  categoryType: SupportedTransactionType,
  transactions: NormalizedTransaction[],
  rowLimit: number | "all"
): string {
  const rows = buildCategoryItemSummaryRows(categoryType, transactions).map((summary) => [
    summary.itemCode,
    summary.direction,
    summary.transactionCount,
    quantity(summary.totalQuantity),
    money(summary.totalMoney),
    unitPrice(summary.averageUnitPrice),
    unitPrice(summary.minUnitPrice),
    unitPrice(summary.maxUnitPrice)
  ]);

  if (rows.length === 0) {
    return "";
  }

  return [
    `#### Item Flow Summary`,
    ``,
    renderTableSection({
      headers: ["Item", "Dir", "TXs", "Qty", "Money", "Avg Unit", "Min Unit", "Max Unit"],
      rows,
      rowLimit,
      emptyMessage: "No item-level summary for this category.",
      detailsLabel: `${categoryType} item-summary rows`
    })
  ].join("\n");
}

function renderWeeklyRows(
  weekly: OverwatchWeeklySummary[],
  links?: Record<string, string>
): { headers: string[]; rows: Array<Array<string | number | undefined>> } {
  const hasDetailLinks = weekly.some((week) => Boolean(links?.[week.weekStart]));
  const headers = [
    "Week Start",
    "Count",
    "Income",
    "Expense",
    "Net",
    "Top Categories",
    ...(hasDetailLinks ? ["Details"] : [])
  ];

  const rows = weekly.map((week) => [
    week.weekStart,
    week.transactionCount,
    money(week.moneyIn),
    money(week.moneyOut),
    money(week.netMoney),
    week.categories
      .slice(0, 3)
      .map((category) => `${category.type}:${money(category.netMoney)}`)
      .join(", "),
    ...(hasDetailLinks ? [links?.[week.weekStart] ? `[details](${links[week.weekStart]})` : ""] : [])
  ]);

  return { headers, rows };
}

function renderTimingAnalysis(report: OverwatchAuditReport): string {
  const timing = report.summary.timingAnalysis as OverwatchAuditReport["summary"]["timingAnalysis"] & {
    thresholdSeconds?: number;
    rapidOfferPostGaps: Array<
      OverwatchAuditReport["summary"]["timingAnalysis"]["rapidOfferPostGaps"][number] & {
        gapSeconds?: number;
      }
    >;
    rapidBuyGaps: Array<
      OverwatchAuditReport["summary"]["timingAnalysis"]["rapidBuyGaps"][number] & {
        gapSeconds?: number;
      }
    >;
  };
  const thresholdMs =
    typeof timing.thresholdMs === "number"
      ? timing.thresholdMs
      : typeof timing.thresholdSeconds === "number"
      ? Math.round(timing.thresholdSeconds * 1000)
      : 0;
  const regularPatternRows: Array<Array<string | number | undefined>> = [];
  if (timing.regularOfferPostGapPattern) {
    regularPatternRows.push([
      "Offer Post Gap Cadence",
      `${timing.regularOfferPostGapPattern.sampleCount}/${timing.regularOfferPostGapPattern.eligibleSampleCount}`,
      `${timing.regularOfferPostGapPattern.minMs}-${timing.regularOfferPostGapPattern.maxMs}`,
      preciseMilliseconds(timing.regularOfferPostGapPattern.averageMs),
      preciseMilliseconds(timing.regularOfferPostGapPattern.medianMs),
      preciseMilliseconds(timing.regularOfferPostGapPattern.standardDeviationMs),
      percent(timing.regularOfferPostGapPattern.share),
      `${timing.regularOfferPostGapPattern.firstObservedAt} -> ${timing.regularOfferPostGapPattern.lastObservedAt}`
    ]);
  }
  if (timing.regularBuyGapPattern) {
    regularPatternRows.push([
      "Buyer Purchase Gap Cadence",
      `${timing.regularBuyGapPattern.sampleCount}/${timing.regularBuyGapPattern.eligibleSampleCount}`,
      `${timing.regularBuyGapPattern.minMs}-${timing.regularBuyGapPattern.maxMs}`,
      preciseMilliseconds(timing.regularBuyGapPattern.averageMs),
      preciseMilliseconds(timing.regularBuyGapPattern.medianMs),
      preciseMilliseconds(timing.regularBuyGapPattern.standardDeviationMs),
      percent(timing.regularBuyGapPattern.share),
      `${timing.regularBuyGapPattern.firstObservedAt} -> ${timing.regularBuyGapPattern.lastObservedAt}`
    ]);
  }
  const sections = [
    `Threshold: ${milliseconds(thresholdMs)} | Seller-side sold offer postings checked: ${timing.sellerItemTransactionCount} | Rapid offer-post gaps: ${timing.rapidOfferPostGapCount} | Buyer-side item-market purchases checked: ${timing.buyerItemTransactionCount} | Rapid buy gaps: ${timing.rapidBuyGapCount}`,
    `Offer-post gap stats: ${formatTimingMetricSummary(timing.offerPostGapStats)}`,
    `Buyer purchase gap stats: ${formatTimingMetricSummary(timing.buyGapStats)}`,
    ``
  ];

  if (regularPatternRows.length > 0) {
    sections.push(
      `### Regular Timing Patterns`,
      ``,
      renderTable(
        [
          "Pattern",
          "Samples",
          "Range (ms)",
          "Avg",
          "Median",
          "Std Dev",
          "Share",
          "Observed"
        ],
        regularPatternRows
      ),
      ``
    );
  } else {
    sections.push(`No repeated narrow item-market offer-posting cadence detected in sub-${milliseconds(thresholdMs * 2)} samples.`, ``);
  }

  if (timing.rapidOfferPostGaps.length > 0) {
    sections.push(
      `### Rapid Offer Posting Gaps`,
      ``,
      renderTableSection({
        headers: [
          "Offer Time",
          "Prev Offer Time",
          "Gap (s)",
          "Prev Item",
          "Item",
          "Qty",
          "Money",
          "Buyer",
          "Sold Time",
          "Prev TX",
          "TX"
        ],
        rows: timing.rapidOfferPostGaps.map((example) => [
          example.offerCreatedAt,
          example.previousOfferCreatedAt,
          millisecondsToSeconds(
            typeof example.gapMs === "number"
              ? example.gapMs
              : Math.round(
                  (((example as typeof example & { gapSeconds?: number }).gapSeconds ?? 0) * 1000)
                )
          ),
          example.previousItemCode,
          example.itemCode,
          quantity(example.quantity),
          money(example.money),
          example.counterparty,
          example.createdAt,
          example.previousTransactionId,
          example.transactionId
        ]),
        rowLimit: "all",
        emptyMessage: `No seller-side item-market offer postings were closer than ${milliseconds(thresholdMs)} apart.`,
        detailsLabel: "rapid offer-post gap transactions"
      }),
      ``
    );
  } else {
    sections.push(`No seller-side item-market offer postings were closer than ${milliseconds(thresholdMs)} apart.`, ``);
  }

  if (timing.rapidBuyGaps.length > 0) {
    sections.push(
      `### Rapid Buyer Purchase Gaps`,
      ``,
      renderTableSection({
        headers: [
          "Time",
          "Prev Time",
          "Gap (s)",
          "Prev Item",
          "Item",
          "Qty",
          "Money",
          "Seller",
          "Prev TX",
          "TX"
        ],
        rows: timing.rapidBuyGaps.map((example) => [
          example.createdAt,
          example.previousCreatedAt,
          millisecondsToSeconds(
            typeof example.gapMs === "number"
              ? example.gapMs
              : Math.round(
                  (((example as typeof example & { gapSeconds?: number }).gapSeconds ?? 0) * 1000)
                )
          ),
          example.previousItemCode,
          example.itemCode,
          quantity(example.quantity),
          money(example.money),
          example.counterparty,
          example.previousTransactionId,
          example.transactionId
        ]),
        rowLimit: "all",
        emptyMessage: `No buyer-side item-market purchases were closer than ${milliseconds(thresholdMs)} apart.`,
        detailsLabel: "rapid buyer purchase-gap transactions"
      }),
      ``
    );
  } else {
    sections.push(`No buyer-side item-market purchases were closer than ${milliseconds(thresholdMs)} apart.`, ``);
  }

  sections.push(
    `Seller-side timings use sold item-market transactions only, with posting times inferred from \`offerCreatedAt\`. Buyer-side timings use consecutive purchase completion times (\`createdAt\`).`
  );

  return sections.join("\n");
}

export function renderOverwatchMarkdown(
  report: OverwatchAuditReport,
  options: RenderOverwatchMarkdownOptions = {}
): string {
  const weeklyTable = renderWeeklyRows(report.summary.weekly, options.weeklyDetailLinks);
  const caseRows = report.summary.caseDrops.outcomesByRarity.map((item) => [
    item.rarity,
    item.count,
    percent(item.share)
  ]);

  const topDropRows = report.summary.caseDrops.topDrops.map((item) => [
    item.itemCode,
    item.rarity,
    item.count,
    percent(item.share)
  ]);
  const caseTypeSections = report.summary.caseDrops.byCaseType.map((caseSummary) => {
    const comparisonRows = caseSummary.outcomesByRarity.map((item) => [
      item.rarity,
      item.count,
      percent(item.share),
      nullablePercent(item.expectedShare),
      nullablePercent(item.deltaShare),
      nullableNumber(item.zScore)
    ]);
    const topRows = caseSummary.topDrops.map((item) => [
      item.itemCode,
      item.rarity,
      item.count,
      percent(item.share)
    ]);

    return [
      `### ${caseSummary.caseLabel} (${caseSummary.caseCode})`,
      ``,
      `Opens: ${caseSummary.totalOpenTransactions} | Observed outcomes: ${caseSummary.totalObservedOutcomes} | Unknown outcomes: ${caseSummary.unknownOutcomeCount}`,
      caseSummary.expectedRatesKnown
        ? `Official comparison: chi-square ${nullableNumber(caseSummary.chiSquare)} | Legendary+ observed ${nullablePercent(caseSummary.highValueObservedShare)} vs expected ${nullablePercent(caseSummary.highValueExpectedShare)} | Legendary+ z-score ${nullableNumber(caseSummary.highValueZScore)}`
        : `Official comparison: unavailable for this case code.`,
      caseSummary.unexpectedObservedRarities.length > 0
        ? `Unexpected observed rarities: ${caseSummary.unexpectedObservedRarities.join(", ")}`
        : "",
      ``,
      comparisonRows.length > 0
        ? renderTable(["Rarity", "Count", "Observed", "Expected", "Delta", "Z"], comparisonRows)
        : "No observed drops for this case type.",
      ``,
      topRows.length > 0 ? renderTable(["Item", "Rarity", "Count", "Share"], topRows) : ""
    ]
      .filter((line) => line !== "")
      .join("\n");
  });

  const benchmarkRows = report.summary.marketBenchmarks.examples.map((example) => [
    example.createdAt,
    example.itemCode,
    example.direction,
    example.quantity,
    money(example.unitPrice),
    money(example.currentMarketPrice),
    `${example.ratio.toFixed(3)}x`,
    example.counterparty
  ]);
  const craftMismatchRows = report.summary.craftChecks.mismatchExamples.map((item) => [
    item.createdAt,
    item.craftedItemCode,
    item.craftedRarity,
    item.observedScraps,
    item.expectedScraps,
    item.deltaScraps > 0 ? `+${item.deltaScraps}` : item.deltaScraps,
    item.transactionId
  ]);

  const pairRows = report.summary.pairAnalysis.pairs.map((pair) => [
    pair.transactionType,
    pair.sellerLabel,
    pair.buyerLabel,
    pair.totalQuantity,
    money(pair.totalMoney),
    pair.transactionCount,
    pair.averageRatio === null ? "n/a" : pair.averageRatio.toFixed(4),
    pair.vsAverage === null
      ? "n/a"
      : `${pair.vsAverage > 0 ? "+" : ""}${pair.vsAverage.toFixed(3)}`
  ]);

  return [
    `# War Era Overwatch Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    `User: ${report.user.username} (${report.user.userId})`,
    `Country: ${report.user.countryId}`,
    `Window: ${report.lookbackDays ? `${report.lookbackDays} day(s)` : "all available history"} | Timezone: ${report.timezone}`,
    `Coverage: ${report.coverage.transactionCount} transactions from ${report.coverage.oldestTransactionAt ?? "n/a"} to ${report.coverage.newestTransactionAt ?? "n/a"}`,
    `Current API wealth: ${money(report.user.wealth.value)} | Rank #${report.user.wealth.rank} (${report.user.wealth.tier})`,
    ``,
    `## Headline`,
    ``,
    `- Money in: ${money(report.summary.moneyIn)}`,
    `- Money out: ${money(report.summary.moneyOut)}`,
    `- Net money: ${money(report.summary.netMoney)}`,
    `- Priced item coverage: ${percent(report.summary.itemValuationCoverage.pricedTransactionShare)} of item transactions`,
    ``,
    `## Signals`,
    ``,
    renderSignals(report.suspiciousSignals),
    ``,
    `## Timing Analysis`,
    ``,
    renderTimingAnalysis(report),
    ``,
    `## Category Breakdown`,
    ``,
    renderCategoryTable(report.summary.categories),
    ``,
    `## Case Outcomes`,
    ``,
    `Observed outcomes: ${report.summary.caseDrops.totalObservedOutcomes} | Unknown outcomes: ${report.summary.caseDrops.unknownOutcomeCount} | Spend: ${money(report.summary.caseDrops.totalSpent)}`,
    ``,
    caseRows.length > 0
      ? renderTable(["Rarity", "Count", "Share"], caseRows)
      : "No case outcomes were observed in the selected window.",
    ``,
    topDropRows.length > 0
      ? renderTable(["Item", "Rarity", "Count", "Share"], topDropRows)
      : "",
    ``,
    caseTypeSections.length > 0 ? caseTypeSections.join("\n\n") : "",
    ``,
    `## Craft Check`,
    ``,
    `Craft transactions: ${report.summary.craftChecks.totalCraftTransactions} | Checked: ${report.summary.craftChecks.checkedCraftTransactions} | Matched: ${report.summary.craftChecks.matchedCraftTransactions} | Mismatched: ${report.summary.craftChecks.mismatchedCraftTransactions} | Skipped: ${report.summary.craftChecks.skippedCraftTransactions}`,
    `Official scrap costs: common 6, uncommon 18, rare 54, epic 162, legendary 486, mythic 1458`,
    ``,
    craftMismatchRows.length > 0
      ? renderTable(
          ["Date", "Item", "Rarity", "Observed Scraps", "Expected Scraps", "Delta", "TX"],
          craftMismatchRows
        )
      : report.summary.craftChecks.totalCraftTransactions > 0
      ? "All checked craft transactions matched the official scrap cost table."
      : "No craft transactions were observed in the selected window.",
    ``,
    `## Weekly Transaction Delta`,
    ``,
    weeklyTable.rows.length > 0 ? renderTable(weeklyTable.headers, weeklyTable.rows) : "No weekly data.",
    ``,
    `## Counterparties`,
    ``,
    report.summary.counterparties.length > 0
      ? renderCounterpartyTable(report.summary.counterparties)
      : "No counterparties found.",
    ``,
    `## Pair Analysis`,
    ``,
    `Filtered pairs: ${report.summary.pairAnalysis.filteredPairCount} of ${report.summary.pairAnalysis.totalPairCount} | min money ${money(report.summary.pairAnalysis.minMoney)} | min txs ${report.summary.pairAnalysis.minTransactions} | wage baseline ratio ${report.summary.pairAnalysis.baselineRatio.toFixed(3)}`,
    ``,
    pairRows.length > 0
      ? renderTable(
          ["Type", "Seller", "Buyer", "Qty", "Money", "TXs", "Ratio", "VS Avg"],
          pairRows
        )
      : "No pairs met the current thresholds.",
    ``,
    `## Market Benchmarks`,
    ``,
    `Comparable trades: ${report.summary.marketBenchmarks.comparableTransactionCount} | Anomalous trades: ${report.summary.marketBenchmarks.anomalousTransactionCount} | Anomalous volume: ${money(report.summary.marketBenchmarks.anomalousMoneyVolume)}`,
    ``,
    benchmarkRows.length > 0
      ? renderTable(
          ["Date", "Item", "Dir", "Qty", "Unit Price", "Current Price", "Ratio", "Counterparty"],
          benchmarkRows
        )
      : "No comparable public-market trades.",
    ``,
    report.summary.work
      ? `## Wage Check

- Wage transactions: ${report.summary.work.observedWages.count}
- Total wage quantity: ${report.summary.work.observedWages.totalQuantity}
- Total wage money: ${money(report.summary.work.observedWages.totalMoney)}
- Weighted average ratio: ${report.summary.work.observedWages.averageRatio.toFixed(4)}
- Observed ratio range: ${report.summary.work.observedWages.minRatio.toFixed(4)} to ${report.summary.work.observedWages.maxRatio.toFixed(4)}
- Expected wage ratio band: ${(report.summary.work.observedWages.baselineRatio * 0.7).toFixed(4)} to ${(report.summary.work.observedWages.baselineRatio * 1.3).toFixed(4)}
- Wage pairs shown in Pair Analysis: ${report.summary.work.wagePairs.length}`
      : "",
    ``,
    `## Notes`,
    ``,
    report.notes.map((note) => `- ${note}`).join("\n")
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function renderWeeklyDetailMarkdown(
  report: OverwatchAuditReport,
  weekStart: string,
  options: RenderWeeklyDetailMarkdownOptions = {}
): string {
  const weekSummary = report.summary.weekly.find((week) => week.weekStart === weekStart);
  const transactions = getWeekTransactions(report, weekStart);
  const maxTransactionsPerSection = options.maxTransactionsPerSection ?? 20;

  if (!weekSummary) {
    return [
      `# Weekly Detail: ${weekStart}`,
      ``,
      options.mainReportLink ? `[Back to main report](${options.mainReportLink})` : "",
      ``,
      `No weekly summary was found for this week.`
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  const categoryRows = weekSummary.categories.map((category) => [
    category.type,
    money(category.moneyIn),
    money(category.moneyOut),
    money(category.netMoney)
  ]);
  const topInflows = [...transactions]
    .filter((transaction) => transaction.moneyDelta > 0)
    .sort((left, right) => right.moneyDelta - left.moneyDelta);
  const topOutflows = [...transactions]
    .filter((transaction) => transaction.moneyDelta < 0)
    .sort((left, right) => Math.abs(right.moneyDelta) - Math.abs(left.moneyDelta));
  const categoryDrilldowns = weekSummary.categories.map((category) => {
    const categoryTransactions = transactions
      .filter((transaction) => transaction.type === category.type)
      .sort((left, right) => getTransactionImpact(right) - getTransactionImpact(left));
    const categoryTotals = summarizeTransactionSet(categoryTransactions);
    const itemSummary = renderCategoryItemSummary(
      category.type,
      categoryTransactions,
      maxTransactionsPerSection
    );
    const allowFullTransactionDetails =
      maxTransactionsPerSection === "all" ||
      !OMIT_FULL_CATEGORY_TRANSACTION_DETAILS.has(category.type);
    const transactionRows = categoryTransactions.map((transaction) => [
      transaction.createdAt,
      transactionDirection(transaction),
      transaction.itemCode ?? "-",
      quantity(transaction.quantity),
      money(transaction.money),
      money(transaction.moneyDelta),
      money(transaction.estimatedItemValueDelta),
      transaction.counterpartyLabel,
      transaction.transactionId
    ]);

    return [
      `### ${category.type}`,
      ``,
      `Count: ${categoryTransactions.length} | Income: ${money(categoryTotals.moneyIn)} | Expense: ${money(categoryTotals.moneyOut)} | Net: ${money(categoryTotals.netMoney)}`,
      ``,
      itemSummary,
      itemSummary ? `` : "",
      `#### Transactions`,
      ``,
      renderTableSection({
        headers: ["Date", "Direction", "Item", "Qty", "Money", "Net", "Est. Item Value", "Counterparty", "TX"],
        rows: transactionRows,
        rowLimit: maxTransactionsPerSection,
        emptyMessage: "No transactions in this category.",
        detailsLabel: `${category.type} transactions`,
        allowFullDetails: allowFullTransactionDetails,
        omittedMessage:
          categoryTransactions.length > 0
            ? `Full ${category.type} transaction table omitted here because it contains ${categoryTransactions.length} rows. Use the JSON report if you need every row for this category.`
            : "No transactions in this category."
      })
    ].join("\n");
  });

  return [
    `# Weekly Detail: ${weekStart}`,
    ``,
    options.mainReportLink ? `[Back to main report](${options.mainReportLink})` : "",
    ``,
    `User: ${report.user.username} (${report.user.userId})`,
    `Timezone: ${report.timezone}`,
    `Transactions: ${weekSummary.transactionCount}`,
    `Money in: ${money(weekSummary.moneyIn)} | Money out: ${money(weekSummary.moneyOut)} | Net: ${money(weekSummary.netMoney)}`,
    maxTransactionsPerSection === "all"
      ? `Preview rows: all tables expanded`
      : `Preview rows per table: ${maxTransactionsPerSection} | Expand the details blocks below to show full tables`,
    transactions.length > 0 && transactions.length !== weekSummary.transactionCount
      ? `Resolved detail transactions: ${transactions.length} | Weekly summary count: ${weekSummary.transactionCount}`
      : "",
    ``,
    `## Category Breakdown`,
    ``,
    categoryRows.length > 0
      ? renderTable(["Type", "Income", "Expense", "Net"], categoryRows)
      : "No category data.",
    ``,
    `## Top Counterparties`,
    ``,
    renderWeeklyCounterpartyTable(transactions),
    ``,
    `## Largest Cash Inflows`,
    ``,
    renderTableSection({
      headers: [
        "Date",
        "Type",
        "Direction",
        "Item",
        "Qty",
        "Money",
        "Net",
        "Est. Item Value",
        "Counterparty",
        "TX"
      ],
      rows: topInflows.map((transaction) => [
        transaction.createdAt,
        transaction.type,
        transactionDirection(transaction),
        transaction.itemCode ?? "-",
        quantity(transaction.quantity),
        money(transaction.money),
        money(transaction.moneyDelta),
        money(transaction.estimatedItemValueDelta),
        transaction.counterpartyLabel,
        transaction.transactionId
      ]),
      rowLimit: maxTransactionsPerSection,
      emptyMessage: "No positive-cash transactions this week.",
      detailsLabel: "cash inflow transactions"
    }),
    ``,
    `## Largest Cash Outflows`,
    ``,
    renderTableSection({
      headers: [
        "Date",
        "Type",
        "Direction",
        "Item",
        "Qty",
        "Money",
        "Net",
        "Est. Item Value",
        "Counterparty",
        "TX"
      ],
      rows: topOutflows.map((transaction) => [
        transaction.createdAt,
        transaction.type,
        transactionDirection(transaction),
        transaction.itemCode ?? "-",
        quantity(transaction.quantity),
        money(transaction.money),
        money(transaction.moneyDelta),
        money(transaction.estimatedItemValueDelta),
        transaction.counterpartyLabel,
        transaction.transactionId
      ]),
      rowLimit: maxTransactionsPerSection,
      emptyMessage: "No negative-cash transactions this week.",
      detailsLabel: "cash outflow transactions"
    }),
    ``,
    `## Category Drilldown`,
    ``,
    categoryDrilldowns.length > 0 ? categoryDrilldowns.join("\n\n") : "No category drilldown data.",
    ``,
    `## Notes`,
    ``,
    `- Weekly drilldowns are built from normalized transactions in the selected timezone.`,
    `- Cash sections rank transactions by signed moneyflow from the audited account's perspective.`,
    `- Category drilldowns rank transactions by the larger of cash impact or estimated item-value impact.`,
    `- Trading and itemMarket sections include item-level in/out summaries with min, average, and max unit price.`,
    transactions.length > 0
      ? maxTransactionsPerSection === "all"
        ? `- All rows are expanded in this file.`
        : `- Preview tables show up to ${maxTransactionsPerSection} rows each; expand details blocks to show full tables where available.`
      : `- No normalized transaction detail was embedded in this report.`
  ]
    .filter((line) => line !== "")
    .join("\n");
}
