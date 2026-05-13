import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAPIClient } from "@wareraprojects/api";
import { createProgressReporter } from "./progress";
import {
  renderOverwatchMarkdown,
  renderTimingAnalysisMarkdown,
  renderWeeklyDetailMarkdown
} from "../overwatch/markdown";
import { buildOverwatchReport } from "../overwatch/service";

type ParsedArgs = {
  userId?: string;
  username?: string;
  timezone: string;
  days?: number;
  maxPages?: number;
  pageLimit?: number;
  detailRows: number | "all";
  sellerRapidMs?: number;
  buyerRapidMs?: number;
  rapidMs?: number;
  section: "full" | "timing";
  outDir: string;
  jsonPath?: string;
  markdownPath?: string;
  apiKey?: string;
  url?: string;
  stdout: "markdown" | "json" | "none";
  includeTransactions: boolean;
  progress: boolean;
  verbose: boolean;
  rateLimit: number;
  help: boolean;
};

function parseNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} expects a number.`);
  }
  return parsed;
}

function parseRowLimit(value: string | undefined, flag: string): number | "all" {
  if (value === "all") {
    return "all";
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} expects a positive integer or "all".`);
  }

  return parsed;
}

function parsePositiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} expects a positive integer.`);
  }

  return parsed;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    timezone: "UTC",
    days: 90,
    detailRows: 20,
    section: "full",
    outDir: "reports",
    stdout: "markdown",
    includeTransactions: true,
    progress: true,
    verbose: false,
    rateLimit: 500,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--user-id":
        args.userId = next;
        index += 1;
        break;
      case "--username":
        args.username = next;
        index += 1;
        break;
      case "--timezone":
        args.timezone = next ?? args.timezone;
        index += 1;
        break;
      case "--days":
        args.days = parseNumber(next, "--days");
        index += 1;
        break;
      case "--all-time":
        args.days = undefined;
        break;
      case "--max-pages":
        args.maxPages = parseNumber(next, "--max-pages");
        index += 1;
        break;
      case "--page-limit":
        args.pageLimit = parseNumber(next, "--page-limit");
        index += 1;
        break;
      case "--detail-rows":
        args.detailRows = parseRowLimit(next, "--detail-rows");
        index += 1;
        break;
      case "--rapid-ms":
        args.rapidMs = parsePositiveInteger(next, "--rapid-ms");
        index += 1;
        break;
      case "--seller-rapid-ms":
        args.sellerRapidMs = parsePositiveInteger(next, "--seller-rapid-ms");
        index += 1;
        break;
      case "--buyer-rapid-ms":
        args.buyerRapidMs = parsePositiveInteger(next, "--buyer-rapid-ms");
        index += 1;
        break;
      case "--section":
        if (next === "full" || next === "timing") {
          args.section = next;
        } else {
          throw new Error(`--section expects full or timing.`);
        }
        index += 1;
        break;
      case "--out-dir":
        args.outDir = next ?? args.outDir;
        index += 1;
        break;
      case "--json":
        args.jsonPath = next;
        index += 1;
        break;
      case "--markdown":
        args.markdownPath = next;
        index += 1;
        break;
      case "--api-key":
        args.apiKey = next;
        index += 1;
        break;
      case "--rate-limit":
        args.rateLimit = parseNumber(next, "--rate-limit");
        index += 1;
        break;
      case "--url":
        args.url = next;
        index += 1;
        break;
      case "--stdout":
        if (next === "markdown" || next === "json" || next === "none") {
          args.stdout = next;
        } else {
          throw new Error(`--stdout expects markdown, json, or none.`);
        }
        index += 1;
        break;
      case "--no-transactions":
        args.includeTransactions = false;
        break;
      case "--no-progress":
        args.progress = false;
        break;
      case "--verbose":
      case "-v":
        args.verbose = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        if (token.startsWith("--")) {
          throw new Error(`Unknown flag: ${token}`);
        }
        break;
    }
  }

  return args;
}

function printHelp() {
  console.log(`War Era Overwatch

Usage:
  npm run overwatch -- --username <name> [options]
  npm run overwatch -- --user-id <id> [options]

