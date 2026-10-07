// src/types/domain.ts

/**
 * Domain models — the shape of data AFTER validation and normalization.
 *
 * Rules:
 * - Every field has an explicit type.
 * - No `any`.
 * - Fields that might be missing are optional (`?`) or `| null`.
 */

export interface User {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly username: string;
}

export interface GitHubRepo {
  readonly id: number;
  readonly name: string;
  readonly fullName: string;
  readonly stars: number;
  readonly language: string | null;   // GitHub returns null for some repos
  readonly updatedAt: string;          // ISO 8601 string
}

export interface DogBreeds {
  readonly total: number;
  readonly breeds: readonly string[];  // readonly array — we won't mutate it
}

/**
 * Result wrapper. Every fetch returns this shape.
 *
 * Discriminated union — the `success` field is the tag.
 * TypeScript forces you to check `success` before accessing `data` or `error`.
 * This is how you avoid `any` while still handling both outcomes.
 */
export type FetchResult<T> =
  | {
      readonly success: true;
      readonly data: T;
      readonly source: string;
      readonly durationMs: number;
    }
  | {
      readonly success: false;
      readonly error: string;
      readonly source: string;
      readonly durationMs: number;
    };