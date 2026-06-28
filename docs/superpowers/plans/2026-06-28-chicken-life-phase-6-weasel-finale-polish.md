# Chicken Life Phase 6: Weasel Finale and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace numeric night pressure with observable weasel danger, add handheld/fixed light defense, guarantee closed-coop safety, deliver the Day 14 storm ending and a normal-loop free-play continuation, then harden and package the complete game.

**Architecture:** A pure encounter schedule chooses fixed and seeded threat days. A pure weasel reducer owns stalking/chasing/repelled/caught outcomes; Phaser owns movement rendering, light graphics, and sound cues. The finale serializes a dusk checkpoint before the encounter and restores it on retry, then transitions to an epilogue egg, montage, credits, and free play.

**Tech Stack:** TypeScript, Phaser graphics/tweens/audio, DOM ending overlay, Node test runner, Vite, itch packaging script.

---

### Task 1: Build the deterministic encounter schedule

**Files:**
- Create: `src/game/systems/weaselSchedule.ts`
- Test: `tests/weaselSchedule.test.ts`

- [ ] **Step 1: Write failing schedule tests**

Create `tests/weaselSchedule.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWeaselSchedule,
  hasWeaselEncounter,
} from '../src/game/systems/weaselSchedule';

test('always includes the teaching and finale days', () => {
  const schedule = createWeaselSchedule(1);
  assert.equal(hasWeaselEncounter(schedule, 8, 1), true);
  assert.equal(hasWeaselEncounter(schedule, 14, 1), true);
});

test('chooses exactly two nonconsecutive random days from nine through thirteen', () => {
  const schedule = createWeaselSchedule(25);
  const middle = schedule.filter((day) => day >= 9 && day <= 13);
  assert.equal(middle.length, 2);
  assert.ok(Math.abs(middle[0] - middle[1]) > 1);
});

test('is stable for the same seed', () => {
  assert.deepEqual(createWeaselSchedule(99), createWeaselSchedule(99));
});

test('free play has one deterministic encounter per seven-day block', () => {
  const days = Array.from({ length: 7 }, (_, index) => index + 15);
  const first = days.filter((day) => hasWeaselEncounter([], day, 44));
  const second = days.filter((day) => hasWeaselEncounter([], day, 44));
  assert.deepEqual(first, second);
  assert.equal(first.length, 1);
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `weaselSchedule.ts` does not exist.

- [ ] **Step 3: Implement schedule selection**

Create `src/game/systems/weaselSchedule.ts`:

```ts
import { createSeededRandom } from './seededRandom';

const MIDDLE_PAIRS: Array<[number, number]> = [
  [9, 11],
  [9, 12],
  [9, 13],
  [10, 12],
  [10, 13],
  [11, 13],
];

export function createWeaselSchedule(runSeed: number) {
  const random = createSeededRandom(runSeed ^ 0x51a5e1);
  const pair = MIDDLE_PAIRS[Math.floor(random() * MIDDLE_PAIRS.length)];
  return [8, ...pair, 14].sort((a, b) => a - b);
}

export function hasWeaselEncounter(
  schedule: number[],
  day: number,
  runSeed: number,
) {
  if (day <= 14) return schedule.includes(day);
  const freePlayIndex = day - 15;
  const block = Math.floor(freePlayIndex / 7);
  const dayInBlock = freePlayIndex % 7;
  const random = createSeededRandom(runSeed ^ Math.imul(block + 1, 0x27d4eb2d));
  return dayInBlock === Math.floor(random() * 7);
}
```

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm test
git add src/game/systems/weaselSchedule.ts tests/weaselSchedule.test.ts
git commit -m "feat: schedule observable weasel encounters"
```

### Task 2: Implement weasel pursuit without night pressure

**Files:**
- Create: `src/game/systems/weaselEncounter.ts`
- Test: `tests/weaselEncounter.test.ts`

