# Orion - APT/USD Binary Betting DApp

A Next.js + Aptos DApp for 5-minute binary betting on APT/USD price movements, featuring real-time price feeds from Pyth Network and a clean, modern UI.

## Features

- 🎯 **5-minute binary betting** on APT/USD price movements
- 📊 **Real-time price charts** with Pyth Network WebSocket streaming
- 💰 **Proportional winnings** - winners share the total pool
- 🔒 **Decentralized** - all logic runs on Aptos blockchain
- 🎨 **Modern UI** with Tailwind CSS and responsive design
- 📱 **Mobile-friendly** interface
- 🔐 **Multiple wallet support** (Petra, Martian, Pontem, Rise)

## How It Works

1. **Choose Direction**: Predict if APT/USD will go UP or DOWN in the next 5 minutes
2. **Place Your Bet**: Set your bet amount and wait for the round to end
3. **Claim Winnings**: Winners share the total pool proportionally, losers' bets go to winners

### Important Rules

- **Fee**: 2-5% fee goes to treasury on winning rounds
- **Tie**: If price ends exactly where it started, all bets are refunded
- **Oracle**: Prices sourced from Pyth Network for fairness and accuracy
- **Minimum**: 0.01 APT minimum bet amount

## Tech Stack

### Frontend
- **Next.js 15** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Lightweight Charts** for price visualization
- **Lucide React** for icons

### Blockchain
- **Aptos** blockchain (testnet)
- **Move** smart contracts
- **Aptos Wallet Adapter** for wallet integration
- **@aptos-labs/ts-sdk** for blockchain interactions

### Price Feeds
- **Pyth Network** for real-time APT/USD prices
- **Pyth Hermes** WebSocket for live streaming
- **Historical price data** for settlement accuracy

## Quick Start

### Prerequisites

- Node.js 18+ and Bun (recommended package manager)
- Aptos CLI (for Move contract deployment)
- An Aptos wallet (Petra recommended)
- Testnet APT tokens

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/orion
   cd orion
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp env.template .env.local
   ```

   Fill in the required values in `.env.local`:
   ```env
   # Aptos Network Configuration
   NEXT_PUBLIC_APTOS_NETWORK=testnet
   NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1

   # Pyth Network Configuration
   NEXT_PUBLIC_PYTH_ENDPOINT=https://hermes.pyth.network
   NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID=0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5

   # Move Module Configuration (update after deployment)
   NEXT_PUBLIC_MODULE_ADDRESS=0x1
   NEXT_PUBLIC_MODULE_NAME=binary_betting

   # Admin Configuration (for keeper operations)
   ADMIN_PRIVATE_KEY=your_admin_private_key_here
   ```

4. **Deploy the Move contract**
   ```bash
   cd move
   aptos init --network testnet
   aptos move compile
   aptos move test
   aptos move publish --named-addresses binary_betting=default
   ```

5. **Update environment with deployed address**
   Update `NEXT_PUBLIC_MODULE_ADDRESS` in `.env.local` with your deployed contract address.

6. **Initialize the contract**
   ```bash
   # Replace with your admin account and treasury address
   aptos move run \
     --function-id 'YOUR_MODULE_ADDRESS::binary_betting::init' \
     --args u64:200 address:YOUR_TREASURY_ADDRESS
   ```

7. **Start the development server**
   ```bash
   bun dev
   ```

8. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Contract Deployment

### Step-by-step deployment

1. **Initialize Aptos CLI**
   ```bash
   cd move
   aptos init --network testnet
   ```

2. **Compile the contract**
   ```bash
   aptos move compile
   ```

3. **Run tests**
   ```bash
   aptos move test
   ```

4. **Publish the contract**
   ```bash
   aptos move publish --named-addresses binary_betting=default
   ```

5. **Initialize the contract state**
   ```bash
   aptos move run \
     --function-id 'YOUR_DEPLOYED_ADDRESS::binary_betting::init' \
     --args u64:200 address:YOUR_TREASURY_ADDRESS
   ```

### Contract Functions

- `init(admin, fee_bps, treasury)` - Initialize contract
- `start_round(start_price, duration_secs)` - Start new betting round
- `place_bet(side_up: bool, amount: u64)` - Place a bet
- `settle(round_id, end_price)` - Settle completed round
- `claim(round_id)` - Claim winnings from settled round

## API Endpoints

### Price Data
- `GET /api/price` - Get current APT/USD price
- `POST /api/price` - Get historical price for timestamp

### Keeper Operations
- `GET /api/keeper/start` - Check if new round should start
- `POST /api/keeper/start` - Start new betting round
- `GET /api/keeper/settle` - Check rounds needing settlement
- `POST /api/keeper/settle` - Settle specific round
- `GET /api/keeper/schedule` - Run keeper maintenance tasks

## Development

### Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configuration
├── providers/          # Context providers
└── types/              # TypeScript type definitions

move/
├── sources/            # Move source files
├── tests/              # Move tests
└── Move.toml          # Move project configuration
```

