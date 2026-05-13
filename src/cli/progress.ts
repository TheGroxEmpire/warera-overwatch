import type { OverwatchProgressEvent, OverwatchProgressStage } from "../overwatch/types";

type BatchInfo = {
  batchSize: number;
  paths: string[];
};

type ProgressReporterOptions = {
  enabled: boolean;
  verbose: boolean;
  rateLimitPerMinute: number;
};

type StageState = {
  event?: OverwatchProgressEvent;
  done: boolean;
};

const STAGE_ORDER: OverwatchProgressStage[] = [
  "resolve_subject",
  "fetch_transactions",
  "fetch_supplemental",
  "analyze",
  "resolve_labels",
  "write_output"
];

const STAGE_WEIGHTS: Record<OverwatchProgressStage, number> = {
  resolve_subject: 0.1,
  fetch_transactions: 0.58,
  fetch_supplemental: 0.12,
  analyze: 0.08,
  resolve_labels: 0.1,
  write_output: 0.02
};

const STAGE_LABELS: Record<OverwatchProgressStage, string> = {
  resolve_subject: "Resolving account",
  fetch_transactions: "Fetching transactions",
  fetch_supplemental: "Fetching supplemental data",
  analyze: "Analyzing account",
  resolve_labels: "Resolving usernames",
  write_output: "Writing report"
};