- [ ] **Step 1: Write failing encounter tests**

Create `tests/weaselEncounter.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWeaselEncounter,
  isHumanBlocking,
  updateWeaselEncounter,
} from '../src/game/systems/weaselEncounter';

test('closed coop is absolutely safe', () => {
  const state = createWeaselEncounter({ x: 100, y: 100 });
  const result = updateWeaselEncounter(state, {
    dt: 1,
    chicken: { x: 100, y: 100 },
    chickenInCoop: true,
    coopDoorClosed: true,
    illuminated: false,
    humanBlocking: false,
  });
  assert.equal(result.outcome, 'safe');
  assert.equal(result.state.phase, 'repelled');
});

test('continuous light repels the weasel', () => {
  let state = createWeaselEncounter({ x: 100, y: 100 });
  let outcome = 'active';
  for (let index = 0; index < 4; index += 1) {
    const result = updateWeaselEncounter(state, {
      dt: 0.5,
      chicken: { x: 300, y: 100 },
      chickenInCoop: false,
      coopDoorClosed: false,
      illuminated: true,
      humanBlocking: false,
    });
    state = result.state;
    outcome = result.outcome;
  }
  assert.equal(outcome, 'repelled');
});

test('contact catches an unprotected chicken', () => {
  const state = createWeaselEncounter({ x: 100, y: 100 });
  const result = updateWeaselEncounter(state, {
    dt: 0.1,
    chicken: { x: 105, y: 100 },
    chickenInCoop: false,
    coopDoorClosed: false,
    illuminated: false,
    humanBlocking: false,
  });
  assert.equal(result.outcome, 'caught');
});

test('detects a human standing between chicken and weasel', () => {
  assert.equal(
    isHumanBlocking(
      { x: 100, y: 100 },
      { x: 50, y: 100 },
      { x: 150, y: 100 },
    ),
    true,
  );
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `weaselEncounter.ts` does not exist.

- [ ] **Step 3: Implement the encounter reducer**

Create `src/game/systems/weaselEncounter.ts`:

```ts
import type { Vec2 } from '../simulation/state';

export type WeaselPhase = 'stalking' | 'chasing' | 'repelled';

export interface WeaselEncounterState {
  position: Vec2;
  phase: WeaselPhase;
  lightExposure: number;
}

export interface WeaselContext {
  dt: number;
  chicken: Vec2;
  chickenInCoop: boolean;
  coopDoorClosed: boolean;
  illuminated: boolean;
  humanBlocking: boolean;
}

export function createWeaselEncounter(position: Vec2): WeaselEncounterState {
  return { position: { ...position }, phase: 'stalking', lightExposure: 0 };
}

export function updateWeaselEncounter(
  state: WeaselEncounterState,
  context: WeaselContext,
): { state: WeaselEncounterState; outcome: 'active' | 'repelled' | 'caught' | 'safe' } {
  if (context.chickenInCoop && context.coopDoorClosed) {
    return { state: { ...state, phase: 'repelled' }, outcome: 'safe' };
  }

  const lightExposure = context.illuminated
    ? state.lightExposure + context.dt
    : Math.max(0, state.lightExposure - context.dt * 0.5);
  if (lightExposure >= 1.5) {
    return {
      state: { ...state, phase: 'repelled', lightExposure },
      outcome: 'repelled',
    };
  }

  const dx = context.chicken.x - state.position.x;
  const dy = context.chicken.y - state.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 32 && !context.humanBlocking) {
    return { state: { ...state, lightExposure }, outcome: 'caught' };
  }

  const phase: WeaselPhase = distance < 240 ? 'chasing' : 'stalking';
  const speed = (phase === 'chasing' ? 112 : 62) * (context.illuminated ? 0.35 : 1);
  const length = Math.max(distance, 1);
  const position = {
    x: state.position.x + (dx / length) * speed * context.dt,
    y: state.position.y + (dy / length) * speed * context.dt,
  };
  return {
    state: { position, phase, lightExposure },
    outcome: 'active',
  };
}
```

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm test
git add src/game/systems/weaselEncounter.ts tests/weaselEncounter.test.ts
git commit -m "feat: replace night pressure with direct pursuit"
```

