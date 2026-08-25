/**
 * Seed handling. The operator seed is the CLI's only secret; it lives in .env,
 * which is gitignored from the first commit.
 */

import { existsSync, appendFileSync, writeFileSync } from 'node:fs';

import { generateSeed } from './wallet.ts';
import { logger } from './logger.ts';

const ENV_PATH = new URL('../../.env', import.meta.url).pathname;

export const loadEnv = (): void => {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);
};

/**
 * Return the seed for a named role, creating and persisting one if absent.
 * Roles: OPERATOR (registry operator), or a device id.
 */
export const seedFor = (role: string): string => {
  const key = `${role.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_SEED`;
  const existing = process.env[key];
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) return existing;

  const seed = generateSeed();
  if (!existsSync(ENV_PATH)) {
    writeFileSync(ENV_PATH, '# NightSeal secrets — never commit this file\n', 'utf8');
  }
  appendFileSync(ENV_PATH, `${key}=${seed}\n`, 'utf8');
  process.env[key] = seed;
  logger.info(`Generated a new seed for "${role}" and saved it to .env as ${key}`);
  return seed;
};
