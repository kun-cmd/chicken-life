# Chicken Life Phase 2: Day Flow and HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype’s chicken-day/morning toggle with the approved morning-human → chicken-day → chicken-dusk → dusk-human → night-result loop and reduce the HUD to time, wood, sprint, and contextual guidance.

**Architecture:** Add a pure `dayFlow` reducer beside the legacy state, integrate it as the authoritative phase machine, and keep legacy fields synchronized only until later phases remove their remaining consumers. `GameScene` dispatches flow events; it does not write phase strings directly.

**Tech Stack:** TypeScript, Phaser, DOM HUD, Node test runner.

---

### Task 1: Build the pure day-flow reducer

**Files:**
- Create: `src/game/systems/dayFlow.ts`
- Test: `tests/dayFlow.test.ts`

- [ ] **Step 1: Write failing flow tests**

Create `tests/dayFlow.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDayFlow,
  reduceDayFlow,
  type DayFlowEvent,
  type DayFlowState,
} from '../src/game/systems/dayFlow';

type InstantEvent = Exclude<DayFlowEvent, { type: 'tick' }>;

function transition(state: DayFlowState, type: InstantEvent['type']) {
  return reduceDayFlow(state, { type } as InstantEvent);
}

test('requires the morning egg before releasing the chicken', () => {
  const state = createDayFlow();
  assert.throws(() => transition(state, 'release-chicken'), /morning egg/i);
  const found = transition(state, 'egg-found');
  const released = transition(found, 'release-chicken');
  assert.equal(released.phase, 'chicken-day');
  assert.equal(released.chickenInCoop, false);
});

test('moves from chicken day into dusk and hands control to the human', () => {
  let state = transition(createDayFlow(), 'egg-found');
  state = transition(state, 'release-chicken');
  state = reduceDayFlow(state, { type: 'tick', amount: 0.7 });
  assert.equal(state.phase, 'chicken-dusk');
  state = transition(state, 'call-human');
  assert.equal(state.phase, 'dusk-human');
});

test('only closes the night after the chicken is inside', () => {
  let state = createDayFlow({
    phase: 'dusk-human',
    chickenInCoop: false,
    coopDoorClosed: false,
  });
  assert.throws(() => transition(state, 'close-door'), /inside/i);
  state = transition(state, 'chicken-entered-coop');
  state = transition(state, 'close-door');
  assert.equal(state.phase, 'night-result');
  assert.equal(state.coopDoorClosed, true);
});

test('starts the next morning with a closed coop and a new egg requirement', () => {
  const state = createDayFlow({
    day: 3,
    phase: 'night-result',
    morningEggFound: true,
    chickenInCoop: true,
    coopDoorClosed: true,
  });
  const morning = transition(state, 'next-morning');
  assert.deepEqual(morning, {
    day: 4,
    phase: 'morning-human',
    clock: 0.08,
    morningEggFound: false,
    chickenInCoop: true,
    coopDoorClosed: true,
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `dayFlow.ts` does not exist.

- [ ] **Step 3: Implement the reducer**

Create `src/game/systems/dayFlow.ts`:

```ts
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
```

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
npm test
git add src/game/systems/dayFlow.ts tests/dayFlow.test.ts
git commit -m "feat: add dual perspective day flow reducer"
```

### Task 2: Make day flow authoritative in game state

**Files:**
- Modify: `src/game/simulation/state.ts:19-233`
- Modify: `src/game/simulation/state.ts:258-340`
- Modify: `src/game/simulation/state.ts:978-1060`
- Modify: `src/game/simulation/state.ts:1061-1109`
- Modify: `src/game/simulation/state.ts:1166-1201`
- Test: `tests/dayFlowState.test.ts`

- [ ] **Step 1: Write a failing integration test**

Create `tests/dayFlowState.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyFlowEvent,
  buildHudSnapshot,
  createGameState,
} from '../src/game/simulation/state';

test('game state derives actor and labels from day flow', () => {
  const state = createGameState();
  assert.equal(state.flow.phase, 'morning-human');
  assert.equal(state.mode, 'human');
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'release-chicken' });
  assert.equal(state.mode, 'chicken');
  assert.equal(buildHudSnapshot(state, false).phaseLabel, '白天');
});
```

