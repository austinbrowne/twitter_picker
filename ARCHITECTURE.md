# Twitter Giveaway Picker - Architecture

## Design Philosophy

**Zero Cost, Maximum Features** - A fully client-side application that requires no backend server or API subscriptions.

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | React 18 + TypeScript | Type safety, modern hooks |
| Build Tool | Vite | Fast dev experience, optimized builds |
| Styling | Tailwind CSS | Rapid UI development |
| State | React Context + useReducer | No external dependencies |
| Randomness | Web Crypto API | Cryptographically secure |
| Testing | Vitest + React Testing Library | Fast, compatible with Vite |

## Data Input Methods (No API Required)

Since Twitter API costs $100/month minimum, we support these free alternatives:

### 1. Manual Entry
- User pastes list of usernames/handles
- Simple but requires manual collection

### 2. JSON/CSV Upload
- Export from other tools or manual collection
- Supports structured participant data

### 3. HAR File Parsing
- User records network traffic while browsing Twitter
- We parse the HAR file locally (client-side)
- Completely ToS-compliant (we're parsing user's own data)

### 4. Tweet URL + Browser Bookmarklet
- Provide a bookmarklet that extracts data from Twitter page
- User clicks bookmarklet on retweets/likes page
- Data copied to clipboard, pasted into our app

## Core Features

### Random Selection Engine
```
┌─────────────────────────────────────────────────────┐
│                Selection Pipeline                   │
├─────────────────────────────────────────────────────┤
│ 1. Parse Input Data                                 │
│    └─▶ Normalize usernames, extract metadata        │
│                                                     │
│ 2. Apply Filters                                    │
│    └─▶ Min followers, account age, profile checks   │
│                                                     │
│ 3. Deduplicate                                      │
│    └─▶ Remove duplicate entries                     │
│                                                     │
│ 4. Cryptographic Random Selection                   │
│    └─▶ crypto.getRandomValues() for fairness        │
│                                                     │
│ 5. Generate Verification                            │
│    └─▶ Draw ID, timestamp, hash of participants     │
└─────────────────────────────────────────────────────┘
```

### Bot/Fake Account Filtering

| Filter | Description | Default |
|--------|-------------|---------|
| Min Followers | Accounts with fewer followers excluded | 5 |
| Min Following | Accounts following fewer excluded | 5 |
| Account Age | Accounts newer than X days excluded | 30 days |
| Has Avatar | Exclude default/no profile picture | On |
| Has Bio | Exclude accounts without bio | Off |
| Min Tweets | Exclude accounts with few tweets | 10 |
| Blacklist | Manual exclusion list | Empty |

### Verification System

Each draw generates:
- **Draw ID**: Unique identifier (UUID v4)
- **Timestamp**: ISO 8601 format
- **Participant Hash**: SHA-256 of all participants
- **Selection Seed**: The random seed used
- **Shareable Certificate**: PNG/PDF with QR code

## File Structure

```
twitter_picker/
├── src/
│   ├── components/          # React components
│   │   ├── ParticipantInput/
│   │   ├── FilterConfig/
│   │   ├── WinnerDisplay/
│   │   ├── Certificate/
│   │   └── common/
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   │   ├── random.ts        # Cryptographic random
│   │   ├── parser.ts        # Input parsing
│   │   ├── filter.ts        # Bot filtering
│   │   ├── hash.ts          # SHA-256 hashing
│   │   └── export.ts        # CSV/JSON export
│   ├── types/               # TypeScript types
│   ├── context/             # React context
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── bookmarklet.js       # Browser bookmarklet
├── tests/
└── package.json
```

## Security Considerations

1. **No data leaves the browser** - All processing is client-side
2. **Cryptographic randomness** - Not Math.random()
3. **Verifiable selection** - Hash chain for audit trail
4. **No tracking** - No analytics, no cookies

## Competitive Advantages

| Feature | Our Tool | Comment Picker | TweetDraw |
|---------|----------|----------------|-----------|
| Free entry limit | Unlimited | 25 | 3,000 |
| Multiple winners | Yes (50+) | 1 (free) | 1 |
| Bot filtering | Advanced | Basic | None |
| Verification ID | Yes | No | No |
| Export | CSV/JSON | Premium | No |
| Cost | $0 | $0-8/mo | $0 |
| Works offline | Yes | No | No |
