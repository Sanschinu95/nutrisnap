/**
 * Neon serverless Postgres client
 * Uses @neondatabase/serverless for HTTP-based queries from React Native
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.EXPO_PUBLIC_NEON_CONNECTION_STRING;

if (!connectionString) {
  console.warn(
    'Neon connection string not found. Please set EXPO_PUBLIC_NEON_CONNECTION_STRING in your .env.local file.'
  );
}

/**
 * Neon SQL tagged template function.
 * Usage: const rows = await sql`SELECT * FROM profiles WHERE id = ${userId}`;
 */
export const sql = neon(connectionString ?? '');

/**
 * Execute a raw query string with parameter binding.
 * Prefer the tagged template `sql` above for most queries.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return sql(text, params) as Promise<T[]>;
}
