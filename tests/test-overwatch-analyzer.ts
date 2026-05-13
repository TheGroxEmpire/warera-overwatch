import assert from "node:assert/strict";
import { analyzeOverwatchData } from "../src/overwatch/analyze";
import { renderOverwatchMarkdown, renderWeeklyDetailMarkdown } from "../src/overwatch/markdown";
import { buildOverwatchReport } from "../src/overwatch/service";

const report = analyzeOverwatchData({
  user: {
    _id: "u1",
    avatarUrl: "",
    country: "country-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    dates: {
      lastCitizenshipChangeAt: "",
      lastCompanyJoinedAt: "",
      lastConnectionAt: "",
      lastCountryMessageCheckAt: "",
      lastDailyRewardClaimedAt: "",
      lastWorkAt: "",
      lastWorkOfferApplications: []
    },
    infos: {
      citizenshipApplicationAt: "",
      colorScheme: "default",
      description: "",
      font: "default",
      isPremium: false,
      premiumGiftsCount: 0,
      premiumMonthsCount: 0,
      vicePresidentOf: ""
    },
    isActive: true,
    leveling: {
      availableSkillPoints: 0,
      dailyXpLeft: 0,
      freeReset: 0,
      level: 30,
      spentSkillPoints: 0,
      totalSkillPoints: 0,
      totalXp: 0
    },
    militaryRank: 1,
    mu: "",
    rankings: {
      userBounty: { rank: 1, tier: "gold", value: 0 },
      userCasesOpened: { rank: 10, tier: "silver", value: 2 },
      userDamages: { rank: 1, tier: "gold", value: 0 },
      userGemsPurchased: { rank: 1, tier: "gold", value: 0 },
      userLevel: { rank: 1, tier: "gold", value: 30 },
      userPremiumGifts: { rank: 1, tier: "gold", value: 0 },
      userPremiumMonths: { rank: 1, tier: "gold", value: 0 },
      userReferrals: { rank: 1, tier: "gold", value: 0 },
      userSubscribers: { rank: 1, tier: "gold", value: 0 },
      userTerrain: { rank: 1, tier: "gold", value: 0 },
      userWealth: { rank: 25, tier: "silver", value: 1000 },
      weeklyUserDamages: { rank: 1, tier: "gold", value: 0 }
    },
    skills: {
      armor: { equipment: 0, level: 0, total: 0 },
      attack: { ammoPercent: 0, buffsPercent: 0, debuffsPercent: 0, level: 0, total: 0 },
      companies: { level: 0, total: 0 },
      criticalChance: { level: 0, total: 0 },
      criticalDamages: { level: 0, total: 0 },
      dodge: { equipment: 0, level: 0, total: 0 },
      energy: { level: 100, total: 100 },
      entrepreneurship: { level: 0, total: 0 },
      health: { level: 0, total: 0 },
      hunger: { level: 0, total: 0 },
      lootChance: { level: 0, total: 0 },
      management: { level: 0, total: 0 },
      precision: { level: 0, total: 0 },
      production: { level: 10, total: 10 }
    },
    stats: {
      damagesCount: 0
    },
    username: "TargetUser"
  },
  transactions: [
    {
      __v: 0,
      _id: "tx1",
      buyerId: "u1",
      createdAt: "2026-05-01T10:00:00.000Z",
      money: 0,
      sellerId: "u1",
      transactionType: "openCase",
      updatedAt: "2026-05-01T10:00:00.000Z",
      itemCode: "case1",
      quantity: 1,
      item: {
        _id: "case-drop-1",
        type: "equipment",
        code: "helmet6",
        quantity: 1,
        state: 100,
        maxState: 100,
        lastAcquisitionAt: "2026-05-01T10:00:00.000Z"
      }
    },
    {
      __v: 0,
      _id: "tx2",
      buyerId: "u1",
      createdAt: "2026-05-02T10:00:00.000Z",
      money: 0,
      sellerId: "u1",
      transactionType: "openCase",
      updatedAt: "2026-05-02T10:00:00.000Z",
      itemCode: "case1",
      quantity: 1,
      item: {
        _id: "case-drop-2",
        type: "equipment",
        code: "gloves4",
        quantity: 1,
        state: 100,
        maxState: 100,
        lastAcquisitionAt: "2026-05-02T10:00:00.000Z"
      }
    },
    {
      __v: 0,
      _id: "tx3",
      buyerId: "employer1",
      createdAt: "2026-05-03T10:00:00.000Z",
      money: 4,
      quantity: 10,
      sellerId: "u1",
      transactionType: "wage",
      updatedAt: "2026-05-03T10:00:00.000Z"
    },
    {
      __v: 0,
      _id: "tx4",
      buyerId: "u1",
      createdAt: "2026-05-03T12:00:00.000Z",
      money: 400,
      sellerCountryId: "country-2",
      transactionType: "donation",
      updatedAt: "2026-05-03T12:00:00.000Z"
    },
    {
      __v: 0,
      _id: "tx5",
      buyerId: "booster1",
      createdAt: "2026-05-04T10:00:00.000Z",
      money: 300,
      sellerId: "u1",
      transactionType: "itemMarket",
      updatedAt: "2026-05-04T10:00:00.000Z",
      itemCode: "grain",
      quantity: 10
    },
    {
      __v: 0,
      _id: "tx6",
      buyerId: "booster1",
      createdAt: "2026-05-05T10:00:00.000Z",
      money: 300,
      sellerId: "u1",
      transactionType: "itemMarket",
      updatedAt: "2026-05-05T10:00:00.000Z",
      itemCode: "grain",
      quantity: 10
    },
    {
      __v: 0,
      _id: "tx7",
      buyerId: "booster1",
      createdAt: "2026-05-06T10:00:00.000Z",
      money: 300,
      sellerId: "u1",
      transactionType: "itemMarket",
      updatedAt: "2026-05-06T10:00:00.000Z",
      itemCode: "grain",
      quantity: 10
    },
    {
      __v: 0,
      _id: "tx8",
      buyerId: "u1",
      createdAt: "2026-05-05T12:00:00.000Z",
      money: 0,
      sellerId: "u1",
      transactionType: "craftItem",
      updatedAt: "2026-05-05T12:00:00.000Z",
      itemCode: "scraps",
      quantity: 6,
      item: {
        _id: "craft-good-1",
        type: "equipment",
        code: "helmet1",
        quantity: 1,
        state: 100,
        maxState: 100,
        lastAcquisitionAt: "2026-05-05T12:00:00.000Z"
      }
    },
    {
      __v: 0,
      _id: "tx9",
      buyerId: "u1",
      createdAt: "2026-05-06T12:00:00.000Z",
      money: 0,
      sellerId: "u1",
      transactionType: "craftItem",
      updatedAt: "2026-05-06T12:00:00.000Z",
      itemCode: "scraps",
      quantity: 17,
      item: {
        _id: "craft-bad-1",
        type: "equipment",
        code: "gloves2",
        quantity: 1,
        state: 100,
        maxState: 100,
        lastAcquisitionAt: "2026-05-06T12:00:00.000Z"
      }
    }
  ],
  gameConfig: {
    badge: {} as never,
    battle: {} as never,
    citizenshipApplication: {} as never,
    company: {} as never,
    country: {} as never,
    election: {} as never,
    government: {} as never,
    items: {
      case1: { code: "case1", rarity: "common", type: "case", usage: "open" },
      grain: { code: "grain", rarity: "common", type: "resource", usage: "material" },
      helmet1: { code: "helmet1", rarity: "common", type: "equipment", usage: "wear" },
      gloves2: { code: "gloves2", rarity: "uncommon", type: "equipment", usage: "wear" },
      gloves4: { code: "gloves4", rarity: "rare", type: "equipment", usage: "wear" },
      helmet6: { code: "helmet6", rarity: "mythic", type: "equipment", usage: "wear" }
    } as never,
    law: {} as never,
    mergingCost: {} as never,
    mission: {} as never,
    mu: {} as never,
    newspaper: {} as never,
    org: {} as never,
    party: {} as never,
    referral: {} as never,
    region: {} as never,
    skills: {} as never,
    unrest: {} as never,
    upgrade: {} as never,
    upgradesConfig: {} as never,
    user: {} as never,
    worker: {} as never
  },
  marketPrices: {
    ammo: 0,
    bread: 0,
    case1: 0,
    case2: 0,
    coca: 0,
    cocain: 0,
    concrete: 0,
    cookedFish: 0,
    fish: 0,
    grain: 1,
    heavyAmmo: 0,
    iron: 0,
    lead: 0,
    lightAmmo: 0,
    limestone: 0,
    livestock: 0,
    oil: 0,
    petroleum: 0,
    scraps: 0,
    steel: 0
  },
  workStats: [
    {
      dailyDate: "2026-05-03",
      total: 4,
      wage: 4,
      employeeProd: 0,
      selfWork: 0,
      automatedEngine: 0
    }
  ],
  options: {
    days: 30,
    timezone: "UTC",
    thresholds: {
      minCaseOpensForDistributionSignal: 2,
      pairMinMoney: 0,
      pairMinTransactions: 1
    }
  }
});

