/**
 * Background service worker
 * Manages state and coordinates between popup and content scripts
 *
 * Security: Validates all message inputs
 * State: Persists to chrome.storage to survive service worker restarts
 */

// Global state - will be restored from storage
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

// Collection queue managed by background script
let collectionQueue = [];

// Restore state from storage on service worker start
chrome.storage.local.get(['giveawayData', 'collectionQueue'], (result) => {
  if (result.giveawayData) {
    giveawayData = result.giveawayData;
  }
  if (result.collectionQueue) {
    collectionQueue = result.collectionQueue;
  }
});

// Save state to storage (debounced)
let saveTimeout = null;
let lastSaveError = null;
function saveToStorage() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await chrome.storage.local.set({ giveawayData });
      lastSaveError = null;
    } catch (e) {
      if (lastSaveError !== e.message) {
        lastSaveError = e.message;
        console.error('[Background] Storage save failed:', e.message);
      }
    }
  }, 500);
}

// Save collection queue to storage
function saveQueue() {
  chrome.storage.local.set({ collectionQueue }).catch(() => {});
}

// Process next item in collection queue
async function processNextInQueue() {
  if (collectionQueue.length === 0) {
    // Broadcast completion to popup
    chrome.runtime.sendMessage({ type: 'QUEUE_COMPLETE' }).catch(() => {});
    return;
  }

  const next = collectionQueue.shift();
  saveQueue();

  try {
    // Find the Twitter tab
    const tabs = await chrome.tabs.query({ url: ['*://twitter.com/*', '*://x.com/*'] });
    if (tabs.length === 0) {
      return;
    }

    const tab = tabs[0];

    // Send message to content script to start collection
    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_COLLECT',
      collectType: next.type,
      tweetId: next.tweetId,
      accountUsername: next.account
    });
  } catch (e) {
    // Try again with next item
    processNextInQueue();
  }
}

// Input validation helpers
function isValidString(val) {
  return typeof val === 'string' && val.length < 1000;
}

function isValidUsername(val) {
  return typeof val === 'string' && /^[a-zA-Z0-9_]{1,15}$/.test(val);
}

function isValidTweetId(val) {
  return typeof val === 'string' && /^\d{1,25}$/.test(val);
}

function isValidUrl(val) {
  if (typeof val !== 'string') return false;
  try {
    const url = new URL(val);
    return url.protocol === 'https:' &&
           (url.hostname === 'twitter.com' || url.hostname === 'x.com');
  } catch {
    return false;
  }
}

function isValidUserArray(val) {
  if (!Array.isArray(val)) return false;
  if (val.length > 50000) return false; // Reasonable limit
  return val.every(u => u && typeof u === 'object' && isValidUsername(u.username));
}