const SPINNER_FRAMES = ["|", "/", "-", "\\"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function stagePartial(event?: OverwatchProgressEvent): number {
  if (!event || event.status === "done") {
    return 1;
  }

  if (event.stage === "resolve_subject") {
    return event.status === "start" ? 0.35 : 0.75;
  }

  if (event.stage === "fetch_transactions") {
    if (
      typeof event.page === "number" &&
      typeof event.total === "number" &&
      event.total > 0
    ) {
      return clamp(event.page / event.total, 0, 0.999);
    }
    return 0;
  }

  if (event.stage === "fetch_supplemental") {
    if (
      typeof event.current === "number" &&
      typeof event.total === "number" &&
      event.total > 0
    ) {
      return clamp(event.current / event.total, 0.08, 0.95);
    }
    return event.status === "start" ? 0.08 : 0.5;
  }

  if (event.stage === "resolve_labels") {
    if (
      typeof event.current === "number" &&
      typeof event.total === "number" &&
      event.total > 0
    ) {
      return clamp(event.current / event.total, 0.08, 0.95);
    }
    return event.status === "start" ? 0.08 : 0.5;
  }

  if (event.stage === "analyze") {
    return event.status === "start" ? 0.5 : 0.9;
  }

  if (event.stage === "write_output") {
    return event.status === "start" ? 0.5 : 0.95;
  }

  return 0;
}

function buildBar(fraction: number, width = 28): string {
  const filled = Math.round(clamp(fraction, 0, 1) * width);
  return `${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}`;
}

function buildIndeterminateBar(frame: number, width = 28): string {
  const segmentWidth = Math.max(4, Math.floor(width / 4));
  const travel = Math.max(1, width - segmentWidth);
  const position = frame % (travel + 1);
  const cells = new Array<string>(width).fill("-");

  for (let index = 0; index < segmentWidth; index += 1) {
    const target = position + index;
    if (target < width) {
      cells[target] = "#";
    }
  }

  return cells.join("");
}

export function createProgressReporter(options: ProgressReporterOptions) {
  const isTTY = Boolean(process.stderr.isTTY);
  const stageState = new Map<OverwatchProgressStage, StageState>(
    STAGE_ORDER.map((stage) => [stage, { done: false }])
  );
  const startedAt = Date.now();
  let currentStage: OverwatchProgressStage | undefined;
  let spinnerIndex = 0;
  let batchCount = 0;
  let batchOperations = 0;
  let renderInterval: ReturnType<typeof setInterval> | undefined;

  function clearLine() {
    if (options.enabled && isTTY) {
      process.stderr.write("\r\x1b[2K");
    }
  }

  function printLine(line: string) {
    if (!options.enabled) {
      return;
    }

    clearLine();
    process.stderr.write(`${line}\n`);
    if (isTTY) {
      render();
    }
  }

  function getFraction() {
    let doneWeight = 0;
    let partialWeight = 0;

    for (const stage of STAGE_ORDER) {
      const state = stageState.get(stage);
      if (state?.done) {
        doneWeight += STAGE_WEIGHTS[stage];
      } else if (stage === currentStage) {
        partialWeight = STAGE_WEIGHTS[stage] * stagePartial(state?.event);
      }
    }

    return clamp(doneWeight + partialWeight, 0, 1);
  }

  function hasDeterminateProgress() {
    if (!currentStage) {
      return false;
    }

    const event = stageState.get(currentStage)?.event;
    if (!event) {
      return false;
    }

    if (event.stage === "fetch_transactions") {
      return typeof event.total === "number" && event.total > 0;
    }

    if (event.stage === "fetch_supplemental") {
      return typeof event.total === "number" && event.total > 0;
    }

    if (event.stage === "resolve_labels") {
      return typeof event.total === "number" && event.total > 0;
    }

    return event.status === "done";
  }

  function getCurrentDetails() {
    if (!currentStage) {
      return `Rate limit ${options.rateLimitPerMinute}/min`;
    }

    const event = stageState.get(currentStage)?.event;
    if (!event) {
      return STAGE_LABELS[currentStage];
    }

    if (currentStage === "fetch_transactions") {
      const parts = [event.message];
      if (typeof event.page === "number") {
        if (typeof event.total === "number" && event.total > 0) {
          parts.push(`pages ${event.page}/${event.total}`);
        } else {
          parts.push(`pages ${event.page}`);
        }
      }
      if (typeof event.transactionCount === "number") {
        parts.push(`tx ${event.transactionCount}`);
      }
      parts.push(`batches ${batchCount}`);
      return parts.join(" | ");
    }

    if (currentStage === "fetch_supplemental") {
      const parts = [event.message];
      if (typeof event.current === "number" && typeof event.total === "number") {
        parts.push(`${event.current}/${event.total}`);
      }
      if (event.requestName) {
        parts.push(event.requestName);
      }
      parts.push(`batches ${batchCount}`);
      return parts.join(" | ");
    }

    if (currentStage === "resolve_labels") {
      const parts = [event.message];
      if (typeof event.current === "number" && typeof event.total === "number") {
        parts.push(`${event.current}/${event.total}`);
      }
      parts.push(`batches ${batchCount}`);
      return parts.join(" | ");
    }

    const parts = [event.message];
    if (event.username) {
      parts.push(event.username);
    }
    if (typeof event.transactionCount === "number") {
      parts.push(`tx ${event.transactionCount}`);
    }
    parts.push(`batches ${batchCount}`);
    return parts.join(" | ");
  }

  function render() {
    if (!options.enabled || !isTTY) {
      return;
    }

    const spinner = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length];
    const frame = spinnerIndex;
    spinnerIndex += 1;
    const fraction = getFraction();
    const determinate = hasDeterminateProgress();
    const percentLabel = determinate
      ? `${String(Math.round(fraction * 100)).padStart(3, " ")}%`
      : " --%";
    const bar = determinate ? buildBar(fraction) : buildIndeterminateBar(frame);
    const elapsed = formatDuration(Date.now() - startedAt);
    const details = getCurrentDetails();
    process.stderr.write(`\r\x1b[2K${spinner} [${bar}] ${percentLabel} | ${details} | ${elapsed}`);
  }

  function startRenderLoop() {
    if (!options.enabled || !isTTY || options.verbose || renderInterval) {
      return;
    }

    renderInterval = setInterval(() => {
      render();
    }, 125);
    renderInterval.unref?.();
  }

  function stopRenderLoop() {
    if (!renderInterval) {
      return;
    }

    clearInterval(renderInterval);
    renderInterval = undefined;
  }

  function lineForEvent(event: OverwatchProgressEvent) {
    const prefix = `[${STAGE_LABELS[event.stage]}]`;
    if (event.stage === "fetch_transactions") {
      const parts = [prefix, event.status.toUpperCase(), event.message];
      if (typeof event.page === "number") {
        parts.push(`page=${event.page}`);
      }
      if (typeof event.transactionCount === "number") {
        parts.push(`transactions=${event.transactionCount}`);
      }
      if (typeof event.elapsedMs === "number") {
        parts.push(`elapsed=${formatDuration(event.elapsedMs)}`);
      }
      return parts.join(" ");
    }

    if (event.stage === "fetch_supplemental") {
      const parts = [prefix, event.status.toUpperCase(), event.message];
      if (typeof event.current === "number" && typeof event.total === "number") {
        parts.push(`${event.current}/${event.total}`);
      }
      if (event.requestName) {
        parts.push(`request=${event.requestName}`);
      }
      return parts.join(" ");
    }

    if (event.stage === "resolve_labels") {
      const parts = [prefix, event.status.toUpperCase(), event.message];
      if (typeof event.current === "number" && typeof event.total === "number") {
        parts.push(`${event.current}/${event.total}`);
      }
      return parts.join(" ");
    }

    const parts = [prefix, event.status.toUpperCase(), event.message];
    if (event.username) {
      parts.push(`username=${event.username}`);
    }
    if (event.userId) {
      parts.push(`userId=${event.userId}`);
    }
    return parts.join(" ");
  }

  return {
    start() {
      if (!options.enabled) {
        return;
      }

      startRenderLoop();
      printLine(
        `Starting War Era Overwatch audit | rate limit ${options.rateLimitPerMinute}/min`
      );
    },
    onProgress(event: OverwatchProgressEvent) {
      currentStage = event.stage;
      stageState.set(event.stage, {
        done: event.status === "done",
        event
      });

      if (options.verbose || !isTTY) {
        printLine(lineForEvent(event));
      } else {
        render();
      }
    },
    onBatch(info: BatchInfo) {
      batchCount += 1;
      batchOperations += info.batchSize;

      if (options.verbose) {
        const paths = info.paths.join(", ");
        printLine(`[API batch ${batchCount}] ops=${info.batchSize} totalOps=${batchOperations} paths=${paths}`);
      } else if (options.enabled && isTTY) {
        render();
      }
    },
    finish(message: string) {
      stopRenderLoop();

      if (!options.enabled) {
        process.stderr.write(`${message}\n`);
        return;
      }

      clearLine();
      process.stderr.write(`${message}\n`);
    }
  };
}
