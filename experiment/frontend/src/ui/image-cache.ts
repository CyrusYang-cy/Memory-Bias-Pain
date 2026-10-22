/**
 * Loads images once and keeps them in memory, so switching morph frames on the slider
 * never waits on the network or the browser's HTTP cache (which caused the flicker / 304
 * glitches in the original implementation).
 *
 * The task prefetches the next trial's frames while the current one runs.
 */

const RETRIES = 2;
const RETRY_DELAY_MS = 1000;

class ImageCache {
  private readonly images = new Map<string, Promise<HTMLImageElement>>();

  load(url: string): Promise<HTMLImageElement> {
    let pending = this.images.get(url);
    if (!pending) {
      pending = loadWithRetry(url, RETRIES).catch((error: unknown) => {
        this.images.delete(url); // allow another attempt later
        throw error;
      });
      this.images.set(url, pending);
    }
    return pending;
  }

  loadAll(urls: readonly string[]): Promise<HTMLImageElement[]> {
    return Promise.all(urls.map((url) => this.load(url)));
  }

  /** Start loading in the background; errors surface when the images are actually needed. */
  prefetch(urls: readonly string[]): void {
    for (const url of urls) this.load(url).catch(() => undefined);
  }
}

async function loadWithRetry(url: string, retries: number): Promise<HTMLImageElement> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await loadOnce(url);
    } catch (error) {
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

/**
 * Resolves when the image has downloaded. Decoding is started in the background but not
 * awaited: browsers never finish `decode()` while the tab is hidden (e.g. the participant
 * switched tabs), which would stall the trial.
 */
function loadOnce(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      img.decode().catch(() => undefined);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Could not load image ${url}`));
    img.src = url;
  });
}

export const imageCache = new ImageCache();
