import { describe, it, expect } from 'vitest';
import {
  secureRandomInt,
  generateRandomHex,
  secureShuffle,
  selectWinners,
  selectWinnersWithAlternates,
} from './random';

describe('secureRandomInt', () => {
  it('returns values within range', () => {
    for (let i = 0; i < 100; i++) {
      const result = secureRandomInt(10);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(10);
    }
  });

  it('throws for non-positive max', () => {
    expect(() => secureRandomInt(0)).toThrow();
    expect(() => secureRandomInt(-1)).toThrow();
  });

  it('handles max of 1', () => {
    const result = secureRandomInt(1);
    expect(result).toBe(0);
  });
});

describe('generateRandomHex', () => {
  it('generates hex string of correct length', () => {
    const hex = generateRandomHex(16);
    expect(hex).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates different values each call', () => {
    const hex1 = generateRandomHex(16);
    const hex2 = generateRandomHex(16);
    expect(hex1).not.toBe(hex2);
  });
});

describe('secureShuffle', () => {
  it('returns array of same length', () => {
    const input = [1, 2, 3, 4, 5];
    const result = secureShuffle(input);
    expect(result.length).toBe(input.length);
  });

  it('contains all original elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = secureShuffle(input);
    expect(result.sort()).toEqual(input.sort());
  });

  it('does not modify original array', () => {
    const input = [1, 2, 3, 4, 5];
    const original = [...input];
    secureShuffle(input);
    expect(input).toEqual(original);
  });

  it('handles empty array', () => {
    const result = secureShuffle([]);
    expect(result).toEqual([]);
  });

  it('handles single element', () => {
    const result = secureShuffle([42]);
    expect(result).toEqual([42]);
  });
});

describe('selectWinners', () => {
  const participants = [
    { username: 'user1' },
    { username: 'user2' },
    { username: 'user3' },
    { username: 'user4' },
    { username: 'user5' },
  ];

  it('selects correct number of winners', () => {
    const { winners } = selectWinners(participants, 3);
    expect(winners.length).toBe(3);
  });

  it('returns seed', () => {
    const { seed } = selectWinners(participants, 1);
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles count greater than participants', () => {
    const { winners } = selectWinners(participants, 10);
    expect(winners.length).toBe(5);
  });

  it('handles empty participants', () => {
    const { winners } = selectWinners([], 3);
    expect(winners.length).toBe(0);
  });

  it('selects unique winners', () => {
    const { winners } = selectWinners(participants, 3);
    const usernames = winners.map(w => w.username);
    const unique = new Set(usernames);
    expect(unique.size).toBe(usernames.length);
  });
});

describe('selectWinnersWithAlternates', () => {
  const participants = [
    { username: 'user1' },
    { username: 'user2' },
    { username: 'user3' },
    { username: 'user4' },
    { username: 'user5' },
  ];

  it('selects winners and alternates', () => {
    const { winners, alternates } = selectWinnersWithAlternates(participants, 2, 2);
    expect(winners.length).toBe(2);
    expect(alternates.length).toBe(2);
  });

  it('alternates are different from winners', () => {
    const { winners, alternates } = selectWinnersWithAlternates(participants, 2, 2);
    const winnerUsernames = new Set(winners.map(w => w.username));
    for (const alt of alternates) {
      expect(winnerUsernames.has(alt.username)).toBe(false);
    }
  });

  it('handles not enough participants for alternates', () => {
    const { winners, alternates } = selectWinnersWithAlternates(participants, 4, 3);
    expect(winners.length).toBe(4);
    expect(alternates.length).toBe(1); // Only 1 left for alternates
  });
});
