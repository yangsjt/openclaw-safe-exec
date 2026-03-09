const DEBUG = (process.env.DEBUG ?? "")
  .split(",")
  .some((t) => t.trim() === "safe-exec" || t.trim() === "*");

export function debug(...args) {
  if (DEBUG) console.error("[safe-exec]", ...args);
}
