import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  Round, 
  UserBet, 
  BetPlacedEvent, 
  ChartData, 
  BetMarker, 
  TransactionStatus,
  AppState 
} from '@/types';

interface BettingStore extends AppState {
  // Actions
  setCurrentRound: (round: Round | null) => void;
  setUserBets: (bets: UserBet[]) => void;
  addUserBet: (bet: UserBet) => void;
  updateUserBet: (roundId: number, updates: Partial<UserBet>) => void;
  setRecentBets: (bets: BetPlacedEvent[]) => void;
  addRecentBet: (bet: BetPlacedEvent) => void;
  setPastRounds: (rounds: Round[]) => void;
  addPastRound: (round: Round) => void;
  updatePastRound: (roundId: number, updates: Partial<Round>) => void;
  setPriceData: (data: ChartData[]) => void;
  addPriceData: (data: ChartData) => void;
  setBetMarkers: (markers: BetMarker[]) => void;
  addBetMarker: (marker: BetMarker) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Transaction status
  transactionStatus: TransactionStatus;
  setTransactionStatus: (status: TransactionStatus) => void;
  
  // UI state
  selectedAmount: string;
  setSelectedAmount: (amount: string) => void;
  showClaimModal: boolean;
  setShowClaimModal: (show: boolean) => void;
  claimableRounds: Round[];
  setClaimableRounds: (rounds: Round[]) => void;
  
  // Utility functions
  getCurrentUserBet: () => UserBet | null;
  getTotalUserBet: (roundId: number) => number;
  canClaim: (roundId: number) => boolean;
  reset: () => void;
}

const initialState: AppState = {
  currentRound: null,
  userBets: [],
  recentBets: [],
  pastRounds: [],
  priceData: [],
  betMarkers: [],
  isLoading: false,
  error: null,
};

export const useBettingStore = create<BettingStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // Transaction status
    transactionStatus: {
      pending: false,
      success: false,
      error: undefined,
      hash: undefined,
    },
    
    // UI state
    selectedAmount: '',
    showClaimModal: false,
    claimableRounds: [],
    
    // Actions
    setCurrentRound: (round) => set({ currentRound: round }),
    
    setUserBets: (bets) => set({ userBets: bets }),
    
    addUserBet: (bet) => set((state) => ({
      userBets: [...state.userBets.filter(b => b.roundId !== bet.roundId), bet]
    })),
    
    updateUserBet: (roundId, updates) => set((state) => ({
      userBets: state.userBets.map(bet => 
        bet.roundId === roundId ? { ...bet, ...updates } : bet
      )
    })),
    
    setRecentBets: (bets) => set({ recentBets: bets }),
    
    addRecentBet: (bet) => set((state) => ({
      recentBets: [bet, ...state.recentBets.slice(0, 19)] // Keep last 20
    })),
    
    setPastRounds: (rounds) => set({ pastRounds: rounds }),
    
    addPastRound: (round) => set((state) => ({
      pastRounds: [round, ...state.pastRounds.filter(r => r.id !== round.id)]
    })),
    
    updatePastRound: (roundId, updates) => set((state) => ({
      pastRounds: state.pastRounds.map(round => 
        round.id === roundId ? { ...round, ...updates } : round
      )
    })),
    
    setPriceData: (data) => set({ priceData: data }),
    
    addPriceData: (data) => set((state) => {
      const newData = [...state.priceData, data].slice(-1000); // Keep last 1000 points
      return { priceData: newData };
    }),
    
    setBetMarkers: (markers) => set({ betMarkers: markers }),
    
    addBetMarker: (marker) => set((state) => ({
      betMarkers: [...state.betMarkers, marker]
    })),
    
    setLoading: (loading) => set({ isLoading: loading }),
    
    setError: (error) => set({ error }),
    
    setTransactionStatus: (status) => set({ transactionStatus: status }),
    
    setSelectedAmount: (amount) => set({ selectedAmount: amount }),
    
    setShowClaimModal: (show) => set({ showClaimModal: show }),
    
    setClaimableRounds: (rounds) => set({ claimableRounds: rounds }),
    
    // Utility functions
    getCurrentUserBet: () => {
      const { currentRound, userBets } = get();
      if (!currentRound) return null;
      return userBets.find(bet => bet.roundId === currentRound.id) || null;
    },
    
    getTotalUserBet: (roundId) => {
      const { userBets } = get();
      const bet = userBets.find(b => b.roundId === roundId);
      if (!bet) return 0;
      return bet.upBet + bet.downBet;
    },
    
    canClaim: (roundId) => {
      const { userBets, pastRounds } = get();
      const bet = userBets.find(b => b.roundId === roundId);
      const round = pastRounds.find(r => r.id === roundId);
      
      if (!bet || !round || !round.settled || bet.claimed) return false;
      
      // Can claim if user has a bet and the round is settled
      const hasBet = bet.upBet > 0 || bet.downBet > 0;
      if (!hasBet) return false;
      
      // If it's a tie, user can always claim
      if (round.isTie) return true;
      
      // If UP won and user bet UP, or DOWN won and user bet DOWN
      if (round.upWins && bet.upBet > 0) return true;
      if (!round.upWins && !round.isTie && bet.downBet > 0) return true;
      
      return false;
    },
    
    reset: () => set(initialState),
  }))
);

// Selectors for better performance
export const useCurrentRound = () => useBettingStore((state) => state.currentRound);
export const useUserBets = () => useBettingStore((state) => state.userBets);
export const useRecentBets = () => useBettingStore((state) => state.recentBets);
export const usePastRounds = () => useBettingStore((state) => state.pastRounds);
export const usePriceData = () => useBettingStore((state) => state.priceData);
export const useBetMarkers = () => useBettingStore((state) => state.betMarkers);
export const useIsLoading = () => useBettingStore((state) => state.isLoading);
export const useError = () => useBettingStore((state) => state.error);
export const useTransactionStatus = () => useBettingStore((state) => state.transactionStatus);
export const useSelectedAmount = () => useBettingStore((state) => state.selectedAmount);
export const useShowClaimModal = () => useBettingStore((state) => state.showClaimModal);
export const useClaimableRounds = () => useBettingStore((state) => state.claimableRounds);
