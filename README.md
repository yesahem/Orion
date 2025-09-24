# Orion - APT/USD Binary Options DApp

A Next.js + Aptos DApp for 5-minute APT/USD binary betting with real-time price feeds from Pyth Network.

## Features

- **Binary Options Trading**: Bet UP or DOWN on APT/USD price movements over 5-minute intervals
- **Real-time Price Data**: Live price feeds via Pyth Network WebSocket integration
- **Interactive Charts**: TradingView-style charts with bet markers using lightweight-charts
- **Wallet Integration**: Seamless Aptos wallet connection (Petra, Pontem, Martian)
- **Automated Rounds**: Keeper system for automatic round start/settlement
- **Fair Settlement**: Oracle-based price settlement with fee distribution
- **Claim System**: Winners claim proportional shares; ties get refunds

## Architecture

### Frontend (Next.js)
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS with custom dark theme
- **State Management**: Zustand for global app state
- **Charts**: Lightweight Charts for price visualization
- **Wallet**: Aptos Wallet Adapter for multi-wallet support

### Smart Contract (Move)
- **Module**: `orion_betting::betting` with comprehensive betting logic
- **Events**: BetPlaced, RoundSettled, WinningsClaimed for tracking
- **Security**: Admin-only functions, timing validation, proper fee handling
- **Testing**: Complete test suite covering win/loss/tie scenarios

### Backend APIs
- **Price Feed**: `/api/price` - Pyth Network integration
- **Keeper**: `/api/keeper/start` and `/api/keeper/settle` for automation
- **WebSocket**: Real-time price streaming for live charts

## Setup Instructions

### Prerequisites

- Node.js 18+ and Bun (recommended) or npm
- Aptos CLI for Move contract deployment
- Git for version control

### 1. Clone and Install

```bash
git clone <repository-url>
cd orion
bun install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Aptos Network Configuration
NEXT_PUBLIC_APTOS_NETWORK=testnet
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1

# Move Module Configuration (update after deployment)
NEXT_PUBLIC_MODULE_ADDRESS=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Pyth Configuration
NEXT_PUBLIC_PYTH_ENDPOINT=https://hermes.pyth.network
NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID=0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5

# Keeper Configuration (for automated round management)
KEEPER_PRIVATE_KEY=your_keeper_private_key_here
ROUND_DURATION_SECONDS=300
```

### 3. Deploy Move Contract

Navigate to the move directory and deploy:

```bash
cd move

# Initialize Aptos account (if needed)
aptos init

# Compile the contract
aptos move compile

# Deploy to testnet
aptos move publish --named-addresses orion_betting=default

# Note the deployed address for .env.local
```

Update `NEXT_PUBLIC_MODULE_ADDRESS` in `.env.local` with the deployed address.

### 4. Initialize Contract

After deployment, initialize the contract:

```bash
# Replace with your admin address, fee (200 = 2%), and treasury address
aptos move run \
  --function-id "0xYOUR_ADDRESS::betting::init" \
  --args address:0xYOUR_ADMIN_ADDRESS u64:200 address:0xYOUR_TREASURY_ADDRESS
```

### 5. Run Development Server

```bash
bun dev
```

Visit `http://localhost:3000` to see the application.

## Testing the Move Contract

Run the comprehensive test suite:

```bash
cd move
aptos move test
```

Tests cover:
- ✅ Full betting flow (place bets, settle, claim)
- ✅ Tie scenarios with refunds
- ✅ Win scenarios with proportional payouts
- ✅ Edge cases (no opposite bets = 2x payout)
- ✅ Fee calculation and distribution
- ✅ Access control and timing validation

## Keeper System

The keeper system automates round management:

### Manual Keeper Operations

Start a new round:
```bash
curl -X POST http://localhost:3000/api/keeper/start
```

Settle a round:
```bash
curl -X POST http://localhost:3000/api/keeper/settle \
  -H "Content-Type: application/json" \
  -d '{"roundId": 1}'
```

### Automated Keeper (Production)

