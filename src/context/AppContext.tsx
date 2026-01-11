/**
 * Application state management using React Context
 */

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { AppState, Participant, FilterConfig, Draw, GiveawayConfig } from '@/types';
import { DEFAULT_FILTER_CONFIG, DEFAULT_GIVEAWAY_CONFIG } from '@/types';
import { filterParticipants, selectWinnersWithAlternates, hashParticipants, generateDrawId } from '@/utils';
import { GiveawayService, type VerificationProgress } from '@/api';

// Initial state
const initialState: AppState = {
  step: 'setup',
  inputMode: 'api',
  giveawayConfig: {
    ...DEFAULT_GIVEAWAY_CONFIG,
    bearerToken: '',
  },
  participants: [],
  disqualified: [],
  filterConfig: DEFAULT_FILTER_CONFIG,
  winnerCount: 1,
  alternateCount: 0,
  draw: null,
  isLoading: false,
  progressMessage: '',
  error: null,
  tweetUrl: '',
  verificationStats: null,
};

// Action types
type Action =
  | { type: 'SET_STEP'; payload: AppState['step'] }
  | { type: 'SET_INPUT_MODE'; payload: AppState['inputMode'] }
  | { type: 'SET_GIVEAWAY_CONFIG'; payload: Partial<GiveawayConfig> }
  | { type: 'SET_PARTICIPANTS'; payload: Participant[] }
  | { type: 'SET_DISQUALIFIED'; payload: AppState['disqualified'] }
  | { type: 'SET_FILTER_CONFIG'; payload: Partial<FilterConfig> }
  | { type: 'SET_WINNER_COUNT'; payload: number }
  | { type: 'SET_ALTERNATE_COUNT'; payload: number }
  | { type: 'SET_DRAW'; payload: Draw }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PROGRESS'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TWEET_URL'; payload: string }
  | { type: 'SET_VERIFICATION_STATS'; payload: AppState['verificationStats'] }
  | { type: 'RESET' };

// Reducer
function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload, error: null };
    case 'SET_INPUT_MODE':
      return { ...state, inputMode: action.payload };
    case 'SET_GIVEAWAY_CONFIG':
      return { ...state, giveawayConfig: { ...state.giveawayConfig, ...action.payload } };
    case 'SET_PARTICIPANTS':
      return { ...state, participants: action.payload };
    case 'SET_DISQUALIFIED':
      return { ...state, disqualified: action.payload };
    case 'SET_FILTER_CONFIG':
      return { ...state, filterConfig: { ...state.filterConfig, ...action.payload } };
    case 'SET_WINNER_COUNT':
      return { ...state, winnerCount: Math.max(1, action.payload) };
    case 'SET_ALTERNATE_COUNT':
      return { ...state, alternateCount: Math.max(0, action.payload) };
    case 'SET_DRAW':
      return { ...state, draw: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progressMessage: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_TWEET_URL':
      return { ...state, tweetUrl: action.payload };
    case 'SET_VERIFICATION_STATS':
      return { ...state, verificationStats: action.payload };
    case 'RESET':
      return { ...initialState, giveawayConfig: { ...initialState.giveawayConfig, bearerToken: state.giveawayConfig.bearerToken } };
    default:
      return state;
  }
}

// Context type
interface AppContextType {
  state: AppState;
  setStep: (step: AppState['step']) => void;
  setInputMode: (mode: AppState['inputMode']) => void;
  setGiveawayConfig: (config: Partial<GiveawayConfig>) => void;
  setParticipants: (participants: Participant[]) => void;
  setFilterConfig: (config: Partial<FilterConfig>) => void;
  setWinnerCount: (count: number) => void;
  setAlternateCount: (count: number) => void;
  setTweetUrl: (url: string) => void;
  fetchParticipants: () => Promise<void>;
  performDraw: () => Promise<void>;
  reset: () => void;
}