- [ ] **Step 2: Run to verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `GameState.flow` and `applyFlowEvent` do not exist.

- [ ] **Step 3: Integrate the reducer**

Import from `dayFlow.ts`:

```ts
import {
  activeActor,
  createDayFlow,
  reduceDayFlow,
  type DayFlowEvent,
  type DayFlowState,
  type StoryPhase,
} from '../systems/dayFlow';
```

Add to `GameState`:

```ts
flow: DayFlowState;
```

Initialize:

```ts
flow: createDayFlow(),
phase: 'human',
mode: 'human',
egg: createTutorialEgg(),
```

Add the temporary tutorial egg helper; Phase 5 replaces it with the authored egg-search system:

```ts
function createTutorialEgg(): EggEntity {
  return {
    x: 1005,
    y: 430,
    type: 'balanced',
    name: '第一枚蛋',
    effect: '找到蛋后，才放心把鸡放进院子。',
    found: false,
  };
}
```

Add:

```ts
export function applyFlowEvent(state: GameState, event: DayFlowEvent) {
  state.flow = reduceDayFlow(state.flow, event);
  const actor = activeActor(state.flow.phase);
  state.mode = actor === 'none' ? state.mode : actor;
  state.phase =
    state.flow.phase === 'morning-human' || state.flow.phase === 'dusk-human'
      ? 'human'
      : state.flow.phase === 'chicken-dusk'
        ? 'dusk'
        : state.flow.phase === 'night-result'
          ? 'night'
          : 'day';
  state.day = state.flow.day;
  state.time = state.flow.clock;
}
```

Add `storyPhase` to `HudSnapshot` and return `state.flow.phase`. Replace the old label source with:

```ts
function storyPhaseLabel(phase: StoryPhase) {
  if (phase === 'morning-human') return '清晨找蛋';
  if (phase === 'chicken-day') return '白天';
  if (phase === 'chicken-dusk') return '黄昏';
  if (phase === 'dusk-human') return '黄昏收鸡';
  if (phase === 'night-result') return '夜里';
  return '归巢之夜';
}
```

Set `phaseLabel: storyPhaseLabel(state.flow.phase)` in `buildHudSnapshot()`.

Restore `flow` as a nested value:

```ts
flow: createDayFlow(input.flow),
```

Replace direct phase/day transitions in `finishChickenRun()` and `startNextDay()` with `applyFlowEvent()` calls. Keep their old exported names temporarily so existing scene imports compile.

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass and the current game still builds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/game/simulation/state.ts tests/dayFlowState.test.ts
git commit -m "refactor: make day flow authoritative"
```

### Task 3: Add explicit input for calling the human

**Files:**
- Modify: `src/game/input/actions.ts`
- Modify: `src/phaser/scenes/GameScene.ts:85-109`
- Modify: `src/phaser/scenes/GameScene.ts:317-349`
- Test: `tests/keyboardState.test.ts`

- [ ] **Step 1: Extend the input contract**

Replace `InputActions` with:

```ts
export interface InputActions {
  x: number;
  y: number;
  sprint: boolean;
  peck: boolean;
  digOrRest: boolean;
  interact: boolean;
  search: boolean;
  call: boolean;
}
```

Add `'KeyQ'` to `GAMEPLAY_KEY_CODES`. In `readActions()`, consume it and return:

```ts
call: this.keyboardState.consumePress('KeyQ'),
```

- [ ] **Step 2: Add a keyboard regression**

Append to `tests/keyboardState.test.ts`:

```ts
test('exposes a call press once', () => {
  const keyboard = new KeyboardState();
  keyboard.keyDown('KeyQ', false);
  assert.equal(keyboard.consumePress('KeyQ'), true);
  assert.equal(keyboard.consumePress('KeyQ'), false);
});
```

- [ ] **Step 3: Run tests and commit**

Run:

```powershell
npm test
git add src/game/input/actions.ts src/phaser/scenes/GameScene.ts tests/keyboardState.test.ts
git commit -m "feat: add explicit chicken call input"
```

### Task 4: Integrate all five playable phases in `GameScene`

**Files:**
- Modify: `src/phaser/scenes/GameScene.ts:286-716`
- Modify: `src/game/simulation/state.ts:978-1060`
- Test: `tests/dayFlowSceneRules.test.ts`

- [ ] **Step 1: Test scene-independent phase rules**

Create `tests/dayFlowSceneRules.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState, applyFlowEvent } from '../src/game/simulation/state';

