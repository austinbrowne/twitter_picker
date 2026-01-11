# Twitter Giveaway Picker - Chrome Extension

A free, standalone Chrome extension for picking Twitter giveaway winners. No API costs, no servers.

## Features

- **Collect Retweeters** - Auto-scrolls and captures all users who retweeted
- **Collect Likers** - Auto-scrolls and captures all users who liked
- **Verify Follows** - Check followers of multiple accounts
- **Find Intersection** - Only users who meet ALL requirements are eligible
- **Bot Filtering** - Filter by followers, tweets, account age, profile picture
- **Cryptographic Random** - Uses `crypto.getRandomValues()` for fair selection
- **100% Client-side** - All data stays in your browser

## Installation

1. Download/clone this folder
2. Convert SVG icons to PNG (16x16, 48x48, 128x128) or use any icon
3. Open Chrome → `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked"
6. Select this `extension` folder

## How to Use

### Step 1: Open Your Giveaway Tweet
Navigate to the tweet in Chrome

### Step 2: Click the Extension
Click the extension icon in your toolbar

### Step 3: Configure Requirements
- Check which requirements apply (retweet, like, follow)
- Add usernames for required follow accounts

### Step 4: Collect Data
Click "Collect All Data" - the extension will:
1. Navigate to the Retweets tab and scroll to collect all retweeters
2. Navigate to the Likes tab and scroll to collect all likers
3. Navigate to each required account's followers page

**Note**: You may need to re-open the popup after each collection step.

### Step 5: Pick Winners
- Set bot filters (min followers, account age, etc.)
- Choose number of winners
- Click "Pick Winners"

## How It Works

The extension intercepts Twitter's internal API responses as you browse. When you scroll through the retweets/likes/followers pages, Twitter loads user data via its GraphQL API. We capture these responses and extract user information.

This means:
- **No external API calls** - Uses your logged-in session
- **No rate limits** - Just normal browsing
- **Full user data** - Follower counts, account age, etc.

## Limitations

- You must be logged into Twitter
- Large giveaways require more scrolling time
- Some data may be incomplete for private accounts

## Privacy

- All data is stored locally in your browser
- Nothing is sent to any external server
- Data is cleared when you start a new giveaway
