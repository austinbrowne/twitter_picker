# Twitter Giveaway Picker

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension-4285F4?logo=googlechrome&logoColor=white)](extension/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A free, open-source Chrome extension for picking Twitter/X giveaway winners. No API costs, no subscriptions, no data sent to servers.

![Twitter Giveaway Picker Demo](docs/demo.gif)
<!-- TODO: Add actual screenshot/gif -->

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Bot Filtering](#bot-filtering)
- [Security](#security)
- [Privacy](#privacy)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Collect Retweeters** - Auto-scrolls and captures all users who retweeted
- **Collect Likers** - Auto-scrolls and captures all users who liked
- **Verify Follows** - Validates winners follow required accounts at pick time
- **Find Intersection** - Only users who meet ALL requirements are eligible
- **Bot Filtering** - Filter by followers, tweets, account age, profile picture
- **Cryptographic Random** - Uses `crypto.getRandomValues()` for provably fair selection
- **100% Client-Side** - All data stays in your browser
- **Unlimited Entries** - No artificial limits like paid tools
- **Multiple Winners** - Pick as many winners as you need

### Why This Tool?

| Tool | Free Limit | Multiple Winners | Bot Filtering | API Cost |
|------|------------|-----------------|---------------|----------|
| Comment Picker | 25 entries | No (free) | Basic | N/A |
| Simpliers | 200 entries | No (free) | Basic | N/A |
| TweetDraw | 3,000 retweets | No | None | N/A |
| Twitter API | N/A | Yes | Custom | $100/mo |
| **This Tool** | **Unlimited** | **Yes** | **Advanced** | **$0** |

## Installation

### From Source (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/twitter_picker.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top right)

4. Click **Load unpacked**

5. Select the `extension` folder from this repository

6. Pin the extension to your toolbar for easy access

## Usage

### Step 1: Navigate to Your Giveaway Tweet

Open the tweet you want to pick winners from in Chrome.

### Step 2: Open the Extension

Click the extension icon in your Chrome toolbar.

### Step 3: Configure Requirements

- **Must Retweet** - Check if users must have retweeted
- **Must Like** - Check if users must have liked
- **Must Follow** - Add usernames of accounts users must follow

### Step 4: Collect Data

Click **"Collect All Data"** - the extension will automatically:

1. Navigate to the Retweets page and scroll to collect all retweeters
2. Navigate to the Likes page and scroll to collect all likers

> **Note**: The popup closes during navigation. Re-open it to see progress. Follower verification happens automatically when picking winners.

### Step 5: Configure Filters & Pick Winners

1. Expand **Bot Filters** to set minimum requirements
2. Enter the number of winners
3. Click **"Pick Winners"**

### Step 6: Announce Winners

Winners are displayed with links to their profiles. Use the **Copy** button to copy usernames for easy announcing.

## How It Works

The extension intercepts Twitter's internal GraphQL API responses as you browse. When you scroll through retweets, likes, or followers pages, Twitter loads user data which we capture and store locally.

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Twitter Page   │────▶│  Extension   │────▶│  Local Storage  │
│  (GraphQL API)  │     │  (Intercept) │     │  (Your Browser) │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

This approach means:
- **No external API calls** - Uses your logged-in session
- **No rate limits** - Just normal browsing behavior
- **Full user data** - Follower counts, account age, bio, etc.
- **No API costs** - Twitter API access costs $100+/month

## Bot Filtering

Filter out suspicious accounts with configurable rules:

| Filter | Default | Description |
|--------|---------|-------------|
| Min Followers | 0 | Accounts must have at least this many followers |
| Min Tweets | 0 | Accounts must have posted at least this many tweets |
| Min Account Age | 0 days | Accounts must be at least this old |
| Profile Picture | Off | Require accounts to have a custom profile picture |

## Security

This extension is designed with security in mind:

- **Origin Validation** - All postMessage communications validate origin
- **Message Authentication** - Unique keys prevent message spoofing
- **Input Sanitization** - All user data is sanitized before storage
- **XSS Prevention** - DOM manipulation uses safe methods (textContent, createElement)
- **No Remote Code** - No external scripts or resources loaded
- **Open Source** - Full code available for audit

### Permissions Explained

| Permission | Why It's Needed |
|------------|-----------------|
| `activeTab` | Access the current Twitter tab to detect tweet URLs |
| `storage` | Store collected data locally in your browser |
| `scripting` | Inject content script to intercept API responses |
| `host_permissions` (twitter.com, x.com) | Run on Twitter pages only |

## Privacy

- **No data collection** - Nothing is sent to any server
- **No analytics** - No tracking or telemetry
- **No cookies** - Extension doesn't set any cookies
- **Local storage only** - All data stays in your browser
- **Clear on demand** - "New Giveaway" button clears all data

## Limitations

- **Must be logged in** - You need an active Twitter session
- **Scrolling time** - Large giveaways require more scrolling (the extension auto-scrolls)
- **Private accounts** - Cannot collect data from private/protected accounts
- **Rate limiting** - Twitter may slow responses if you scroll too fast (the extension handles this)
- **Chrome only** - Currently only supports Chrome/Chromium browsers

## Troubleshooting

### Extension not detecting the tweet

1. Make sure you're on a tweet page (URL contains `/status/`)
2. Try clicking the "Detect" button
3. Refresh the Twitter page and try again

### Collection stops early

1. Twitter may have rate-limited scrolling - wait a minute and try again
2. Check if you've scrolled to the end (no more users to load)
3. Try collecting one type at a time instead of "Collect All"

### No users showing after collection

1. Ensure you stayed on the page during collection
2. Check that users actually exist (view retweets/likes manually)
3. Try clearing data and collecting again

### "0 Eligible" after collection

1. Verify all requirements are checked correctly
2. Ensure you collected all required data types
3. Check that users meet ALL requirements (intersection)

### Extension not working after Chrome update

1. Go to `chrome://extensions/`
2. Click the refresh icon on the extension
3. Reload any open Twitter tabs

## FAQ

### Is this legal?

Yes. The extension only accesses publicly available data that you can see when logged into Twitter. It doesn't bypass any authentication or access private data.

### Is the selection truly random?

Yes. We use the Web Crypto API (`crypto.getRandomValues()`) with rejection sampling to ensure unbiased random selection. This is the same standard used for cryptographic applications.

### Can I pick winners from replies/comments?

Not currently. The extension focuses on retweets, likes, and follows which are the most common giveaway requirements.

### Why do I need to scroll?

Twitter loads users in batches as you scroll (infinite scroll). The extension auto-scrolls to load all users, but large giveaways take longer.

### Can I use this on X.com?

Yes. The extension works on both twitter.com and x.com.

### How many winners can I pick?

Up to 100 at a time, but you can run multiple draws.

### Does this work with quote retweets?

Currently, only regular retweets are collected. Quote retweets appear differently in Twitter's API.

## Contributing

Contributions are welcome! Here's how you can help:

### Reporting Bugs

1. Check existing [issues](../../issues) to avoid duplicates
2. Create a new issue with:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Chrome version and OS

### Suggesting Features

Open an issue with the `enhancement` label describing:
- The feature you'd like
- Why it would be useful
- Any implementation ideas

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/twitter_picker.git
cd twitter_picker

# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the extension/ folder

# Make changes and reload extension to test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Disclaimer**: This tool is not affiliated with, endorsed by, or connected to Twitter/X. Use responsibly and in accordance with Twitter's Terms of Service.