function isValidNumber(val) {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate message structure
  if (!message || typeof message.type !== 'string') {
    sendResponse({ success: false, error: 'Invalid message' });
    return true;
  }

  try {
    switch (message.type) {
      case 'GET_STATE':
        sendResponse(giveawayData);
        break;

      case 'SET_TWEET':
        if (!isValidTweetId(message.tweetId)) {
          sendResponse({ success: false, error: 'Invalid tweet ID' });
          break;
        }
        if (message.tweetUrl && !isValidUrl(message.tweetUrl)) {
          sendResponse({ success: false, error: 'Invalid tweet URL' });
          break;
        }
        giveawayData.tweetId = message.tweetId;
        giveawayData.tweetUrl = message.tweetUrl || null;
        saveToStorage();
        sendResponse({ success: true });
        break;

      case 'SET_REQUIREMENTS':
        if (!message.requirements || typeof message.requirements !== 'object') {
          sendResponse({ success: false, error: 'Invalid requirements' });
          break;
        }
        const req = message.requirements;
        giveawayData.requirements = {
          mustRetweet: Boolean(req.mustRetweet),
          mustLike: Boolean(req.mustLike),
          mustFollow: Array.isArray(req.mustFollow)
            ? req.mustFollow.filter(isValidUsername).map(u => u.toLowerCase())
            : []
        };
        saveToStorage();
        sendResponse({ success: true });
        break;

      case 'UPDATE_RETWEETERS':
        if (!isValidUserArray(message.users)) {
          sendResponse({ success: false, error: 'Invalid users array' });
          break;
        }
        giveawayData.retweeters = message.users;
        giveawayData.collectionStatus.retweeters = 'complete';
        saveToStorage();
        sendResponse({ success: true });
        break;

      case 'UPDATE_LIKERS':
        if (!isValidUserArray(message.users)) {
          sendResponse({ success: false, error: 'Invalid users array' });
          break;
        }
        giveawayData.likers = message.users;
        giveawayData.collectionStatus.likers = 'complete';
        saveToStorage();
        sendResponse({ success: true });
        break;

      case 'UPDATE_FOLLOWERS':
        if (!isValidUsername(message.account)) {
          sendResponse({ success: false, error: 'Invalid account' });
          break;
        }
        if (!isValidUserArray(message.users)) {
          sendResponse({ success: false, error: 'Invalid users array' });
          break;
        }
        const accountKey = message.account.toLowerCase();
        giveawayData.followers[accountKey] = message.users;
        giveawayData.collectionStatus.followers[accountKey] = 'complete';
        saveToStorage();
        sendResponse({ success: true });
        break;

      case 'COLLECTION_PROGRESS':
        if (message.collectType === 'retweeters') {
          giveawayData.collectionStatus.retweeters = 'collecting';
        } else if (message.collectType === 'likers') {
          giveawayData.collectionStatus.likers = 'collecting';
        } else if (message.collectType === 'followers' && isValidUsername(message.account)) {
          giveawayData.collectionStatus.followers[message.account.toLowerCase()] = 'collecting';
        }
        // Broadcast to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        break;

      case 'COLLECTION_COMPLETE':
        if (message.collectType === 'retweeters') {
          giveawayData.collectionStatus.retweeters = 'complete';
        } else if (message.collectType === 'likers') {
          giveawayData.collectionStatus.likers = 'complete';
        } else if (message.collectType === 'followers' && isValidUsername(message.account)) {
          giveawayData.collectionStatus.followers[message.account.toLowerCase()] = 'complete';
        }
        saveToStorage();
        // Broadcast to popup
        chrome.runtime.sendMessage(message).catch(() => {});
        // Process next item in queue after a short delay
        setTimeout(() => processNextInQueue(), 1000);
        break;

      case 'START_QUEUE':
        // Set up collection queue from popup
        if (Array.isArray(message.queue)) {
          collectionQueue = message.queue.filter(item =>
            item && item.type && item.tweetId &&
            ['retweeters', 'likers', 'followers'].includes(item.type)
          );
          saveQueue();
          // Start processing
          processNextInQueue();
          sendResponse({ success: true, queueLength: collectionQueue.length });
        } else {
          sendResponse({ success: false, error: 'Invalid queue' });
        }
        break;

      case 'GET_QUEUE':
        sendResponse({ queue: collectionQueue });
        break;

      case 'CLEAR_QUEUE':
        collectionQueue = [];
        saveQueue();
        sendResponse({ success: true });
        break;

      case 'CALCULATE_ELIGIBLE':
        giveawayData.eligible = calculateEligible();
        saveToStorage();
        sendResponse({ eligible: giveawayData.eligible });
        break;

      case 'PICK_WINNERS':
        const count = isValidNumber(message.count) ? Math.min(message.count, 1000) : 1;
        const filters = message.filters && typeof message.filters === 'object' ? message.filters : {};
        const winners = pickWinners(count, filters);
        giveawayData.winners = winners;
        saveToStorage();
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
        // Clear both background and content script storage
        chrome.storage.local.remove(['giveawayData', 'collectedData', 'pendingCollection']).catch(() => {});
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
  return true;
});

// Calculate eligible participants based on requirements
function calculateEligible() {
  const req = giveawayData.requirements;

  // If a requirement is set but list is empty, no one can be eligible
  if (req.mustRetweet && giveawayData.retweeters.length === 0) {
    return [];
  }
  if (req.mustLike && giveawayData.likers.length === 0) {
    return [];
  }

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

  // Apply filters - FIXED: require value to be defined AND meet threshold
  // When a filter is set, users without the data are excluded
  if (filters.minFollowers > 0) {
    candidates = candidates.filter(u =>
      typeof u.followerCount === 'number' && u.followerCount >= filters.minFollowers
    );
  }

  if (filters.minTweets > 0) {
    candidates = candidates.filter(u =>
      typeof u.tweetCount === 'number' && u.tweetCount >= filters.minTweets
    );
  }

  if (filters.minAccountAgeDays > 0) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - filters.minAccountAgeDays);
    candidates = candidates.filter(u => {
      if (!u.createdAt || typeof u.createdAt !== 'string') return false;
      try {
        return new Date(u.createdAt) <= minDate;
      } catch {
        return false;
      }
    });
  }

  if (filters.requireAvatar) {
    candidates = candidates.filter(u =>
      u.avatarUrl && typeof u.avatarUrl === 'string' && !u.avatarUrl.includes('default_profile')
    );
  }

  if (filters.blacklist && Array.isArray(filters.blacklist) && filters.blacklist.length > 0) {
    const blacklistSet = new Set(
      filters.blacklist.filter(isValidUsername).map(u => u.toLowerCase())
    );
    candidates = candidates.filter(u => !blacklistSet.has(u.username.toLowerCase()));
  }

  // Cryptographic random shuffle with rejection sampling to avoid modulo bias
  const shuffled = cryptoShuffle(candidates);

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Generate unbiased random integer using rejection sampling
function secureRandomInt(max) {
  if (max <= 0) return 0;

  // Calculate the largest multiple of max that fits in 32 bits
  const limit = Math.floor(0x100000000 / max) * max;

  let value;
  const arr = new Uint32Array(1);
  do {
    crypto.getRandomValues(arr);
    value = arr[0];
  } while (value >= limit);

  return value % max;
}

// Fisher-Yates shuffle using unbiased crypto random
function cryptoShuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