### Task 3: Integrate world signals, lantern, and coop safety

**Files:**
- Modify: `src/game/simulation/state.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Modify: `src/game/content/yard.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `tests/weaselStateIntegration.test.ts`

- [ ] **Step 1: Add encounter state and schedule**

Add to `GameState`:

```ts
weaselSchedule: number[];
weaselEncounter: WeaselEncounterState | null;
handLanternActive: boolean;
caughtToday: boolean;
```

Initialize:

```ts
weaselSchedule: createWeaselSchedule(profile.runSeed),
weaselEncounter: null,
handLanternActive: false,
caughtToday: false,
```

Restore nested encounter state and derive the schedule again if missing.

- [ ] **Step 2: Add a state integration test**

Create `tests/weaselStateIntegration.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGameState,
  resolveWeaselOutcome,
} from '../src/game/simulation/state';
import { createWeaselEncounter } from '../src/game/systems/weaselEncounter';

test('caught outcome marks the day but does not remove wood or relationship', () => {
  const state = createGameState();
  state.yard.wood = 4;
  state.relationship.memories = 9;
  state.weaselEncounter = createWeaselEncounter({ x: 10, y: 10 });
  resolveWeaselOutcome(state, 'caught');
  assert.equal(state.caughtToday, true);
  assert.equal(state.yard.wood, 4);
  assert.equal(state.relationship.memories, 9);
});
```

- [ ] **Step 3: Spawn only on scheduled dusk phases**

At chicken dusk or dusk human, if `hasWeaselEncounter(schedule, day, profile.runSeed)` and no encounter exists, spawn at the farthest valid world edge from the chicken. Day 8 uses 75% pursuit speed; all later encounters use full speed.

Delete numeric wake conditions, `updateNightPressure()`, `PressureContext`, pressure HUD fields, light budgets, carried pressure, repair costs, and pressure debug controls.

- [ ] **Step 4: Add observable danger**

Render:

- A grass-rustle animation at the encounter edge before the weasel is visible.
- Directional rustle SFX whose interval shrinks from 2.4 seconds to 0.55 seconds as distance closes.
- Chicken crouch and head-turn animation below 260 pixels.
- Darkening based only on clock/weather, never a hidden danger number.

- [ ] **Step 5: Add lantern controls**

During `dusk-human`, hold Space to aim a hand-lantern circle 150 pixels toward the pointer or last movement direction:

```ts
import { YARD_LAMP_POSITION } from '../../game/content/yardUpgrades';

const illuminated =
  distance(this.state.weaselEncounter.position, lanternCenter) <= 150 ||
  (this.state.yard.owned.includes('yard-lamp') &&
    distance(this.state.weaselEncounter.position, YARD_LAMP_POSITION) <= 130);
```

Add this geometry helper to `weaselEncounter.ts`:

```ts
export function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function isHumanBlocking(human: Vec2, chicken: Vec2, weasel: Vec2) {
  return distanceToSegment(human, chicken, weasel) <= 42;
}
```

Set `humanBlocking = isHumanBlocking(human, chicken, weasel)` and pass both booleans to `updateWeaselEncounter()`.

- [ ] **Step 6: Resolve outcomes**

Implement:

```ts
export function resolveWeaselOutcome(
  state: GameState,
  outcome: 'active' | 'repelled' | 'caught' | 'safe',
) {
  if (outcome === 'caught') {
    state.caughtToday = true;
  }
  if (outcome === 'repelled') {
    recordTrustMemory(state.relationship, state.day, 'first-rescue');
  }
  if (outcome !== 'active') state.weaselEncounter = null;
}
```

