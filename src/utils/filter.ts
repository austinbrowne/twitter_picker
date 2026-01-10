/**
 * Bot and fake account filtering utilities
 *
 * Applies configurable filters to detect and exclude suspicious accounts
 */

import type {
  Participant,
  FilterConfig,
  FilterResult,
  FilteredParticipant,
  FilterReason,
  FilterStats,
} from '@/types';

/**
 * Apply all configured filters to a list of participants
 */
export function filterParticipants(
  participants: Participant[],
  config: FilterConfig
): FilterResult {
  const passed: Participant[] = [];
  const filtered: FilteredParticipant[] = [];
  const stats: FilterStats = {
    total: participants.length,
    passed: 0,
    filtered: 0,
    byReason: {
      low_followers: 0,
      low_following: 0,
      new_account: 0,
      no_avatar: 0,
      no_bio: 0,
      low_tweets: 0,
      blacklisted: 0,
      not_verified: 0,
      default_profile: 0,
      duplicate: 0,
    },
  };

  // Track duplicates
  const seenUsernames = new Set<string>();
  const normalizedBlacklist = new Set(
    config.blacklist.map(u => u.toLowerCase().replace(/^@/, ''))
  );

  for (const participant of participants) {
    const reasons: FilterReason[] = [];
    const normalizedUsername = participant.username.toLowerCase();

    // Check for duplicates
    if (seenUsernames.has(normalizedUsername)) {
      reasons.push('duplicate');
      stats.byReason.duplicate++;
    } else {
      seenUsernames.add(normalizedUsername);
    }

    // Check blacklist
    if (normalizedBlacklist.has(normalizedUsername)) {
      reasons.push('blacklisted');
      stats.byReason.blacklisted++;
    }

    // Check follower count (only if data available)
    if (
      config.minFollowers > 0 &&
      participant.followerCount !== undefined &&
      participant.followerCount < config.minFollowers
    ) {
      reasons.push('low_followers');
      stats.byReason.low_followers++;
    }

    // Check following count
    if (
      config.minFollowing > 0 &&
      participant.followingCount !== undefined &&
      participant.followingCount < config.minFollowing
    ) {
      reasons.push('low_following');
      stats.byReason.low_following++;
    }

    // Check account age
    if (config.minAccountAgeDays > 0 && participant.createdAt) {
      const accountAgeDays = getAccountAgeDays(participant.createdAt);
      if (accountAgeDays < config.minAccountAgeDays) {
        reasons.push('new_account');
        stats.byReason.new_account++;
      }
    }

    // Check avatar
    if (config.requireAvatar) {
      if (!participant.avatarUrl || isDefaultAvatar(participant.avatarUrl)) {
        reasons.push('no_avatar');
        stats.byReason.no_avatar++;
      }
    }

    // Check bio
    if (config.requireBio && !participant.bio) {
      reasons.push('no_bio');
      stats.byReason.no_bio++;
    }

    // Check tweet count
    if (
      config.minTweets > 0 &&
      participant.tweetCount !== undefined &&
      participant.tweetCount < config.minTweets
    ) {
      reasons.push('low_tweets');
      stats.byReason.low_tweets++;
    }

    // Check verified status
    if (config.onlyVerified && !participant.isVerified) {
      reasons.push('not_verified');
      stats.byReason.not_verified++;
    }

    // Check default profile
    if (config.excludeDefaultProfile && hasDefaultProfile(participant)) {
      reasons.push('default_profile');
      stats.byReason.default_profile++;
    }

    // Categorize participant
    if (reasons.length === 0) {
      passed.push(participant);
    } else {
      filtered.push({ participant, reasons });
    }
  }

  stats.passed = passed.length;
  stats.filtered = filtered.length;

  return { passed, filtered, stats };
}

/**
 * Calculate account age in days
 */
