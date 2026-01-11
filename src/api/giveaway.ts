/**
 * Giveaway Verification Service
 *
 * Verifies that participants meet all giveaway requirements:
 * - Retweeted the tweet
 * - Liked the tweet
 * - Following specified accounts
 */

import {
  TwitterClient,
  TwitterUser,
  twitterUserToParticipant,
  RateLimitError,
} from './twitter';
import type { Participant } from '@/types';

export interface GiveawayRequirements {
  /** The tweet URL or ID for the giveaway */
  tweetUrl: string;
  /** Must have retweeted */
  requireRetweet: boolean;
  /** Must have liked */
  requireLike: boolean;
  /** Must follow these accounts (usernames or URLs) */
  mustFollow: string[];
}

export interface VerificationProgress {
  stage: 'fetching_retweeters' | 'fetching_likers' | 'verifying_follows' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface VerificationResult {
  /** All users who meet ALL requirements */
  eligible: Participant[];
  /** Users who retweeted */
  retweeters: Participant[];
  /** Users who liked */
  likers: Participant[];
  /** Users who failed requirements with reasons */
  disqualified: {
    participant: Participant;
    missingRequirements: string[];
  }[];
  /** Statistics */
  stats: {
    totalRetweeters: number;
    totalLikers: number;
    bothRetweetAndLike: number;
    followsAllAccounts: number;
    eligible: number;
  };
}

/**
 * Giveaway Verification Service
 */
export class GiveawayService {
  private client: TwitterClient;

  constructor(bearerToken: string) {
    this.client = new TwitterClient({ bearerToken });
  }

  /**
   * Verify all giveaway requirements and return eligible participants
   */
  async verifyGiveaway(
    requirements: GiveawayRequirements,
    onProgress?: (progress: VerificationProgress) => void
  ): Promise<VerificationResult> {
    const tweetId = TwitterClient.extractTweetId(requirements.tweetUrl);

    // Get tweet info
    const tweet = await this.client.getTweet(tweetId);

    let retweeters: TwitterUser[] = [];
    let likers: TwitterUser[] = [];

    // Fetch retweeters
    if (requirements.requireRetweet) {
      onProgress?.({
        stage: 'fetching_retweeters',
        current: 0,
        total: tweet.public_metrics.retweet_count,
        message: `Fetching retweeters (${tweet.public_metrics.retweet_count} total)...`,
      });

      retweeters = await this.client.getAllRetweeters(tweetId, (count) => {
        onProgress?.({
          stage: 'fetching_retweeters',
          current: count,
          total: tweet.public_metrics.retweet_count,
          message: `Fetched ${count} retweeters...`,
        });
      });
    }

    // Fetch likers
    if (requirements.requireLike) {
      onProgress?.({
        stage: 'fetching_likers',
        current: 0,
        total: tweet.public_metrics.like_count,
        message: `Fetching likers (${tweet.public_metrics.like_count} total)...`,
      });

      likers = await this.client.getAllLikers(tweetId, (count) => {
        onProgress?.({
          stage: 'fetching_likers',
          current: count,
          total: tweet.public_metrics.like_count,
          message: `Fetched ${count} likers...`,
        });
      });
    }

    // Find users who meet retweet+like requirements
    const retweeterIds = new Set(retweeters.map(u => u.id));
    const likerIds = new Set(likers.map(u => u.id));

    let candidateUsers: TwitterUser[];

    if (requirements.requireRetweet && requirements.requireLike) {
      // Must have both - find intersection
      candidateUsers = retweeters.filter(u => likerIds.has(u.id));
    } else if (requirements.requireRetweet) {
      candidateUsers = retweeters;
    } else if (requirements.requireLike) {
      candidateUsers = likers;
    } else {
      // Neither required (unusual) - combine both
      const allUsersMap = new Map<string, TwitterUser>();
      for (const u of [...retweeters, ...likers]) {
        allUsersMap.set(u.id, u);
      }
      candidateUsers = Array.from(allUsersMap.values());
    }

    // Verify follows
    let followVerification = new Map<string, Map<string, boolean>>();
    const mustFollowUsernames = requirements.mustFollow.map(u =>
      TwitterClient.extractUsername(u)
    );

    if (mustFollowUsernames.length > 0) {
      // Get user IDs for accounts to follow
      const targetUsers = await this.client.getUsersByUsernames(mustFollowUsernames);
      const targetUserIds = targetUsers.map(u => u.id);

      onProgress?.({
        stage: 'verifying_follows',
        current: 0,
        total: candidateUsers.length * targetUserIds.length,
        message: `Verifying follows for ${candidateUsers.length} users against ${targetUserIds.length} accounts...`,
      });

      // This is the expensive part - checking follows
      // Rate limit: 15 requests per 15 minutes for /users/:id/following
      // We'll need to be smart about this

      let checked = 0;
      for (const targetUserId of targetUserIds) {
        const targetUsername = targetUsers.find(u => u.id === targetUserId)?.username || targetUserId;

        try {
          const results = await this.client.checkUsersFollowAccount(
            candidateUsers.map(u => u.id),
            targetUserId,
            (current, total) => {
              onProgress?.({
                stage: 'verifying_follows',
                current: checked + current,
                total: candidateUsers.length * targetUserIds.length,
                message: `Checking if users follow @${targetUsername}: ${current}/${total}`,
              });
            }
          );

          followVerification.set(targetUserId, results);
          checked += candidateUsers.length;
        } catch (error) {
          if (error instanceof RateLimitError) {
            throw new Error(
              `Rate limit hit while verifying follows. ` +
              `Reset at ${error.resetAt.toLocaleTimeString()}. ` +
              `Consider verifying fewer accounts or waiting.`
            );
          }
          throw error;
        }
      }
    }

    // Build final results
    const eligible: Participant[] = [];
    const disqualified: { participant: Participant; missingRequirements: string[] }[] = [];

    for (const user of candidateUsers) {
      const participant = twitterUserToParticipant(
        user,
        retweeterIds.has(user.id) ? 'retweet' : 'like'
      );

      const missingRequirements: string[] = [];

      // Check retweet requirement
      if (requirements.requireRetweet && !retweeterIds.has(user.id)) {
        missingRequirements.push('Did not retweet');
      }

      // Check like requirement
      if (requirements.requireLike && !likerIds.has(user.id)) {
        missingRequirements.push('Did not like');
      }

      // Check follow requirements
      for (const targetUserId of followVerification.keys()) {
        const followMap = followVerification.get(targetUserId)!;
        if (!followMap.get(user.id)) {
          const targetUsername = (await this.client.getUsersByUsernames([]))
            .find(u => u.id === targetUserId)?.username || targetUserId;
          missingRequirements.push(`Not following @${targetUsername}`);
        }
      }

      if (missingRequirements.length === 0) {
        eligible.push(participant);
      } else {
        disqualified.push({ participant, missingRequirements });
      }
    }

    onProgress?.({
      stage: 'complete',
      current: 1,
      total: 1,
      message: `Verification complete! ${eligible.length} eligible participants.`,
    });

    // Calculate stats
    const bothRetweetAndLike = retweeters.filter(u => likerIds.has(u.id)).length;

    return {
      eligible,
      retweeters: retweeters.map(u => twitterUserToParticipant(u, 'retweet')),
      likers: likers.map(u => twitterUserToParticipant(u, 'like')),
      disqualified,
      stats: {
        totalRetweeters: retweeters.length,
        totalLikers: likers.length,
        bothRetweetAndLike,
        followsAllAccounts: eligible.length, // Only eligible ones follow all
        eligible: eligible.length,
      },
    };
  }

