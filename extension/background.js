/**
 * Background service worker
 * Manages state and coordinates between popup and content scripts
 */

// Global state
let giveawayData = {
  tweetId: null,
  tweetUrl: null,
  retweeters: [],
  likers: [],
  followers: {}, // accountUsername -> user[]
  requirements: {
    mustRetweet: true,
    mustLike: true,
    mustFollow: [] // array of account usernames
  },
  eligible: [],
  winners: [],
  collectionStatus: {
    retweeters: 'idle',
    likers: 'idle',
    followers: {} // accountUsername -> status
  }
};

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE':
      sendResponse(giveawayData);
      break;

    case 'SET_TWEET':
      giveawayData.tweetId = message.tweetId;
      giveawayData.tweetUrl = message.tweetUrl;
      sendResponse({ success: true });
      break;

    case 'SET_REQUIREMENTS':
      giveawayData.requirements = message.requirements;
      sendResponse({ success: true });
      break;

    case 'UPDATE_RETWEETERS':
      giveawayData.retweeters = message.users;
      giveawayData.collectionStatus.retweeters = 'complete';
      sendResponse({ success: true });
      break;

    case 'UPDATE_LIKERS':
      giveawayData.likers = message.users;
      giveawayData.collectionStatus.likers = 'complete';
      sendResponse({ success: true });
      break;

    case 'UPDATE_FOLLOWERS':
      giveawayData.followers[message.account] = message.users;
      giveawayData.collectionStatus.followers[message.account] = 'complete';
      sendResponse({ success: true });
      break;

    case 'COLLECTION_PROGRESS':
      if (message.collectType === 'retweeters') {
        giveawayData.collectionStatus.retweeters = 'collecting';
      } else if (message.collectType === 'likers') {
        giveawayData.collectionStatus.likers = 'collecting';
      } else if (message.collectType === 'followers' && message.account) {
        giveawayData.collectionStatus.followers[message.account] = 'collecting';
      }
      // Broadcast to popup
      chrome.runtime.sendMessage(message).catch(() => {});
      break;

    case 'COLLECTION_COMPLETE':
      if (message.collectType === 'retweeters') {
        giveawayData.collectionStatus.retweeters = 'complete';
      } else if (message.collectType === 'likers') {
        giveawayData.collectionStatus.likers = 'complete';
      } else if (message.collectType === 'followers' && message.account) {
        giveawayData.collectionStatus.followers[message.account] = 'complete';
      }
      // Broadcast to popup
      chrome.runtime.sendMessage(message).catch(() => {});
      break;

    case 'CALCULATE_ELIGIBLE':
      giveawayData.eligible = calculateEligible();
      sendResponse({ eligible: giveawayData.eligible });
      break;

    case 'PICK_WINNERS':
      const winners = pickWinners(message.count, message.filters);
      giveawayData.winners = winners;
      sendResponse({ winners });
      break;

    case 'RESET':
      giveawayData = {
        tweetId: null,
        tweetUrl: null,
        retweeters: [],
        likers: [],
        followers: {},
        requirements: {
          mustRetweet: true,
          mustLike: true,
          mustFollow: []
        },
        eligible: [],
        winners: [],
        collectionStatus: {
          retweeters: 'idle',
          likers: 'idle',
          followers: {}
        }
      };
      sendResponse({ success: true });
      break;
  }
  return true;
});

// Calculate eligible participants based on requirements
function calculateEligible() {
  const req = giveawayData.requirements;

  // Start with all users from first required source
  let eligibleSet = null;

  // Get retweeters set
  if (req.mustRetweet) {
    const retweeterUsernames = new Set(
      giveawayData.retweeters.map(u => u.username.toLowerCase())
    );
    eligibleSet = eligibleSet
      ? new Set([...eligibleSet].filter(u => retweeterUsernames.has(u)))
      : retweeterUsernames;
  }

  // Intersect with likers
  if (req.mustLike) {
    const likerUsernames = new Set(
      giveawayData.likers.map(u => u.username.toLowerCase())
    );
    eligibleSet = eligibleSet
      ? new Set([...eligibleSet].filter(u => likerUsernames.has(u)))
      : likerUsernames;
  }

  // Intersect with followers of each required account
  for (const account of req.mustFollow) {
    const followers = giveawayData.followers[account.toLowerCase()] || [];
    const followerUsernames = new Set(
      followers.map(u => u.username.toLowerCase())
    );
    eligibleSet = eligibleSet
      ? new Set([...eligibleSet].filter(u => followerUsernames.has(u)))
      : followerUsernames;
  }

  if (!eligibleSet) return [];

  // Build user objects for eligible users (prefer data from retweeters as most complete)
  const userDataMap = new Map();

  // Add all user data sources, later ones override
  [...giveawayData.likers, ...giveawayData.retweeters].forEach(u => {
    userDataMap.set(u.username.toLowerCase(), u);
  });

  Object.values(giveawayData.followers).flat().forEach(u => {
    const existing = userDataMap.get(u.username.toLowerCase());
    if (!existing || !existing.followerCount) {
      userDataMap.set(u.username.toLowerCase(), u);
    }
  });

  return Array.from(eligibleSet)
    .map(username => userDataMap.get(username))
    .filter(Boolean);
}

// Apply filters and pick random winners
function pickWinners(count, filters = {}) {
  let candidates = [...giveawayData.eligible];

  // Apply filters
  if (filters.minFollowers) {
    candidates = candidates.filter(u =>
      u.followerCount === undefined || u.followerCount >= filters.minFollowers
    );
  }

  if (filters.minTweets) {
    candidates = candidates.filter(u =>
      u.tweetCount === undefined || u.tweetCount >= filters.minTweets
    );
  }

  if (filters.minAccountAgeDays) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - filters.minAccountAgeDays);
    candidates = candidates.filter(u => {
      if (!u.createdAt) return true;
      return new Date(u.createdAt) <= minDate;
    });
  }

  if (filters.requireAvatar) {
    candidates = candidates.filter(u =>
      u.avatarUrl && !u.avatarUrl.includes('default_profile')
    );
  }

  if (filters.blacklist && filters.blacklist.length > 0) {
    const blacklistSet = new Set(filters.blacklist.map(u => u.toLowerCase()));
    candidates = candidates.filter(u => !blacklistSet.has(u.username.toLowerCase()));
  }

  // Cryptographic random shuffle
  const shuffled = cryptoShuffle(candidates);

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Fisher-Yates shuffle using crypto random
function cryptoShuffle(array) {
  const result = [...array];
  const randomValues = new Uint32Array(result.length);
  crypto.getRandomValues(randomValues);

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