`close-door` immediately resolves `safe` whenever `chickenInCoop` is true. This check runs before collision, so closed-coop safety is absolute.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test
npm run build
git add src/game/simulation/state.ts src/game/content/yard.ts src/phaser/scenes/GameScene.ts src/main.ts src/style.css tests/weaselStateIntegration.test.ts
git commit -m "feat: add lantern rescue and observable danger"
```

### Task 4: Add Day 14 checkpoint and finale state

**Files:**
- Create: `src/game/systems/finale.ts`
- Modify: `src/game/systems/dayFlow.ts`
- Modify: `src/game/simulation/state.ts`
- Test: `tests/finale.test.ts`

- [ ] **Step 1: Write failing finale tests**

Create `tests/finale.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureFinaleCheckpoint,
  restoreFinaleCheckpoint,
  shouldStartFinale,
} from '../src/game/systems/finale';
import {
  activeActor,
  createDayFlow,
  reduceDayFlow,
} from '../src/game/systems/dayFlow';

test('only day fourteen starts the first-run finale', () => {
  assert.equal(shouldStartFinale(13, false), false);
  assert.equal(shouldStartFinale(14, false), true);
  assert.equal(shouldStartFinale(14, true), false);
});

test('checkpoint restore returns an independent clone', () => {
  const original = {
    day: 14,
    chicken: { x: 10, y: 20 },
    caughtToday: false,
    finaleCheckpointJson: null,
  };
  const checkpoint = captureFinaleCheckpoint(original);
  original.chicken.x = 99;
  const restored = restoreFinaleCheckpoint<typeof original>(checkpoint);
  assert.deepEqual(restored, {
    day: 14,
    chicken: { x: 10, y: 20 },
    caughtToday: false,
    finaleCheckpointJson: null,
  });
});

test('epilogue search returns to the normal day loop after credits', () => {
  let flow = createDayFlow({ day: 14, phase: 'night-result' });
  flow = reduceDayFlow(flow, { type: 'start-epilogue' });
  assert.equal(flow.day, 15);
  assert.equal(flow.phase, 'epilogue-human');
  assert.equal(activeActor(flow.phase), 'human');

  flow = reduceDayFlow(flow, { type: 'keepsake-found' });
  assert.equal(flow.phase, 'ending');

  flow = reduceDayFlow(flow, { type: 'continue-free-play' });
  assert.equal(flow.phase, 'morning-human');
  assert.equal(flow.morningEggFound, true);
  assert.equal(flow.day, 15);
});
```

- [ ] **Step 2: Implement checkpoint helpers**

Create `src/game/systems/finale.ts`. Store the checkpoint as JSON so the normal save envelope cannot recursively contain a checkpoint object that contains itself:

```ts
export function shouldStartFinale(day: number, endingSeen: boolean) {
  return day === 14 && !endingSeen;
}

export function captureFinaleCheckpoint<T extends { finaleCheckpointJson: string | null }>(
  state: T,
) {
  const copy = structuredClone(state);
  copy.finaleCheckpointJson = null;
  return JSON.stringify(copy);
}