Options:
  --username <name>       Resolve and audit a username
  --user-id <id>          Audit a user by exact user ID
  --timezone <tz>         Timezone for weekly grouping (default: UTC)
  --days <n>              Look back n days (default: 90)
  --all-time              Fetch all available history
  --max-pages <n>         Stop pagination after n pages
  --page-limit <n>        Page size for transaction fetches (default: 100)
  --detail-rows <n|all>   Preview rows per table in weekly drilldowns (default: 20)
  --rapid-ms <n>          Override both rapid timing thresholds in milliseconds
  --seller-rapid-ms <n>   Seller offer-post timing threshold in milliseconds
  --buyer-rapid-ms <n>    Buyer purchase-gap timing threshold in milliseconds
  --section <mode>        full | timing (timing fetches only itemMarket)
  --out-dir <dir>         Output directory for report files (default: reports)
  --json <path>           Override JSON output path
  --markdown <path>       Override Markdown output path
  --stdout <mode>         markdown | json | none (default: markdown)
  --rate-limit <n>        Requests per minute passed to the API client (default: 500)
  --no-transactions       Exclude normalized transactions from JSON output
  --no-progress           Disable progress output
  --verbose               Print per-stage and per-batch logs
  --api-key <key>         Override WARERA_API_KEY
  --url <url>             Override API base URL
  --help                  Show this help`);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function toMarkdownRelativePath(fromDir: string, targetPath: string): string {
  const relativePath = path.relative(fromDir, targetPath).replace(/\\/g, "/");
  if (relativePath.startsWith(".")) {
    return relativePath;
  }

  return `./${relativePath}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.userId && !args.username) {
    throw new Error("Pass --user-id or --username.");
  }

  const progress = createProgressReporter({
    enabled: args.progress,
    verbose: args.verbose,
    rateLimitPerMinute: args.rateLimit
  });
  progress.start();

  const client = createAPIClient({
    apiKey: args.apiKey ?? process.env.WARERA_API_KEY,
    url: args.url,
    rateLimit: args.rateLimit,
    logBatches: (info) => {
      progress.onBatch({
        batchSize: info.batchSize,
        paths: info.paths
      });
    }
  });

  const report = await buildOverwatchReport(client, {
    userId: args.userId,
    username: args.username,
    timezone: args.timezone,
    days: args.days,
    maxPages: args.maxPages,
    transactionPageLimit: args.pageLimit,
    analysisMode: args.section,
    includeTransactions: args.includeTransactions,
    thresholds: {
      ...(typeof args.rapidMs === "number"
        ? {
            rapidSellerOfferTimingWindowMs: args.rapidMs,
            rapidBuyerTimingWindowMs: args.rapidMs
          }
        : {}),
      ...(typeof args.sellerRapidMs === "number"
        ? { rapidSellerOfferTimingWindowMs: args.sellerRapidMs }
        : {}),
      ...(typeof args.buyerRapidMs === "number"
        ? { rapidBuyerTimingWindowMs: args.buyerRapidMs }
        : {})
    },
    onProgress: (event) => {
      progress.onProgress(event);
    }
  });

  const json = JSON.stringify(report, null, 2);

  const fileStem = sanitizeFileName(
    `${report.user.username || report.user.userId}-${new Date(report.generatedAt)
      .toISOString()
      .slice(0, 10)}`
  );

  const outDir = path.resolve(process.cwd(), args.outDir);
  await mkdir(outDir, { recursive: true });

  const markdownPath = path.resolve(outDir, args.markdownPath ?? `${fileStem}.md`);
  const jsonPath = path.resolve(outDir, args.jsonPath ?? `${fileStem}.json`);
  const markdownDir = path.dirname(markdownPath);
  const weeklyDirName = `${fileStem}.weeks`;
  const weeklyDirPath = path.resolve(markdownDir, weeklyDirName);

  await Promise.all([
    mkdir(path.dirname(markdownPath), { recursive: true }),
    mkdir(path.dirname(jsonPath), { recursive: true })
  ]);

  const weeklyDetailLinks: Record<string, string> = {};
  const weeklyFiles: Array<{ outputPath: string; content: string }> = [];

  if (args.section === "full" && report.normalizedTransactions && report.summary.weekly.length > 0) {
    await rm(weeklyDirPath, { recursive: true, force: true });
    await mkdir(weeklyDirPath, { recursive: true });

    for (const week of report.summary.weekly) {
      const weeklyPath = path.resolve(weeklyDirPath, `${week.weekStart}.md`);
      weeklyDetailLinks[week.weekStart] = toMarkdownRelativePath(markdownDir, weeklyPath);
      weeklyFiles.push({
        outputPath: weeklyPath,
        content: renderWeeklyDetailMarkdown(report, week.weekStart, {
          mainReportLink: toMarkdownRelativePath(path.dirname(weeklyPath), markdownPath),
          maxTransactionsPerSection: args.detailRows
        })
      });
    }
  }

  const markdown =
    args.section === "timing"
      ? [
          `# Timing Analysis: ${report.user.username || report.user.userId}`,
          ``,
          `Generated: ${report.generatedAt}`,
          `Coverage: ${report.coverage.transactionCount} transactions from ${report.coverage.oldestTransactionAt ?? "n/a"} to ${report.coverage.newestTransactionAt ?? "n/a"}`,
          ``,
          renderTimingAnalysisMarkdown(report)
        ].join("\n")
      : renderOverwatchMarkdown(report, {
          weeklyDetailLinks
        });

  progress.onProgress({
    stage: "write_output",
    status: "start",
    message:
      weeklyFiles.length > 0
        ? `Writing Markdown, JSON, and ${weeklyFiles.length} weekly detail files`
        : "Writing Markdown and JSON reports"
  });

  await Promise.all([
    writeFile(markdownPath, markdown, "utf8"),
    writeFile(jsonPath, json, "utf8"),
    ...weeklyFiles.map((file) => writeFile(file.outputPath, file.content, "utf8"))
  ]);

  progress.onProgress({
    stage: "write_output",
    status: "done",
    message: "Finished writing report files"
  });
  progress.finish(
    weeklyFiles.length > 0
      ? `Saved report files:\n- ${markdownPath}\n- ${jsonPath}\n- ${weeklyDirPath}`
      : `Saved report files:\n- ${markdownPath}\n- ${jsonPath}`
  );

  if (args.stdout === "markdown") {
    console.log(markdown);
  } else if (args.stdout === "json") {
    console.log(json);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