### Key Components

- `PriceChart` - Real-time price chart with bet markers
- `BettingPanel` - Betting interface with countdown timer
- `WalletButton` - Wallet connection and management
- `RoundsHistory` - Past rounds and claim interface
- `RecentBets` - Live feed of recent bets

### State Management

The app uses Zustand for state management with the following stores:

- **Round data**: Current and past rounds
- **User bets**: User's betting history and claimable rounds
- **Price data**: Real-time price feed for charts
- **UI state**: Loading states, errors, transaction status

### Real-time Features

- **WebSocket connection** to Pyth Hermes for live prices
- **Automatic round refresh** when rounds expire
- **Live bet markers** on price chart
- **Real-time countdown** timers

## Testing

### Move Contract Tests

```bash
cd move
aptos move test
```

The test suite covers:
- UP wins scenario with fee calculation
- DOWN wins scenario with proportional payouts
- Tie scenario with full refunds
- Multiple bettors with correct distributions
- Error cases and edge conditions

### Frontend Testing

```bash
bun run lint
bun run type-check
```

## Deployment

### Production Deployment

1. **Deploy to Vercel/Netlify**
   ```bash
   bun run build
   ```

2. **Set production environment variables**
   - Update `NEXT_PUBLIC_MODULE_ADDRESS` with mainnet address
   - Set `NEXT_PUBLIC_APTOS_NETWORK=mainnet`
   - Configure production Pyth endpoints

3. **Set up keeper automation**
   - Use a cron service (GitHub Actions, Vercel Cron, etc.)
   - Call `/api/keeper/schedule` every minute
   - Monitor for failed transactions

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APTOS_NETWORK` | Aptos network (testnet/mainnet) | Yes |
| `NEXT_PUBLIC_APTOS_NODE_URL` | Aptos RPC endpoint | Yes |
| `NEXT_PUBLIC_PYTH_ENDPOINT` | Pyth Hermes endpoint | Yes |
| `NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID` | APT/USD price feed ID | Yes |
| `NEXT_PUBLIC_MODULE_ADDRESS` | Deployed contract address | Yes |
| `NEXT_PUBLIC_MODULE_NAME` | Contract module name | No |
| `ADMIN_PRIVATE_KEY` | Admin private key for keeper | Yes |

## Security Considerations

- **Testnet only**: This demo is for testnet use only
- **Price oracle**: Relies on Pyth Network for price feeds
- **Admin key**: Keep admin private key secure
- **Smart contract**: Audited Move code with comprehensive tests
- **Frontend**: No private keys stored in browser

## 📦 Package Manager - Bun

This project is optimized for **Bun** - a fast JavaScript runtime and package manager. Here's why we use Bun:

### Why Bun?
- ⚡ **3x faster** installs compared to npm/yarn
- 🚀 **Built-in bundler** and test runner
- 🔧 **Drop-in replacement** for Node.js
- 📦 **Better dependency resolution**
- 🛡️ **TypeScript support** out of the box

### Installation
```bash
# Install Bun (macOS/Linux)
curl -fsSL https://bun.sh/install | bash

# Or using npm (if you have Node.js)
npm install -g bun

# Verify installation
bun --version
```

### Common Bun Commands
```bash
# Install dependencies
bun install

# Run development server
bun dev

# Build for production
bun run build

# Run linting
bun run lint

# Type checking
bun run type-check

# Clean build artifacts
bun run clean
```

### Bun Configuration
The project includes:
- `bunfig.toml` - Bun configuration for optimized installs
- `.bunignore` - Files to ignore during Bun operations
- Optimized scripts in `package.json`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Open GitHub issues for bugs or feature requests
- **Community**: Join our Discord/Telegram for discussions

## Acknowledgments

- **Aptos Labs** for the blockchain infrastructure
- **Pyth Network** for reliable price feeds
- **Move language** for safe smart contract development
- **Next.js team** for the excellent framework

---

**⚠️ Disclaimer**: This is a demonstration application. Do not use real funds. Only use testnet tokens for testing purposes.