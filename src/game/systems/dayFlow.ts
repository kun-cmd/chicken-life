export type StoryPhase =
  | 'morning-human'
  | 'chicken-day'
  | 'chicken-dusk'
  | 'dusk-human'
  | 'night-result'
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
  | { type: 'release-chicken' }
  | { type: 'tick'; amount: number }
  | { type: 'call-human' }
  | { type: 'chicken-entered-coop' }
  | { type: 'close-door' }
  | { type: 'next-morning' };

const DUSK_AT = 0.65;

export function createDayFlow(overrides: Partial<DayFlowState> = {}): DayFlowState {
  return {
    day: 1,
    phase: 'morning-human',
    clock: 0.08,
    morningEggFound: false,
    chickenInCoop: true,
    coopDoorClosed: true,
    ...overrides,
  };
}

export function activeActor(phase: StoryPhase): 'human' | 'chicken' | 'none' {
  if (phase === 'morning-human' || phase === 'dusk-human') return 'human';
  if (phase === 'chicken-day' || phase === 'chicken-dusk') return 'chicken';
  return 'none';
}

export function reduceDayFlow(state: DayFlowState, event: DayFlowEvent): DayFlowState {
  if (event.type === 'egg-found') {
    if (state.phase !== 'morning-human') throw new Error('Egg can only be found in the morning');
    return { ...state, morningEggFound: true };
  }

  if (event.type === 'release-chicken') {
    if (state.phase !== 'morning-human') throw new Error('Chicken release requires morning');
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
    if (state.phase !== 'chicken-day' && state.phase !== 'chicken-dusk') return state;
    const clock = Math.min(1, state.clock + Math.max(0, event.amount));
    return { ...state, clock, phase: clock >= DUSK_AT ? 'chicken-dusk' : 'chicken-day' };
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

  return state;
}
