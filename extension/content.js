/**
 * Content script - runs on Twitter/X pages
 * Receives API responses from injected.js and collects user data
 *
 * Security: Validates message origin and structure
 * State: Persists data to chrome.storage to survive navigation
 */

(function() {
  'use strict';

  const MESSAGE_TYPE = 'TWITTER_PICKER_API_RESPONSE';

  // Buffer for API responses received before we know if we're collecting
  const responseBuffer = [];
  let isInitialized = false;

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

  const currentOrigin = window.location.origin;

  // Listen for intercepted API responses from injected.js
  window.addEventListener('message', (event) => {
    // Security: Validate origin
    if (event.origin !== currentOrigin) return;

    // Security: Validate message type
    if (event.data?.type !== MESSAGE_TYPE) return;

    // Security: Validate data structure
    if (typeof event.data.url !== 'string' || typeof event.data.data !== 'object') return;

    // If not initialized yet, buffer the response
    if (!isInitialized) {
      responseBuffer.push({ url: event.data.url, data: event.data.data });
      return;
    }

    handleApiResponse(event.data.url, event.data.data);
  });

  // Process buffered responses once we're ready
  function processBuffer() {
    if (!collectedData.isCollecting) return;

    while (responseBuffer.length > 0) {
      const { url, data } = responseBuffer.shift();
      handleApiResponse(url, data);
    }
  }

  // Initialize - restore state from storage
  async function initialize() {
    try {
      // Check for pending collection first
      const pendingResult = await chrome.storage.local.get(['pendingCollection']);
      const pending = pendingResult.pendingCollection;

      if (pending) {
        const { type, tweetId, account, startedAt } = pending;
        const path = window.location.pathname;

        // Check if too old (> 5 minutes)
        if (startedAt && Date.now() - startedAt > 5 * 60 * 1000) {
          await chrome.storage.local.remove('pendingCollection');
        } else {
          // Check if we're on the correct page
          let isCorrectPage = false;
          if (type === 'retweeters' && path.includes('/retweets')) isCorrectPage = true;
          if (type === 'likers' && path.includes('/likes')) isCorrectPage = true;
          if (type === 'followers' && path.includes('/followers')) isCorrectPage = true;

          if (isCorrectPage) {
            // Set collecting state BEFORE marking as initialized
            collectedData.isCollecting = true;
            collectedData.collectType = type;
            collectedData.currentFollowAccount = account;
            collectedData.currentTweetId = tweetId;
          }
        }
      }

      // Restore saved data
      const dataResult = await chrome.storage.local.get(['collectedData']);
      if (dataResult.collectedData) {
        const saved = dataResult.collectedData;
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

      // Mark as initialized and process buffer
      isInitialized = true;
      processBuffer();

      // If we're collecting, start auto-scroll after a short delay
      if (collectedData.isCollecting) {
        await sleep(1500);
        await autoScroll();
        await finishCollection();
      }

    } catch (error) {
      console.error('[Twitter Picker] Initialization error:', error);
      isInitialized = true;
    }
  }

  // Start initialization
  initialize();

  // Warn user before navigating away during collection
  window.addEventListener('beforeunload', (event) => {
    if (collectedData.isCollecting) {
      // Standard way to show browser's default "are you sure?" dialog
      event.preventDefault();
      // Chrome requires returnValue to be set
      event.returnValue = '';
      return '';
    }
  });

  // Save data to storage (debounced with longer interval to reduce I/O)
  let saveTimeout = null;
  let lastSaveError = null;
  function saveToStorage() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const dataToSave = {
        retweeters: Array.from(collectedData.retweeters.values()),
        likers: Array.from(collectedData.likers.values()),
        followers: Object.fromEntries(
          Array.from(collectedData.followers.entries()).map(([k, v]) => [k, Array.from(v.values())])
        ),
        currentTweetId: collectedData.currentTweetId
      };
      try {
        await chrome.storage.local.set({ collectedData: dataToSave });
        lastSaveError = null;
      } catch (e) {
        // Only log once per error to avoid spam
        if (lastSaveError !== e.message) {
          lastSaveError = e.message;
          console.error('[Twitter Picker] Storage save failed:', e.message);
          // Notify popup of storage error
          chrome.runtime.sendMessage({
            type: 'STORAGE_ERROR',
            error: e.message
          }).catch(() => {});
        }
      }
    }, 1000); // Increased from 300ms to 1000ms to reduce I/O
  }

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
  // Uses Set for O(1) duplicate checking instead of O(n) findIndex
  function extractUsers(data, users = [], depth = 0, maxDepth = 50, seenUsernames = null) {
    // Initialize Set on first call for O(1) duplicate checking
    if (seenUsernames === null) {
      seenUsernames = new Set(users.map(u => u.username.toLowerCase()));
    }

    if (depth > maxDepth) return users;
    if (!data || typeof data !== 'object') return users;

    // Check for user result wrapper (common in Twitter's GraphQL responses)
    if (data.user_results?.result) {
      extractUsers(data.user_results.result, users, depth + 1, maxDepth, seenUsernames);
    }

    // Check if this is a user object - multiple patterns Twitter uses
    const isUserObject =
      data.__typename === 'User' ||
      data.__typename === 'UserResults' ||
      (data.legacy && data.rest_id) ||
      (data.legacy && data.id_str) ||
      (data.screen_name && (data.id_str || data.id));

    if (isUserObject) {
      // Twitter uses different structures: legacy (old), core (new), or flat
      const legacy = data.legacy || {};
      const core = data.core || {};

      const username = legacy.screen_name || core.screen_name || data.screen_name;

      // Security: Validate and sanitize username
      if (username && typeof username === 'string' && /^[a-zA-Z0-9_]{1,15}$/.test(username)) {
        const usernameLower = username.toLowerCase();
        // O(1) duplicate check using Set
        if (!seenUsernames.has(usernameLower)) {
          seenUsernames.add(usernameLower);

          const user = buildUserObject(data, legacy, core, username);
          users.push(user);
        }
      }
    }

    // Recursively search nested objects
    if (Array.isArray(data)) {
      for (const item of data) {
        extractUsers(item, users, depth + 1, maxDepth, seenUsernames);
        if (users.length > 10000) break; // Memory safety limit
      }
    } else {
      for (const value of Object.values(data)) {
        if (value && typeof value === 'object') {
          extractUsers(value, users, depth + 1, maxDepth, seenUsernames);
          if (users.length > 10000) break;
        }
      }
    }

    return users;
  }

  // Build user object from Twitter API data (extracted for cleaner code)
  function buildUserObject(data, legacy, core, username) {
    // Extract avatar from multiple possible locations
    const avatarUrl = legacy.profile_image_url_https ||
                     data.profile_image_url_https ||
                     data.avatar?.image_url ||
                     core.avatar?.image_url;

    // Extract created_at from multiple possible locations
    const createdAt = legacy.created_at ||
                     data.created_at ||
                     core.created_at;

    return {
      id: String(data.rest_id || data.id_str || data.id || ''),
      username: username,
      displayName: sanitizeString(legacy.name || core.name || data.name),
      avatarUrl: sanitizeUrl(avatarUrl),
      bio: sanitizeString(legacy.description || core.description || data.description),
      followerCount: sanitizeNumber(legacy.followers_count ?? core.followers_count ?? data.followers_count),
      followingCount: sanitizeNumber(legacy.friends_count ?? core.friends_count ?? data.friends_count),
      tweetCount: sanitizeNumber(legacy.statuses_count ?? core.statuses_count ?? data.statuses_count),
      isVerified: Boolean(legacy.verified || data.verified || data.is_blue_verified),
      createdAt: sanitizeString(createdAt)
    };
  }

  // Security: Sanitize string input
  function sanitizeString(str) {
    if (typeof str !== 'string') return undefined;
    // Remove any HTML/script tags
    return str.replace(/<[^>]*>/g, '').slice(0, 500);
  }

  // Security: Validate URL with exact hostname matching
  function sanitizeUrl(url) {
    if (typeof url !== 'string') return undefined;
    try {
      const parsed = new URL(url);
      // Use exact hostname match or proper subdomain check
      const validHosts = ['twimg.com', 'pbs.twimg.com', 'abs.twimg.com'];
      const hostname = parsed.hostname;
      const isValidHost = validHosts.includes(hostname) ||
                         hostname.endsWith('.twimg.com');
      if (parsed.protocol === 'https:' && isValidHost) {
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
  async function autoScroll(maxScrolls = 200) {
    let scrollCount = 0;
    let lastHeight = 0;
    let noChangeCount = 0;
    let lastUserCount = getTargetMap()?.size || 0;
    let noNewUsersCount = 0;

    while (scrollCount < maxScrolls && collectedData.isCollecting) {
      // Scroll down
      window.scrollTo(0, document.body.scrollHeight);

      // Wait for content to load
      await sleep(1000 + Math.random() * 500);

      const newHeight = document.body.scrollHeight;
      const currentUserCount = getTargetMap()?.size || 0;

      // Check if we got new users
      if (currentUserCount > lastUserCount) {
        noNewUsersCount = 0;
        lastUserCount = currentUserCount;
      } else {
        noNewUsersCount++;
      }

      // Check if page height changed
      if (newHeight === lastHeight) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
      }

      lastHeight = newHeight;
      scrollCount++;

      // Stop if no new content for a while
      if (noChangeCount >= 5 && noNewUsersCount >= 5) {
        break;
      }

      // Update progress every 3 scrolls
      if (scrollCount % 3 === 0) {
        updateProgress();
      }
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Fetch with timeout to prevent hanging requests
  async function fetchWithTimeout(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw e;
    }
  }

  function getCurrentTweetId() {
    const match = window.location.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  async function finishCollection() {
    const type = collectedData.collectType;
    const account = collectedData.currentFollowAccount;
    const count = getTargetMap()?.size || 0;

    collectedData.isCollecting = false;
    collectedData.collectionMutex = false;

    await chrome.storage.local.remove('pendingCollection');
    saveToStorage();

    // Send completion message
    chrome.runtime.sendMessage({
      type: 'COLLECTION_COMPLETE',
      collectType: type,
      count: count,
      account: account
    }).catch(() => {});
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
        targetUrl = `https://x.com/i/status/${tweetId}/retweets`;
      } else if (type === 'likers') {
        targetUrl = `https://x.com/i/status/${tweetId}/likes`;
      } else if (type === 'followers' && accountUsername) {
        targetUrl = `https://x.com/${accountUsername}/followers`;
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

      // We're already on the right page, start collecting
      await sleep(1500);
      await autoScroll();
      await finishCollection();

      const count = getTargetMap()?.size || 0;
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

      case 'CHECK_FOLLOWS':
        // Check if a user follows all required accounts
        if (!message.username || !Array.isArray(message.requiredAccounts)) {
          sendResponse({ followsAll: false, error: 'Invalid parameters' });
          break;
        }
        checkUserFollowsAccounts(message.username, message.requiredAccounts)
          .then(result => sendResponse(result))
          .catch(e => sendResponse({ followsAll: false, error: e.message }));
        return true; // Keep channel open for async response

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    return true;
  });

  // Check if a user follows all the required accounts
  async function checkUserFollowsAccounts(username, requiredAccounts) {
    try {
      // Fetch the user's following list using Twitter's internal API
      const following = await fetchUserFollowing(username);
      const followingSet = new Set(following.map(u => u.toLowerCase()));

      // Check if all required accounts are in their following list
      const results = {};
      let followsAll = true;

      for (const account of requiredAccounts) {
        const follows = followingSet.has(account.toLowerCase());
        results[account] = follows;
        if (!follows) {
          followsAll = false;
        }
      }

      return { followsAll, results };

    } catch (e) {
      return { followsAll: false, error: e.message };
    }
  }

  // Fetch a user's following list using Twitter's GraphQL API
  async function fetchUserFollowing(username) {
    // First, get the user's ID
    const userInfo = await fetchUserByScreenName(username);
    if (!userInfo?.rest_id) {
      throw new Error('Could not find user: ' + username);
    }

    const userId = userInfo.rest_id;
    const following = [];

    // Fetch following list (first page should be enough for verification)
    // We only need to check if specific accounts are in their following,
    // so fetching first ~100-200 should cover most cases
    const variables = {
      userId: userId,
      count: 200,
      includePromotedContent: false
    };

    const features = {
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false
    };

    const url = `https://x.com/i/api/graphql/PAnE9toEjRfE-4tozRcsfw/Following?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`;

    const response = await fetchWithTimeout(url, {
      credentials: 'include',
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en'
      }
    }, 15000);

    if (!response.ok) {
      throw new Error(`Failed to fetch following: ${response.status}`);
    }

    const data = await response.json();

    // Extract usernames from the response
    const instructions = data?.data?.user?.result?.timeline?.timeline?.instructions || [];
    for (const instruction of instructions) {
      if (instruction.entries) {
        for (const entry of instruction.entries) {
          const userResult = entry?.content?.itemContent?.user_results?.result;
          if (userResult?.legacy?.screen_name) {
            following.push(userResult.legacy.screen_name);
          } else if (userResult?.core?.screen_name) {
            following.push(userResult.core.screen_name);
          }
        }
      }
    }

    return following;
  }

  // Fetch user info by screen name
  async function fetchUserByScreenName(screenName) {
    const variables = {
      screen_name: screenName,
      withSafetyModeUserFields: true
    };

    const features = {
      hidden_profile_subscriptions_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      subscriptions_verification_info_is_identity_verified_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: true,
      subscriptions_feature_can_gift_premium: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true
    };

    const fieldToggles = {
      withAuxiliaryUserLabels: false
    };

    const url = `https://x.com/i/api/graphql/xc8f1g7BYqr6VTzTbvNlGw/UserByScreenName?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}&fieldToggles=${encodeURIComponent(JSON.stringify(fieldToggles))}`;

    const response = await fetchWithTimeout(url, {
      credentials: 'include',
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en'
      }
    }, 15000);

    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status}`);
    }

    const data = await response.json();
    return data?.data?.user?.result;
  }

})();
