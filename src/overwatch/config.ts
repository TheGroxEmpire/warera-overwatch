import type { OverwatchThresholds } from "./types";

export const DEFAULT_OVERWATCH_THRESHOLDS: OverwatchThresholds = {
  minMoneyflowForCounterpartySignal: 500,
  counterpartyConcentrationShare: 0.45,
  oneWayFlowShare: 0.8,
  minDonationAmountForSignal: 250,
  minDonationShareForSignal: 0.25,
  minComparableMarketTransactions: 3,
  minMarketPriceRatio: 0.5,
  maxMarketPriceRatio: 2,
  minCaseOpensForDistributionSignal: 50,
  lowWageRatio: 0.7,
  highWageRatio: 1.3,
  wageBaselineRatio: 0.142,
  pairMinMoney: 10,
  pairMinTransactions: 5,
  rapidTimingWindowMs: 1000
};

export function mergeOverwatchThresholds(
  overrides?: Partial<OverwatchThresholds>
): OverwatchThresholds {
  return {
    ...DEFAULT_OVERWATCH_THRESHOLDS,
    ...(overrides ?? {})
  };
}
