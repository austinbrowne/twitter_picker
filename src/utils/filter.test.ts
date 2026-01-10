import { describe, it, expect } from 'vitest';
import {
  filterParticipants,
  calculateBotScore,
  getFilterReasonLabel,
} from './filter';
import { DEFAULT_FILTER_CONFIG } from '@/types';
import type { Participant, FilterConfig } from '@/types';

describe('filterParticipants', () => {
  const createParticipant = (overrides: Partial<Participant> = {}): Participant => ({
    username: 'testuser',
    followerCount: 100,
    followingCount: 50,
    tweetCount: 200,
    createdAt: new Date('2020-01-01'),
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    ...overrides,
  });

  const defaultConfig: FilterConfig = {
    ...DEFAULT_FILTER_CONFIG,
    minFollowers: 10,
    minFollowing: 5,
    minAccountAgeDays: 30,
    minTweets: 10,
    requireAvatar: true,
    requireBio: false,
    blacklist: [],
    onlyVerified: false,
    excludeDefaultProfile: false,
  };

  it('passes valid participants', () => {
    const participants = [createParticipant()];
    const result = filterParticipants(participants, defaultConfig);

    expect(result.passed.length).toBe(1);
    expect(result.filtered.length).toBe(0);
  });

  it('filters low followers', () => {
    const participants = [createParticipant({ followerCount: 5 })];
    const result = filterParticipants(participants, defaultConfig);

    expect(result.passed.length).toBe(0);
    expect(result.filtered.length).toBe(1);
    expect(result.filtered[0].reasons).toContain('low_followers');
  });

  it('filters low following', () => {
    const participants = [createParticipant({ followingCount: 2 })];
    const result = filterParticipants(participants, defaultConfig);

    expect(result.filtered[0].reasons).toContain('low_following');
  });

  it('filters new accounts', () => {
    const participants = [createParticipant({ createdAt: new Date() })];
    const result = filterParticipants(participants, defaultConfig);

    expect(result.filtered[0].reasons).toContain('new_account');
  });

  it('filters accounts without avatar', () => {
    const participants = [createParticipant({ avatarUrl: undefined })];
    const result = filterParticipants(participants, defaultConfig);

    expect(result.filtered[0].reasons).toContain('no_avatar');
  });

  it('filters default avatars', () => {
    const participants = [
      createParticipant({ avatarUrl: 'https://abs.twimg.com/sticky/default_profile_images/default_profile.png' }),
    ];
    const result = filterParticipants(participants, defaultConfig);

    expect(result.filtered[0].reasons).toContain('no_avatar');
  });

  it('filters blacklisted users', () => {
    const participants = [createParticipant({ username: 'baduser' })];
    const config = { ...defaultConfig, blacklist: ['baduser'] };
    const result = filterParticipants(participants, config);

    expect(result.filtered[0].reasons).toContain('blacklisted');
  });

  it('handles case-insensitive blacklist', () => {
    const participants = [createParticipant({ username: 'BadUser' })];
    const config = { ...defaultConfig, blacklist: ['baduser'] };
    const result = filterParticipants(participants, config);

    expect(result.filtered[0].reasons).toContain('blacklisted');
  });

  it('filters duplicates', () => {
    const participants = [
      createParticipant({ username: 'user1' }),
      createParticipant({ username: 'user1' }),
    ];
    const result = filterParticipants(participants, defaultConfig);

    expect(result.passed.length).toBe(1);
    expect(result.filtered.length).toBe(1);
    expect(result.filtered[0].reasons).toContain('duplicate');
  });

  it('skips filters when data not available', () => {
    const participants = [createParticipant({ followerCount: undefined })];
    const result = filterParticipants(participants, defaultConfig);

    // Should pass because we can't verify follower count
    expect(result.filtered[0]?.reasons || []).not.toContain('low_followers');
  });

  it('calculates correct stats', () => {
    const participants = [
      createParticipant({ username: 'good1' }),
      createParticipant({ username: 'good2' }),
      createParticipant({ username: 'bad1', followerCount: 1 }),
    ];
    const result = filterParticipants(participants, defaultConfig);

    expect(result.stats.total).toBe(3);
    expect(result.stats.passed).toBe(2);
    expect(result.stats.filtered).toBe(1);
    expect(result.stats.byReason.low_followers).toBe(1);
  });
});

describe('calculateBotScore', () => {
  it('returns low score for legitimate accounts', () => {
    const participant: Participant = {
      username: 'realuser',
      followerCount: 500,
      followingCount: 200,
      tweetCount: 1000,
      createdAt: new Date('2015-01-01'),
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'Real user bio',
      displayName: 'Real User',
    };

    const score = calculateBotScore(participant);
    expect(score).toBeLessThan(30);
  });

  it('returns high score for suspicious accounts', () => {
    const participant: Participant = {
      username: 'bot12345678',
      followerCount: 0,
      followingCount: 1000,
      tweetCount: 0,
      createdAt: new Date(), // Just created
      avatarUrl: undefined,
      bio: undefined,
    };

    const score = calculateBotScore(participant);
    expect(score).toBeGreaterThan(50);
  });

  it('handles missing data gracefully', () => {
    const participant: Participant = {
      username: 'unknownuser',
    };

    const score = calculateBotScore(participant);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('getFilterReasonLabel', () => {
  it('returns human-readable labels', () => {
    expect(getFilterReasonLabel('low_followers')).toBe('Too few followers');
    expect(getFilterReasonLabel('new_account')).toBe('Account too new');
    expect(getFilterReasonLabel('blacklisted')).toBe('Blacklisted');
  });
});
