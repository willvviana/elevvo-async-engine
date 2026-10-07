// src/index.ts

import { fetchJson } from "./lib/fetchJson.js";
import { mapUsers, mapGitHubRepo, mapDogBreeds } from "./services/validators.js";
import type { User, GitHubRepo, DogBreeds, FetchResult } from "./types/domain.js";

/**
 * A source: URL, human-readable name, and a mapper from `unknown` → domain type.
 * The mapper is where validation happens.
 * If the raw response doesn't match, the mapper throws and we catch it.
 */
interface Source<T> {
  readonly name: string;
  readonly url: string;
  readonly map: (raw: unknown) => T;
}

/**
 * The three sources we query concurrently.
 *
 * Deliberately three DIFFERENT services, so a failure in one
 * doesn't affect the others. If they were all the same provider,
 * `Promise.allSettled` wouldn't prove anything.
 */
const SOURCES = [
  {
    name: "jsonplaceholder-users",
    url: "https://jsonplaceholder.typicode.com/users",
    map: mapUsers,
  },
  {
    name: "github-node-repo",
    url: "https://api.github.com/repos/nodejs/node",
    map: mapGitHubRepo,
  },
  {
    name: "dog-ceo-breeds",
    url: "https://dog.ceo/api/breeds/list/all",
    map: mapDogBreeds,
  },
] as const satisfies readonly Source<User[] | GitHubRepo | DogBreeds>[];

/**
 * Fetch all sources concurrently and validate each response.
 *
 * Why allSettled and not all:
 * - `Promise.all` rejects as soon as ONE promise rejects. One bad API
 *   kills the whole batch.
 * - `Promise.allSettled` waits for ALL promises, resolved or rejected.
 *   Every source gets a fair chance, and we see every outcome.
 */
async function run(): Promise<void> {
  const wallStart = Date.now();

  console.log(`Fetching from ${SOURCES.length} sources concurrently...\n`);

  // Fire all fetches without awaiting individually.
  // Each promise resolves with a FetchResult — never rejects, because
  // fetchJson catches everything internally.
  const promises = SOURCES.map(async (source) => {
    const fetchResult = await fetchJson(source.url, source.name);

    if (!fetchResult.success) {
      return fetchResult;
    }

    // Fetch succeeded, but the raw data might be garbage.
    // Running the mapper validates it. If the mapper throws,
    // this source fails individually — the others are unaffected.
    try {
      const data = source.map(fetchResult.data);
      return {
        success: true as const,
        data,
        source: fetchResult.source,
        durationMs: fetchResult.durationMs,
      };
    } catch (err) {
      return {
        success: false as const,
        source: fetchResult.source,
        error: `Validation failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        durationMs: fetchResult.durationMs,
      };
    }
  });

  const results = await Promise.allSettled(promises);

  // allSettled returns { status, value | reason } wrappers.
  // Our promises never reject (fetchJson catches internally),
  // so every entry should be "fulfilled". We still handle rejection
  // for safety — defensive coding costs nothing here.
  const settled: FetchResult<unknown>[] = results.map((r) => {
    if (r.status === "fulfilled") return r.value;
    return {
      success: false,
      source: "unknown",
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      durationMs: 0,
    };
  });

  console.log("=== Results ===\n");

  let successCount = 0;
  let failureCount = 0;

  for (const result of settled) {
    if (result.success) {
      successCount++;
      console.log(`[OK] ${result.source} (${result.durationMs}ms)`);
      console.log(`     ${summarize(result.data)}\n`);
    } else {
      failureCount++;
      console.log(`[FAIL] ${result.source} (${result.durationMs}ms)`);
      console.log(`     Error: ${result.error}\n`);
    }
  }

  const wallTime = Date.now() - wallStart;

  console.log("=== Summary ===");
  console.log(`  Success: ${successCount} / ${SOURCES.length}`);
  console.log(`  Failed:  ${failureCount} / ${SOURCES.length}`);
  console.log(`  Wall time: ${wallTime}ms`);
  console.log(
    `  UV_THREADPOOL_SIZE: ${process.env.UV_THREADPOOL_SIZE ?? "(default 4)"}`,
  );
}

/**
 * Produce a one-line human summary of any domain object.
 * Deliberately loose typing — this is display-only, not logic.
 */
function summarize(data: unknown): string {
  if (Array.isArray(data)) return `Array of ${data.length} items`;
  if (typeof data === "object" && data !== null) {
    return JSON.stringify(data).slice(0, 140) + "...";
  }
  return String(data);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});