test('dusk call preserves chicken position for human collection', () => {
  const state = createGameState();
  applyFlowEvent(state, { type: 'egg-found' });
  applyFlowEvent(state, { type: 'release-chicken' });
  applyFlowEvent(state, { type: 'tick', amount: 0.7 });
  state.chicken = { x: 300, y: 600 };
  applyFlowEvent(state, { type: 'call-human' });
  assert.deepEqual(state.chicken, { x: 300, y: 600 });
  assert.equal(state.mode, 'human');
});
```

- [ ] **Step 2: Route scene updates by story phase**

Replace the actor branch in `update()` with:

```ts
const storyPhase = this.state.flow.phase;
if (storyPhase === 'morning-human' || storyPhase === 'dusk-human') {
  this.updateHuman(dt, actions);
} else if (
  storyPhase === 'chicken-day' ||
  storyPhase === 'chicken-dusk'
) {
  this.updateChicken(dt, actions);
}
```

In `advanceChickenWorld()`, convert action time to normalized flow time:

```ts
applyFlowEvent(this.state, { type: 'tick', amount: actionSeconds / 155 });
```

When `actions.call` is pressed during `chicken-dusk`:

```ts
applyFlowEvent(this.state, { type: 'call-human' });
this.switchToHuman();
return;
```

- [ ] **Step 3: Stop egg collection from auto-starting the next day**

After `collectEgg(this.state)` succeeds in morning:

```ts
applyFlowEvent(this.state, { type: 'egg-found' });
this.state.message = '蛋找到了。还可以陪陪鸡，准备好后去鸡窝门口放它出院。';
```

Remove the `nextDayTimer` transition from egg collection. At the coop door, when the morning egg is found and `actions.search` is pressed:

```ts
applyFlowEvent(this.state, { type: 'release-chicken' });
this.switchToChicken();
```

- [ ] **Step 4: Add a temporary but complete dusk collection**

During `dusk-human`, make the chicken follow when the human is within 150 pixels:

```ts
const chickenDistance = distance(this.state.human, this.state.chicken);
if (chickenDistance < 150 && chickenDistance > 42) {
  const follow = normalize(
    this.state.human.x - this.state.chicken.x,
    this.state.human.y - this.state.chicken.y,
  );
  this.state.chicken.x += follow.x * 70 * dt;
  this.state.chicken.y += follow.y * 70 * dt;
}
```

When chicken and human are both near `COOP_DOOR`, `actions.interact` dispatches:

```ts
applyFlowEvent(this.state, { type: 'chicken-entered-coop' });
applyFlowEvent(this.state, { type: 'close-door' });
finishNightResult(this.state);
```

Implement `finishNightResult()` in `state.ts` to create the next morning’s current prototype egg, set a short summary, then call `applyFlowEvent(state, { type: 'next-morning' })` after the result timer.

Use these two explicit state functions:

```ts
export function finishNightResult(state: GameState) {
  state.egg = createEgg(state);
  state.reward = null;
  state.daySummary = createDaySummary(state, 0);
  state.message = state.caughtToday
    ? '今晚受了惊，明早去看看留下了什么蛋。'
    : '门关好了。院子安静下来，明早再来找蛋。';
}