export function restoreFinaleCheckpoint<T>(checkpointJson: string): T {
  return JSON.parse(checkpointJson) as T;
}
```

- [ ] **Step 3: Add finale state**

Add to `GameState`:

```ts
endingSeen: boolean;
freePlay: boolean;
finaleCheckpointJson: string | null;
stormActive: boolean;
```

Initialize `endingSeen = false`, `freePlay = false`, `finaleCheckpointJson = null`, and `stormActive = false`. Include all four fields in save/restore. The checkpoint string can be written by the existing v3 save envelope without recursion.

Extend `StoryPhase` with `'epilogue-human'`. Extend `DayFlowEvent` with:

```ts
| { type: 'start-epilogue' }
| { type: 'keepsake-found' }
| { type: 'continue-free-play' };
```

Add these reducer transitions:

```ts
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
  return { ...state, phase: 'morning-human', morningEggFound: true };
}
```

Update `activeActor()` and `storyPhaseLabel()` so `epilogue-human` is a human phase labelled `清晨的礼物`. Do not add a permanent `free-play` story phase: free play uses the same morning → chicken day → dusk → night loop as the main game.

- [ ] **Step 4: Capture and restore Day 14**

When Day 14 enters `chicken-dusk`:

```ts
state.stormActive = true;
state.finaleCheckpointJson = captureFinaleCheckpoint(state);
```

If the final weasel catches the chicken, show a retry panel. Retry executes:

```ts
const checkpointJson = this.state.finaleCheckpointJson;
if (!checkpointJson) throw new Error('Finale checkpoint is missing');
this.state = restoreGameState(restoreFinaleCheckpoint<GameState>(checkpointJson));
this.rebuildWorldFromState();
this.emitHud(true, true);
```

Do not change Days 1–13 progress.

- [ ] **Step 5: Complete the finale**

After safe final door closure:

1. Call a dedicated `startEpilogueMorning(state)` helper; never assign `flow.phase` directly.
2. The helper dispatches `start-epilogue`, syncs `state.day`, delivers the wood pending from the Day 14 morning egg, selects Day 15 weather with `weatherForDay()`, resets daily experience, and creates a `keepsake` egg at the authored `far-hedge` spot.
3. Start the Day 15 epilogue morning search with maximum clue level after 120 seconds.
4. Finding it sets `endingSeen = true` and dispatches `keepsake-found`.
5. The resulting `ending` phase opens the ending overlay.

Implement the helper in `state.ts`:

```ts
export function startEpilogueMorning(state: GameState) {
  applyFlowEvent(state, { type: 'start-epilogue' });
  state.day = state.flow.day;
  deliverPendingWood(state.yard);
  state.weather = weatherForDay(state.profile.runSeed, state.day);
  state.currentDayExperience = { muddy: false, positive: [] };
  state.eggSearch = createEggSearchState('far-hedge', 'keepsake');
}
```

Add an integration test that begins with `yard.pendingWood = 1`, calls this helper, and asserts Day 15, human control, `yard.wood === 1`, `pendingWood === 0`, and a `far-hedge` keepsake search.

After credits, “继续小院生活” sets `freePlay = true`, dispatches `continue-free-play`, keeps all profile/album/yard state, and disables further fixed-story day gates. Because the keepsake fulfills that morning’s egg search, the player can feed and release the chicken immediately; later days continue through the ordinary dual-perspective loop.

Any fixed-day condition must use `!state.freePlay && condition`, including ability tutorials, scripted weather, and authored weasel nights. Seeded ambient weather, egg spots, food, and optional weasel encounters continue in free play.

- [ ] **Step 6: Run and commit**

Run:

```powershell
npm test
npm run build
git add src/game/systems/finale.ts src/game/systems/dayFlow.ts src/game/simulation/state.ts tests/finale.test.ts
git commit -m "feat: add retryable day fourteen finale"
```

### Task 5: Build the ending presentation and final cleanup

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `src/phaser/scenes/GameScene.ts`
- Modify: `src/game/simulation/state.ts`
- Modify: `rules.md`
- Test: `tests/removedMechanics.test.ts`

- [ ] **Step 1: Add ending markup**

Insert:

```html
<section id="endingPanel" class="ending-panel" hidden>
  <div id="endingMontage" class="ending-montage"></div>
  <h1><span id="endingChickenName"></span>回家了</h1>
  <p>小院的日子还会继续。</p>
  <button id="continueFreePlay" type="button">继续小院生活</button>
