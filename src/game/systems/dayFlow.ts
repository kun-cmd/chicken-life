export type StoryPhase =
  | 'morning-human'
  | 'chicken-day'
  | 'chicken-dusk'
  | 'chicken-night'
  | 'dusk-human'
  | 'night-result'
  | 'epilogue-human'
  | 'ending';

export interface DayFlowState {
  day: number;
  phase: StoryPhase;
  clock: number;
  morningEggFound: boolean;
  chickenInCoop: boolean;
  coopDoorClosed: boolean;
}

export type DayFlowEvent =
  | { type: 'egg-found' }
  | { type: 'return-home' }
  | { type: 'tick'; amount: number }
  | { type: 'call-human' }
  | { type: 'settle-for-night' }
  | { type: 'chicken-entered-coop' }
  | { type: 'close-door' }
  | { type: 'next-morning' }
  | { type: 'start-epilogue' }
  | { type: 'keepsake-found' }
  | { type: 'continue-free-play' };

const DUSK_AT = 0.65;
const NIGHT_AT = 0.82;

export function createDayFlow(overrides: Partial<DayFlowState> = {}): DayFlowState {
  return {
    day: 1,
    phase: 'morning-human',
    clock: 0.08,
    morningEggFound: false,
    chickenInCoop: false,
    coopDoorClosed: false,
    ...overrides,
  };
}

export function activeActor(phase: StoryPhase): 'human' | 'chicken' | 'none' {
  if (phase === 'morning-human' || phase === 'dusk-human' || phase === 'epilogue-human') {
    return 'human';
  }
  if (phase === 'chicken-day' || phase === 'chicken-dusk' || phase === 'chicken-night') {
    return 'chicken';
  }
  return 'none';
}

export function reduceDayFlow(state: DayFlowState, event: DayFlowEvent): DayFlowState {
  if (event.type === 'egg-found') {
    if (state.phase !== 'morning-human') throw new Error('Egg can only be found in the morning');
    return { ...state, morningEggFound: true };
  }

  if (event.type === 'return-home') {
    if (state.phase !== 'morning-human') throw new Error('Returning home requires morning');
    if (!state.morningEggFound) throw new Error('Morning egg must be found first');
    return {
      ...state,
      phase: 'chicken-day',
      clock: 0.12,
      chickenInCoop: false,
      coopDoorClosed: false,
    };
  }

  if (event.type === 'tick') {
    if (
      state.phase !== 'chicken-day' &&
      state.phase !== 'chicken-dusk' &&
      state.phase !== 'chicken-night'
    ) {
      return state;
    }
    const clock = Math.min(1, state.clock + Math.max(0, event.amount));
    const phase =
      clock >= NIGHT_AT ? 'chicken-night' : clock >= DUSK_AT ? 'chicken-dusk' : 'chicken-day';
    return { ...state, clock, phase };
  }

  if (event.type === 'settle-for-night') {
    if (state.phase !== 'chicken-dusk' && state.phase !== 'chicken-night') {
      throw new Error('Settling for night requires chicken dusk or night');
    }
    return {
      ...state,
      phase: 'night-result',
      chickenInCoop: true,
      coopDoorClosed: true,
    };
  }

  if (event.type === 'call-human') {
    if (state.phase !== 'chicken-dusk') throw new Error('Human can only be called at dusk');
    return { ...state, phase: 'dusk-human' };
  }

  if (event.type === 'chicken-entered-coop') {
    if (state.phase !== 'dusk-human') throw new Error('Chicken enters coop during dusk human phase');
    return { ...state, chickenInCoop: true };
  }

  if (event.type === 'close-door') {
    if (state.phase !== 'dusk-human') throw new Error('Door closes during dusk human phase');
    if (!state.chickenInCoop) throw new Error('Chicken must be inside before closing the door');
    return { ...state, phase: 'night-result', coopDoorClosed: true };
  }

  if (event.type === 'next-morning') {
    if (state.phase !== 'night-result') throw new Error('Next morning requires night result');
    return createDayFlow({ day: state.day + 1 });
  }

  if (event.type === 'start-epilogue') {
    if (state.phase !== 'night-result') throw new Error('Epilogue requires night result');
    return {
      ...state,
      day: state.day + 1,
      phase: 'epilogue-human',
      clock: 0.08,
      morningEggFound: false,
      chickenInCoop: true,
      coopDoorClosed: true,
    };
  }

  if (event.type === 'keepsake-found') {
    if (state.phase !== 'epilogue-human') throw new Error('Keepsake requires epilogue search');
    return { ...state, phase: 'ending', morningEggFound: true };
  }

  if (event.type === 'continue-free-play') {
    if (state.phase !== 'ending') throw new Error('Free play requires ending');
    return {
      ...state,
      phase: 'morning-human',
      morningEggFound: true,
      chickenInCoop: false,
      coopDoorClosed: false,
    };
  }

  return state;
}