// Create context
const AppContext = createContext<AppContextType | null>(null);

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setStep = useCallback((step: AppState['step']) => {
    dispatch({ type: 'SET_STEP', payload: step });
  }, []);

  const setInputMode = useCallback((mode: AppState['inputMode']) => {
    dispatch({ type: 'SET_INPUT_MODE', payload: mode });
  }, []);

  const setGiveawayConfig = useCallback((config: Partial<GiveawayConfig>) => {
    dispatch({ type: 'SET_GIVEAWAY_CONFIG', payload: config });
  }, []);

  const setParticipants = useCallback((participants: Participant[]) => {
    dispatch({ type: 'SET_PARTICIPANTS', payload: participants });
  }, []);

  const setFilterConfig = useCallback((config: Partial<FilterConfig>) => {
    dispatch({ type: 'SET_FILTER_CONFIG', payload: config });
  }, []);

  const setWinnerCount = useCallback((count: number) => {
    dispatch({ type: 'SET_WINNER_COUNT', payload: count });
  }, []);

  const setAlternateCount = useCallback((count: number) => {
    dispatch({ type: 'SET_ALTERNATE_COUNT', payload: count });
  }, []);

  const setTweetUrl = useCallback((url: string) => {
    dispatch({ type: 'SET_TWEET_URL', payload: url });
  }, []);

  // Fetch participants from Twitter API
  const fetchParticipants = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_STEP', payload: 'fetching' });

    try {
      const service = new GiveawayService(state.giveawayConfig.bearerToken);

      const onProgress = (progress: VerificationProgress) => {
        dispatch({ type: 'SET_PROGRESS', payload: progress.message });
      };

      const result = await service.verifyGiveaway(
        {
          tweetUrl: state.giveawayConfig.tweetUrl,
          requireRetweet: state.giveawayConfig.requireRetweet,
          requireLike: state.giveawayConfig.requireLike,
          mustFollow: state.giveawayConfig.mustFollow,
        },
        onProgress
      );

      dispatch({ type: 'SET_PARTICIPANTS', payload: result.eligible });
      dispatch({ type: 'SET_DISQUALIFIED', payload: result.disqualified.map(d => ({
        participant: d.participant,
        reasons: d.missingRequirements,
      })) });
      dispatch({ type: 'SET_VERIFICATION_STATS', payload: result.stats });
      dispatch({ type: 'SET_TWEET_URL', payload: state.giveawayConfig.tweetUrl });
      dispatch({ type: 'SET_STEP', payload: 'filter' });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to fetch participants',
      });
      dispatch({ type: 'SET_STEP', payload: 'requirements' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_PROGRESS', payload: '' });
    }
  }, [state.giveawayConfig]);

  const performDraw = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Apply filters
      const filterResult = filterParticipants(state.participants, state.filterConfig);

      if (filterResult.passed.length === 0) {
        throw new Error('No eligible participants after applying filters');
      }

      // Select winners
      const { winners, alternates, seed } = selectWinnersWithAlternates(
        filterResult.passed,
        state.winnerCount,
        state.alternateCount
      );

      // Generate participant hash
      const participantHash = await hashParticipants(state.participants);

      // Create draw result
      const draw: Draw = {
        id: generateDrawId(),
        timestamp: new Date(),
        tweetUrl: state.tweetUrl || undefined,
        allParticipants: state.participants,
        eligibleParticipants: filterResult.passed,
        winners,
        winnerCount: state.winnerCount,
        filterConfig: state.filterConfig,
        filterStats: filterResult.stats,
        participantHash,
        randomSeed: seed,
        alternates: alternates.length > 0 ? alternates : undefined,
      };

      dispatch({ type: 'SET_DRAW', payload: draw });
      dispatch({ type: 'SET_STEP', payload: 'results' });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'An error occurred during the draw',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.participants, state.filterConfig, state.winnerCount, state.alternateCount, state.tweetUrl]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: AppContextType = {
    state,
    setStep,
    setInputMode,
    setGiveawayConfig,
    setParticipants,
    setFilterConfig,
    setWinnerCount,
    setAlternateCount,
    setTweetUrl,
    fetchParticipants,
    performDraw,
    reset,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