</section>
```

Render the saved name with `textContent`. Populate the montage from immutable summary data: first hand feed, each ability awakening, owned facilities, first rescue, and final closed door.

- [ ] **Step 2: Add storm and credits presentation**

During the finale:

- Alternate rain streaks and brief dimming every 1.8–3.2 seconds.
- If the yard lamp is owned, flicker it rather than disabling it.
- Use the existing night music at lower volume and rustle SFX for the chase.
- After finding the keepsake egg, fade through six 2-second montage cards, then reveal the ending panel.
- Respect `prefers-reduced-motion` by replacing movement with cross-fades.

- [ ] **Step 3: Remove all legacy code**

Delete remaining:

```text
nightPressure
PressureContext
coopSafety
abilityTrainingLevel
old egg stat effects and egg candidates
forceEgg debug UI
addAffection/addMaterials legacy debug labels
cat and meat branches
hole rendering
nutrition/fullness/water CSS
```

Keep debug actions only for:

```text
jump to day
jump to phase
spawn scheduled weasel
grant wood
reset save
```

Update `tests/removedMechanics.test.ts` so every removed key/function is absent from fresh state and HUD.

- [ ] **Step 4: Rewrite `rules.md`**

Replace the prototype rules with the implemented rules, in this order:

1. 14-day structure and free play.
2. Naming and relationship stages.
3. Morning egg search and clues.
4. Human close interaction.
5. Chicken controls and ability awakening days.
6. Food discovery and sprint energy.
7. Wood delivery and six upgrades.
8. Dusk collection and door safety.
9. Weasel schedule, lantern, catching, and retry.
10. Day 14 ending.

Use only implemented controls and values; copy costs/days from the tested content modules.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test
npm run build
rg -n "饱食|营养|润喉|夜压|窝材|肉块|训练等级" src index.html rules.md
```

Expected: tests/build pass; grep has no obsolete gameplay terminology.

Commit:

```powershell
git add index.html src rules.md tests/removedMechanics.test.ts
git commit -m "feat: finish归巢之夜 ending and free play"
```

### Task 6: Full playtest and itch packaging verification

**Files:**
- Modify only if defects are found: `src/**`, `index.html`, `rules.md`, `tests/**`
- Verify: `chicken-life-itch-flat.zip`

- [ ] **Step 1: Run automated verification**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass and production build succeeds.

- [ ] **Step 2: Run browser smoke tests**

Start:

```powershell
npm run dev
```

Use the game playtest workflow to verify:

1. Fresh naming and reload persistence.
2. Day 1 tutorial egg and one-wood next-day delivery.
3. Ability awakenings on Days 4, 5, and 7.
4. Relationship behavior on Days 3, 7, and 11.
5. Weasel tutorial on Day 8.
6. Two nonconsecutive random encounters between Days 9–13.
7. All six upgrades and twelve-wood total.
8. Day 14 failure retry.
9. Day 14 success, keepsake egg, montage, credits, and free play.
10. Keyboard focus, reduced motion, and 1280×720 plus one narrow viewport.

Record any discovered issue as a failing automated regression before fixing it.

- [ ] **Step 3: Package exactly as required**

Run:

```powershell
npm run package:itch
powershell -ExecutionPolicy Bypass -File tests/package-itch.ps1
```

Expected: `chicken-life-itch-flat.zip` is recreated and the package path test passes. Do not manually compress or upload `dist/`.

- [ ] **Step 4: Final repository check**

Run:

```powershell
git status --short
git log --oneline -12
```

Expected: only ignored release artifacts remain outside Git; implementation commits are present.

- [ ] **Step 5: Commit playtest fixes if any**

If Step 2 produced fixes, commit only those tested fixes:

```powershell
git add src index.html rules.md tests
git commit -m "fix: address full game playtest findings"
```

If no fixes were required, do not create an empty commit.

### Phase 6 exit check

Run:

```powershell
npm test
npm run build
npm run package:itch
powershell -ExecutionPolicy Bypass -File tests/package-itch.ps1
```

Expected: all commands pass; the 14-day story and free play are complete; the upload artifact is `chicken-life-itch-flat.zip`.
