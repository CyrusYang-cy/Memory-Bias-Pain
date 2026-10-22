import Bowser from "bowser";

const SUPPORTED_BROWSERS = {
  chrome: ">=67",
  edge: ">=17",
  firefox: ">=60",
  safari: ">=14", // WebP with transparency
};

/** Returns a message explaining why this browser cannot run the study, or null if it can. */
export function unsupportedBrowserReason(userAgent = window.navigator.userAgent): string | null {
  const browser = Bowser.getParser(userAgent);
  const platform = browser.getPlatformType();
  if (platform === "mobile" || platform === "tablet") {
    return (
      "It looks like you are using a mobile device. This study can only be completed on a " +
      "desktop or laptop computer with an up-to-date browser such as Google Chrome."
    );
  }
  if (!browser.satisfies(SUPPORTED_BROWSERS)) {
    return (
      "It looks like you are using an old or unsupported browser. Please open the study " +
      "link again in an up-to-date browser such as Google Chrome."
    );
  }
  return null;
}
