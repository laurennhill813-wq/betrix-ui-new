
const LogLevel = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  DEBUG: "debug"
};

function fmtLevel(level) {
  return level.toUpperCase();
}

function safeSerial(obj) {
  try {
    return typeof obj === "string" ? obj : JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}

function safeParseMeta(meta) {
  if (meta === undefined || meta === null) return undefined;
  try {
    return JSON.parse(safeSerial(meta));
  } catch (e) {
    return { raw: String(meta) };
  }
}

class Logger {
  constructor(context = "") {
    this.context = context;
  }

  #log(level, label, message, meta) {
    const output = {
      ts: new Date().toISOString(),
      level: fmtLevel(label),
      context: this.context,
      msg: String(message),
      meta: safeParseMeta(meta)
    };
    const str = JSON.stringify(output) + "\n";
    if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      process.stderr.write(str);
    } else {
      process.stdout.write(str);
    }
  }

  info(message, data) {
    this.#log(LogLevel.INFO, "INFO", message, data);
  }

  warn(message, data) {
    this.#log(LogLevel.WARN, "WARN", message, data);
  }

  error(message, error) {
    const data =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
    this.#log(LogLevel.ERROR, "ERROR", message, data);
  }

  debug(message, data) {
    if (process.env.DEBUG && process.env.DEBUG !== "false") {
      this.#log(LogLevel.DEBUG, "DEBUG", message, data);
    }
  }
}

export { Logger, LogLevel };
