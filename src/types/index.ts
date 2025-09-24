// Betting related types
export interface Round {
  id: number;
  startPrice: number;
  endPrice: number;
  expiryTime: number;
  settled: boolean;
  upPool: number;
  downPool: number;
  upWins?: boolean;
  isTie?: boolean;
}

export interface UserBet {
  roundId: number;
  upBet: number;
  downBet: number;
  claimed: boolean;
}

export interface BetPlacedEvent {
  roundId: number;
  user: string;
  sideUp: boolean;
  amount: number;
  timestamp: number;
}

export interface RoundSettledEvent {
  roundId: number;
  startPrice: number;
  endPrice: number;
  upWins: boolean;
  isTie: boolean;
  upPoolAmount: number;
  downPoolAmount: number;
  feeAmount: number;
  timestamp: number;
}

// Price data types
export interface PriceData {
  price: number;
  confidence: number;
  publishTime: number;
  priceId: string;
}

// Chart data types
export interface ChartData {
  time: number;
  value: number;
}

export interface BetMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
  size: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

// Wallet and transaction types
export interface TransactionStatus {
  pending: boolean;
  success: boolean;
  error?: string;
  hash?: string;
}

// App state types
export interface AppState {
  currentRound: Round | null;
  userBets: UserBet[];
  recentBets: BetPlacedEvent[];
  pastRounds: Round[];
  priceData: ChartData[];
  betMarkers: BetMarker[];
  isLoading: boolean;
  error: string | null;
}

// Contract interaction types
export interface PlaceBetPayload {
  sideUp: boolean;
  amount: number;
}

export interface ClaimPayload {
  roundId: number;
}

// Environment configuration
export interface Config {
  network: string;
  nodeUrl: string;
  moduleAddress: string;
  moduleName: string;
  pythEndpoint: string;
  pythPriceId: string;
}
