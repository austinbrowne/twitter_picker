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

  // Load saved state
  await loadState();

  // Try to detect tweet from current tab - this will clear data if tweet changed
  await detectCurrentTweet();

  updateUI();

  // Display winners if they exist from previous session
  if (state.winners && state.winners.length > 0) {
    displayWinners();
  }

  // Poll for updates while collecting (optimized to only poll when needed)
  let pollInterval = null;
  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
      if (state.isCollecting) {
        await fetchCollectedData();
        updateUI();
      } else {
        // Stop polling when not collecting
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }, 2000);
  }

  // Start polling if already collecting
  if (state.isCollecting) {
    startPolling();
  }

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

  // Debounced UI update for filter changes
  let filterUpdateTimeout = null;
  function debouncedUpdateUI() {
    if (filterUpdateTimeout) clearTimeout(filterUpdateTimeout);
    filterUpdateTimeout = setTimeout(() => {
      updateUI();
      saveSettings();
    }, 150);
  }

  // Update stats when filters change
  document.getElementById('filter-followers').addEventListener('input', debouncedUpdateUI);
  document.getElementById('filter-tweets').addEventListener('input', debouncedUpdateUI);
  document.getElementById('filter-age').addEventListener('input', debouncedUpdateUI);
  document.getElementById('filter-avatar').addEventListener('change', debouncedUpdateUI);

  // Save settings when requirements change
  reqRetweet.addEventListener('change', saveSettings);
  reqLike.addEventListener('change', saveSettings);
  reqFollow.addEventListener('change', saveSettings);
  winnerCountInput.addEventListener('change', saveSettings);
  pickBtn.addEventListener('click', async () => {
    try {
      await pickWinners();
    } catch (e) {
      console.error('[Popup] Pick winners error:', e);
      showError('Error picking winners: ' + e.message);
    }
  });
  copyWinnersBtn.addEventListener('click', copyWinners);
  repickBtn.addEventListener('click', pickWinners);
  newGiveawayBtn.addEventListener('click', resetGiveaway);

  // Listen for collection updates from content script and background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'COLLECTION_PROGRESS') {
      updateCollectionStatus(message.collectType, 'collecting', message.count, message.account);
      showProgress(`Collecting ${message.collectType}: ${message.count} found...`);
    } else if (message.type === 'COLLECTION_COMPLETE') {
      updateCollectionStatus(message.collectType, 'complete', message.count, message.account);
      fetchCollectedData().then(() => updateUI());
    } else if (message.type === 'STORAGE_ERROR') {
      // Show storage error to user
      showWarning('Warning: Failed to save data. Your progress may be lost if you close the browser.');
    } else if (message.type === 'QUEUE_COMPLETE') {
      // All collections done
      state.isCollecting = false;
      collectAllBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      hideProgress();
      fetchCollectedData().then(() => {
        updateUI();
        if (state.retweeters.length > 0 || state.likers.length > 0) {
          showSuccess('Collection complete!');
        }
      });
    }
  });

  // Functions
  async function loadState() {
    try {
      const saved = await chrome.storage.local.get(['giveawayState', 'collectedData', 'giveawaySettings']);

      if (saved.giveawayState) {
        state = { ...state, ...saved.giveawayState };
      }

      if (saved.collectedData) {
        state.retweeters = saved.collectedData.retweeters || [];
        state.likers = saved.collectedData.likers || [];
        state.followers = saved.collectedData.followers || {};
        state.tweetId = saved.collectedData.currentTweetId || state.tweetId;
      }

      // Restore filter settings
      if (saved.giveawaySettings) {
        const settings = saved.giveawaySettings;
        if (settings.minFollowers !== undefined) {
          document.getElementById('filter-followers').value = settings.minFollowers;
        }
        if (settings.minTweets !== undefined) {
          document.getElementById('filter-tweets').value = settings.minTweets;
        }
        if (settings.minAge !== undefined) {
          document.getElementById('filter-age').value = settings.minAge;
        }
        if (settings.requireAvatar !== undefined) {
          document.getElementById('filter-avatar').checked = settings.requireAvatar;
        }
        if (settings.requireRetweet !== undefined) {
          reqRetweet.checked = settings.requireRetweet;
        }
        if (settings.requireLike !== undefined) {
          reqLike.checked = settings.requireLike;
        }
        if (settings.requireFollow !== undefined) {
          reqFollow.checked = settings.requireFollow;
        }
        if (settings.winnerCount !== undefined) {
          winnerCountInput.value = settings.winnerCount;
        }
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

  // Save filter settings (debounced)
  let saveSettingsTimeout = null;
  function saveSettings() {
    if (saveSettingsTimeout) clearTimeout(saveSettingsTimeout);
    saveSettingsTimeout = setTimeout(async () => {
      try {
        await chrome.storage.local.set({
          giveawaySettings: {
            minFollowers: parseInt(document.getElementById('filter-followers').value) || 0,
            minTweets: parseInt(document.getElementById('filter-tweets').value) || 0,
            minAge: parseInt(document.getElementById('filter-age').value) || 0,
            requireAvatar: document.getElementById('filter-avatar').checked,
            requireRetweet: reqRetweet.checked,
            requireLike: reqLike.checked,
            requireFollow: reqFollow.checked,
            winnerCount: parseInt(winnerCountInput.value) || 1
          }
        });
      } catch (e) {
        console.error('Error saving settings:', e);
      }
    }, 500);
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

      let newTweetId = null;

      // Try to get tweet ID from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TWEET_ID' });
        if (response?.tweetId) {
          newTweetId = response.tweetId;
        }
      } catch (e) {
        // Content script not loaded, try URL parsing
      }

      // Extract from URL if not found
      if (!newTweetId) {
        const match = tab.url.match(/\/status\/(\d+)/);
        if (match) {
          newTweetId = match[1];
        }
      }

      if (!newTweetId) {
        showError('Navigate to a tweet to detect it');
        return;
      }

      // Check if this is a different tweet than before
      if (state.tweetId && state.tweetId !== newTweetId) {
        // Different tweet - clear old data
        await clearCollectedData();
      }

      state.tweetId = newTweetId;
      tweetUrlInput.value = tab.url;
      hideError();
      updateUI();

    } catch (e) {
      showError('Could not detect tweet. Refresh the page and try again.');
    }
  }

  async function clearCollectedData() {
    state.retweeters = [];
    state.likers = [];
    state.followers = {};
    state.eligible = [];
    state.winners = [];

    try {
      await chrome.storage.local.remove(['collectedData', 'pendingCollection']);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_DATA' });
    } catch (e) {}

    // Reset status indicators
    if (statusRetweet) {
      statusRetweet.className = 'requirement-status status-idle';
      statusRetweet.textContent = 'Not collected';
    }
    if (statusLike) {
      statusLike.className = 'requirement-status status-idle';
      statusLike.textContent = 'Not collected';
    }

    winnersSection.classList.add('hidden');
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
    startPolling(); // Start polling for updates
    const queue = [];

    // Build collection queue (only retweeters and likers - followers verified at pick time)
    if (reqRetweet.checked) {
      queue.push({ type: 'retweeters', tweetId: state.tweetId });
    }
    if (reqLike.checked) {
      queue.push({ type: 'likers', tweetId: state.tweetId });
    }
    // Note: followers are verified when picking winners, not collected

    if (queue.length === 0) {
      showError('Select at least one requirement');
      state.isCollecting = false;
      return;
    }

    // Update UI
    collectAllBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    showProgress('Starting collection...');

    // Send queue to background script to manage
    try {
      await chrome.runtime.sendMessage({
        type: 'START_QUEUE',
        queue: queue
      });
    } catch (e) {
      showError('Failed to start collection: ' + e.message);
      state.isCollecting = false;
      collectAllBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
    }
  }

  async function stopCollection() {
    state.isCollecting = false;

    try {
      // Clear background queue
      await chrome.runtime.sendMessage({ type: 'CLEAR_QUEUE' });

      // Stop content script collection
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

    const retweeterSet = new Set(state.retweeters.map(u => u.username.toLowerCase()));
    const likerSet = new Set(state.likers.map(u => u.username.toLowerCase()));

    // Start with retweeters if required
    if (reqRetweet.checked && state.retweeters.length > 0) {
      eligibleSet = new Set(retweeterSet);
    }

    // Intersect with likers if required
    if (reqLike.checked && state.likers.length > 0) {
      if (eligibleSet) {
        eligibleSet = new Set([...eligibleSet].filter(u => likerSet.has(u)));
      } else {
        eligibleSet = new Set(likerSet);
      }
    }

    if (!eligibleSet) return [];

    // Build user objects - prefer retweeter data (most complete)
    const userMap = new Map();
    [...state.likers, ...state.retweeters].forEach(u => {
      userMap.set(u.username.toLowerCase(), u);
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
      // Only apply filters when we have the data (don't exclude if data is missing)
      if (minFollowers > 0 && u.followerCount !== undefined) {
        if (u.followerCount < minFollowers) return false;
      }
      if (minTweets > 0 && u.tweetCount !== undefined) {
        if (u.tweetCount < minTweets) return false;
      }
      if (minAge > 0 && u.createdAt) {
        try {
          const created = new Date(u.createdAt);
          if (created > minDate) return false;
        } catch (e) {}
      }
      if (requireAvatar && u.avatarUrl) {
        if (u.avatarUrl.includes('default_profile')) return false;
      }
      return true;
    });
  }

  async function pickWinners() {
    showProgress('Picking winners...');

    const eligible = calculateEligible();
    const filtered = applyFilters(eligible);
    let count = parseInt(winnerCountInput.value) || 1;

    // Validate count
    count = Math.max(1, Math.min(count, 100, filtered.length));

    if (filtered.length === 0) {
      hideProgress();
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

    // Check if we need to verify followers
    const requiredFollows = reqFollow.checked ? getFollowAccounts() : [];

    if (requiredFollows.length > 0) {
      showProgress('Verifying winners follow required accounts...');
      pickBtn.disabled = true;

      try {
        const verifiedWinners = await verifyAndPickWinners(shuffled, count, requiredFollows);
        state.winners = verifiedWinners;
      } catch (e) {
        showError('Failed to verify followers: ' + e.message);
        pickBtn.disabled = false;
        hideProgress();
        return;
      }

      pickBtn.disabled = false;
      hideProgress();
    } else {
      state.winners = shuffled.slice(0, count);
    }

    state.eligible = eligible;
    displayWinners();
    saveState();
  }

  // Verify candidates follow required accounts and return verified winners
  async function verifyAndPickWinners(candidates, count, requiredAccounts) {
    const winners = [];
    const failed = [];
    const errors = [];
    const maxToCheck = Math.min(candidates.length, count + 10); // Check up to 10 extra as backups

    for (let i = 0; i < maxToCheck && winners.length < count; i++) {
      const candidate = candidates[i];
      showProgress(`Verifying @${candidate.username} (${winners.length}/${count} winners, ${i + 1}/${maxToCheck} checked)...`);

      try {
        const result = await checkUserFollows(candidate.username, requiredAccounts);
        if (result.followsAll) {
          winners.push(candidate);
        } else if (result.results) {
          // Track which accounts they don't follow
          const notFollowing = Object.entries(result.results)
            .filter(([_, follows]) => !follows)
            .map(([account]) => account);
          failed.push({ username: candidate.username, notFollowing });
        } else if (result.error) {
          errors.push({ username: candidate.username, error: result.error });
        }
      } catch (e) {
        errors.push({ username: candidate.username, error: e.message });
      }

      // Small delay to avoid rate limiting
      if (i < maxToCheck - 1) {
        await sleep(500);
      }
    }

    // Report issues to user
    if (winners.length < count) {
      let message = `Only found ${winners.length} of ${count} winners who follow all required accounts.`;
      if (failed.length > 0) {
        message += ` ${failed.length} candidates didn't follow required accounts.`;
      }
      if (errors.length > 0) {
        message += ` ${errors.length} verification(s) failed (API errors).`;
      }
      showWarning(message);
    }

    return winners;
  }

  // Check if a user follows all required accounts
  // Returns { followsAll: boolean, results?: { account: boolean }, error?: string }
  async function checkUserFollows(username, requiredAccounts) {
    // Get the user's following list by sending message to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CHECK_FOLLOWS',
      username: username,
      requiredAccounts: requiredAccounts
    });

    // Return full response object for detailed error reporting
    return response || { followsAll: false, error: 'No response from content script' };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    // Handle edge cases that would cause infinite loop or division by zero
    if (max <= 0) return 0;
    if (max === 1) return 0;

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

    try {
      await chrome.storage.local.remove(['giveawayState', 'collectedData', 'pendingCollection', 'giveawaySettings']);

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