For production, set up automated calls:

1. **Cron Jobs**: Schedule regular API calls
2. **Background Services**: Node.js intervals or separate keeper service
3. **External Services**: Use services like GitHub Actions or cloud functions

Example cron for round start (every 5 minutes):
```bash
*/5 * * * * curl -X POST https://your-domain.com/api/keeper/start
```

## Usage Guide

### For Users

1. **Connect Wallet**: Click "Connect Wallet" and choose your Aptos wallet
2. **View Current Round**: See countdown timer and current pools
3. **Place Bets**: Enter amount and click UP or DOWN before time expires
4. **Monitor Chart**: Watch live price movements with your bet markers
5. **Claim Winnings**: After round settlement, claim your winnings if you won

### For Administrators

1. **Deploy Contract**: Follow deployment instructions above
2. **Initialize System**: Set fee percentage and treasury address
3. **Monitor Rounds**: Ensure keeper system is functioning
4. **Manage Treasury**: Collect fees and manage protocol funds

## API Reference

### GET /api/price

Get current APT/USD price from Pyth Network.

**Response:**
```json
{
  "price": 12.3456,
  "confidence": 0.0012,
  "timestamp": 1699123456,
  "symbol": "APT/USD"
}
```

### POST /api/keeper/start

Start a new betting round (admin only).

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "startPrice": 12345600,
  "timestamp": 1699123456
}
```

### POST /api/keeper/settle

Settle an expired round (admin only).

**Body:**
```json
{
  "roundId": 1
}
```

## Smart Contract Interface

### Entry Functions

- `init(admin, fee_bps, treasury)` - Initialize contract
- `start_round(start_price, duration_secs)` - Start new round
- `place_bet(side_up: bool, amount: u64)` - Place a bet
- `settle(round_id, end_price)` - Settle round
- `claim(round_id)` - Claim winnings

### View Functions

- `get_round(round_id)` - Get round details
- `get_user_bet(round_id, user_addr)` - Get user's bet
- `get_current_round_id()` - Get latest round ID

### Events

- `BetPlaced` - Emitted when user places bet
- `RoundSettled` - Emitted when round is settled
- `WinningsClaimed` - Emitted when user claims winnings

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Environment Variables for Production

Ensure all environment variables are set:

- `NEXT_PUBLIC_APTOS_NETWORK=mainnet` (for production)
- `NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1`
- `NEXT_PUBLIC_MODULE_ADDRESS=<deployed_address>`
- `NEXT_PUBLIC_PYTH_ENDPOINT=https://hermes.pyth.network`
- `NEXT_PUBLIC_PYTH_APT_USD_PRICE_ID=<pyth_price_id>`
- `KEEPER_PRIVATE_KEY=<keeper_private_key>`

## Security Considerations

1. **Private Keys**: Never commit private keys. Use secure environment variable management.
2. **Access Control**: Only admin can start/settle rounds
3. **Timing Validation**: Bets only accepted before expiry
4. **Oracle Security**: Uses Pyth Network for tamper-resistant pricing
5. **Fee Limits**: Maximum 5% fee hardcoded in contract
6. **Reentrancy**: Move's resource model prevents reentrancy attacks

## Troubleshooting

### Common Issues

1. **Wallet Connection Failed**
   - Ensure wallet extension is installed and unlocked
   - Check network matches (testnet/mainnet)

2. **Transaction Failed**
   - Verify sufficient APT balance for gas + bet amount
   - Check if round has expired
   - Ensure contract is properly deployed

3. **Price Feed Issues**
   - Verify Pyth endpoint is accessible
   - Check price ID is correct for APT/USD
   - Ensure WebSocket connection is stable

4. **Keeper Not Working**
   - Verify keeper private key has sufficient balance
   - Check API endpoints are accessible
   - Ensure proper timing for round management

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create GitHub issue for bugs
- Join our Discord for community support
- Check documentation for common solutions

---

Built with ❤️ on Aptos using Pyth Network price feeds.