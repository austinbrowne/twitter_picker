/**
 * Popup script - main UI logic
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
  const pickBtn = document.getElementById('pick-btn');
  const winnerCountInput = document.getElementById('winner-count');
  const winnersSection = document.getElementById('step-winners');
  const winnersList = document.getElementById('winners-list');
  const copyWinnersBtn = document.getElementById('copy-winners');
  const repickBtn = document.getElementById('repick-btn');
  const newGiveawayBtn = document.getElementById('new-giveaway-btn');
  const errorDiv = document.getElementById('error');

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
    winners: []
  };

  // Load saved state
  const savedState = await chrome.storage.local.get(['giveawayState']);
  if (savedState.giveawayState) {
    state = savedState.giveawayState;
    updateUI();
  }

  // Try to detect tweet from current tab
  detectCurrentTweet();

  // Event listeners
  detectBtn.addEventListener('click', detectCurrentTweet);

  addFollowBtn.addEventListener('click', () => {
    addFollowInput();
  });

  followAccountsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-follow')) {
      const row = e.target.closest('.follow-input-row');
      if (followAccountsContainer.children.length > 1) {
        row.remove();
      } else {
        row.querySelector('input').value = '';
      }
    }
  });

  collectAllBtn.addEventListener('click', collectAll);
  pickBtn.addEventListener('click', pickWinners);
  copyWinnersBtn.addEventListener('click', copyWinners);
  repickBtn.addEventListener('click', pickWinners);
  newGiveawayBtn.addEventListener('click', resetGiveaway);

  // Listen for collection updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'COLLECTION_PROGRESS') {
      updateCollectionStatus(message.collectType, 'collecting', message.count, message.account);
    } else if (message.type === 'COLLECTION_COMPLETE') {
      updateCollectionStatus(message.collectType, 'complete', message.count, message.account);
      // Fetch the collected data
      fetchCollectedData();
    }
  });

  // Functions
  async function detectCurrentTweet() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('twitter.com') && !tab.url.includes('x.com')) {
        showError('Please open a Twitter/X page');
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TWEET_ID' });

      if (response?.tweetId) {
        state.tweetId = response.tweetId;
        tweetUrlInput.value = tab.url;
        hideError();
      } else {
        // Try to extract from URL
        const match = tab.url.match(/\/status\/(\d+)/);
        if (match) {
          state.tweetId = match[1];
          tweetUrlInput.value = tab.url;
          hideError();
        } else {
          showError('Navigate to a tweet to detect it');
        }
      }
    } catch (e) {
      showError('Could not detect tweet. Make sure you\'re on a tweet page.');
    }
  }

  function addFollowInput() {
    const row = document.createElement('div');
    row.className = 'follow-input-row';
    row.innerHTML = `
      <input type="text" placeholder="@username" class="follow-input">
      <button class="btn btn-secondary remove-follow">×</button>
    `;
    followAccountsContainer.appendChild(row);
  }

  function getFollowAccounts() {
    const inputs = followAccountsContainer.querySelectorAll('.follow-input');
    return Array.from(inputs)
      .map(input => input.value.trim().replace(/^@/, '').toLowerCase())
      .filter(v => v.length > 0);
  }

  async function collectAll() {
    if (!state.tweetId) {
      // Try to extract from input
      const match = tweetUrlInput.value.match(/\/status\/(\d+)/);
      if (match) {
        state.tweetId = match[1];
      } else {
        showError('Please enter a valid tweet URL');
        return;
      }
    }

    collectAllBtn.disabled = true;
    collectAllBtn.textContent = 'Collecting...';
    hideError();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      // Collect retweeters first
      if (reqRetweet.checked) {
        updateCollectionStatus('retweeters', 'collecting', 0);
        await chrome.storage.local.set({
          pendingCollection: { type: 'retweeters', tweetId: state.tweetId }
        });
        await chrome.tabs.sendMessage(tab.id, {
          type: 'START_COLLECT',
          collectType: 'retweeters',
          tweetId: state.tweetId
        });

        // Wait for collection to complete (popup might close during navigation)
        // The content script will continue and save data
      }

      showError('Collection started. The page will navigate to collect data. Re-open this popup when done.');

    } catch (e) {
      showError('Error starting collection: ' + e.message);
      collectAllBtn.disabled = false;
      collectAllBtn.textContent = 'Collect All Data';
    }
  }

  async function fetchCollectedData() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_DATA' });

      if (response) {
        if (response.retweeters) {
          state.retweeters = response.retweeters;
        }
        if (response.likers) {
          state.likers = response.likers;
        }
        if (response.followers) {
          state.followers = { ...state.followers, ...response.followers };
        }

        await saveState();
        updateUI();
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    }
  }

  function updateCollectionStatus(type, status, count, account) {
    let statusEl;

    if (type === 'retweeters') {
      statusEl = statusRetweet;
    } else if (type === 'likers') {
      statusEl = statusLike;
    } else if (type === 'followers' && account) {
      // Find or create status element for this account
      // For simplicity, we'll update a general indicator
      return;
    }

    if (!statusEl) return;

    statusEl.className = 'requirement-status';

    if (status === 'collecting') {
      statusEl.classList.add('status-collecting');
      statusEl.textContent = `Collecting... (${count})`;
    } else if (status === 'complete') {
      statusEl.classList.add('status-complete');
      statusEl.textContent = `${count} collected`;
    } else {
      statusEl.classList.add('status-idle');
      statusEl.textContent = 'Not collected';
    }
  }

  function calculateEligible() {
    let eligibleSet = null;

    if (reqRetweet.checked && state.retweeters.length > 0) {
      const set = new Set(state.retweeters.map(u => u.username.toLowerCase()));
      eligibleSet = eligibleSet ? intersection(eligibleSet, set) : set;
    }

    if (reqLike.checked && state.likers.length > 0) {
      const set = new Set(state.likers.map(u => u.username.toLowerCase()));
      eligibleSet = eligibleSet ? intersection(eligibleSet, set) : set;
    }

    if (reqFollow.checked) {
      const accounts = getFollowAccounts();
      for (const account of accounts) {
        const followers = state.followers[account] || [];
        if (followers.length > 0) {
          const set = new Set(followers.map(u => u.username.toLowerCase()));
          eligibleSet = eligibleSet ? intersection(eligibleSet, set) : set;
        }
      }
    }

    if (!eligibleSet) return [];

    // Build user objects
    const userMap = new Map();
    [...state.likers, ...state.retweeters].forEach(u => {
      userMap.set(u.username.toLowerCase(), u);
    });
    Object.values(state.followers).flat().forEach(u => {
      if (!userMap.has(u.username.toLowerCase())) {
        userMap.set(u.username.toLowerCase(), u);
      }
    });

    return Array.from(eligibleSet).map(u => userMap.get(u)).filter(Boolean);
  }

  function intersection(setA, setB) {
    return new Set([...setA].filter(x => setB.has(x)));
  }

  function applyFilters(users) {
    const minFollowers = parseInt(document.getElementById('filter-followers').value) || 0;
    const minTweets = parseInt(document.getElementById('filter-tweets').value) || 0;
    const minAge = parseInt(document.getElementById('filter-age').value) || 0;
    const requireAvatar = document.getElementById('filter-avatar').checked;

    const minDate = new Date();
    minDate.setDate(minDate.getDate() - minAge);

    return users.filter(u => {
      if (minFollowers && u.followerCount !== undefined && u.followerCount < minFollowers) {
        return false;
      }
      if (minTweets && u.tweetCount !== undefined && u.tweetCount < minTweets) {
        return false;
      }
      if (minAge && u.createdAt) {
        const created = new Date(u.createdAt);
        if (created > minDate) return false;
      }
      if (requireAvatar && (!u.avatarUrl || u.avatarUrl.includes('default_profile'))) {
        return false;
      }
      return true;
    });
  }

  function pickWinners() {
    const eligible = calculateEligible();
    const filtered = applyFilters(eligible);
    const count = parseInt(winnerCountInput.value) || 1;

    if (filtered.length === 0) {
      showError('No eligible participants found. Collect more data first.');
      return;
    }

    // Crypto shuffle
    const shuffled = cryptoShuffle(filtered);
    state.winners = shuffled.slice(0, Math.min(count, shuffled.length));
    state.eligible = eligible;

    displayWinners();
    saveState();
  }

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

  function displayWinners() {
    winnersList.innerHTML = '';

    state.winners.forEach((winner, index) => {
      const item = document.createElement('div');
      item.className = 'winner-item';
      item.innerHTML = `
        <div class="winner-rank">${index + 1}</div>
        <div class="winner-info">
          <a href="https://twitter.com/${winner.username}" target="_blank" class="winner-link">
            <span class="winner-username">@${winner.username}</span>
          </a>
          <div class="winner-meta">
            ${winner.followerCount !== undefined ? winner.followerCount.toLocaleString() + ' followers' : ''}
          </div>
        </div>
      `;
      winnersList.appendChild(item);
    });

    winnersSection.classList.remove('hidden');
  }

  function copyWinners() {
    const text = state.winners.map((w, i) => `${i + 1}. @${w.username}`).join('\n');
    navigator.clipboard.writeText(text);
    copyWinnersBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyWinnersBtn.textContent = 'Copy';
    }, 2000);
  }

  async function resetGiveaway() {
    state = {
      tweetId: null,
      retweeters: [],
      likers: [],
      followers: {},
      eligible: [],
      winners: []
    };

    await chrome.storage.local.remove(['giveawayState', 'pendingCollection']);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_DATA' });
    } catch (e) {}

    tweetUrlInput.value = '';
    winnersSection.classList.add('hidden');
    updateUI();
    hideError();
    collectAllBtn.disabled = false;
    collectAllBtn.textContent = 'Collect All Data';
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
  }

  async function saveState() {
    await chrome.storage.local.set({ giveawayState: state });
  }

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
  }

  function hideError() {
    errorDiv.classList.add('hidden');
  }
});
