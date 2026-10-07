// src/lib/fetchJson.ts

import type { FetchResult } from "../types/domain.js";

/**
 * Timeout for a single fetch, in milliseconds.
 * Node's fetch has no default timeout — a hanging request hangs forever.
 * AbortController + setTimeout is the standard way to enforce one.
 */
const FETCH_TIMEOUT_MS = 5000;

/**
 * Fetch a URL, parse as JSON, return a discriminated-union result.
 *
 * Never throws. Errors are returned as `{ success: false, error }`.
 * This is the whole point of the task: failures isolate.
 */
export async function fetchJson(
  url: string,
  source: string,
): Promise<FetchResult<unknown>> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // GitHub API asks for a User-Agent. Without it, some endpoints 403.
        "User-Agent": "elevvo-async-engine",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        source,
        error: `HTTP ${response.status} ${response.statusText}`,
        durationMs: Date.now() - start,
      };
    }

    // response.json() returns `Promise<any>` from the DOM lib.
    // We cast to `unknown` immediately — that's honest, and forces
    // callers to validate before using.
    const raw = (await response.json()) as unknown;

    return {
      success: true,
      data: raw,
      source,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    // Catches: network errors, DNS failures, timeouts (AbortError),
    // JSON parse errors — anything that goes wrong during the fetch.
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      source,
      error: message,
      durationMs: Date.now() - start,
    };
  } finally {
    // Always clear the timeout. Otherwise Node keeps the timer alive
    // and prevents the process from exiting cleanly.
    clearTimeout(timeoutId);
  }
}