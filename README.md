# War Era Overwatch

`War Era Overwatch` is a standalone report generator built on top of the published `@wareraprojects/api` package. It audits a player account and produces:

- Transaction income and expense totals by category
- Current wealth from the API
- Weekly transaction deltas with category-level breakdowns
- Per-week markdown drilldowns linked from the main report
- Weekly drilldowns with item-level `trading` and `itemMarket` summaries
- Case-opening outcome summaries by rarity
- Official rarity comparison for `case1` and `case2`
- Craft scrap-cost validation against the official rarity ladder
- Counterparty concentration and one-way flow checks
- Wage ratio checks based on `money / quantity`
- Seller/buyer pair summaries for wage, article tip, and item market transactions
- Market-price anomaly checks
- Suspiciously fast market timing checks using `offerCreatedAt` and consecutive buy gaps

## Install

```bash
npm install
```

## Required Environment

```bash
WARERA_API_KEY=your_api_key_here
```

The CLI honors `WARERA_API_KEY` or `--api-key`.

## Usage

```bash
npm run overwatch -- --username SomePlayer
```

By default it looks back `90` days, uses an API client rate limit of `500` requests per minute, shows live progress in the terminal, and writes Markdown, JSON, and weekly detail markdown files into `reports/`.

## Common Commands

```bash
npm run overwatch -- --user-id 6813... --days 30
npm run overwatch -- --username SomePlayer --all-time --stdout none
npm run overwatch -- --username SomePlayer --markdown reports/some-player.md --json reports/some-player.json
npm run overwatch -- --username SomePlayer --detail-rows 50
npm run overwatch -- --username SomePlayer --detail-rows all
npm run overwatch -- --username SomePlayer --rapid-ms 750
npm run overwatch -- --username SomePlayer --verbose
npm run overwatch -- --username SomePlayer --no-progress
```

## Output Layout

Each run writes:

- `<name>-<date>.md` for the main summary report
- `<name>-<date>.json` for the full JSON payload
- `<name>-<date>.weeks/` for linked weekly drilldown markdown files

Weekly drilldown files include:

- preview tables with a configurable row limit via `--detail-rows <n|all>`
- expandable `<details>` blocks to show the full table where appropriate
- item-level `trading` and `itemMarket` summaries grouped by item and direction
- min, average, and max unit price for each grouped item flow
- timing-analysis tables for offer fills under `1000ms` and buyer-side purchase gaps under `1000ms`

## Important Assumptions

- Moneyflow treats the `buyerId` side as the payer and the `sellerId` or seller entity side as the receiver.
- Item wealth estimates use current public market prices from `itemTrading.getPrices`.
- Gear and other items without current public prices are left unvalued, so estimated wealth deltas are conservative.
- Case-drop analysis uses fixed official rates for `case1` and `case2`. Unknown case codes are still summarized, but they are not compared to an official baseline.
- Craft analysis checks `craftItem` transactions against the official scrap ladder: common `6`, uncommon `18`, rare `54`, epic `162`, legendary `486`, mythic `1458`.
- Timing analysis flags `itemMarket` transactions when `createdAt - offerCreatedAt < 1000ms`, and buyer-side `itemMarket` purchases when consecutive buys are less than `1000ms` apart.

## Notes

- Use `--detail-rows <n|all>` to control how many rows weekly drilldown tables preview before the expandable full tables.
- Use `--rapid-ms <n>` to change the rapid timing threshold from the default `1000ms`.
