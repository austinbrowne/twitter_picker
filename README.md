# Twitter Giveaway Picker

A free, open-source, client-side Twitter/X giveaway winner picker with advanced bot filtering.

## Features

- **100% Free** - No API costs, no subscriptions
- **Unlimited Entries** - No artificial limits like other tools
- **Client-Side Only** - All processing happens in your browser, no data sent to servers
- **Cryptographically Fair** - Uses Web Crypto API for truly random selection
- **Bot Filtering** - Filter out fake accounts with configurable rules
- **Multiple Input Methods** - Paste usernames, upload CSV/JSON, or use HAR files
- **Export Results** - Download as CSV, JSON, or plain text
- **Verification** - Each draw generates a unique ID and participant hash

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## How It Works

Since the Twitter API costs $100/month minimum for read access, this tool uses alternative data input methods:

### Input Methods

1. **Manual Entry** - Paste usernames directly (one per line or comma-separated)
2. **CSV Upload** - Upload a CSV file with a `username` column
3. **JSON Upload** - Upload JSON data (supports Twitter API format)
4. **HAR File** - Record your browser's network traffic while viewing retweets/likes, then upload the HAR file

### Bot Filtering

Configure filters to exclude suspicious accounts:

- Minimum follower count
- Minimum following count
- Minimum account age (days)
- Minimum tweet count
- Require profile picture
- Require bio
- Blacklist specific users

### Verification

Each draw generates:
- **Draw ID** - Unique identifier for the draw
- **Participant Hash** - SHA-256 hash of all participants for tamper verification
- **Random Seed** - The cryptographic seed used for selection

## Tech Stack

- React 18 + TypeScript
- Vite for fast builds
- Tailwind CSS for styling
- Vitest for testing
- Web Crypto API for secure randomness

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests with coverage
npm run test:coverage
```

## Why This Tool?

Most giveaway picker tools have significant limitations:

| Tool | Free Limit | Multiple Winners | Bot Filtering |
|------|------------|-----------------|---------------|
| Comment Picker | 25 entries | No (free) | Basic |
| Simpliers | 200 entries | No (free) | Basic |
| TweetDraw | 3,000 retweets | No | None |
| **This Tool** | **Unlimited** | **Yes** | **Advanced** |

## Privacy

- No data is sent to any server
- No analytics or tracking
- No cookies
- Open source - verify the code yourself

## License

MIT

## Contributing

Contributions welcome! Please open an issue or pull request.
