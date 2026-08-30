// Shared rate-limited client for the OpenF1 API.
//
// OpenF1's Community (free) tier allows "up to 3 requests per second and
// 30 requests per minute" (https://openf1.org/#features). This module
// serializes every outgoing request through a single queue so the app can
// never exceed those limits, no matter how many callers fire concurrently
// within this process, and backs off on HTTP 429 using the Retry-After
// header when OpenF1 sends one.
//
// Note: throttling state lives in module scope, so it only coordinates
// requests within a single process/isolate. That's sufficient for this
// app's deployment model (a single Fly.io instance and a low-frequency
// Cloudflare Worker, which has its own copy of this logic).

const F1_API_BASE = "https://api.openf1.org/v1";

// Stay comfortably under the documented ceiling rather than skating right
// at it: ~2.5 req/sec and 28 req/min.
const MIN_INTERVAL_MS = 400;
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 28;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let queueTail = Promise.resolve();
const requestTimestamps = [];

function pruneWindow(now) {
  while (requestTimestamps.length && now - requestTimestamps[0] >= WINDOW_MS) {
    requestTimestamps.shift();
  }
}

async function waitForSlot() {
  const now = Date.now();
  pruneWindow(now);

  let waitMs = 0;

  const lastRequestAt = requestTimestamps[requestTimestamps.length - 1];
  if (lastRequestAt !== undefined) {
    const sinceLast = now - lastRequestAt;
    if (sinceLast < MIN_INTERVAL_MS) {
      waitMs = MIN_INTERVAL_MS - sinceLast;
    }
  }

  if (requestTimestamps.length >= WINDOW_LIMIT) {
    const windowWait = WINDOW_MS - (now - requestTimestamps[0]) + 10;
    waitMs = Math.max(waitMs, windowWait);
  }

  if (waitMs > 0) {
    await delay(waitMs);
  }

  requestTimestamps.push(Date.now());
}

/**
 * Fetch a path from the OpenF1 API, respecting the Community-tier rate
 * limits across all callers in this process and retrying once on HTTP 429.
 * @param {string} path - Path and query string, e.g. "/meetings?year=2026"
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export function openf1Fetch(path, options = {}) {
  // Chain onto the shared queue so concurrent callers are serialized and
  // can't race each other past the rate limit.
  const task = queueTail.then(async () => {
    await waitForSlot();

    const doFetch = () =>
      fetch(`${F1_API_BASE}${path}`, {
        signal: AbortSignal.timeout(5000),
        ...options,
      });

    let response = await doFetch();

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader
        ? parseFloat(retryAfterHeader) * 1000
        : 2000;
      console.warn(
        `OpenF1 rate limit hit for ${path}, retrying after ${retryAfterMs}ms`
      );
      await delay(Math.max(retryAfterMs, 1000));
      await waitForSlot();
      response = await doFetch();
    }

    return response;
  });

  // Keep the queue moving even if this request fails, and don't let one
  // caller's rejection surface as an unhandled rejection on the shared chain.
  queueTail = task.catch(() => {});

  return task;
}
