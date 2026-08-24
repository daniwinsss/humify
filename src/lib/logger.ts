type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.event,
  ];
  if (entry.durationMs !== undefined) {
    parts.push(`(${entry.durationMs}ms)`);
  }
  if (entry.data && Object.keys(entry.data).length > 0) {
    parts.push(JSON.stringify(entry.data));
  }
  return parts.join(" ");
}

function log(level: LogLevel, event: string, data?: Record<string, unknown>, durationMs?: number) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    data,
    durationMs,
  };

  const message = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(message);
      break;
    case "warn":
      console.warn(message);
      break;
    case "debug":
      if (process.env.NODE_ENV === "development") {
        console.debug(message);
      }
      break;
    default:
      console.log(message);
  }
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => log("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => log("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => log("error", event, data),
  debug: (event: string, data?: Record<string, unknown>) => log("debug", event, data),

  time: (event: string) => {
    const start = performance.now();
    return {
      end: (data?: Record<string, unknown>) => {
        const durationMs = Math.round(performance.now() - start);
        log("info", event, data, durationMs);
        return durationMs;
      },
      error: (data?: Record<string, unknown>) => {
        const durationMs = Math.round(performance.now() - start);
        log("error", event, data, durationMs);
        return durationMs;
      },
    };
  },
};
