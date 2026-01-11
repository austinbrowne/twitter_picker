/**
 * Twitter API v2 Client
 *
 * Handles authentication and API calls to Twitter/X
 * Requires at minimum Basic tier ($100/month) for read access
 */

import type { Participant } from '@/types';

export interface TwitterConfig {
  bearerToken: string;
}

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
  created_at?: string;
  verified?: boolean;
}

export interface TwitterApiError {
  title: string;
  detail: string;
  type: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    result_count: number;
    next_token?: string;
    previous_token?: string;
  };
}

const TWITTER_API_BASE = 'https://api.twitter.com/2';

const USER_FIELDS = 'id,username,name,profile_image_url,description,public_metrics,created_at,verified';

/**
 * Twitter API v2 Client
 */
export class TwitterClient {
  private bearerToken: string;
  private rateLimitRemaining: number = 75;
  private rateLimitReset: Date = new Date();

  constructor(config: TwitterConfig) {
    this.bearerToken = config.bearerToken;
  }

  /**
   * Make an authenticated request to the Twitter API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Check rate limit
    if (this.rateLimitRemaining <= 0 && new Date() < this.rateLimitReset) {
      const waitMs = this.rateLimitReset.getTime() - Date.now();
      throw new RateLimitError(
        `Rate limit exceeded. Resets in ${Math.ceil(waitMs / 1000)} seconds`,
        this.rateLimitReset
      );
    }

    const url = `${TWITTER_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Update rate limit info from headers
    const remaining = response.headers.get('x-rate-limit-remaining');
    const reset = response.headers.get('x-rate-limit-reset');

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitReset = new Date(parseInt(reset, 10) * 1000);
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new RateLimitError(
          'Rate limit exceeded',
          this.rateLimitReset
        );
      }

      const error = await response.json() as { errors?: TwitterApiError[] };
      throw new TwitterApiRequestError(
        error.errors?.[0]?.detail || `API error: ${response.status}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Extract tweet ID from URL
   */
  static extractTweetId(urlOrId: string): string {
    // Already an ID
    if (/^\d+$/.test(urlOrId)) {
      return urlOrId;
    }

    // Extract from URL
    const match = urlOrId.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (match) {
      return match[1];
    }

    throw new Error('Invalid tweet URL or ID');
  }

  /**
   * Extract username from URL or handle
   */
  static extractUsername(input: string): string {
    // Remove @ prefix
    if (input.startsWith('@')) {
      return input.substring(1);
    }

    // Extract from URL
    const match = input.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
    if (match) {
      return match[1];
    }

    // Assume it's already a username
    return input;
  }

  /**
   * Get tweet details
   */
  async getTweet(tweetId: string): Promise<{
    id: string;
    text: string;
    author_id: string;
    public_metrics: {
      retweet_count: number;
      like_count: number;
      reply_count: number;
      quote_count: number;
    };
  }> {
    const response = await this.request<{ data: any }>(
      `/tweets/${tweetId}?tweet.fields=public_metrics,author_id`
    );
    return response.data;
  }

  /**
   * Get users who retweeted a tweet
   * Rate limit: 75 requests per 15 minutes
   * Max 100 users per request
   */
  async getRetweeters(
    tweetId: string,
    options: { maxResults?: number; paginationToken?: string } = {}
  ): Promise<PaginatedResponse<TwitterUser>> {
    const params = new URLSearchParams({
      'user.fields': USER_FIELDS,
      'max_results': String(options.maxResults || 100),
    });

    if (options.paginationToken) {
      params.set('pagination_token', options.paginationToken);
    }

    return this.request<PaginatedResponse<TwitterUser>>(
      `/tweets/${tweetId}/retweeted_by?${params}`
    );
  }

  /**
   * Get all retweeters with pagination
   */
  async getAllRetweeters(
    tweetId: string,
    onProgress?: (count: number) => void
  ): Promise<TwitterUser[]> {
    const allUsers: TwitterUser[] = [];
    let paginationToken: string | undefined;

    do {
      const response = await this.getRetweeters(tweetId, { paginationToken });

      if (response.data) {
        allUsers.push(...response.data);
        onProgress?.(allUsers.length);
      }

      paginationToken = response.meta?.next_token;

      // Small delay to be nice to rate limits
      if (paginationToken) {
        await sleep(100);
      }
    } while (paginationToken);

    return allUsers;
  }

  /**
   * Get users who liked a tweet
   * Rate limit: 75 requests per 15 minutes
   * Max 100 users per request
   */
  async getLikers(
    tweetId: string,
    options: { maxResults?: number; paginationToken?: string } = {}
  ): Promise<PaginatedResponse<TwitterUser>> {
    const params = new URLSearchParams({
      'user.fields': USER_FIELDS,
      'max_results': String(options.maxResults || 100),
    });

    if (options.paginationToken) {
      params.set('pagination_token', options.paginationToken);
    }

    return this.request<PaginatedResponse<TwitterUser>>(
      `/tweets/${tweetId}/liking_users?${params}`
    );
  }

