## Slop

This project was made 100% with AI. I haven't done much to this code myself.

# 🔥 Hot Stocks

A virtual trading game for a private group of friends. Each user starts with $100,000 virtual cash and can trade stocks, ETFs, and crypto 24/7.

## Features

- **$100,000 Starting Balance** - Each user begins with virtual cash to trade
- **24/7 Trading** - Place and fill orders any time, including outside market hours
- **Multiple Strategies** - Each user can manage up to 3 strategies (A, B, C) as separate portfolios
- **Real-Time Quotes** - Live price updates via WebSocket streaming
- **Leaderboard** - Rankings across all strategies by net worth
- **Friends View** - Browse and view friends' strategies and holdings (read-only)
- **Transaction Ledger** - Immutable record of all fills, commissions, and adjustments
- **CSV Export** - Download your transaction history

## Tech Stack

- **Frontend**: SvelteKit + TypeScript
- **Backend**: Fastify + TypeScript
- **Database**: PostgreSQL
- **Authentication**: Auth0
- **Market Data**: Alpha Vantage API

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Auth0 account
- Alpha Vantage API key (free at <https://www.alphavantage.co/support/#api-key>)

## Setup

### 1. Clone and Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set Up PostgreSQL Database

```bash
# Create database
createdb hotstocks

# Run schema migration
cd backend
psql -d hotstocks -f sql/schema.sql

# Run migrations for updates
npm run db:migrate
```

### 3. Configure Auth0

1. Create a new Auth0 application (Single Page Application)
2. Configure Allowed Callback URLs: `http://localhost:5173`
3. Configure Allowed Logout URLs: `http://localhost:5173`
4. Configure Allowed Web Origins: `http://localhost:5173`
5. Create an API in Auth0 with identifier: `https://hotstocks-api`

### 4. Environment Variables

**Backend** (`backend/.env`):

```env
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:password@localhost:5432/hotstocks
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://hotstocks-api
ALPHA_VANTAGE_API_KEY=your-api-key
COMMISSION_FEE=4.95
STARTING_BALANCE=100000
```

**Frontend** (`frontend/.env`):

```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://hotstocks-api
VITE_API_URL=http://localhost:3000
```

### 5. Run the Application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open <http://localhost:5173> in your browser.

## API Endpoints

### Users

- `GET /api/users/me` - Get current user
- `GET /api/users/me/strategies` - Get user's strategies
- `GET /api/users` - Get all users (friends)
- `GET /api/users/:userId/strategies` - Get a friend's strategies

### Trading

- `POST /api/trade` - Execute a trade
- `GET /api/strategies/:strategyId/positions` - Get positions
- `GET /api/strategies/:strategyId/portfolio` - Get portfolio summary
- `GET /api/strategies/:strategyId/net-worth-history` - Get equity curve data

### Market Data

- `GET /api/market/search?q=` - Search symbols
- `GET /api/market/quote/:symbol` - Get quote
- `GET /api/market/chart/:symbol` - Get chart data
- `WS /api/market/stream` - WebSocket for real-time quotes

### Ledger

- `GET /api/strategies/:strategyId/ledger` - Get transaction history
- `GET /api/strategies/:strategyId/ledger/export` - Export CSV

### Leaderboard

- `GET /api/leaderboard` - Get rankings

## Trading Rules

- **Market Orders Only** - No limit orders
- **$4.95 Commission** - Flat fee per trade
- **24/7 Trading** - Orders fill immediately at current price
- **No Short Selling** - Can only sell shares you own
- **Crypto Support** - Trade BTC, ETH, SOL, and more

## Project Structure

```text
hotstocks/
├── backend/
│   ├── sql/
│   │   └── schema.sql        # Database schema
│   ├── src/
│   │   ├── routes/           # API route handlers
│   │   │   ├── users.ts
│   │   │   ├── trading.ts
│   │   │   ├── market.ts
│   │   │   ├── ledger.ts
│   │   │   └── leaderboard.ts
│   │   ├── auth.ts           # Auth0 JWT verification
│   │   ├── config.ts         # Environment config
│   │   ├── db.ts             # Database connection
│   │   ├── marketData.ts     # Alpha Vantage integration
│   │   └── index.ts          # Fastify server entry
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   ├── components/   # Svelte components
    │   │   │   ├── StrategyToggle.svelte
    │   │   │   ├── SymbolSearch.svelte
    │   │   │   ├── QuoteView.svelte
    │   │   │   ├── TradeTicket.svelte
    │   │   │   ├── Portfolio.svelte
    │   │   │   ├── Ledger.svelte
    │   │   │   ├── Leaderboard.svelte
    │   │   │   └── FriendsView.svelte
    │   │   ├── api.ts        # API client
    │   │   ├── auth.ts       # Auth0 client
    │   │   ├── config.ts     # Frontend config
    │   │   └── stores.ts     # Svelte stores
    │   └── routes/           # SvelteKit pages
    │       ├── +layout.svelte
    │       ├── +page.svelte         # Trade page
    │       ├── portfolio/
    │       ├── history/
    │       ├── leaderboard/
    │       └── friends/
    └── package.json
```

## License

MIT