  /**
   * Quick check - just get retweeters and likers without follow verification
   * Much faster, useful for preview
   */
  async quickFetch(
    tweetUrl: string,
    onProgress?: (progress: VerificationProgress) => void
  ): Promise<{
    retweeters: Participant[];
    likers: Participant[];
    intersection: Participant[];
  }> {
    const tweetId = TwitterClient.extractTweetId(tweetUrl);
    const tweet = await this.client.getTweet(tweetId);

    onProgress?.({
      stage: 'fetching_retweeters',
      current: 0,
      total: tweet.public_metrics.retweet_count,
      message: 'Fetching retweeters...',
    });

    const retweeters = await this.client.getAllRetweeters(tweetId, (count) => {
      onProgress?.({
        stage: 'fetching_retweeters',
        current: count,
        total: tweet.public_metrics.retweet_count,
        message: `Fetched ${count} retweeters...`,
      });
    });

    onProgress?.({
      stage: 'fetching_likers',
      current: 0,
      total: tweet.public_metrics.like_count,
      message: 'Fetching likers...',
    });

    const likers = await this.client.getAllLikers(tweetId, (count) => {
      onProgress?.({
        stage: 'fetching_likers',
        current: count,
        total: tweet.public_metrics.like_count,
        message: `Fetched ${count} likers...`,
      });
    });

    const likerIds = new Set(likers.map(u => u.id));
    const intersection = retweeters.filter(u => likerIds.has(u.id));

    onProgress?.({
      stage: 'complete',
      current: 1,
      total: 1,
      message: 'Fetch complete!',
    });

    return {
      retweeters: retweeters.map(u => twitterUserToParticipant(u, 'retweet')),
      likers: likers.map(u => twitterUserToParticipant(u, 'like')),
      intersection: intersection.map(u => twitterUserToParticipant(u, 'retweet')),
    };
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    return this.client.getRateLimitStatus();
  }
}

/**
 * Estimate API calls needed for a giveaway verification
 */
export function estimateApiCalls(
  retweetCount: number,
  likeCount: number,
  followAccountsCount: number,
  requireRetweet: boolean,
  requireLike: boolean
): {
  retweeterCalls: number;
  likerCalls: number;
  followCalls: number;
  totalCalls: number;
  estimatedTimeMinutes: number;
  warnings: string[];
} {
  const retweeterCalls = requireRetweet ? Math.ceil(retweetCount / 100) : 0;
  const likerCalls = requireLike ? Math.ceil(likeCount / 100) : 0;

  // Follow verification is expensive: 1 call per user per account to follow
  // Rate limit: 15 per 15 minutes
  const candidateCount = Math.min(retweetCount, likeCount); // Rough estimate
  const followCalls = candidateCount * followAccountsCount;

  const totalCalls = retweeterCalls + likerCalls + followCalls;

  // Estimate time based on rate limits
  // Retweeters/Likers: 75 per 15 min = 5 per minute
  // Follows: 15 per 15 min = 1 per minute
  const retweeterTime = retweeterCalls / 5;
  const likerTime = likerCalls / 5;
  const followTime = followCalls / 1; // This is the bottleneck

  const estimatedTimeMinutes = retweeterTime + likerTime + followTime;

  const warnings: string[] = [];

  if (followCalls > 100) {
    warnings.push(
      `Follow verification will take ~${Math.ceil(followTime)} minutes due to rate limits. ` +
      `Consider verifying fewer accounts or sampling participants.`
    );
  }

  if (retweetCount > 10000 || likeCount > 10000) {
    warnings.push(
      'Large engagement counts may hit API limits. Consider running during off-peak hours.'
    );
  }

  return {
    retweeterCalls,
    likerCalls,
    followCalls,
    totalCalls,
    estimatedTimeMinutes,
    warnings,
  };
}