function getAccountAgeDays(createdAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if avatar URL is a default Twitter avatar
 */
function isDefaultAvatar(avatarUrl: string): boolean {
  const defaultPatterns = [
    'default_profile',
    'default-profile',
    'default_profile_normal',
    '/sticky/default_profile_images/',
    'abs.twimg.com/sticky/default_profile',
  ];

  const lowerUrl = avatarUrl.toLowerCase();
  return defaultPatterns.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Check if participant has a default/empty profile
 */
function hasDefaultProfile(participant: Participant): boolean {
  // No avatar or default avatar
  if (!participant.avatarUrl || isDefaultAvatar(participant.avatarUrl)) {
    return true;
  }

  // No bio and no display name
  if (!participant.bio && !participant.displayName) {
    return true;
  }

  return false;
}

/**
 * Get a human-readable description for a filter reason
 */
export function getFilterReasonLabel(reason: FilterReason): string {
  const labels: Record<FilterReason, string> = {
    low_followers: 'Too few followers',
    low_following: 'Too few following',
    new_account: 'Account too new',
    no_avatar: 'No profile picture',
    no_bio: 'No bio/description',
    low_tweets: 'Too few tweets',
    blacklisted: 'Blacklisted',
    not_verified: 'Not verified',
    default_profile: 'Default profile',
    duplicate: 'Duplicate entry',
  };

  return labels[reason] || reason;
}

/**
 * Calculate a "bot likelihood" score for a participant
 * Higher score = more likely to be a bot (0-100)
 */
export function calculateBotScore(participant: Participant): number {
  let score = 0;
  let factors = 0;

  // Follower/Following ratio
  if (participant.followerCount !== undefined && participant.followingCount !== undefined) {
    factors++;
    if (participant.followerCount === 0 && participant.followingCount > 100) {
      score += 30; // Following many, no followers
    } else if (participant.followingCount > 0) {
      const ratio = participant.followerCount / participant.followingCount;
      if (ratio < 0.1) {
        score += 20; // Very low ratio
      } else if (ratio < 0.3) {
        score += 10; // Low ratio
      }
    }
  }

  // Account age
  if (participant.createdAt) {
    factors++;
    const ageDays = getAccountAgeDays(participant.createdAt);
    if (ageDays < 7) {
      score += 30; // Very new account
    } else if (ageDays < 30) {
      score += 20; // New account
    } else if (ageDays < 90) {
      score += 10; // Relatively new
    }
  }

  // Tweet count
  if (participant.tweetCount !== undefined) {
    factors++;
    if (participant.tweetCount === 0) {
      score += 25; // No tweets
    } else if (participant.tweetCount < 5) {
      score += 15; // Very few tweets
    } else if (participant.tweetCount < 20) {
      score += 5; // Few tweets
    }
  }

  // Profile completeness
  if (!participant.avatarUrl || isDefaultAvatar(participant.avatarUrl)) {
    factors++;
    score += 15; // No profile picture
  }

  if (!participant.bio) {
    factors++;
    score += 10; // No bio
  }

  if (!participant.displayName || participant.displayName === participant.username) {
    factors++;
    score += 5; // No display name or same as username
  }

  // Username patterns (common bot patterns)
  const username = participant.username.toLowerCase();
  if (/\d{5,}$/.test(username)) {
    factors++;
    score += 15; // Ends with many numbers
  }
  if (/^[a-z]+\d+[a-z]+\d+/.test(username)) {
    factors++;
    score += 10; // Alternating letters and numbers
  }

  // Normalize score based on available factors
  if (factors > 0) {
    // Scale to 0-100
    const maxPossibleScore = factors * 30; // Approximate max per factor
    score = Math.min(100, Math.round((score / maxPossibleScore) * 100));
  }

  return score;
}

/**
 * Suggest filter configuration based on participant data
 */
export function suggestFilters(participants: Participant[]): Partial<FilterConfig> {
  if (participants.length === 0) {
    return {};
  }

  const hasFollowerData = participants.some(p => p.followerCount !== undefined);
  const hasAgeData = participants.some(p => p.createdAt !== undefined);
  const hasTweetData = participants.some(p => p.tweetCount !== undefined);

  const suggestions: Partial<FilterConfig> = {};

  if (hasFollowerData) {
    // Calculate median follower count
    const followerCounts = participants
      .filter(p => p.followerCount !== undefined)
      .map(p => p.followerCount!);

    if (followerCounts.length > 0) {
      const sorted = [...followerCounts].sort((a, b) => a - b);
      const p10 = sorted[Math.floor(sorted.length * 0.1)];

      // Suggest filtering out bottom 10%
      if (p10 > 0) {
        suggestions.minFollowers = Math.min(p10, 10);
      }
    }
  }

  if (hasAgeData) {
    suggestions.minAccountAgeDays = 30; // Always recommend 30 days
  }

  if (hasTweetData) {
    suggestions.minTweets = 5; // Recommend at least 5 tweets
  }

  // Always recommend avatar check if we have URL data
  if (participants.some(p => p.avatarUrl !== undefined)) {
    suggestions.requireAvatar = true;
  }

  return suggestions;
}

/**
 * Generate a summary of filtered participants
 */
export function generateFilterSummary(result: FilterResult): string {
  const { stats } = result;
  const lines: string[] = [];

  lines.push(`Total participants: ${stats.total}`);
  lines.push(`Eligible: ${stats.passed} (${((stats.passed / stats.total) * 100).toFixed(1)}%)`);
  lines.push(`Filtered out: ${stats.filtered}`);

  if (stats.filtered > 0) {
    lines.push('');
    lines.push('Reasons for filtering:');

    const reasons = Object.entries(stats.byReason)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);

    for (const [reason, count] of reasons) {
      const label = getFilterReasonLabel(reason as FilterReason);
      lines.push(`  - ${label}: ${count}`);
    }
  }

  return lines.join('\n');
}