  /**
   * Get all likers with pagination
   */
  async getAllLikers(
    tweetId: string,
    onProgress?: (count: number) => void
  ): Promise<TwitterUser[]> {
    const allUsers: TwitterUser[] = [];
    let paginationToken: string | undefined;

    do {
      const response = await this.getLikers(tweetId, { paginationToken });

      if (response.data) {
        allUsers.push(...response.data);
        onProgress?.(allUsers.length);
      }

      paginationToken = response.meta?.next_token;

      if (paginationToken) {
        await sleep(100);
      }
    } while (paginationToken);

    return allUsers;
  }

  /**
   * Get a user by username
   */
  async getUserByUsername(username: string): Promise<TwitterUser> {
    const response = await this.request<{ data: TwitterUser }>(
      `/users/by/username/${username}?user.fields=${USER_FIELDS}`
    );
    return response.data;
  }

  /**
   * Get multiple users by username
   */
  async getUsersByUsernames(usernames: string[]): Promise<TwitterUser[]> {
    if (usernames.length === 0) return [];

    // API limit: 100 usernames per request
    const chunks = chunkArray(usernames, 100);
    const allUsers: TwitterUser[] = [];

    for (const chunk of chunks) {
      const response = await this.request<{ data: TwitterUser[] }>(
        `/users/by?usernames=${chunk.join(',')}&user.fields=${USER_FIELDS}`
      );
      if (response.data) {
        allUsers.push(...response.data);
      }
      await sleep(100);
    }

    return allUsers;
  }

  /**
   * Get followers of a user
   * Rate limit: 15 requests per 15 minutes (very limited!)
   */
  async getFollowers(
    userId: string,
    options: { maxResults?: number; paginationToken?: string } = {}
  ): Promise<PaginatedResponse<TwitterUser>> {
    const params = new URLSearchParams({
      'user.fields': USER_FIELDS,
      'max_results': String(options.maxResults || 1000),
    });

    if (options.paginationToken) {
      params.set('pagination_token', options.paginationToken);
    }

    return this.request<PaginatedResponse<TwitterUser>>(
      `/users/${userId}/followers?${params}`
    );
  }

  /**
   * Check if users follow a specific account
   * This is expensive - we fetch followers and check membership
   *
   * For large accounts, this is impractical. Consider using
   * the "following" endpoint instead (check if target follows user)
   */
  async checkUsersFollowAccount(
    userIds: string[],
    targetUserId: string,
    onProgress?: (checked: number, total: number) => void
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // For each user, check if they follow the target
    // Using the "following" endpoint: GET /users/:id/following
    // Rate limit: 15 requests per 15 minutes - very limited!

    let checked = 0;
    for (const userId of userIds) {
      try {
        const isFollowing = await this.checkUserFollowsTarget(userId, targetUserId);
        results.set(userId, isFollowing);
      } catch (error) {
        if (error instanceof RateLimitError) {
          throw error; // Re-throw rate limit errors
        }
        // Assume not following on other errors
        results.set(userId, false);
      }

      checked++;
      onProgress?.(checked, userIds.length);

      // Respect rate limits
      await sleep(1000); // 1 second between requests
    }

    return results;
  }

  /**
   * Check if a single user follows a target account
   */
  private async checkUserFollowsTarget(userId: string, targetUserId: string): Promise<boolean> {
    // Get the user's following list and check if target is in it
    // This is limited to 1000 results, so for users following many accounts,
    // this might not work perfectly

    const params = new URLSearchParams({
      'max_results': '1000',
    });

    try {
      const response = await this.request<PaginatedResponse<{ id: string }>>(
        `/users/${userId}/following?${params}`
      );

      return response.data?.some(user => user.id === targetUserId) || false;
    } catch {
      return false;
    }
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { remaining: number; resetAt: Date } {
    return {
      remaining: this.rateLimitRemaining,
      resetAt: this.rateLimitReset,
    };
  }
}

/**
 * Convert Twitter API user to our Participant type
 */
export function twitterUserToParticipant(user: TwitterUser, entryType: 'retweet' | 'like'): Participant {
  return {
    username: user.username,
    displayName: user.name,
    userId: user.id,
    avatarUrl: user.profile_image_url,
    bio: user.description,
    followerCount: user.public_metrics?.followers_count,
    followingCount: user.public_metrics?.following_count,
    tweetCount: user.public_metrics?.tweet_count,
    createdAt: user.created_at ? new Date(user.created_at) : undefined,
    isVerified: user.verified,
    entryType,
  };
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  resetAt: Date;

  constructor(message: string, resetAt: Date) {
    super(message);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

/**
 * Twitter API request error
 */
export class TwitterApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TwitterApiRequestError';
    this.status = status;
  }
}

// Utility functions

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