assert.equal(report.summary.moneyIn, 904);
assert.equal(report.summary.moneyOut, 400);
assert.equal(report.summary.netMoney, 504);
assert.equal(report.summary.caseDrops.totalObservedOutcomes, 2);
assert.equal(report.summary.caseDrops.outcomesByRarity.find((item) => item.rarity === "mythic")?.count, 1);
assert.equal(report.summary.caseDrops.byCaseType[0]?.caseCode, "case1");
assert.equal(report.summary.caseDrops.byCaseType[0]?.caseLabel, "Case");
assert.equal(report.summary.caseDrops.byCaseType[0]?.outcomesByRarity.find((item) => item.rarity === "mythic")?.expectedShare, 0.0001);
assert.equal(report.summary.marketBenchmarks.anomalousTransactionCount, 3);
assert.equal(report.summary.counterparties[0]?.displayName, "user:booster1");
assert.equal(report.summary.work?.observedWages.averageRatio, 0.4);
assert.equal(report.summary.work?.observedWages.aboveAllowedRangeCount, 1);
assert.equal(report.summary.craftChecks.totalCraftTransactions, 2);
assert.equal(report.summary.craftChecks.checkedCraftTransactions, 2);
assert.equal(report.summary.craftChecks.mismatchedCraftTransactions, 1);
assert.equal(report.summary.craftChecks.mismatchExamples[0]?.craftedItemCode, "gloves2");
assert.equal(report.summary.craftChecks.mismatchExamples[0]?.expectedScraps, 18);
assert.equal(report.summary.craftChecks.mismatchExamples[0]?.observedScraps, 17);
assert.equal(report.summary.pairAnalysis.pairs.length, 2);
assert.equal(report.summary.pairAnalysis.pairs[0]?.transactionType, "itemMarket");
assert.equal(report.summary.pairAnalysis.pairs[1]?.vsAverage, 2.58);
assert.equal(report.summary.weekly[0]?.weekStart, "2026-04-27");
assert.equal(report.summary.weekly[1]?.weekStart, "2026-05-04");
assert.ok(report.suspiciousSignals.some((signal) => signal.code === "market_price_outlier"));
assert.ok(report.suspiciousSignals.some((signal) => signal.code === "wage_outlier"));
assert.ok(report.suspiciousSignals.some((signal) => signal.code === "case_drop_outlier"));
assert.ok(report.suspiciousSignals.some((signal) => signal.code === "craft_scrap_mismatch"));
assert.ok(report.suspiciousSignals.every((signal) => signal.code !== "self_dealing"));

