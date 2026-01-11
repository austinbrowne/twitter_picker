/**
 * Content script - runs on Twitter/X pages
 * Intercepts API responses and collects user data
 */

(function() {
  'use strict';

  // Store collected data
  const collectedData = {
    retweeters: new Map(),
    likers: new Map(),
    followers: new Map(), // Map of accountUsername -> Map of followerUsername -> userData
    currentTweetId: null,
    isCollecting: false,
    collectType: null
  };

  // Inject script to intercept fetch/XHR
  const injectedScript = document.createElement('script');
  injectedScript.textContent = `
    (function() {
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0]?.url || args[0];

        if (typeof url === 'string' && (url.includes('/graphql/') || url.includes('/2/'))) {
          try {
            const clone = response.clone();
            const data = await clone.json();
            window.postMessage({
              type: 'TWITTER_API_RESPONSE',
              url: url,
              data: data
            }, '*');
          } catch (e) {}
        }

        return response;
      };

      // Also intercept XHR
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
                type: 'TWITTER_API_RESPONSE',
                url: this._url,
                data: data
              }, '*');
            } catch (e) {}
          }
        });
        return originalSend.apply(this, arguments);
      };
    })();
  `;
  document.documentElement.appendChild(injectedScript);
  injectedScript.remove();

  // Listen for intercepted API responses
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'TWITTER_API_RESPONSE') {
      handleApiResponse(event.data.url, event.data.data);
    }
  });

  // Handle API responses
  function handleApiResponse(url, data) {
    if (!collectedData.isCollecting) return;

    // Extract users from response
    const users = extractUsers(data);

    if (users.length > 0) {
      const targetMap = getTargetMap();
      if (targetMap) {
        users.forEach(user => {
          if (!targetMap.has(user.username.toLowerCase())) {
            targetMap.set(user.username.toLowerCase(), user);
            updateProgress();
          }
        });
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
          if (!collectedData.followers.has(currentAccount)) {
            collectedData.followers.set(currentAccount, new Map());
          }
          return collectedData.followers.get(currentAccount);
        }
        return null;
      default:
        return null;
    }
  }

  // Extract user objects from Twitter's nested GraphQL responses
  function extractUsers(data, users = []) {
    if (!data || typeof data !== 'object') return users;

    // Check if this is a user object
    if (data.__typename === 'User' || (data.legacy && data.rest_id)) {
      const legacy = data.legacy || data;
      const user = {
        id: data.rest_id || data.id_str || data.id,
        username: legacy.screen_name || data.screen_name,
        displayName: legacy.name || data.name,
        avatarUrl: legacy.profile_image_url_https || data.profile_image_url_https,
        bio: legacy.description || data.description,
        followerCount: legacy.followers_count ?? data.followers_count,
        followingCount: legacy.friends_count ?? data.friends_count,
        tweetCount: legacy.statuses_count ?? data.statuses_count,
        isVerified: legacy.verified || data.verified || data.is_blue_verified,
        createdAt: legacy.created_at || data.created_at
      };

      if (user.username) {
        users.push(user);
      }
    }

    // Recursively search nested objects
    if (Array.isArray(data)) {
      data.forEach(item => extractUsers(item, users));
    } else {
      Object.values(data).forEach(value => extractUsers(value, users));
    }

    return users;
  }

  function updateProgress() {
    const targetMap = getTargetMap();
    const count = targetMap ? targetMap.size : 0;

    chrome.runtime.sendMessage({
      type: 'COLLECTION_PROGRESS',
      collectType: collectedData.collectType,
      count: count,
      account: collectedData.currentFollowAccount
    });
  }

  // Auto-scroll function
  async function autoScroll(maxScrolls = 100) {
    let scrollCount = 0;
    let lastHeight = 0;
    let noChangeCount = 0;

    while (scrollCount < maxScrolls && collectedData.isCollecting) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(1500);

      const newHeight = document.body.scrollHeight;
      if (newHeight === lastHeight) {
        noChangeCount++;
        if (noChangeCount >= 3) {
          // No new content loaded, we're done
          break;
        }
      } else {
        noChangeCount = 0;
      }

      lastHeight = newHeight;
      scrollCount++;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get current tweet ID from URL
  function getCurrentTweetId() {
    const match = window.location.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // Navigate to specific tab and collect
  async function navigateAndCollect(type, tweetId, accountUsername = null) {
    collectedData.isCollecting = true;
    collectedData.collectType = type;
    collectedData.currentFollowAccount = accountUsername;

    let targetUrl;

    if (type === 'retweeters') {
      targetUrl = `https://twitter.com/i/status/${tweetId}/retweets`;
    } else if (type === 'likers') {
      targetUrl = `https://twitter.com/i/status/${tweetId}/likes`;
    } else if (type === 'followers' && accountUsername) {
      targetUrl = `https://twitter.com/${accountUsername}/followers`;
    }

    if (targetUrl && window.location.href !== targetUrl) {
      window.location.href = targetUrl;
      return; // Page will reload, content script will restart
    }

    // We're on the right page, start scrolling
    await sleep(2000); // Wait for initial load
    await autoScroll();

    collectedData.isCollecting = false;

    // Send completion message
    chrome.runtime.sendMessage({
      type: 'COLLECTION_COMPLETE',
      collectType: type,
      count: getTargetMap()?.size || 0,
      account: accountUsername
    });
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'START_COLLECT':
        navigateAndCollect(message.collectType, message.tweetId, message.accountUsername);
        sendResponse({ success: true });
        break;

      case 'STOP_COLLECT':
        collectedData.isCollecting = false;
        sendResponse({ success: true });
        break;

      case 'GET_DATA':
        sendResponse({
          retweeters: Array.from(collectedData.retweeters.values()),
          likers: Array.from(collectedData.likers.values()),
          followers: Object.fromEntries(
            Array.from(collectedData.followers.entries()).map(([k, v]) => [k, Array.from(v.values())])
          ),
          tweetId: collectedData.currentTweetId
        });
        break;

      case 'CLEAR_DATA':
        collectedData.retweeters.clear();
        collectedData.likers.clear();
        collectedData.followers.clear();
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
          tweetId: getCurrentTweetId()
        });
        break;
    }
    return true;
  });

  // Auto-detect page and resume collection if needed
  chrome.storage.local.get(['pendingCollection'], (result) => {
    if (result.pendingCollection) {
      const { type, tweetId, account } = result.pendingCollection;
      const path = window.location.pathname;

      let isCorrectPage = false;
      if (type === 'retweeters' && path.includes('/retweets')) isCorrectPage = true;
      if (type === 'likers' && path.includes('/likes')) isCorrectPage = true;
      if (type === 'followers' && path.includes('/followers')) isCorrectPage = true;

      if (isCorrectPage) {
        chrome.storage.local.remove('pendingCollection');
        collectedData.isCollecting = true;
        collectedData.collectType = type;
        collectedData.currentFollowAccount = account;
        collectedData.currentTweetId = tweetId;

        sleep(2000).then(() => autoScroll());
      }
    }
  });

})();
