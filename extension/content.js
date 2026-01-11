/**
 * Content script - runs on Twitter/X pages
 * Intercepts API responses and collects user data
 *
 * Security: Uses specific origin for postMessage, validates sources
 * State: Persists data to chrome.storage to survive navigation
 */

(function() {
  'use strict';

  // Unique message key to prevent spoofing
  const MESSAGE_KEY = 'TWITTER_PICKER_' + Math.random().toString(36).slice(2);

  // Store collected data
  const collectedData = {
    retweeters: new Map(),
    likers: new Map(),
    followers: new Map(),
    currentTweetId: null,
    isCollecting: false,
    collectType: null,
    currentFollowAccount: null,
    collectionMutex: false
  };

  // Restore data from storage on load
  chrome.storage.local.get(['collectedData'], (result) => {
    if (result.collectedData) {
      const saved = result.collectedData;
      if (saved.retweeters) {
        saved.retweeters.forEach(u => collectedData.retweeters.set(u.username.toLowerCase(), u));
      }
      if (saved.likers) {
        saved.likers.forEach(u => collectedData.likers.set(u.username.toLowerCase(), u));
      }
      if (saved.followers) {
        Object.entries(saved.followers).forEach(([account, users]) => {
          const map = new Map();
          users.forEach(u => map.set(u.username.toLowerCase(), u));
          collectedData.followers.set(account, map);
        });
      }
      if (saved.currentTweetId) {
        collectedData.currentTweetId = saved.currentTweetId;
      }
    }
  });

  // Save data to storage (debounced)
  let saveTimeout = null;
  function saveToStorage() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const dataToSave = {
        retweeters: Array.from(collectedData.retweeters.values()),
        likers: Array.from(collectedData.likers.values()),
        followers: Object.fromEntries(
          Array.from(collectedData.followers.entries()).map(([k, v]) => [k, Array.from(v.values())])
        ),
        currentTweetId: collectedData.currentTweetId
      };
      chrome.storage.local.set({ collectedData: dataToSave }).catch(() => {});
    }, 500);
  }

  // Inject script to intercept fetch/XHR
  // Uses specific origin and unique key for security
  const currentOrigin = window.location.origin;
  const injectedScript = document.createElement('script');
  injectedScript.textContent = `
    (function() {
      const MESSAGE_KEY = '${MESSAGE_KEY}';
      const ORIGIN = '${currentOrigin}';

      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0]?.url || args[0];

        if (typeof url === 'string' && (url.includes('/graphql/') || url.includes('/2/'))) {
          try {
            const clone = response.clone();
            const data = await clone.json();
            window.postMessage({
              type: MESSAGE_KEY,
              url: url,
              data: data
            }, ORIGIN);
          } catch (e) {
            // JSON parse error - not a JSON response
          }
        }

        return response;
      };

      const originalXHR = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalXHR.apply(this, arguments);
      };

      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
          if (this._url && (this._url.includes('/graphql/') || this._url.includes('/2/'))) {
            try {
              const data = JSON.parse(this.responseText);
              window.postMessage({
                type: MESSAGE_KEY,
                url: this._url,
                data: data
              }, ORIGIN);
            } catch (e) {
              // JSON parse error
            }
          }
        });
        return originalSend.apply(this, arguments);
      };
    })();
  `;
  document.documentElement.appendChild(injectedScript);
  injectedScript.remove();

  // Listen for intercepted API responses with origin validation
  window.addEventListener('message', (event) => {
    // Security: Validate origin
    if (event.origin !== currentOrigin) return;

    // Security: Validate message key
    if (event.data?.type !== MESSAGE_KEY) return;

    // Security: Validate data structure
    if (typeof event.data.url !== 'string' || typeof event.data.data !== 'object') return;

    handleApiResponse(event.data.url, event.data.data);
  });

  function handleApiResponse(url, data) {
    if (!collectedData.isCollecting) return;
    if (!data) return;

    // Extract users from response with depth limit
    const users = extractUsers(data, [], 0, 50);

    if (users.length > 0) {
      const targetMap = getTargetMap();
      if (targetMap) {
        let added = 0;
        users.forEach(user => {
          if (user.username && !targetMap.has(user.username.toLowerCase())) {
            targetMap.set(user.username.toLowerCase(), user);
            added++;
          }
        });
        if (added > 0) {
          saveToStorage();
          updateProgress();
        }
      }
    }
  }

  function getTargetMap() {
    switch (collectedData.collectType) {
      case 'retweeters':
        return collectedData.retweeters;
      case 'likers':
        return collectedData.likers;
      case 'followers':
        const currentAccount = collectedData.currentFollowAccount;
        if (currentAccount) {
          const key = currentAccount.toLowerCase();
          if (!collectedData.followers.has(key)) {
            collectedData.followers.set(key, new Map());
          }
          return collectedData.followers.get(key);
        }
        return null;
      default:
        return null;
    }
  }

  // Extract user objects with depth limit to prevent stack overflow
  function extractUsers(data, users = [], depth = 0, maxDepth = 50) {
    if (depth > maxDepth) return users;
    if (!data || typeof data !== 'object') return users;

    // Check if this is a user object
    if (data.__typename === 'User' || (data.legacy && data.rest_id)) {
      const legacy = data.legacy || data;
      const username = legacy.screen_name || data.screen_name;

      // Security: Validate and sanitize username
      if (username && typeof username === 'string' && /^[a-zA-Z0-9_]{1,15}$/.test(username)) {
        const user = {
          id: String(data.rest_id || data.id_str || data.id || ''),
          username: username,
          displayName: sanitizeString(legacy.name || data.name),
          avatarUrl: sanitizeUrl(legacy.profile_image_url_https || data.profile_image_url_https),
          bio: sanitizeString(legacy.description || data.description),
          followerCount: sanitizeNumber(legacy.followers_count ?? data.followers_count),
          followingCount: sanitizeNumber(legacy.friends_count ?? data.friends_count),
          tweetCount: sanitizeNumber(legacy.statuses_count ?? data.statuses_count),
          isVerified: Boolean(legacy.verified || data.verified || data.is_blue_verified),
          createdAt: sanitizeString(legacy.created_at || data.created_at)
        };
        users.push(user);
      }
    }

    // Recursively search nested objects
    if (Array.isArray(data)) {
      for (const item of data) {
        extractUsers(item, users, depth + 1, maxDepth);
        if (users.length > 10000) break; // Memory safety limit
      }
    } else {
      for (const value of Object.values(data)) {
        extractUsers(value, users, depth + 1, maxDepth);
        if (users.length > 10000) break;
      }
    }

    return users;
  }

  // Security: Sanitize string input
  function sanitizeString(str) {
    if (typeof str !== 'string') return undefined;
    // Remove any HTML/script tags
    return str.replace(/<[^>]*>/g, '').slice(0, 500);
  }

  // Security: Validate URL
  function sanitizeUrl(url) {
    if (typeof url !== 'string') return undefined;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && parsed.hostname.includes('twimg.com')) {
        return url;
      }
    } catch (e) {}
    return undefined;
  }

  // Security: Validate number
  function sanitizeNumber(num) {
    if (typeof num !== 'number' || !Number.isFinite(num)) return undefined;
    return Math.max(0, Math.floor(num));
  }

  function updateProgress() {
    const targetMap = getTargetMap();
    const count = targetMap ? targetMap.size : 0;

    chrome.runtime.sendMessage({
      type: 'COLLECTION_PROGRESS',
      collectType: collectedData.collectType,
      count: count,
      account: collectedData.currentFollowAccount
    }).catch(() => {});
  }

  // Auto-scroll function with better control
  async function autoScroll(maxScrolls = 150) {
    let scrollCount = 0;
    let lastHeight = 0;
    let noChangeCount = 0;

    while (scrollCount < maxScrolls && collectedData.isCollecting) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(1200);

      const newHeight = document.body.scrollHeight;
      if (newHeight === lastHeight) {
        noChangeCount++;
        if (noChangeCount >= 4) {
          break;
        }
      } else {
        noChangeCount = 0;
      }

      lastHeight = newHeight;
      scrollCount++;

      // Update progress every 5 scrolls
      if (scrollCount % 5 === 0) {
        updateProgress();
      }
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getCurrentTweetId() {
    const match = window.location.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // Navigate and collect with mutex to prevent race conditions
  async function navigateAndCollect(type, tweetId, accountUsername = null) {
    // Mutex check
    if (collectedData.collectionMutex) {
      return { success: false, error: 'Collection already in progress' };
    }
    collectedData.collectionMutex = true;

    try {
      collectedData.isCollecting = true;
      collectedData.collectType = type;
      collectedData.currentFollowAccount = accountUsername?.toLowerCase();
      collectedData.currentTweetId = tweetId;

      let targetUrl;

      if (type === 'retweeters') {
        targetUrl = `https://twitter.com/i/status/${tweetId}/retweets`;
      } else if (type === 'likers') {
        targetUrl = `https://twitter.com/i/status/${tweetId}/likes`;
      } else if (type === 'followers' && accountUsername) {
        targetUrl = `https://twitter.com/${accountUsername}/followers`;
      }

      // Store pending collection before navigation
      await chrome.storage.local.set({
        pendingCollection: {
          type,
          tweetId,
          account: accountUsername?.toLowerCase(),
          startedAt: Date.now()
        }
      });

      if (targetUrl && window.location.href !== targetUrl) {
        window.location.href = targetUrl;
        return { success: true, navigating: true };
      }

      // We're on the right page, start scrolling
      await sleep(2000);
      await autoScroll();

      collectedData.isCollecting = false;
      collectedData.collectionMutex = false;

      // Clear pending and save final data
      await chrome.storage.local.remove('pendingCollection');
      saveToStorage();

      const count = getTargetMap()?.size || 0;

      // Send completion message
      chrome.runtime.sendMessage({
        type: 'COLLECTION_COMPLETE',
        collectType: type,
        count: count,
        account: accountUsername
      }).catch(() => {});

      return { success: true, count };
    } catch (error) {
      collectedData.isCollecting = false;
      collectedData.collectionMutex = false;
      return { success: false, error: error.message };
    }
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Validate message structure
    if (!message || typeof message.type !== 'string') {
      sendResponse({ success: false, error: 'Invalid message' });
      return true;
    }

    switch (message.type) {
      case 'START_COLLECT':
        if (!message.collectType || !message.tweetId) {
          sendResponse({ success: false, error: 'Missing collectType or tweetId' });
          break;
        }
        navigateAndCollect(message.collectType, message.tweetId, message.accountUsername)
          .then(result => sendResponse(result))
          .catch(e => sendResponse({ success: false, error: e.message }));
        return true; // Keep channel open for async response

      case 'STOP_COLLECT':
        collectedData.isCollecting = false;
        collectedData.collectionMutex = false;
        sendResponse({ success: true });
        break;

      case 'GET_DATA':
        sendResponse({
          retweeters: Array.from(collectedData.retweeters.values()),
          likers: Array.from(collectedData.likers.values()),
          followers: Object.fromEntries(
            Array.from(collectedData.followers.entries()).map(([k, v]) => [k, Array.from(v.values())])
          ),
          tweetId: collectedData.currentTweetId,
          isCollecting: collectedData.isCollecting,
          collectType: collectedData.collectType
        });
        break;

      case 'CLEAR_DATA':
        collectedData.retweeters.clear();
        collectedData.likers.clear();
        collectedData.followers.clear();
        collectedData.currentTweetId = null;
        collectedData.isCollecting = false;
        collectedData.collectionMutex = false;
        chrome.storage.local.remove(['collectedData', 'pendingCollection']).catch(() => {});
        sendResponse({ success: true });
        break;

      case 'GET_TWEET_ID':
        sendResponse({ tweetId: getCurrentTweetId() });
        break;

      case 'CHECK_PAGE':
        const path = window.location.pathname;
        sendResponse({
          isTweetPage: /\/status\/\d+/.test(path),
          isRetweetersPage: path.includes('/retweets'),
          isLikersPage: path.includes('/likes'),
          isFollowersPage: path.includes('/followers'),
          tweetId: getCurrentTweetId(),
          isCollecting: collectedData.isCollecting
        });
        break;

      case 'GET_STATUS':
        sendResponse({
          isCollecting: collectedData.isCollecting,
          collectType: collectedData.collectType,
          retweetersCount: collectedData.retweeters.size,
          likersCount: collectedData.likers.size,
          followersCount: Object.fromEntries(
            Array.from(collectedData.followers.entries()).map(([k, v]) => [k, v.size])
          )
        });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    return true;
  });

  // Resume collection if pending
  chrome.storage.local.get(['pendingCollection'], (result) => {
    if (result.pendingCollection) {
      const { type, tweetId, account, startedAt } = result.pendingCollection;
      const path = window.location.pathname;

      // Check if too old (> 5 minutes)
      if (startedAt && Date.now() - startedAt > 5 * 60 * 1000) {
        chrome.storage.local.remove('pendingCollection');
        return;
      }

      let isCorrectPage = false;
      if (type === 'retweeters' && path.includes('/retweets')) isCorrectPage = true;
      if (type === 'likers' && path.includes('/likes')) isCorrectPage = true;
      if (type === 'followers' && path.includes('/followers')) isCorrectPage = true;

      if (isCorrectPage) {
        collectedData.isCollecting = true;
        collectedData.collectType = type;
        collectedData.currentFollowAccount = account;
        collectedData.currentTweetId = tweetId;

        sleep(2000).then(async () => {
          await autoScroll();
          collectedData.isCollecting = false;
          collectedData.collectionMutex = false;

          await chrome.storage.local.remove('pendingCollection');
          saveToStorage();

          chrome.runtime.sendMessage({
            type: 'COLLECTION_COMPLETE',
            collectType: type,
            count: getTargetMap()?.size || 0,
            account: account
          }).catch(() => {});
        });
      }
    }
  });

})();
