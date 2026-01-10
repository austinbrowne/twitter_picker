/**
 * Core types for the Twitter Giveaway Picker
 */

/**
 * Represents a Twitter/X participant
 */
export interface Participant {
  /** Twitter username (without @) */
  username: string;
  /** Display name */
  displayName?: string;
  /** User ID (if available) */
  userId?: string;
  /** Profile image URL */
  avatarUrl?: string;
  /** Number of followers */
  followerCount?: number;
  /** Number of accounts following */
  followingCount?: number;
  /** Number of tweets */
  tweetCount?: number;
  /** Account creation date */
  createdAt?: Date;
  /** Bio/description */
  bio?: string;
  /** Whether account is verified */
  isVerified?: boolean;
  /** Entry type (retweet, like, quote, reply) */
  entryType?: EntryType;
  /** Raw data for debugging */
  rawData?: unknown;
}

/**
 * Types of giveaway entries
 */
export type EntryType = 'retweet' | 'like' | 'quote' | 'reply' | 'follower' | 'manual';

/**
 * Filter configuration for bot/fake account detection
 */
export interface FilterConfig {
  /** Minimum follower count required */
  minFollowers: number;
  /** Minimum following count required */
  minFollowing: number;
  /** Minimum account age in days */
  minAccountAgeDays: number;
  /** Require profile picture */
  requireAvatar: boolean;
  /** Require bio/description */
  requireBio: boolean;
  /** Minimum tweet count */
  minTweets: number;
  /** Blacklisted usernames */
  blacklist: string[];
  /** Only include verified accounts */
  onlyVerified: boolean;
  /** Exclude accounts with default profile */
  excludeDefaultProfile: boolean;
}

/**
 * Default filter configuration
 */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  minFollowers: 5,
  minFollowing: 5,
  minAccountAgeDays: 30,
  requireAvatar: true,
  requireBio: false,
  minTweets: 10,
  blacklist: [],
  onlyVerified: false,
  excludeDefaultProfile: true,
};

/**
 * Result of applying filters to participants
 */
export interface FilterResult {
  /** Participants that passed all filters */
  passed: Participant[];
  /** Participants that were filtered out */
  filtered: FilteredParticipant[];
  /** Summary statistics */
  stats: FilterStats;
}

/**
 * A participant that was filtered out with reason
 */
export interface FilteredParticipant {
  participant: Participant;
  reasons: FilterReason[];
}

/**
 * Reasons why a participant was filtered
 */
export type FilterReason =
  | 'low_followers'
  | 'low_following'
  | 'new_account'
  | 'no_avatar'
  | 'no_bio'
  | 'low_tweets'
  | 'blacklisted'
  | 'not_verified'
  | 'default_profile'
  | 'duplicate';

/**
 * Statistics about filtering
 */
export interface FilterStats {
  total: number;
  passed: number;
  filtered: number;
  byReason: Record<FilterReason, number>;
}

/**
 * A completed giveaway draw
 */
export interface Draw {
  /** Unique draw identifier */
  id: string;
  /** When the draw was performed */
  timestamp: Date;
  /** Original tweet URL (if provided) */
  tweetUrl?: string;
  /** All participants (before filtering) */
  allParticipants: Participant[];
  /** Eligible participants (after filtering) */
  eligibleParticipants: Participant[];
  /** Selected winners */
  winners: Participant[];
  /** Number of winners requested */
  winnerCount: number;
  /** Filter configuration used */
  filterConfig: FilterConfig;
  /** Filter statistics */
  filterStats: FilterStats;
  /** SHA-256 hash of participant list for verification */
  participantHash: string;
  /** Random seed used (for reproducibility) */
  randomSeed: string;
  /** Whether alternates were selected */
  alternates?: Participant[];
}

/**
 * Input methods for participant data
 */
export type InputMethod = 'manual' | 'csv' | 'json' | 'har' | 'bookmarklet';

/**
 * Parsed data from various input sources
 */
export interface ParsedInput {
  participants: Participant[];
  source: InputMethod;
  metadata?: {
    tweetUrl?: string;
    tweetId?: string;
    tweetAuthor?: string;
    parsedAt: Date;
  };
  warnings?: string[];
  errors?: string[];
}

/**
 * Application state
 */
export interface AppState {
  /** Current step in the flow */
  step: 'input' | 'filter' | 'draw' | 'results';
  /** Parsed participants */
  participants: Participant[];
  /** Current filter configuration */
  filterConfig: FilterConfig;
  /** Number of winners to select */
  winnerCount: number;
  /** Number of alternates to select */
  alternateCount: number;
  /** Completed draw result */
  draw: Draw | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Tweet URL (if provided) */
  tweetUrl: string;
}

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'json' | 'text';

/**
 * Certificate generation options
 */
export interface CertificateOptions {
  /** Include QR code */
  includeQR: boolean;
  /** Include participant list hash */
  includeHash: boolean;
  /** Custom branding text */
  brandingText?: string;
  /** Background color */
  backgroundColor?: string;
  /** Accent color */
  accentColor?: string;
}
