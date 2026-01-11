import { describe, it, expect } from 'vitest';
import { calculateEligible, applyFilters } from './eligibility.js';

// Helper to create user objects
function createUser(username, overrides = {}) {
  return {
    id: `id_${username}`,
    username,
    displayName: username,
    followerCount: 100,
    tweetCount: 50,
    createdAt: '2020-01-01T00:00:00Z',
    avatarUrl: 'https://pbs.twimg.com/profile.jpg',
    ...overrides
  };
}

describe('calculateEligible', () => {
  describe('intersection of retweeters and likers', () => {
    it('should return only users who both retweeted AND liked when both required', () => {
      const retweeters = [
        createUser('alice'),
        createUser('bob'),
        createUser('charlie')
      ];
      const likers = [
        createUser('bob'),
        createUser('charlie'),
        createUser('dave')
      ];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: true
      });

      expect(eligible).toHaveLength(2);
      const usernames = eligible.map(u => u.username.toLowerCase());
      expect(usernames).toContain('bob');
      expect(usernames).toContain('charlie');
      expect(usernames).not.toContain('alice'); // only retweeted
      expect(usernames).not.toContain('dave');  // only liked
    });

    it('should handle case-insensitive usernames', () => {
      const retweeters = [createUser('Alice'), createUser('BOB')];
      const likers = [createUser('alice'), createUser('bob')];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: true
      });

      expect(eligible).toHaveLength(2);
    });

    it('should return empty array when no intersection exists', () => {
      const retweeters = [createUser('alice'), createUser('bob')];
      const likers = [createUser('charlie'), createUser('dave')];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: true
      });

      expect(eligible).toHaveLength(0);
    });

    it('should return all retweeters when only retweet required', () => {
      const retweeters = [createUser('alice'), createUser('bob')];
      const likers = [createUser('charlie')];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: false
      });

      expect(eligible).toHaveLength(2);
      const usernames = eligible.map(u => u.username.toLowerCase());
      expect(usernames).toContain('alice');
      expect(usernames).toContain('bob');
    });

    it('should return all likers when only like required', () => {
      const retweeters = [createUser('alice')];
      const likers = [createUser('bob'), createUser('charlie')];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: false,
        requireLike: true
      });

      expect(eligible).toHaveLength(2);
      const usernames = eligible.map(u => u.username.toLowerCase());
      expect(usernames).toContain('bob');
      expect(usernames).toContain('charlie');
    });

    it('should return empty array when neither requirement is set', () => {
      const retweeters = [createUser('alice')];
      const likers = [createUser('bob')];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: false,
        requireLike: false
      });

      expect(eligible).toHaveLength(0);
    });

    it('should return empty array when retweeters list is empty but required', () => {
      const retweeters = [];
      const likers = [createUser('alice'), createUser('bob')];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: true
      });

      expect(eligible).toHaveLength(0);
    });

    it('should return empty array when likers list is empty but required', () => {
      const retweeters = [createUser('alice'), createUser('bob')];
      const likers = [];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: true
      });

      expect(eligible).toHaveLength(0);
    });
  });

  describe('user data merging', () => {
    it('should prefer retweeter data over liker data', () => {
      const retweeters = [createUser('alice', { followerCount: 1000, displayName: 'Alice R' })];
      const likers = [createUser('alice', { followerCount: 500, displayName: 'Alice L' })];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: true
      });

      expect(eligible).toHaveLength(1);
      expect(eligible[0].followerCount).toBe(1000); // retweeter data preferred
      expect(eligible[0].displayName).toBe('Alice R');
    });
  });

  describe('edge cases', () => {
    it('should handle single user in both lists', () => {
      const user = createUser('alice');
      const retweeters = [user];
      const likers = [user];

      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: true
      });

      expect(eligible).toHaveLength(1);
      expect(eligible[0].username).toBe('alice');
    });

    it('should handle large lists efficiently', () => {
      const retweeters = Array.from({ length: 10000 }, (_, i) => createUser(`user${i}`));
      const likers = Array.from({ length: 10000 }, (_, i) => createUser(`user${i + 5000}`));

      const start = performance.now();
      const eligible = calculateEligible({
        retweeters,
        likers,
        requireRetweet: true,
        requireLike: true
      });
      const duration = performance.now() - start;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
      // Intersection should be users 5000-9999
      expect(eligible).toHaveLength(5000);
    });

    it('should handle undefined/null gracefully', () => {
      expect(() => calculateEligible({})).not.toThrow();
      expect(calculateEligible({})).toEqual([]);
    });
  });
});