const markdown = renderOverwatchMarkdown(report, {
  weeklyDetailLinks: {
    "2026-04-27": "./TargetUser-2026-05-08.weeks/2026-04-27.md",
    "2026-05-04": "./TargetUser-2026-05-08.weeks/2026-05-04.md"
  }
});
assert.match(
  markdown,
  /\| Week Start \| Count \| Income \| Expense \| Net \| Top Categories \| Details \|/
);
assert.doesNotMatch(markdown, /Est\. Wealth Delta|Transaction delta from priced items only/);
assert.match(markdown, /\[details\]\(\.\/TargetUser-2026-05-08\.weeks\/2026-05-04\.md\)/);
assert.match(markdown, /### Case \(case1\)/);
assert.match(markdown, /Official comparison: chi-square/);
assert.match(markdown, /## Craft Check/);
assert.match(markdown, /gloves2/);

const weeklyMarkdown = renderWeeklyDetailMarkdown(report, "2026-05-04", {
  mainReportLink: "../TargetUser-2026-05-08.md",
  maxTransactionsPerSection: 1
});
assert.match(weeklyMarkdown, /# Weekly Detail: 2026-05-04/);
assert.match(weeklyMarkdown, /\[Back to main report\]\(\.\.\/TargetUser-2026-05-08\.md\)/);
assert.match(weeklyMarkdown, /## Category Drilldown/);
assert.match(weeklyMarkdown, /Preview rows per table: 1/);
assert.match(weeklyMarkdown, /#### Item Flow Summary/);
assert.match(weeklyMarkdown, /\| grain \| out \| 3 \| 30 \| 900\.00 \| 30\.00 \| 30\.00 \| 30\.00 \|/);
assert.match(weeklyMarkdown, /<summary>Show all itemMarket transactions \(3 rows\)<\/summary>/);
assert.match(weeklyMarkdown, /<summary>Show all itemMarket transactions \(3 rows\)<\/summary>\s*<table>/);
assert.match(weeklyMarkdown, /<summary>Show all cash inflow transactions/);
assert.match(weeklyMarkdown, /booster1/);
assert.match(weeklyMarkdown, /tx7/);

const timingReport = analyzeOverwatchData({
  user: {
    _id: "u2",
    country: "country-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    rankings: {
      userWealth: { rank: 1, tier: "gold", value: 100 },
      userCasesOpened: { rank: 1, tier: "gold", value: 0 }
    },
    username: "TimingUser"
  } as never,
  transactions: [
    {
      __v: 0,
      _id: "sell-1",
      buyerId: "buyer-1",
      createdAt: "2026-05-07T10:00:10.800Z",
      itemCode: "grain",
      money: 100,
      offerCreatedAt: "2026-05-07T10:00:00.000Z",
      quantity: 10,
      sellerId: "u2",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:11.200Z"
    },
    {
      __v: 0,
      _id: "sell-2",
      buyerId: "buyer-2",
      createdAt: "2026-05-07T10:00:11.700Z",
      itemCode: "bread",
      money: 200,
      offerCreatedAt: "2026-05-07T10:00:00.820Z",
      quantity: 20,
      sellerId: "u2",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:12.100Z"
    },
    {
      __v: 0,
      _id: "ignored-buy-3",
      buyerId: "u2",
      createdAt: "2026-05-07T10:00:12.500Z",
      itemCode: "bread",
      money: 10,
      offerCreatedAt: "2026-05-07T10:00:01.100Z",
      quantity: 1,
      sellerId: "seller-ignored-buy",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:12.500Z"
    },
    {
      __v: 0,
      _id: "buy-4",
      buyerId: "u2",
      createdAt: "2026-05-07T10:00:13.320Z",
      itemCode: "grain",
      money: 12,
      offerCreatedAt: "2026-05-07T10:00:01.400Z",
      quantity: 1,
      sellerId: "seller-buy-2",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:13.320Z"
    },
    {
      __v: 0,
      _id: "ignored-trading-5",
      buyerId: "buyer-trading",
      createdAt: "2026-05-07T10:00:13.400Z",
      itemCode: "grain",
      money: 12,
      offerCreatedAt: "2026-05-07T10:00:01.650Z",
      quantity: 1,
      sellerId: "u2",
      transactionType: "trading",
      updatedAt: "2026-05-07T10:00:13.400Z"
    },
    {
      __v: 0,
      _id: "buy-6",
      buyerId: "u2",
      createdAt: "2026-05-07T10:00:14.150Z",
      itemCode: "bread",
      money: 13,
      offerCreatedAt: "2026-05-07T10:00:01.900Z",
      quantity: 1,
      sellerId: "seller-buy-3",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:14.150Z"
    },
    {
      __v: 0,
      _id: "sell-7",
      buyerId: "buyer-4",
      createdAt: "2026-05-07T10:00:14.310Z",
      itemCode: "grain",
      money: 25,
      offerCreatedAt: "2026-05-07T10:00:01.650Z",
      quantity: 2,
      sellerId: "u2",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:14.310Z"
    },
    {
      __v: 0,
      _id: "sell-8",
      buyerId: "buyer-5",
      createdAt: "2026-05-07T10:00:15.230Z",
      itemCode: "bread",
      money: 30,
      offerCreatedAt: "2026-05-07T10:00:02.490Z",
      quantity: 3,
      sellerId: "u2",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:15.230Z"
    },
    {
      __v: 0,
      _id: "sell-9",
      buyerId: "buyer-6",
      createdAt: "2026-05-07T10:00:16.220Z",
      itemCode: "grain",
      money: 35,
      offerCreatedAt: "2026-05-07T10:00:03.320Z",
      quantity: 4,
      sellerId: "u2",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:16.220Z"
    },
    {
      __v: 0,
      _id: "sell-10",
      buyerId: "buyer-7",
      createdAt: "2026-05-07T10:00:20.500Z",
      itemCode: "grain",
      money: 50,
      offerCreatedAt: "2026-05-07T10:00:04.150Z",
      quantity: 5,
      sellerId: "u2",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:20.900Z"
    },
    {
      __v: 0,
      _id: "sell-11-same-item-price",
      buyerId: "buyer-8",
      createdAt: "2026-05-07T10:00:24.000Z",
      itemCode: "grain",
      money: 50,
      offerCreatedAt: "2026-05-07T10:00:07.332Z",
      quantity: 5,
      sellerId: "u2",
      transactionType: "itemMarket",
      updatedAt: "2026-05-07T10:00:24.000Z"
    }
  ],
  marketPrices: {
    bread: 10,
    grain: 10
  },
  options: {
    timezone: "UTC"
  }
});

assert.equal(timingReport.summary.timingAnalysis.sellerThresholdMs, 5000);
assert.equal(timingReport.summary.timingAnalysis.sellerDuplicateThresholdMs, 1000);
assert.equal(timingReport.summary.timingAnalysis.buyerThresholdMs, 1000);
assert.equal(timingReport.summary.timingAnalysis.sellerItemTransactionCount, 7);
assert.equal(timingReport.summary.timingAnalysis.rapidOfferPostGapCount, 5);
assert.equal(timingReport.summary.timingAnalysis.offerPostGapStats.count, 6);
assert.equal(timingReport.summary.timingAnalysis.rapidOfferPostGaps[0]?.transactionId, "sell-2");
assert.equal(timingReport.summary.timingAnalysis.regularOfferPostGapPattern?.sampleCount, 5);
assert.equal(timingReport.summary.timingAnalysis.buyerItemTransactionCount, 3);
assert.equal(timingReport.summary.timingAnalysis.rapidBuyGapCount, 2);
assert.equal(timingReport.summary.timingAnalysis.buyGapStats.count, 2);
assert.equal(timingReport.summary.timingAnalysis.rapidBuyGaps[0]?.transactionId, "buy-4");
assert.ok(
  timingReport.summary.timingAnalysis.rapidOfferPostGaps.every((example) => example.type === "itemMarket")
);
assert.ok(
  timingReport.summary.timingAnalysis.rapidBuyGaps.every((example) => example.type === "itemMarket")
);
assert.ok(timingReport.suspiciousSignals.some((signal) => signal.code === "timing_anomaly"));

const timingMarkdown = renderOverwatchMarkdown(timingReport);
assert.match(timingMarkdown, /## Timing Analysis/);
assert.match(timingMarkdown, /### Regular Timing Patterns/);
assert.match(timingMarkdown, /### Rapid Offer Posting Gaps/);
assert.match(timingMarkdown, /### Rapid Buyer Purchase Gaps/);
assert.match(
  timingMarkdown,
  /\| Offer Time \| Prev Offer Time \| Gap \(s\) \| Prev Item \| Prev Price \| Item \| Price \| Trigger \| Qty \| Buyer \| Sold Time \| Prev TX \| TX \|/
);
assert.match(
  timingMarkdown,
  /\| Time \| Prev Time \| Gap \(s\) \| Prev Item \| Item \| Qty \| Money \| Seller \| Prev TX \| TX \|/
);
assert.match(timingMarkdown, /Seller changed-offer threshold: 5000ms/);
assert.match(timingMarkdown, /Seller identical-offer threshold: 1000ms/);
assert.match(timingMarkdown, /Buyer threshold: 1000ms/);
assert.match(timingMarkdown, /Seller-side sold offer postings checked: 7/);
assert.match(timingMarkdown, /Buyer-side item-market purchases checked: 3/);
assert.match(timingMarkdown, /Offer-post gap stats: 6 samples/);
assert.match(timingMarkdown, /Buyer purchase gap stats: 2 samples/);
assert.match(timingMarkdown, /Offer Post Gap Cadence/);
assert.match(timingMarkdown, /Changed item\/price reposts use 5000ms, while identical item-and-price reposts use 1000ms/);
assert.doesNotMatch(timingMarkdown, /<summary>Show all rapid offer-post gap transactions/);
assert.match(timingMarkdown, /sell-2/);
assert.match(timingMarkdown, /sell-10/);
assert.doesNotMatch(timingMarkdown, /sell-11-same-item-price/);
assert.match(timingMarkdown, /buy-4/);
assert.match(timingMarkdown, /buy-6/);
assert.doesNotMatch(timingMarkdown, /ignored-trading-5/);
assert.match(timingMarkdown, /0\.820/);
assert.match(timingMarkdown, /0\.830/);

const transactionFetchCalls: Array<{
  transactionType?: string | string[];
  cursor?: string;
  limit?: number;
}> = [];
const parallelFetchReport = await buildOverwatchReport({
  user: {
    getUserLite: async ({ userId }: { userId: string }) =>
      ({
        _id: userId,
        country: "country-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        rankings: {
          userWealth: { rank: 1, tier: "gold", value: 100 },
          userCasesOpened: { rank: 1, tier: "gold", value: 0 }
        },
        username:
          {
            "u-parallel": "ParallelUser",
            "seller-1": "SellerOne",
            "seller-2": "SellerTwo"
          }[userId] ?? `user:${userId}`
      }) as never
  },
  transaction: {
    getPaginatedTransactions: async (input: {
      userId: string;
      transactionType?: string | string[];
      cursor?: string;
      limit?: number;
    }) => {
      transactionFetchCalls.push({
        transactionType: input.transactionType,
        cursor: input.cursor,
        limit: input.limit
      });

      if (!input.transactionType) {
        return {
          items: [
            {
              __v: 0,
              _id: "ptx-1",
              buyerId: "u-parallel",
              createdAt: "2026-05-09T00:00:00.000Z",
              itemCode: "bread",
              money: 10,
              quantity: 1,
              sellerId: "seller-1",
              transactionType: "trading",
              updatedAt: "2026-05-09T00:00:00.000Z"
            },
            {
              __v: 0,
              _id: "ptx-2",
              buyerId: "u-parallel",
              createdAt: "2026-05-08T00:00:00.000Z",
              itemCode: "grain",
              money: 20,
              quantity: 2,
              sellerId: "seller-2",
              transactionType: "itemMarket",
              updatedAt: "2026-05-08T00:00:00.000Z"
            }
          ],
          nextCursor: "2026-05-07T00:00:00.000Z|probe-next"
        };
      }

      if (input.transactionType === "trading") {
        if (!input.cursor) {
          return {
            items: [
              {
                __v: 0,
                _id: "ptx-1",
                buyerId: "u-parallel",
                createdAt: "2026-05-09T00:00:00.000Z",
                itemCode: "bread",
                money: 10,
                quantity: 1,
                sellerId: "seller-1",
                transactionType: "trading",
                updatedAt: "2026-05-09T00:00:00.000Z"
              },
              {
                __v: 0,
                _id: "ptx-3",
                buyerId: "u-parallel",
                createdAt: "2026-05-07T00:00:00.000Z",
                itemCode: "bread",
                money: 30,
                quantity: 3,
                sellerId: "seller-1",
                transactionType: "trading",
                updatedAt: "2026-05-07T00:00:00.000Z"
              }
            ],
            nextCursor: undefined
          };
        }
      }

      if (input.transactionType === "itemMarket") {
        return {
          items: [
            {
              __v: 0,
              _id: "ptx-2",
              buyerId: "u-parallel",
              createdAt: "2026-05-08T00:00:00.000Z",
              itemCode: "grain",
              money: 20,
              quantity: 2,
              sellerId: "seller-2",
              transactionType: "itemMarket",
              updatedAt: "2026-05-08T00:00:00.000Z"
            }
          ],
          nextCursor: undefined
        };
      }

      return {
        items: [],
        nextCursor: undefined
      };
    }
  },
  gameConfig: {
    getGameConfig: async () => null
  },
  itemTrading: {
    getPrices: async () => ({})
  },
  work: {
    getStatsByUserId: async () => []
  }
} as never, {
  userId: "u-parallel",
  timezone: "UTC",
  days: 90,
  transactionPageLimit: 2,
  includeTransactions: true
});

assert.equal(parallelFetchReport.coverage.transactionCount, 3);
assert.equal(parallelFetchReport.normalizedTransactions?.length, 3);
assert.equal(
  transactionFetchCalls.filter((call) => call.transactionType === undefined).length,
  1
);
assert.ok(transactionFetchCalls.some((call) => call.transactionType === "trading"));
assert.ok(transactionFetchCalls.some((call) => call.transactionType === "itemMarket"));

const filteredRoundFetchCalls: Array<{
  transactionType?: string | string[];
  cursor?: string;
  limit?: number;
}> = [];
await buildOverwatchReport({
  user: {
    getUserLite: async ({ userId }: { userId: string }) =>
      ({
        _id: userId,
        country: "country-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        rankings: {
          userWealth: { rank: 1, tier: "gold", value: 100 },
          userCasesOpened: { rank: 1, tier: "gold", value: 0 }
        },
        username: "RoundRobinUser"
      }) as never
  },
  transaction: {
    getPaginatedTransactions: async (input: {
      userId: string;
      transactionType?: string | string[];
      cursor?: string;
      limit?: number;
    }) => {
      filteredRoundFetchCalls.push({
        transactionType: input.transactionType,
        cursor: input.cursor,
        limit: input.limit
      });

      if (input.transactionType === "trading") {
        if (!input.cursor) {
          return {
            items: [
              {
                __v: 0,
                _id: "round-1",
                buyerId: "u-round",
                createdAt: "2026-05-09T00:00:00.000Z",
                itemCode: "bread",
                money: 10,
                quantity: 1,
                sellerId: "seller-1",
                transactionType: "trading",
                updatedAt: "2026-05-09T00:00:00.000Z"
              }
            ],
            nextCursor: "2026-05-08T00:00:00.000Z|round-next"
          };
        }

        return {
          items: [
            {
              __v: 0,
              _id: "round-2",
              buyerId: "u-round",
              createdAt: "2026-05-08T00:00:00.000Z",
              itemCode: "bread",
              money: 20,
              quantity: 2,
              sellerId: "seller-1",
              transactionType: "trading",
              updatedAt: "2026-05-08T00:00:00.000Z"
            }
          ],
          nextCursor: undefined
        };
      }

      if (input.transactionType === "itemMarket") {
        return {
          items: [
            {
              __v: 0,
              _id: "round-3",
              buyerId: "u-round",
              createdAt: "2026-05-09T12:00:00.000Z",
              itemCode: "grain",
              money: 30,
              quantity: 3,
              sellerId: "seller-2",
              transactionType: "itemMarket",
              updatedAt: "2026-05-09T12:00:00.000Z"
            }
          ],
          nextCursor: undefined
        };
      }

      return {
        items: [],
        nextCursor: undefined
      };
    }
  },
  gameConfig: {
    getGameConfig: async () => null
  },
  itemTrading: {
    getPrices: async () => ({})
  },
  work: {
    getStatsByUserId: async () => []
  }
} as never, {
  userId: "u-round",
  timezone: "UTC",
  days: 90,
  transactionPageLimit: 2,
  transactionTypes: ["trading", "itemMarket"],
  includeTransactions: true
});

assert.deepEqual(filteredRoundFetchCalls.slice(0, 2), [
  { transactionType: "trading", cursor: undefined, limit: 2 },
  { transactionType: "itemMarket", cursor: undefined, limit: 2 }
]);
assert.deepEqual(filteredRoundFetchCalls[2], {
  transactionType: "trading",
  cursor: "2026-05-08T00:00:00.000Z|round-next",
  limit: 2
});

const timingOnlyFetchCalls: Array<{
  transactionType?: string | string[];
  cursor?: string;
  limit?: number;
}> = [];
let timingOnlySupplementalCalls = 0;
const timingOnlyReport = await buildOverwatchReport({
  user: {
    getUserLite: async ({ userId }: { userId: string }) =>
      ({
        _id: userId,
        country: "country-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        rankings: {
          userWealth: { rank: 1, tier: "gold", value: 100 },
          userCasesOpened: { rank: 1, tier: "gold", value: 0 }
        },
        username: "TimingOnlyUser"
      }) as never
  },
  transaction: {
    getPaginatedTransactions: async (input: {
      userId: string;
      transactionType?: string | string[];
      cursor?: string;
      limit?: number;
    }) => {
      timingOnlyFetchCalls.push({
        transactionType: input.transactionType,
        cursor: input.cursor,
        limit: input.limit
      });

      if (input.transactionType !== "itemMarket") {
        return {
          items: [],
          nextCursor: undefined
        };
      }

      if (!input.cursor) {
        return {
          items: [
            {
              __v: 0,
              _id: "timing-only-1",
              buyerId: "buyer-one",
              createdAt: "2026-05-09T00:00:03.500Z",
              itemCode: "grain",
              money: 20,
              offerCreatedAt: "2026-05-09T00:00:00.000Z",
              quantity: 2,
              sellerId: "u-timing-only",
              transactionType: "itemMarket",
              updatedAt: "2026-05-09T00:00:03.500Z"
            },
            {
              __v: 0,
              _id: "timing-only-2",
              buyerId: "buyer-two",
              createdAt: "2026-05-09T00:00:06.000Z",
              itemCode: "bread",
              money: 30,
              offerCreatedAt: "2026-05-09T00:00:04.000Z",
              quantity: 3,
              sellerId: "u-timing-only",
              transactionType: "itemMarket",
              updatedAt: "2026-05-09T00:00:06.000Z"
            }
          ],
          nextCursor: undefined
        };
      }

      return {
        items: [],
        nextCursor: undefined
      };
    }
  },
  gameConfig: {
    getGameConfig: async () => {
      timingOnlySupplementalCalls += 1;
      return null;
    }
  },
  itemTrading: {
    getPrices: async () => {
      timingOnlySupplementalCalls += 1;
      return {};
    }
  },
  work: {
    getStatsByUserId: async () => {
      timingOnlySupplementalCalls += 1;
      return [];
    }
  }
} as never, {
  userId: "u-timing-only",
  timezone: "UTC",
  days: 90,
  analysisMode: "timing",
  transactionPageLimit: 2,
  includeTransactions: true
});

assert.equal(timingOnlyReport.coverage.transactionCount, 2);
assert.equal(timingOnlyReport.summary.timingAnalysis.rapidOfferPostGapCount, 1);
assert.equal(timingOnlySupplementalCalls, 0);
assert.equal(
  timingOnlyFetchCalls.filter((call) => call.transactionType === undefined).length,
  0
);
assert.ok(timingOnlyFetchCalls.every((call) => call.transactionType === "itemMarket"));

console.log("test-overwatch-analyzer: ok");