export function advanceNightResult(state: GameState) {
  const nextMorningEgg = state.egg;
  applyFlowEvent(state, { type: 'next-morning' });
  state.caughtToday = false;
  state.huggedToday = false;
  state.repairedToday = false;
  state.keeperRescueUsedToday = false;
  state.drankToday = false;
  state.holesDugToday = 0;
  state.chicken = { x: COOP_DOOR.x, y: COOP_DOOR.y + 32 };
  state.human = { x: 750, y: 448 };
  state.chickenWander = { target: null, wait: 0.4, pause: 0.2, facing: 1 };
  state.stats.stamina = state.stats.maxStamina;
  state.stats.fullness = 0;
  state.eaten = freshEaten();
  state.foods = [];
  state.animals = [];
  state.weasel = { x: -120, y: 820, active: false, chasing: false, stunned: 0 };
  state.egg = nextMorningEgg;
  state.reward = null;
  state.message = '清晨到了。先在院子里找到今天的蛋。';
  spawnDailyFood(state);
}
```

Add `private nightResultTimer = 0;` to `GameScene`. After `finishNightResult()` set it to `2.4`. In `update()`:

```ts
if (this.state.flow.phase === 'night-result') {
  this.nightResultTimer = Math.max(0, this.nightResultTimer - dt);
  if (this.nightResultTimer === 0) {
    advanceNightResult(this.state);
    this.switchToHuman();
  }
  this.updateSprites(dt);
  return;
}
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm test
npm run build
```

Manual expected loop: name → morning egg → release chicken → dusk Q call → human guides chicken → E closes door → next morning.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/phaser/scenes/GameScene.ts src/game/simulation/state.ts tests/dayFlowSceneRules.test.ts
git commit -m "feat: integrate dual perspective daily loop"
```

### Task 5: Replace the management HUD with minimal feedback

**Files:**
- Modify: `index.html:21-93`
- Modify: `src/main.ts:42-297`
- Modify: `src/style.css`
- Modify: `src/game/simulation/state.ts:195-233`
- Test: `tests/hudSnapshot.test.ts`

- [ ] **Step 1: Write a failing HUD snapshot test**

Create `tests/hudSnapshot.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHudSnapshot, createGameState } from '../src/game/simulation/state';

test('minimal hud exposes time, wood, sprint visibility, and prompt', () => {
  const snapshot = buildHudSnapshot(createGameState(), false);
  assert.equal(snapshot.day, 1);
  assert.equal(snapshot.wood, 0);
  assert.equal(snapshot.showSprint, false);
  assert.equal(typeof snapshot.contextPrompt, 'string');
});
```

- [ ] **Step 2: Replace the HUD snapshot surface**

Add to `HudSnapshot` and `buildHudSnapshot()`:

```ts
wood: state.materials,
showSprint: state.mode === 'chicken' && state.stats.stamina < state.stats.maxStamina,
contextPrompt: goalTipFor(state),
```

Keep legacy snapshot fields temporarily until Phase 3 removes their state sources.

- [ ] **Step 3: Replace the main HUD markup**

Replace `.hud-dock`, `.today-plate`, and the old goal tip markup with:

```html
<section class="minimal-hud">
  <div class="wood-chip"><span>修缮木料</span><b id="woodLabel">0</b></div>
  <div id="sprintWrap" class="sprint-wrap" hidden>
    <span>冲刺</span>
    <div class="meter-track"><i id="staminaMeter"></i></div>
  </div>
</section>
<div id="contextPrompt" class="goal-tip">先在院子里找到今天的蛋。</div>
```

Remove old meter, plate, summary, and inventory selectors from `main.ts`. Render:

```ts
hud.woodLabel.textContent = String(snapshot.wood);
hud.sprintWrap.hidden = !snapshot.showSprint;
hud.staminaMeter.style.width = `${snapshot.staminaPct}%`;
hud.contextPrompt.textContent = snapshot.contextPrompt;
```

- [ ] **Step 4: Remove obsolete HUD CSS**

Delete selectors used only by fullness, nutrition, water, pressure, the food plate, the old inventory, and the day-summary panel. Keep toast, reward, debug, volume, naming, and responsive canvas rules.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test
npm run build
git add index.html src/main.ts src/style.css src/game/simulation/state.ts tests/hudSnapshot.test.ts
git commit -m "refactor: reduce hud to contextual feedback"
```

### Phase 2 exit check

Run:

```powershell
npm test
npm run build
```

Expected: the complete five-phase daily loop is playable, the chicken must be collected by the human, and the main HUD no longer presents nutrition-management meters.
