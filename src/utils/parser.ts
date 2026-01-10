/**
 * Parser utilities for various input formats
 *
 * Supports: Manual text, CSV, JSON, HAR files, Bookmarklet data
 */

import type { Participant, ParsedInput, EntryType } from '@/types';

/**
 * Parse manual text input (usernames, one per line or comma-separated)
 */
export function parseManualInput(text: string): ParsedInput {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Split by newlines, commas, or spaces
  const lines = text
    .split(/[\n,]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const participants: Participant[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Remove @ prefix if present
    let username = line.startsWith('@') ? line.substring(1) : line;

    // Basic username validation (alphanumeric and underscores, 1-15 chars)
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(username)) {
      // Try to extract username from URL
      const urlMatch = username.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})/);
      if (urlMatch) {
        username = urlMatch[1];
      } else {
        warnings.push(`Invalid username format: "${line}"`);
        continue;
      }
    }

    const normalizedUsername = username.toLowerCase();
    if (seen.has(normalizedUsername)) {
      warnings.push(`Duplicate username: @${username}`);
      continue;
    }

    seen.add(normalizedUsername);
    participants.push({
      username,
      entryType: 'manual',
    });
  }

  return {
    participants,
    source: 'manual',
    metadata: { parsedAt: new Date() },
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Parse CSV input
 *
 * Expected columns: username (required), displayName, followerCount, etc.
 */
export function parseCSV(csvText: string): ParsedInput {
  const warnings: string[] = [];
  const errors: string[] = [];

  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return {
      participants: [],
      source: 'csv',
      metadata: { parsedAt: new Date() },
      errors: ['CSV must have a header row and at least one data row'],
    };
  }

  // Parse header
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const usernameIndex = header.findIndex(h =>
    ['username', 'user', 'handle', 'screen_name', 'screenname'].includes(h)
  );

  if (usernameIndex === -1) {
    return {
      participants: [],
      source: 'csv',
      metadata: { parsedAt: new Date() },
      errors: ['CSV must have a "username" column'],
    };
  }

  // Map column indices
  const columns = {
    username: usernameIndex,
    displayName: header.findIndex(h => ['displayname', 'display_name', 'name'].includes(h)),
    followers: header.findIndex(h => ['followers', 'follower_count', 'followercount'].includes(h)),
    following: header.findIndex(h => ['following', 'following_count', 'followingcount'].includes(h)),
    tweets: header.findIndex(h => ['tweets', 'tweet_count', 'tweetcount', 'statuses'].includes(h)),
    createdAt: header.findIndex(h => ['created_at', 'createdat', 'account_created'].includes(h)),
    bio: header.findIndex(h => ['bio', 'description'].includes(h)),
    avatar: header.findIndex(h => ['avatar', 'avatar_url', 'profile_image'].includes(h)),
    verified: header.findIndex(h => ['verified', 'is_verified'].includes(h)),
  };

  const participants: Participant[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const username = values[columns.username]?.trim().replace(/^@/, '');

    if (!username) {
      warnings.push(`Row ${i + 1}: Missing username`);
      continue;
    }

    const normalizedUsername = username.toLowerCase();
    if (seen.has(normalizedUsername)) {
      warnings.push(`Row ${i + 1}: Duplicate username @${username}`);
      continue;
    }

    seen.add(normalizedUsername);

    const participant: Participant = {
      username,
      entryType: 'manual',
    };

    if (columns.displayName >= 0 && values[columns.displayName]) {
      participant.displayName = values[columns.displayName];
    }
    if (columns.followers >= 0 && values[columns.followers]) {
      participant.followerCount = parseInt(values[columns.followers], 10) || undefined;
    }
    if (columns.following >= 0 && values[columns.following]) {
      participant.followingCount = parseInt(values[columns.following], 10) || undefined;
    }
    if (columns.tweets >= 0 && values[columns.tweets]) {
      participant.tweetCount = parseInt(values[columns.tweets], 10) || undefined;
    }
    if (columns.createdAt >= 0 && values[columns.createdAt]) {
      const date = new Date(values[columns.createdAt]);
      if (!isNaN(date.getTime())) {
        participant.createdAt = date;
      }
    }
    if (columns.bio >= 0 && values[columns.bio]) {
      participant.bio = values[columns.bio];
    }
    if (columns.avatar >= 0 && values[columns.avatar]) {
      participant.avatarUrl = values[columns.avatar];
    }
    if (columns.verified >= 0 && values[columns.verified]) {
      participant.isVerified = ['true', 'yes', '1'].includes(values[columns.verified].toLowerCase());
    }

    participants.push(participant);
  }

  return {
    participants,
    source: 'csv',
    metadata: { parsedAt: new Date() },
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Parse JSON input
 *
 * Supports array of objects with username field, or Twitter API response format
 */
export function parseJSON(jsonText: string): ParsedInput {
  const warnings: string[] = [];
  const errors: string[] = [];

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return {
      participants: [],
      source: 'json',
      metadata: { parsedAt: new Date() },
      errors: ['Invalid JSON format'],
    };
  }

  const participants: Participant[] = [];
  const seen = new Set<string>();

  // Handle different JSON structures
  let users: unknown[] = [];

  if (Array.isArray(data)) {
    users = data;
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // Twitter API v2 format
    if (Array.isArray(obj.data)) {
      users = obj.data;
    } else if (Array.isArray(obj.users)) {
      users = obj.users;
    } else if (Array.isArray(obj.participants)) {
      users = obj.participants;
    }
  }

  for (const user of users) {
    if (typeof user !== 'object' || user === null) {
      warnings.push('Skipped non-object entry');
      continue;
    }

    const userObj = user as Record<string, unknown>;
    const username = extractUsername(userObj);

    if (!username) {
      warnings.push('Entry missing username field');
      continue;
    }

    const normalizedUsername = username.toLowerCase();
    if (seen.has(normalizedUsername)) {
      warnings.push(`Duplicate username: @${username}`);
      continue;
    }

    seen.add(normalizedUsername);

    const participant: Participant = {
      username,
      displayName: extractString(userObj, ['name', 'displayName', 'display_name']),
      userId: extractString(userObj, ['id', 'userId', 'user_id', 'id_str']),
      avatarUrl: extractString(userObj, ['profile_image_url', 'avatar', 'avatarUrl', 'profile_image_url_https']),
      followerCount: extractNumber(userObj, ['followers_count', 'followerCount', 'followers']),
      followingCount: extractNumber(userObj, ['following_count', 'followingCount', 'friends_count', 'following']),
      tweetCount: extractNumber(userObj, ['statuses_count', 'tweetCount', 'tweets']),
      bio: extractString(userObj, ['description', 'bio']),
      isVerified: extractBoolean(userObj, ['verified', 'is_verified', 'isVerified']),
      entryType: extractEntryType(userObj),
      rawData: user,
    };

    // Handle created_at
    const createdAtStr = extractString(userObj, ['created_at', 'createdAt']);
    if (createdAtStr) {
      const date = new Date(createdAtStr);
      if (!isNaN(date.getTime())) {
        participant.createdAt = date;
      }
    }

    participants.push(participant);
  }

  return {
    participants,
    source: 'json',
    metadata: { parsedAt: new Date() },
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Parse HAR (HTTP Archive) file to extract Twitter data
 *
 * Users can record their browser's network traffic while viewing
 * retweets/likes page, export as HAR, and we parse the responses.
 */
export function parseHAR(harText: string): ParsedInput {
  const warnings: string[] = [];
  const errors: string[] = [];

  let har: { log?: { entries?: unknown[] } };
  try {
    har = JSON.parse(harText);
  } catch {
    return {
      participants: [],
      source: 'har',
      metadata: { parsedAt: new Date() },
      errors: ['Invalid HAR file format'],
    };
  }

  if (!har.log?.entries || !Array.isArray(har.log.entries)) {
    return {
      participants: [],
      source: 'har',
      metadata: { parsedAt: new Date() },
      errors: ['HAR file has no entries'],
    };
  }

  const allParticipants: Participant[] = [];
  const seen = new Set<string>();
  let tweetUrl: string | undefined;
  let entryType: EntryType = 'manual';

  for (const entry of har.log.entries) {
    const entryObj = entry as Record<string, unknown>;
    const request = entryObj.request as Record<string, unknown> | undefined;
    const response = entryObj.response as Record<string, unknown> | undefined;

    if (!request || !response) continue;

    const url = request.url as string;
    if (!url?.includes('twitter.com') && !url?.includes('x.com')) continue;

    // Detect entry type from URL
    if (url.includes('Retweeters') || url.includes('retweeted_by')) {
      entryType = 'retweet';
    } else if (url.includes('Likers') || url.includes('liking_users')) {
      entryType = 'like';
    } else if (url.includes('TweetDetail')) {
      // Extract tweet URL
      const tweetIdMatch = url.match(/focalTweetId[=:](\d+)/);
      if (tweetIdMatch) {
        tweetUrl = `https://twitter.com/i/status/${tweetIdMatch[1]}`;
      }
    }

    // Try to extract response content
    const content = response.content as Record<string, unknown> | undefined;
    const text = content?.text as string;
    if (!text) continue;

    try {
      const responseData = JSON.parse(text);
      const users = extractUsersFromTwitterResponse(responseData);

      for (const user of users) {
        if (seen.has(user.username.toLowerCase())) continue;
        seen.add(user.username.toLowerCase());
        allParticipants.push({ ...user, entryType });
      }
    } catch {
      // Response wasn't JSON, skip
    }
  }

  if (allParticipants.length === 0) {
    warnings.push('No Twitter user data found in HAR file. Make sure to record while viewing the Retweets or Likes tab.');
  }

  return {
    participants: allParticipants,
    source: 'har',
    metadata: {
      parsedAt: new Date(),
      tweetUrl,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Parse bookmarklet data (JSON string from clipboard)
 */
export function parseBookmarkletData(data: string): ParsedInput {
  try {
    const parsed = JSON.parse(data);

    if (parsed.source !== 'twitter-picker-bookmarklet') {
      return parseJSON(data);
    }

    const participants: Participant[] = (parsed.users || []).map((user: Record<string, unknown>) => ({
      username: user.username || user.screen_name,
      displayName: user.name,
      avatarUrl: user.profile_image_url,
      followerCount: user.followers_count,
      followingCount: user.following_count,
      tweetCount: user.statuses_count,
      bio: user.description,
      isVerified: user.verified,
      entryType: parsed.type || 'manual',
    }));

    return {
      participants,
      source: 'bookmarklet',
      metadata: {
        parsedAt: new Date(),
        tweetUrl: parsed.tweetUrl,
        tweetId: parsed.tweetId,
      },
    };
  } catch {
    return {
      participants: [],
      source: 'bookmarklet',
      metadata: { parsedAt: new Date() },
      errors: ['Invalid bookmarklet data'],
    };
  }
}

/**
 * Auto-detect input format and parse accordingly
 */
export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();

  // Detect JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    // Check if it's a HAR file
    if (trimmed.includes('"log"') && trimmed.includes('"entries"')) {
      return parseHAR(trimmed);
    }
    // Check if it's bookmarklet data
    if (trimmed.includes('"source":"twitter-picker-bookmarklet"')) {
      return parseBookmarkletData(trimmed);
    }
    return parseJSON(trimmed);
  }

  // Detect CSV (has header row with commas)
  const firstLine = trimmed.split('\n')[0];
  if (firstLine.includes(',') && /username|user|handle/i.test(firstLine)) {
    return parseCSV(trimmed);
  }

  // Default to manual input
  return parseManualInput(trimmed);
}

// Helper functions

function extractUsername(obj: Record<string, unknown>): string | undefined {
  const fields = ['username', 'screen_name', 'screenName', 'handle', 'user'];
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'string' && value.length > 0) {
      return value.replace(/^@/, '');
    }
  }
  return undefined;
}

function extractString(obj: Record<string, unknown>, fields: string[]): string | undefined {
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function extractNumber(obj: Record<string, unknown>, fields: string[]): number | undefined {
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function extractBoolean(obj: Record<string, unknown>, fields: string[]): boolean | undefined {
  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return ['true', 'yes', '1'].includes(value.toLowerCase());
    }
  }
  return undefined;
}

function extractEntryType(obj: Record<string, unknown>): EntryType {
  const type = extractString(obj, ['entryType', 'entry_type', 'type']);
  if (type && ['retweet', 'like', 'quote', 'reply', 'follower'].includes(type)) {
    return type as EntryType;
  }
  return 'manual';
}

function extractUsersFromTwitterResponse(data: unknown): Participant[] {
  const users: Participant[] = [];

  if (typeof data !== 'object' || data === null) return users;

  const traverse = (obj: unknown): void => {
    if (typeof obj !== 'object' || obj === null) return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        traverse(item);
      }
      return;
    }

    const record = obj as Record<string, unknown>;

    // Check if this is a user object
    if (record.__typename === 'User' || (record.screen_name && record.id_str)) {
      const legacy = (record.legacy || record) as Record<string, unknown>;
      const username = (legacy.screen_name || record.screen_name) as string;

      if (username) {
        users.push({
          username,
          displayName: legacy.name as string,
          userId: (record.rest_id || record.id_str) as string,
          avatarUrl: legacy.profile_image_url_https as string,
          followerCount: legacy.followers_count as number,
          followingCount: legacy.friends_count as number,
          tweetCount: legacy.statuses_count as number,
          bio: legacy.description as string,
          isVerified: (legacy.verified || record.is_blue_verified) as boolean,
          createdAt: legacy.created_at ? new Date(legacy.created_at as string) : undefined,
        });
      }
    }

    // Recursively check all properties
    for (const key of Object.keys(record)) {
      traverse(record[key]);
    }
  };

  traverse(data);
  return users;
}
