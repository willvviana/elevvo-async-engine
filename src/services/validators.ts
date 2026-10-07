// src/services/validators.ts

import type { User, GitHubRepo, DogBreeds } from "../types/domain.js";

/**
 * Runtime type guards.
 *
 * TypeScript types disappear at runtime. Values coming from `fetch` are
 * `unknown` and must be validated with real code before use.
 *
 * Every guard returns `value is T` — the type predicate. When it returns
 * true, TypeScript narrows the type inside the `if` block.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/* ---------------- Users (jsonplaceholder) ---------------- */

interface JsonPlaceholderUser {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  username?: unknown;
}

function isJsonPlaceholderUser(value: unknown): value is JsonPlaceholderUser {
  return isObject(value);
}

export function mapUsers(raw: unknown): User[] {
  if (!Array.isArray(raw)) {
    throw new Error(`Expected array of users, got ${typeof raw}`);
  }

  const users: User[] = [];
  for (const item of raw) {
    if (!isJsonPlaceholderUser(item)) continue;

    // Skip malformed entries rather than failing the whole batch.
    // One bad row shouldn't take out the entire result.
    if (
      !isNumber(item.id) ||
      !isString(item.name) ||
      !isString(item.email) ||
      !isString(item.username)
    ) {
      continue;
    }

    users.push({
      id: item.id,
      name: item.name,
      email: item.email,
      username: item.username,
    });
  }
  return users;
}

/* ---------------- GitHub repo ---------------- */

interface RawGitHubRepo {
  id?: unknown;
  name?: unknown;
  full_name?: unknown;
  stargazers_count?: unknown;
  language?: unknown;
  updated_at?: unknown;
}

export function mapGitHubRepo(raw: unknown): GitHubRepo {
  if (!isObject(raw)) {
    throw new Error("Expected object for GitHub repo");
  }
  const r = raw as RawGitHubRepo;

  if (
    !isNumber(r.id) ||
    !isString(r.name) ||
    !isString(r.full_name) ||
    !isNumber(r.stargazers_count) ||
    !isString(r.updated_at)
  ) {
    throw new Error("GitHub repo response is missing required fields");
  }

  // `language` can be null in GitHub's API — that's valid, not an error.
  const language =
    r.language === null ? null : isString(r.language) ? r.language : null;

  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    stars: r.stargazers_count,
    language,
    updatedAt: r.updated_at,
  };
}

/* ---------------- Dog breeds ---------------- */

interface RawDogApi {
  status?: unknown;
  message?: unknown;
}

export function mapDogBreeds(raw: unknown): DogBreeds {
  if (!isObject(raw)) throw new Error("Expected object for dog breeds");
  const r = raw as RawDogApi;

  if (r.status !== "success" || !isObject(r.message)) {
    throw new Error("Dog API returned unexpected shape");
  }

  const breeds = Object.keys(r.message);
  return { total: breeds.length, breeds };
}