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

const logger = {
  info: (msg, meta) => {
    process.stdout.write(
      const logger = {
        info: (msg, meta) => {
          process.stdout.write(
            JSON.stringify({
              ts: new Date().toISOString(),
              level: fmtLevel("info"),
              msg: String(msg),
              meta: safeParseMeta(meta)
            }) + "\n"
          );
        },
        warn: (msg, meta) => {
          process.stderr.write(
            JSON.stringify({
              ts: new Date().toISOString(),
              level: fmtLevel("warn"),
              msg: String(msg),
              meta: safeParseMeta(meta)
            }) + "\n"
          );
        },
        error: (msg, meta) => {
          process.stderr.write(
            JSON.stringify({
              ts: new Date().toISOString(),
              level: fmtLevel("error"),
              msg: String(msg),
    this.#log(LogLevel.DEBUG, "DEBUG", message, data);
              const logger = {
                info: (msg, meta) => {
                  process.stdout.write(
                    JSON.stringify({
                      ts: new Date().toISOString(),
                      level: fmtLevel("info"),
                      msg: String(msg),
                      meta: safeParseMeta(meta)
                    }) + "\n"
                  );
                },
                warn: (msg, meta) => {
                  process.stderr.write(
                    JSON.stringify({
                      ts: new Date().toISOString(),
                      level: fmtLevel("warn"),
                      msg: String(msg),
                      meta: safeParseMeta(meta)
                    }) + "\n"
                  );
                },
                error: (msg, meta) => {
                  process.stderr.write(
                    JSON.stringify({
                      ts: new Date().toISOString(),
                      level: fmtLevel("error"),
                      msg: String(msg),
                      meta: safeParseMeta(meta)
                    }) + "\n"
                  );
                },
                debug: (msg, meta) => {
                  if (process.env.DEBUG && process.env.DEBUG !== "false") {
                    process.stdout.write(
                      JSON.stringify({
                        ts: new Date().toISOString(),
                        level: fmtLevel("debug"),
                        msg: String(msg),
                        meta: safeParseMeta(meta)
                      }) + "\n"
                    );
                  }
                }
              };
  }
              export default logger;

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
}

export { Logger, LogLevel };
