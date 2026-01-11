/**
 * Eligibility calculation utilities
 * Pure functions for calculating eligible participants from collected data
 */

/**
 * Calculate eligible participants based on requirements
 * @param {Object} options
 * @param {Array} options.retweeters - Array of user objects who retweeted
 * @param {Array} options.likers - Array of user objects who liked
 * @param {boolean} options.requireRetweet - Whether retweet is required
 * @param {boolean} options.requireLike - Whether like is required
 * @returns {Array} Array of eligible user objects
 */
export function calculateEligible({ retweeters = [], likers = [], requireRetweet = true, requireLike = true }) {
  // If a requirement is set but list is empty, no one can be eligible
  if (requireRetweet && retweeters.length === 0) {
    return [];
  }
  if (requireLike && likers.length === 0) {
    return [];
  }

  let eligibleSet = null;

  const retweeterSet = new Set(retweeters.map(u => u.username.toLowerCase()));
  const likerSet = new Set(likers.map(u => u.username.toLowerCase()));

  // Start with retweeters if required
  if (requireRetweet) {
    eligibleSet = new Set(retweeterSet);
  }

  // Intersect with likers if required
  if (requireLike) {
    if (eligibleSet) {
      eligibleSet = new Set([...eligibleSet].filter(u => likerSet.has(u)));
    } else {
      eligibleSet = new Set(likerSet);
    }
  }

  if (!eligibleSet) return [];

  // Build user objects - prefer retweeter data (most complete)
  const userMap = new Map();
  [...likers, ...retweeters].forEach(u => {
    userMap.set(u.username.toLowerCase(), u);
  });

  return Array.from(eligibleSet)
    .map(username => userMap.get(username))
    .filter(Boolean);
}

/**
 * Apply filters to a list of users
 * @param {Array} users - Array of user objects
 * @param {Object} filters
 * @param {number} filters.minFollowers - Minimum follower count
 * @param {number} filters.minTweets - Minimum tweet count
 * @param {number} filters.minAccountAgeDays - Minimum account age in days
 * @param {boolean} filters.requireAvatar - Whether to require a profile picture
 * @returns {Array} Filtered array of user objects
 */
export function applyFilters(users, { minFollowers = 0, minTweets = 0, minAccountAgeDays = 0, requireAvatar = false } = {}) {
  const now = new Date();
  const minDate = new Date(now);
  minDate.setDate(minDate.getDate() - minAccountAgeDays);

  return users.filter(u => {
    // Only apply filters when we have the data (don't exclude if data is missing)
    if (minFollowers > 0 && u.followerCount !== undefined) {
      if (u.followerCount < minFollowers) return false;
    }
    if (minTweets > 0 && u.tweetCount !== undefined) {
      if (u.tweetCount < minTweets) return false;
    }
    if (minAccountAgeDays > 0 && u.createdAt) {
      try {
        const created = new Date(u.createdAt);
        if (created > minDate) return false;
      } catch (e) {
        // Invalid date, skip filter
      }
    }
    if (requireAvatar && u.avatarUrl) {
      if (u.avatarUrl.includes('default_profile')) return false;
    }
    return true;
  });
}
