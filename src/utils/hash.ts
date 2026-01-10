/**
 * Cryptographic hashing utilities for verification
 *
 * Uses Web Crypto API for SHA-256 hashing
 */

import type { Participant } from '@/types';

/**
 * Generate SHA-256 hash of a string
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a hash of the participant list for verification
 *
 * This allows anyone to verify that the participant list wasn't modified
 * after the draw was performed.
 */
export async function hashParticipants(participants: Participant[]): Promise<string> {
  // Sort by username to ensure consistent ordering
  const sorted = [...participants].sort((a, b) =>
    a.username.toLowerCase().localeCompare(b.username.toLowerCase())
  );

  // Create a canonical string representation
  const canonical = sorted.map(p => p.username.toLowerCase()).join(',');

  return sha256(canonical);
}

/**
 * Generate a verification hash for a complete draw
 *
 * Includes timestamp, participant hash, winners, and seed
 */
export async function generateDrawHash(
  timestamp: Date,
  participantHash: string,
  winners: Participant[],
  seed: string
): Promise<string> {
  const winnerUsernames = winners.map(w => w.username.toLowerCase()).sort().join(',');
  const data = `${timestamp.toISOString()}|${participantHash}|${winnerUsernames}|${seed}`;
  return sha256(data);
}

/**
 * Generate a short verification ID from a hash
 *
 * More user-friendly than a full hash
 */
export function shortId(hash: string, length: number = 8): string {
  return hash.substring(0, length).toUpperCase();
}

/**
 * Generate a draw ID combining timestamp and randomness
 */
export function generateDrawId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`.toUpperCase();
}
