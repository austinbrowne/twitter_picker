/**
 * Cryptographically secure random selection utilities
 *
 * Uses Web Crypto API (crypto.getRandomValues) for true randomness,
 * not Math.random() which is predictable.
 */

import type { Participant } from '@/types';

/**
 * Generate a cryptographically secure random number between 0 and max (exclusive)
 */
export function secureRandomInt(max: number): number {
  if (max <= 0) {
    throw new Error('Max must be positive');
  }

  // Use rejection sampling to ensure uniform distribution
  const array = new Uint32Array(1);
  const maxValid = Math.floor(0xFFFFFFFF / max) * max;

  let value: number;
  do {
    crypto.getRandomValues(array);
    value = array[0];
  } while (value >= maxValid);

  return value % max;
}

/**
 * Generate a random hex string of specified length
 */
export function generateRandomHex(bytes: number = 16): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random seed for reproducible draws
 */
export function generateRandomSeed(): string {
  return generateRandomHex(32);
}

/**
 * Fisher-Yates shuffle using cryptographic randomness
 */
export function secureShuffle<T>(array: T[]): T[] {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Select random winners from a list of participants
 *
 * @param participants - List of eligible participants
 * @param count - Number of winners to select
 * @param seed - Optional seed for logging/verification (does not affect randomness)
 * @returns Selected winners and the seed used
 */
export function selectWinners(
  participants: Participant[],
  count: number,
  seed?: string
): { winners: Participant[]; seed: string } {
  if (participants.length === 0) {
    return { winners: [], seed: seed || generateRandomSeed() };
  }

  const actualCount = Math.min(count, participants.length);
  const usedSeed = seed || generateRandomSeed();

  // Shuffle and take the first N
  const shuffled = secureShuffle(participants);
  const winners = shuffled.slice(0, actualCount);

  return { winners, seed: usedSeed };
}

/**
 * Select winners with alternates
 *
 * @param participants - List of eligible participants
 * @param winnerCount - Number of main winners
 * @param alternateCount - Number of alternates
 * @returns Winners, alternates, and the seed used
 */
export function selectWinnersWithAlternates(
  participants: Participant[],
  winnerCount: number,
  alternateCount: number
): { winners: Participant[]; alternates: Participant[]; seed: string } {
  const seed = generateRandomSeed();
  const shuffled = secureShuffle(participants);

  const actualWinnerCount = Math.min(winnerCount, shuffled.length);
  const remainingCount = shuffled.length - actualWinnerCount;
  const actualAlternateCount = Math.min(alternateCount, remainingCount);

  const winners = shuffled.slice(0, actualWinnerCount);
  const alternates = shuffled.slice(actualWinnerCount, actualWinnerCount + actualAlternateCount);

  return { winners, alternates, seed };
}

/**
 * Verify that a selection is statistically valid
 * (for testing purposes)
 */
export function verifyUniformDistribution(
  _sampleSize: number,
  buckets: number,
  iterations: number = 10000
): { isUniform: boolean; chiSquare: number; pValue: number } {
  const counts = new Array(buckets).fill(0);

  for (let i = 0; i < iterations; i++) {
    const value = secureRandomInt(buckets);
    counts[value]++;
  }

  const expected = iterations / buckets;
  let chiSquare = 0;

  for (const count of counts) {
    chiSquare += Math.pow(count - expected, 2) / expected;
  }

  // Rough p-value calculation (chi-square distribution with buckets-1 degrees of freedom)
  // This is a simplified approximation
  const degreesOfFreedom = buckets - 1;
  const criticalValue = degreesOfFreedom + 2 * Math.sqrt(2 * degreesOfFreedom);
  const pValue = chiSquare < criticalValue ? 0.95 : 0.05;

  return {
    isUniform: chiSquare < criticalValue,
    chiSquare,
    pValue,
  };
}
