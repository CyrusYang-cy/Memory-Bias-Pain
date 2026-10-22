/**
 * Console logging with a common prefix, so experiment messages are easy to filter
 * (type "[exp]" in the browser console filter). Debug-level messages only appear in
 * development builds.
 */
const PREFIX = "[exp]";

export const log = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug(PREFIX, ...args);
  },
  info: (...args: unknown[]) => console.info(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args),
};