describe('applyFilters', () => {
  describe('minFollowers filter', () => {
    it('should filter out users below minimum follower count', () => {
      const users = [
        createUser('alice', { followerCount: 100 }),
        createUser('bob', { followerCount: 50 }),
        createUser('charlie', { followerCount: 200 })
      ];

      const filtered = applyFilters(users, { minFollowers: 100 });

      expect(filtered).toHaveLength(2);
      const usernames = filtered.map(u => u.username);
      expect(usernames).toContain('alice');
      expect(usernames).toContain('charlie');
      expect(usernames).not.toContain('bob');
    });

    it('should not filter when followerCount is undefined', () => {
      const users = [
        createUser('alice', { followerCount: undefined }),
        createUser('bob', { followerCount: 50 })
      ];

      const filtered = applyFilters(users, { minFollowers: 100 });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].username).toBe('alice'); // undefined passes filter
    });

    it('should not filter when minFollowers is 0', () => {
      const users = [
        createUser('alice', { followerCount: 0 }),
        createUser('bob', { followerCount: 50 })
      ];

      const filtered = applyFilters(users, { minFollowers: 0 });

      expect(filtered).toHaveLength(2);
    });
  });

  describe('minTweets filter', () => {
    it('should filter out users below minimum tweet count', () => {
      const users = [
        createUser('alice', { tweetCount: 10 }),
        createUser('bob', { tweetCount: 100 })
      ];

      const filtered = applyFilters(users, { minTweets: 50 });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].username).toBe('bob');
    });
  });

  describe('minAccountAgeDays filter', () => {
    it('should filter out accounts younger than minimum age', () => {
      const now = new Date();
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 100);
      const newDate = new Date(now);
      newDate.setDate(newDate.getDate() - 10);

      const users = [
        createUser('alice', { createdAt: oldDate.toISOString() }),
        createUser('bob', { createdAt: newDate.toISOString() })
      ];

      const filtered = applyFilters(users, { minAccountAgeDays: 30 });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].username).toBe('alice');
    });

    it('should handle invalid dates gracefully', () => {
      const users = [
        createUser('alice', { createdAt: 'invalid-date' }),
        createUser('bob', { createdAt: null })
      ];

      expect(() => applyFilters(users, { minAccountAgeDays: 30 })).not.toThrow();
    });
  });

  describe('requireAvatar filter', () => {
    it('should filter out default profile pictures', () => {
      const users = [
        createUser('alice', { avatarUrl: 'https://pbs.twimg.com/profile.jpg' }),
        createUser('bob', { avatarUrl: 'https://abs.twimg.com/sticky/default_profile.png' })
      ];

      const filtered = applyFilters(users, { requireAvatar: true });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].username).toBe('alice');
    });

    it('should not filter when requireAvatar is false', () => {
      const users = [
        createUser('alice', { avatarUrl: 'https://abs.twimg.com/sticky/default_profile.png' })
      ];

      const filtered = applyFilters(users, { requireAvatar: false });

      expect(filtered).toHaveLength(1);
    });
  });

  describe('combined filters', () => {
    it('should apply all filters together', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const users = [
        createUser('alice', { followerCount: 200, tweetCount: 100, createdAt: oldDate.toISOString() }),
        createUser('bob', { followerCount: 50, tweetCount: 100, createdAt: oldDate.toISOString() }),
        createUser('charlie', { followerCount: 200, tweetCount: 5, createdAt: oldDate.toISOString() }),
        createUser('dave', { followerCount: 200, tweetCount: 100, createdAt: new Date().toISOString() })
      ];

      const filtered = applyFilters(users, {
        minFollowers: 100,
        minTweets: 50,
        minAccountAgeDays: 30
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].username).toBe('alice');
    });
  });
});
