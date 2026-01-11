/**
 * Popup script - main UI logic
 *
 * Security: Uses textContent/createElement instead of innerHTML
 * UX: Sequential collection with progress feedback
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const tweetUrlInput = document.getElementById('tweet-url');
  const detectBtn = document.getElementById('detect-btn');
  const reqRetweet = document.getElementById('req-retweet');
  const reqLike = document.getElementById('req-like');
  const reqFollow = document.getElementById('req-follow');
  const followAccountsContainer = document.getElementById('follow-accounts');
  const addFollowBtn = document.getElementById('add-follow-btn');
  const collectAllBtn = document.getElementById('collect-all-btn');
  const stopBtn = document.getElementById('stop-btn');
  const pickBtn = document.getElementById('pick-btn');
  const winnerCountInput = document.getElementById('winner-count');
  const winnersSection = document.getElementById('step-winners');
  const winnersList = document.getElementById('winners-list');
  const copyWinnersBtn = document.getElementById('copy-winners');
  const repickBtn = document.getElementById('repick-btn');
  const newGiveawayBtn = document.getElementById('new-giveaway-btn');
  const errorDiv = document.getElementById('error');
  const progressDiv = document.getElementById('progress-info');
  const progressText = document.getElementById('progress-text');

  // Stats elements
  const statRetweeters = document.getElementById('stat-retweeters');
  const statLikers = document.getElementById('stat-likers');
  const statFollowers = document.getElementById('stat-followers');
  const statEligible = document.getElementById('stat-eligible');
  const statFiltered = document.getElementById('stat-filtered');

  // Status elements
  const statusRetweet = document.getElementById('status-retweet');
  const statusLike = document.getElementById('status-like');

  // State
  let state = {
    tweetId: null,
    retweeters: [],
    likers: [],
    followers: {},
    eligible: [],
    winners: [],
    isCollecting: false,
    currentCollection: null
  };

  // Collection queue for sequential processing
  let collectionQueue = [];
  let isProcessingQueue = false;

  // Load saved state
  await loadState();
  updateUI();

  // Try to detect tweet from current tab
  detectCurrentTweet();

  // Poll for updates while collecting
  setInterval(async () => {
    if (state.isCollecting) {
      await fetchCollectedData();
      updateUI();
    }
  }, 2000);

  // Event listeners
  detectBtn.addEventListener('click', detectCurrentTweet);

  addFollowBtn.addEventListener('click', () => addFollowInput());

  followAccountsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-follow')) {
      const row = e.target.closest('.follow-input-row');
      if (followAccountsContainer.querySelectorAll('.follow-input-row').length > 1) {
        row.remove();
      } else {
        row.querySelector('input').value = '';
      }
    }
  });

  collectAllBtn.addEventListener('click', startCollection);
  stopBtn.addEventListener('click', stopCollection);
  pickBtn.addEventListener('click', pickWinners);
  copyWinnersBtn.addEventListener('click', copyWinners);
  repickBtn.addEventListener('click', pickWinners);
  newGiveawayBtn.addEventListener('click', resetGiveaway);

  // Listen for collection updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'COLLECTION_PROGRESS') {
      updateCollectionStatus(message.collectType, 'collecting', message.count, message.account);
      showProgress(`Collecting ${message.collectType}: ${message.count} found...`);
    } else if (message.type === 'COLLECTION_COMPLETE') {
      updateCollectionStatus(message.collectType, 'complete', message.count, message.account);
      fetchCollectedData().then(() => {
        processNextInQueue();
      });
    }
  });

  // Functions
  async function loadState() {
    try {
      const saved = await chrome.storage.local.get(['giveawayState', 'collectedData']);

      if (saved.giveawayState) {
        state = { ...state, ...saved.giveawayState };
      }

      if (saved.collectedData) {
        state.retweeters = saved.collectedData.retweeters || [];
        state.likers = saved.collectedData.likers || [];
        state.followers = saved.collectedData.followers || {};
        state.tweetId = saved.collectedData.currentTweetId || state.tweetId;
      }
    } catch (e) {
      console.error('Error loading state:', e);
    }
  }

  async function saveState() {
    try {
      await chrome.storage.local.set({
        giveawayState: {
          tweetId: state.tweetId,
          winners: state.winners,
          eligible: state.eligible
        }
      });
    } catch (e) {
      console.error('Error saving state:', e);
    }
  }

  async function detectCurrentTweet() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.url) {
        showError('Cannot access current tab');
        return;
      }

      if (!tab.url.includes('twitter.com') && !tab.url.includes('x.com')) {
        showError('Please open a Twitter/X page');
        return;
      }

      // Try to get tweet ID from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TWEET_ID' });
        if (response?.tweetId) {
          state.tweetId = response.tweetId;
          tweetUrlInput.value = tab.url;
          hideError();
          return;
        }
      } catch (e) {
        // Content script not loaded, try URL parsing
      }

      // Extract from URL
      const match = tab.url.match(/\/status\/(\d+)/);
      if (match) {
        state.tweetId = match[1];
        tweetUrlInput.value = tab.url;
        hideError();
      } else {
        showError('Navigate to a tweet to detect it');
      }
    } catch (e) {
      showError('Could not detect tweet. Refresh the page and try again.');
    }
  }

  function addFollowInput() {
    const row = document.createElement('div');
    row.className = 'follow-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '@username';
    input.className = 'follow-input';
    input.setAttribute('aria-label', 'Account username to follow');

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-secondary remove-follow';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove this account');

    row.appendChild(input);
    row.appendChild(removeBtn);
    followAccountsContainer.appendChild(row);
  }

  function getFollowAccounts() {
    const inputs = followAccountsContainer.querySelectorAll('.follow-input');
    return Array.from(inputs)
      .map(input => input.value.trim().replace(/^@/, '').toLowerCase())
      .filter(v => v.length > 0 && /^[a-zA-Z0-9_]{1,15}$/.test(v));
  }

  async function startCollection() {
    // Validate tweet ID
    if (!state.tweetId) {
      const match = tweetUrlInput.value.match(/\/status\/(\d+)/);
      if (match) {
        state.tweetId = match[1];
      } else {
        showError('Please enter a valid tweet URL');
        return;
      }
    }

    hideError();
    state.isCollecting = true;
    collectionQueue = [];

    // Build collection queue
    if (reqRetweet.checked) {
      collectionQueue.push({ type: 'retweeters', tweetId: state.tweetId });
    }
    if (reqLike.checked) {
      collectionQueue.push({ type: 'likers', tweetId: state.tweetId });
    }
    if (reqFollow.checked) {
      const accounts = getFollowAccounts();
      for (const account of accounts) {
        collectionQueue.push({ type: 'followers', tweetId: state.tweetId, account });
      }
    }

    if (collectionQueue.length === 0) {
      showError('Select at least one requirement');
      state.isCollecting = false;
      return;
    }

    // Update UI
    collectAllBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    showProgress('Starting collection...');

    // Process queue
    isProcessingQueue = true;
    processNextInQueue();
  }

  async function processNextInQueue() {
    if (collectionQueue.length === 0 || !state.isCollecting) {
      // All done
      state.isCollecting = false;
      isProcessingQueue = false;
      collectAllBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      hideProgress();

      await fetchCollectedData();
      updateUI();

      if (state.retweeters.length > 0 || state.likers.length > 0) {
        showSuccess('Collection complete!');
      }
      return;
    }

    const next = collectionQueue.shift();
    state.currentCollection = next;

    showProgress(`Collecting ${next.type}${next.account ? ` (@${next.account})` : ''}...`);
    updateCollectionStatus(next.type, 'collecting', 0, next.account);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_COLLECT',
        collectType: next.type,
        tweetId: next.tweetId,
        accountUsername: next.account
      });

      // The content script will navigate and continue
      // We'll get COLLECTION_COMPLETE when done
    } catch (e) {
      showError(`Failed to start ${next.type} collection. Refresh the page and try again.`);
      processNextInQueue();
    }
  }

  async function stopCollection() {
    state.isCollecting = false;
    collectionQueue = [];
    isProcessingQueue = false;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { type: 'STOP_COLLECT' });
    } catch (e) {}

    collectAllBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    hideProgress();
    updateUI();
  }

  async function fetchCollectedData() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_DATA' });

      if (response) {
        if (response.retweeters) state.retweeters = response.retweeters;
        if (response.likers) state.likers = response.likers;
        if (response.followers) state.followers = response.followers;
        if (response.isCollecting !== undefined) state.isCollecting = response.isCollecting;
      }
    } catch (e) {
      // Content script not available, load from storage
      await loadState();
    }
  }

  function updateCollectionStatus(type, status, count, account) {
    let statusEl;

    if (type === 'retweeters') {
      statusEl = statusRetweet;
    } else if (type === 'likers') {
      statusEl = statusLike;
    } else if (type === 'followers' && account) {
      // Update followers count in stats
      if (statFollowers) {
        const totalFollowers = Object.values(state.followers).reduce((sum, arr) => sum + arr.length, 0);
        statFollowers.textContent = totalFollowers.toLocaleString();
      }
      return;
    }

    if (!statusEl) return;

    statusEl.className = 'requirement-status';

    if (status === 'collecting') {
      statusEl.classList.add('status-collecting');
      statusEl.textContent = `Collecting... (${count})`;
      statusEl.setAttribute('aria-live', 'polite');
    } else if (status === 'complete') {
      statusEl.classList.add('status-complete');
      statusEl.textContent = `${count} collected ✓`;
    } else {
      statusEl.classList.add('status-idle');
      statusEl.textContent = 'Not collected';
    }
  }

  function calculateEligible() {
    let eligibleSet = null;

    // Start with retweeters if required
    if (reqRetweet.checked && state.retweeters.length > 0) {
      const set = new Set(state.retweeters.map(u => u.username.toLowerCase()));
      eligibleSet = set;
    }

    // Intersect with likers if required
    if (reqLike.checked && state.likers.length > 0) {
      const set = new Set(state.likers.map(u => u.username.toLowerCase()));
      if (eligibleSet) {
        eligibleSet = new Set([...eligibleSet].filter(u => set.has(u)));
      } else {
        eligibleSet = set;
      }
    }

    // Intersect with followers if required
    if (reqFollow.checked) {
      const accounts = getFollowAccounts();
      for (const account of accounts) {
        const followers = state.followers[account.toLowerCase()] || [];
        if (followers.length > 0) {
          const set = new Set(followers.map(u => u.username.toLowerCase()));
          if (eligibleSet) {
            eligibleSet = new Set([...eligibleSet].filter(u => set.has(u)));
          } else {
            eligibleSet = set;
          }
        }
      }
    }

    if (!eligibleSet) return [];

    // Build user objects - prefer retweeter data (most complete)
    const userMap = new Map();
    [...state.likers, ...state.retweeters].forEach(u => {
      userMap.set(u.username.toLowerCase(), u);
    });
    Object.values(state.followers).flat().forEach(u => {
      if (!userMap.has(u.username.toLowerCase())) {
        userMap.set(u.username.toLowerCase(), u);
      }
    });

    return Array.from(eligibleSet)
      .map(username => userMap.get(username))
      .filter(Boolean);
  }

  function applyFilters(users) {
    const minFollowers = parseInt(document.getElementById('filter-followers').value) || 0;
    const minTweets = parseInt(document.getElementById('filter-tweets').value) || 0;
    const minAge = parseInt(document.getElementById('filter-age').value) || 0;
    const requireAvatar = document.getElementById('filter-avatar').checked;

    const minDate = new Date();
    minDate.setDate(minDate.getDate() - minAge);

    return users.filter(u => {
      // Filter out users with insufficient data if filters are set
      if (minFollowers > 0) {
        if (u.followerCount === undefined || u.followerCount < minFollowers) {
          return false;
        }
      }
      if (minTweets > 0) {
        if (u.tweetCount === undefined || u.tweetCount < minTweets) {
          return false;
        }
      }
      if (minAge > 0 && u.createdAt) {
        try {
          const created = new Date(u.createdAt);
          if (created > minDate) return false;
        } catch (e) {}
      }
      if (requireAvatar) {
        if (!u.avatarUrl || u.avatarUrl.includes('default_profile')) {
          return false;
        }
      }
      return true;
    });
  }

  function pickWinners() {
    const eligible = calculateEligible();
    const filtered = applyFilters(eligible);
    let count = parseInt(winnerCountInput.value) || 1;

    // Validate count
    count = Math.max(1, Math.min(count, 100, filtered.length));

    if (filtered.length === 0) {
      if (eligible.length === 0) {
        showError('No eligible participants. Make sure to collect data first and check that users meet all requirements.');
      } else {
        showError(`All ${eligible.length} eligible participants were filtered out. Try relaxing your filters.`);
      }
      return;
    }

    if (count > filtered.length) {
      showWarning(`Only ${filtered.length} participants after filters. Picking all of them.`);
      count = filtered.length;
    }

    hideError();

    // Crypto shuffle using rejection sampling for unbiased results
    const shuffled = unbiasedShuffle(filtered);
    state.winners = shuffled.slice(0, count);
    state.eligible = eligible;

    displayWinners();
    saveState();
  }

  // Unbiased Fisher-Yates shuffle
  function unbiasedShuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      // Generate unbiased random index
      const j = secureRandomInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  // Generate unbiased random integer using rejection sampling
  function secureRandomInt(max) {
    const randomBuffer = new Uint32Array(1);
    const maxValid = Math.floor(0xFFFFFFFF / max) * max;

    let value;
    do {
      crypto.getRandomValues(randomBuffer);
      value = randomBuffer[0];
    } while (value >= maxValid);

    return value % max;
  }

  function displayWinners() {
    winnersList.innerHTML = '';

    state.winners.forEach((winner, index) => {
      const item = document.createElement('div');
      item.className = 'winner-item';

      const rank = document.createElement('div');
      rank.className = 'winner-rank';
      rank.textContent = index + 1;

      const info = document.createElement('div');
      info.className = 'winner-info';

      const link = document.createElement('a');
      link.href = `https://twitter.com/${encodeURIComponent(winner.username)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'winner-link';

      const username = document.createElement('span');
      username.className = 'winner-username';
      username.textContent = '@' + winner.username;
      link.appendChild(username);

      info.appendChild(link);

      if (winner.followerCount !== undefined) {
        const meta = document.createElement('div');
        meta.className = 'winner-meta';
        meta.textContent = winner.followerCount.toLocaleString() + ' followers';
        info.appendChild(meta);
      }

      item.appendChild(rank);
      item.appendChild(info);
      winnersList.appendChild(item);
    });

    winnersSection.classList.remove('hidden');
  }

  async function copyWinners() {
    const text = state.winners.map((w, i) => `${i + 1}. @${w.username}`).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      copyWinnersBtn.textContent = 'Copied!';
      copyWinnersBtn.classList.add('btn-success');
      setTimeout(() => {
        copyWinnersBtn.textContent = 'Copy';
        copyWinnersBtn.classList.remove('btn-success');
      }, 2000);
    } catch (e) {
      showError('Failed to copy. Try selecting and copying manually.');
    }
  }

  async function resetGiveaway() {
    state = {
      tweetId: null,
      retweeters: [],
      likers: [],
      followers: {},
      eligible: [],
      winners: [],
      isCollecting: false,
      currentCollection: null
    };

    collectionQueue = [];
    isProcessingQueue = false;

    try {
      await chrome.storage.local.remove(['giveawayState', 'collectedData', 'pendingCollection']);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_DATA' });
    } catch (e) {}

    tweetUrlInput.value = '';
    winnersSection.classList.add('hidden');
    collectAllBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');

    // Reset status indicators
    if (statusRetweet) {
      statusRetweet.className = 'requirement-status status-idle';
      statusRetweet.textContent = 'Not collected';
    }
    if (statusLike) {
      statusLike.className = 'requirement-status status-idle';
      statusLike.textContent = 'Not collected';
    }

    updateUI();
    hideError();
    hideProgress();
  }

  function updateUI() {
    // Update stats
    statRetweeters.textContent = state.retweeters.length.toLocaleString();
    statLikers.textContent = state.likers.length.toLocaleString();

    if (statFollowers) {
      const totalFollowers = Object.values(state.followers).reduce((sum, arr) => sum + arr.length, 0);
      statFollowers.textContent = totalFollowers.toLocaleString();
    }

    const eligible = calculateEligible();
    const filtered = applyFilters(eligible);

    statEligible.textContent = eligible.length.toLocaleString();
    statFiltered.textContent = filtered.length.toLocaleString();

    // Update status indicators
    if (state.retweeters.length > 0) {
      updateCollectionStatus('retweeters', 'complete', state.retweeters.length);
    }
    if (state.likers.length > 0) {
      updateCollectionStatus('likers', 'complete', state.likers.length);
    }

    // Enable/disable pick button
    pickBtn.disabled = filtered.length === 0;

    // Update buttons based on collection state
    if (state.isCollecting) {
      collectAllBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      collectAllBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
    }
  }

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.className = 'message error-msg';
    errorDiv.classList.remove('hidden');
    errorDiv.setAttribute('role', 'alert');
  }

  function showWarning(msg) {
    errorDiv.textContent = msg;
    errorDiv.className = 'message warning-msg';
    errorDiv.classList.remove('hidden');
  }

  function showSuccess(msg) {
    errorDiv.textContent = msg;
    errorDiv.className = 'message success-msg';
    errorDiv.classList.remove('hidden');
    setTimeout(hideError, 3000);
  }

  function hideError() {
    errorDiv.classList.add('hidden');
  }

  function showProgress(msg) {
    if (progressDiv && progressText) {
      progressText.textContent = msg;
      progressDiv.classList.remove('hidden');
    }
  }

  function hideProgress() {
    if (progressDiv) {
      progressDiv.classList.add('hidden');
    }
  }
});
