# Chicken Life Phase 5: Eggs, Yard Upgrades, and Weather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hidden egg locations with fair escalating clues, an egg album, next-day wood delivery, six visible yard upgrades costing twelve wood, and controlled daily weather/facility life.

**Architecture:** Use seeded selection over eight hand-authored egg spots and pure state transitions for clues, egg classification, album recording, and upgrade purchasing. `GameScene` only renders the chosen spot’s clues and owned structures. Egg search remains mandatory but untimed; clue escalation prevents permanent blocking.

**Tech Stack:** TypeScript, Phaser generated graphics/audio positioning, DOM album/build panel, Node test runner.

---

### Task 1: Add seeded randomness and egg-spot content

**Files:**
- Reuse: `src/game/systems/seededRandom.ts`
- Create: `src/game/content/eggSpots.ts`
- Test: `tests/eggSpots.test.ts`

- [ ] **Step 1: Write failing spot-selection tests**

Create `tests/eggSpots.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { EGG_SPOTS, selectEggSpot } from '../src/game/content/eggSpots';
import { isBlocked } from '../src/game/content/yard';
import { createSeededRandom } from '../src/game/systems/seededRandom';

test('opens three, five, and eight egg spots by story chapter', () => {
  assert.equal(EGG_SPOTS.filter((spot) => spot.unlockDay <= 1).length, 3);
  assert.equal(EGG_SPOTS.filter((spot) => spot.unlockDay <= 4).length, 5);
  assert.equal(EGG_SPOTS.filter((spot) => spot.unlockDay <= 10).length, 8);
});

test('never selects yesterday spot when another valid spot exists', () => {
  const random = createSeededRandom(42);
  let previous: string | null = null;
  for (let day = 1; day <= 14; day += 1) {
    const selected = selectEggSpot(day, previous, random);
    assert.notEqual(selected.id, previous);
    previous = selected.id;
  }
});

test('same seed produces the same spot sequence', () => {
  const sequence = (seed: number) => {
    const random = createSeededRandom(seed);
    let previous: string | null = null;
    return Array.from({ length: 14 }, (_, index) => {
      const spot = selectEggSpot(index + 1, previous, random);
      previous = spot.id;
      return spot.id;
    });
  };
  assert.deepEqual(sequence(9), sequence(9));
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `eggSpots.ts` does not exist. `seededRandom.ts` already exists from Phase 3.

- [ ] **Step 3: Reuse the shared seeded random**

Import `createSeededRandom` and `RandomSource` from the Phase 3 module. Do not add a second PRNG or use `Math.random()` for egg selection.

- [ ] **Step 4: Define eight authored spots**

Create `src/game/content/eggSpots.ts`:

```ts
import type { Vec2 } from '../simulation/state';
import type { RandomSource } from '../systems/seededRandom';

export interface EggSpot {
  id: string;
  position: Vec2;
  cluePosition: Vec2;
  unlockDay: 1 | 4 | 10;
  clueKind: 'feather' | 'bent-grass' | 'scratched-soil' | 'shell-sound';
}

export const EGG_SPOTS: EggSpot[] = [
  {
    id: 'coop-straw',
    position: { x: 1005, y: 430 },
    cluePosition: { x: 970, y: 420 },
    unlockDay: 1,
    clueKind: 'feather',
  },
  {
    id: 'west-patch',
    position: { x: 305, y: 455 },
    cluePosition: { x: 340, y: 470 },
    unlockDay: 1,
    clueKind: 'bent-grass',
  },
  {
    id: 'old-tree',
    position: { x: 285, y: 705 },
    cluePosition: { x: 320, y: 690 },
    unlockDay: 1,
    clueKind: 'scratched-soil',
  },
  {
    id: 'pond-reeds',
    position: { x: 245, y: 235 },
    cluePosition: { x: 270, y: 250 },
    unlockDay: 4,
    clueKind: 'shell-sound',
  },
  {
    id: 'east-garden',
    position: { x: 1295, y: 535 },
    cluePosition: { x: 1260, y: 550 },
    unlockDay: 4,
    clueKind: 'bent-grass',
  },
  {
    id: 'house-eaves',
    position: { x: 1010, y: 375 },
    cluePosition: { x: 980, y: 395 },
    unlockDay: 10,
    clueKind: 'feather',
  },
  {
    id: 'south-path',
    position: { x: 610, y: 790 },
    cluePosition: { x: 640, y: 770 },
    unlockDay: 10,
    clueKind: 'scratched-soil',
  },
  {
    id: 'far-hedge',
    position: { x: 1190, y: 835 },
    cluePosition: { x: 1160, y: 815 },
    unlockDay: 10,
    clueKind: 'shell-sound',
  },
];

export function selectEggSpot(
  day: number,
  previousId: string | null,
  random: RandomSource,
) {
  const open = EGG_SPOTS.filter((spot) => spot.unlockDay <= day);
  const withoutPrevious = open.filter((spot) => spot.id !== previousId);
  const candidates = withoutPrevious.length > 0 ? withoutPrevious : open;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}
```

- [ ] **Step 5: Validate positions against the yard**

Add a test case that imports `isBlocked` and asserts every `position` and `cluePosition` is not blocked with radius 12:

```ts
test('egg and clue positions are reachable', () => {
  for (const spot of EGG_SPOTS) {
    assert.equal(isBlocked(spot.position, 12), false, `${spot.id} egg is blocked`);
    assert.equal(isBlocked(spot.cluePosition, 12), false, `${spot.id} clue is blocked`);
  }
});
```

If a coordinate fails, adjust that coordinate before continuing; do not weaken the assertion.

- [ ] **Step 6: Run and commit**

Run:

```powershell
npm test
git add src/game/content/eggSpots.ts tests/eggSpots.test.ts
git commit -m "feat: add seeded hidden egg locations"
```

### Task 2: Implement egg search, classification, and album

**Files:**
- Create: `src/game/systems/eggSearch.ts`
- Test: `tests/eggSearch.test.ts`

- [ ] **Step 1: Write failing egg-system tests**

Create `tests/eggSearch.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceEggSearch,
  classifyEgg,
  collectCurrentEgg,
  createEggSearchState,
  type EggAlbumEntry,
} from '../src/game/systems/eggSearch';

test('raises clue level at sixty and one hundred twenty seconds', () => {
  let state = createEggSearchState('coop-straw');
  state = advanceEggSearch(state, 59);
  assert.equal(state.clueLevel, 0);
  state = advanceEggSearch(state, 1);
  assert.equal(state.clueLevel, 1);
  state = advanceEggSearch(state, 60);
  assert.equal(state.clueLevel, 2);
});

test('classifies caught, muddy, pretty, and ordinary eggs in priority order', () => {
  assert.equal(classifyEgg({ caught: true, muddy: true, positiveKinds: 4 }), 'cracked');
  assert.equal(classifyEgg({ caught: false, muddy: true, positiveKinds: 4 }), 'muddy');
  assert.equal(classifyEgg({ caught: false, muddy: false, positiveKinds: 2 }), 'pretty');
  assert.equal(classifyEgg({ caught: false, muddy: false, positiveKinds: 1 }), 'ordinary');
});

test('records an egg once and schedules one wood', () => {
  const search = createEggSearchState('coop-straw', 'pretty');
  const album: EggAlbumEntry[] = [];
  const first = collectCurrentEgg(search, album);
  const second = collectCurrentEgg(search, album);
  assert.equal(first.woodScheduled, 1);
  assert.equal(second.woodScheduled, 0);
  assert.deepEqual(album, [{ kind: 'pretty', count: 1 }]);
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `eggSearch.ts` does not exist.

- [ ] **Step 3: Implement egg search**

Create `src/game/systems/eggSearch.ts`:

```ts
export type EggKind = 'ordinary' | 'pretty' | 'muddy' | 'cracked' | 'keepsake';

export interface EggSearchState {
  spotId: string;
  kind: EggKind;
  seconds: number;
  clueLevel: 0 | 1 | 2;
  found: boolean;
}

export interface EggAlbumEntry {
  kind: EggKind;
  count: number;
}

export interface EggExperience {
  caught: boolean;
  muddy: boolean;
  positiveKinds: number;
}

export type PositiveExperienceKind =
  | 'favorite-food'
  | 'facility-rest'
  | 'close-interaction'
  | 'safe-close';

export interface DailyExperienceState {
  muddy: boolean;
  positive: PositiveExperienceKind[];
}

export function createEggSearchState(
  spotId: string,
  kind: EggKind = 'ordinary',
): EggSearchState {
  return { spotId, kind, seconds: 0, clueLevel: 0, found: false };
}

export function advanceEggSearch(state: EggSearchState, seconds: number): EggSearchState {
  const elapsed = state.seconds + Math.max(0, seconds);
  return {
    ...state,
    seconds: elapsed,
    clueLevel: elapsed >= 120 ? 2 : elapsed >= 60 ? 1 : 0,
  };
}

export function classifyEgg(experience: EggExperience): EggKind {
  if (experience.caught) return 'cracked';
  if (experience.muddy) return 'muddy';
  if (experience.positiveKinds >= 2) return 'pretty';
  return 'ordinary';
}

export function summarizeDailyExperience(
  state: DailyExperienceState,
  caught: boolean,
): EggExperience {
  return {
    caught,
    muddy: state.muddy,
    positiveKinds: new Set(state.positive).size,
  };
}

export function collectCurrentEgg(
  state: EggSearchState,
  album: EggAlbumEntry[],
) {
  if (state.found) return { found: false, woodScheduled: 0 };
  state.found = true;
  const entry = album.find((item) => item.kind === state.kind);
  if (entry) entry.count += 1;
  else album.push({ kind: state.kind, count: 1 });
  return { found: true, woodScheduled: state.kind === 'keepsake' ? 0 : 1 };
}
```

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm test
git add src/game/systems/eggSearch.ts tests/eggSearch.test.ts
git commit -m "feat: add fair egg search and album rules"
```

### Task 3: Implement wood delivery and six upgrades

**Files:**
- Create: `src/game/content/yardUpgrades.ts`
- Create: `src/game/systems/yardUpgrades.ts`
- Test: `tests/yardUpgrades.test.ts`

- [ ] **Step 1: Write failing upgrade tests**

Create `tests/yardUpgrades.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { YARD_UPGRADES } from '../src/game/content/yardUpgrades';
import {
  buyUpgrade,
  coopEntryRadius,
  createYardUpgradeState,
  deliverPendingWood,
  doorCloseDurationMs,
} from '../src/game/systems/yardUpgrades';

test('all six upgrades cost twelve wood', () => {
  assert.equal(YARD_UPGRADES.length, 6);
  assert.equal(YARD_UPGRADES.reduce((sum, item) => sum + item.cost, 0), 12);
});

test('delivers pending wood at the next morning', () => {
  const state = createYardUpgradeState();
  state.pendingWood = 2;
  assert.equal(deliverPendingWood(state), 2);
  assert.deepEqual(state, { wood: 2, pendingWood: 0, owned: [] });
});

test('buys each upgrade once without negative wood', () => {
  const state = createYardUpgradeState();
  state.wood = 3;
  assert.equal(buyUpgrade(state, 'yard-lamp'), true);
  assert.equal(buyUpgrade(state, 'yard-lamp'), false);
  assert.equal(state.wood, 0);
});

test('coop upgrades make the dusk ritual easier without replacing it', () => {
  const state = createYardUpgradeState();
  assert.equal(coopEntryRadius(state), 34);
  assert.equal(doorCloseDurationMs(state), 850);
  state.owned.push('coop-ramp', 'door-latch');
  assert.equal(coopEntryRadius(state), 56);
  assert.equal(doorCloseDurationMs(state), 300);
});
```

- [ ] **Step 2: Define upgrade content**

Create `src/game/content/yardUpgrades.ts`:

```ts
import type { Vec2 } from '../simulation/state';

export type YardUpgradeId =
  | 'loose-soil'
  | 'shade-shelter'
  | 'low-perch'
  | 'coop-ramp'
  | 'yard-lamp'
  | 'door-latch';

export interface YardUpgradeDefinition {
  id: YardUpgradeId;
  name: string;
  cost: 1 | 2 | 3;
  position: Vec2;
  effect: string;
}

export const YARD_LAMP_POSITION: Vec2 = { x: 930, y: 430 };

export const YARD_UPGRADES: YardUpgradeDefinition[] = [
  { id: 'loose-soil', name: '松土区', cost: 1, position: { x: 610, y: 565 }, effect: '稳定出现蚯蚓和沙浴' },
  { id: 'shade-shelter', name: '遮阴棚', cost: 1, position: { x: 930, y: 600 }, effect: '乘凉、打盹和梳理羽毛' },
  { id: 'low-perch', name: '低栖木', cost: 2, position: { x: 340, y: 690 }, effect: '增加跳跃路线和高处食物' },
  { id: 'coop-ramp', name: '鸡窝坡道', cost: 2, position: { x: 1068, y: 410 }, effect: '收鸡时更少在门口犹豫' },
  { id: 'yard-lamp', name: '院灯', cost: 3, position: YARD_LAMP_POSITION, effect: '提供固定安全光区' },
  { id: 'door-latch', name: '可靠门闩', cost: 3, position: { x: 1092, y: 380 }, effect: '缩短关门动作' },
];
```

- [ ] **Step 3: Implement upgrade state**

Create `src/game/systems/yardUpgrades.ts`:

```ts
import { YARD_UPGRADES, type YardUpgradeId } from '../content/yardUpgrades';

export interface YardUpgradeState {
  wood: number;
  pendingWood: number;
  owned: YardUpgradeId[];
}

export function createYardUpgradeState(): YardUpgradeState {
  return { wood: 0, pendingWood: 0, owned: [] };
}

export function deliverPendingWood(state: YardUpgradeState) {
  const delivered = state.pendingWood;
  state.wood += delivered;
  state.pendingWood = 0;
  return delivered;
}

export function buyUpgrade(state: YardUpgradeState, id: YardUpgradeId) {
  if (state.owned.includes(id)) return false;
  const definition = YARD_UPGRADES.find((item) => item.id === id);
  if (!definition || state.wood < definition.cost) return false;
  state.wood -= definition.cost;
  state.owned.push(id);
  return true;
}

export function coopEntryRadius(state: YardUpgradeState) {
  return state.owned.includes('coop-ramp') ? 56 : 34;
}

export function doorCloseDurationMs(state: YardUpgradeState) {
  return state.owned.includes('door-latch') ? 300 : 850;
}
```

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm test
git add src/game/content/yardUpgrades.ts src/game/systems/yardUpgrades.ts tests/yardUpgrades.test.ts
git commit -m "feat: add bounded yard upgrade economy"
```

### Task 4: Integrate egg and upgrade state into the daily loop

**Files:**
- Modify: `src/game/simulation/state.ts`
- Modify: `src/game/systems/dayFlow.ts`
- Test: `tests/eggDayLoop.test.ts`

- [ ] **Step 1: Write failing day-loop tests**

Create `tests/eggDayLoop.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectMorningEgg,
  createGameState,
  startMorning,
} from '../src/game/simulation/state';

test('day one has a fixed tutorial egg and schedules wood', () => {
  const state = createGameState();
  assert.equal(state.eggSearch.spotId, 'coop-straw');
  assert.equal(collectMorningEgg(state), true);
  assert.equal(state.yard.pendingWood, 1);
});

test('next morning delivers yesterday scheduled wood', () => {
  const state = createGameState();
  collectMorningEgg(state);
  startMorning(state, 2);
  assert.equal(state.yard.wood, 1);
  assert.equal(state.yard.pendingWood, 0);
});

test('ending keepsake does not schedule wood', () => {
  const state = createGameState();
  state.eggSearch.kind = 'keepsake';
  assert.equal(collectMorningEgg(state), true);
  assert.equal(state.yard.pendingWood, 0);
});
```

- [ ] **Step 2: Add nested state**

Add to `GameState`:

```ts
eggSearch: EggSearchState;
eggAlbum: EggAlbumEntry[];
previousEggSpotId: string | null;
yard: YardUpgradeState;
currentDayExperience: DailyExperienceState;
previousDayExperience: EggExperience;
```

Create one seeded random source per selection from `profile.runSeed + day * 7919`; do not store a function in save state.

Initialize Day 1:

```ts
eggSearch: createEggSearchState('coop-straw'),
eggAlbum: [],
previousEggSpotId: null,
yard: createYardUpgradeState(),
currentDayExperience: { muddy: false, positive: [] },
previousDayExperience: { caught: false, muddy: false, positiveKinds: 0 },
```

- [ ] **Step 3: Add morning transitions**

Implement:

```ts
export function collectMorningEgg(state: GameState) {
  const result = collectCurrentEgg(state.eggSearch, state.eggAlbum);
  if (!result.found) return false;
  state.yard.pendingWood += result.woodScheduled;
  state.previousEggSpotId = state.eggSearch.spotId;
  applyFlowEvent(state, { type: 'egg-found' });
  return true;
}

export function startMorning(state: GameState, day: number) {
  state.day = day;
  state.flow.day = day;
  deliverPendingWood(state.yard);
  const random = createSeededRandom(state.profile.runSeed + day * 7919);
  const spot = selectEggSpot(day, state.previousEggSpotId, random);
  state.eggSearch = createEggSearchState(
    spot.id,
    classifyEgg(state.previousDayExperience),
  );
  state.currentDayExperience = { muddy: false, positive: [] };
}
```

At night result, before `startMorning()`, store:

```ts
state.previousDayExperience = summarizeDailyExperience(
  state.currentDayExperience,
  state.caughtToday,
);
```

When an approved positive event occurs, append its typed key only if it is absent. Rain/mud traversal sets `currentDayExperience.muddy = true`. These values must not use nutrition totals.

Wire the existing Phase 4 events with this helper:

```ts
export function recordPositiveExperience(
  state: GameState,
  kind: PositiveExperienceKind,
) {
  if (!state.currentDayExperience.positive.includes(kind)) {
    state.currentDayExperience.positive.push(kind);
  }
}
```

Call it with:

```ts
recordPositiveExperience(state, 'close-interaction');
if (food === state.taste.favorite) recordPositiveExperience(state, 'favorite-food');
recordPositiveExperience(state, 'safe-close');
```

The first two calls belong in accepted `applyCloseInteraction()`; the safe-close call belongs immediately after the coop door closes.

- [ ] **Step 4: Replace prototype egg/material state**

Remove legacy `EggType`, egg stat effects, forced egg type, old archive effects, `materials`, and material gain functions. `HudSnapshot.wood` now reads `state.yard.wood`.

- [ ] **Step 5: Run tests/build and commit**

Run:

```powershell
npm test
npm run build
git add src/game/simulation/state.ts src/game/systems/dayFlow.ts tests/eggDayLoop.test.ts
git commit -m "feat: connect eggs to next day wood"
```

### Task 5: Render clues, album, and upgrade choices

**Files:**
- Modify: `src/phaser/scenes/GameScene.ts`
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `src/game/content/yard.ts`
- Test: `tests/hudSnapshot.test.ts`

- [ ] **Step 1: Render clue escalation**

During `morning-human`, call:

```ts
this.state.eggSearch = advanceEggSearch(this.state.eggSearch, dt);
```

Render by clue level:

- Level 0: one subtle world mark at `cluePosition`.
- Level 1: stronger mark plus directional shell SFX within 360 pixels.
- Level 2: mark pulses and the morning chicken faces the correct quadrant every 6–10 seconds.

Keep the egg object invisible until the human is within 72 pixels and presses the search action. Do not render arrows, distance numbers, or false clues.

- [ ] **Step 2: Add album/build markup**

Add one panel with:

```html
<section id="yardPanel" class="yard-panel" hidden>
  <div class="panel-head">
    <span>小院手记</span>
    <button id="yardPanelClose" type="button">×</button>
  </div>
  <h2>蛋相册</h2>
  <div id="eggAlbumList" class="panel-list"></div>
  <h2>修缮</h2>
  <div id="upgradeChoices" class="upgrade-grid"></div>
</section>
```

Tab opens this panel. Every upgrade button displays name, cost, effect, owned/available state, and dispatches:

```ts
new CustomEvent('chicken-life:buy-upgrade', { detail: { id } })
```

- [ ] **Step 3: Buy and render facilities**

Handle the buy event in `GameScene` with `buyUpgrade()`, force-save, and redraw only the upgrade layer.

Draw:

- Loose soil: warm brown oval with scratch marks.
- Shade shelter: four posts and a dark cloth rectangle.
- Low perch: two supports and one horizontal branch.
- Coop ramp: slatted board to the door.
- Yard lamp: post plus warm light circle.
- Door latch: visible metal bar on the coop door.

- [ ] **Step 4: Wire every facility to a concrete behavior**

- Loose soil adds its zone to the Phase 3 scratch-target list and enables dust bathing.
- Shade shelter and low perch expose the idle actions specified in Task 6.
- Coop ramp uses `coopEntryRadius(state.yard)` when a carried/following chicken reaches the door.
- Door closure starts a visible door tween, disables repeat input, and dispatches `close-door` only after `doorCloseDurationMs(state.yard)`; it remains a separate action from chicken entry.
- Yard lamp has no effect before dusk and is consumed by the light-defense rules in Phase 6.

Add scene regression assertions for the two numeric coop helpers; do not leave any upgrade as a visual-only purchase.

- [ ] **Step 5: Update snapshot tests**

Extend `HudSnapshot` with:

```ts
album: state.eggAlbum.map((entry) => ({ ...entry })),
yard: {
  wood: state.yard.wood,
  pendingWood: state.yard.pendingWood,
  owned: [...state.yard.owned],
},
```

Assert the snapshot returns copies rather than mutable references.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test
npm run build
git add src/phaser/scenes/GameScene.ts src/game/content/yard.ts src/game/simulation/state.ts index.html src/main.ts src/style.css tests/hudSnapshot.test.ts
git commit -m "feat: render egg clues album and yard upgrades"
```

### Task 6: Add controlled weather and facility life

**Files:**
- Create: `src/game/systems/weather.ts`
- Modify: `src/game/simulation/state.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Test: `tests/weather.test.ts`

- [ ] **Step 1: Write failing weather tests**

Create `tests/weather.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWeatherCalendar,
  weatherForDay,
} from '../src/game/systems/weather';

test('weather is deterministic and contains no three-day repeat', () => {
  const first = createWeatherCalendar(12);
  const second = createWeatherCalendar(12);
  assert.deepEqual(first, second);
  assert.equal(first.length, 14);
  for (let index = 2; index < first.length; index += 1) {
    assert.equal(
      first[index] === first[index - 1] && first[index] === first[index - 2],
      false,
    );
  }
});

test('two weeks contain seven sunny, four cloudy, and three rainy days', () => {
  const calendar = createWeatherCalendar(30);
  assert.equal(calendar.filter((item) => item === 'sunny').length, 7);
  assert.equal(calendar.filter((item) => item === 'cloudy').length, 4);
  assert.equal(calendar.filter((item) => item === 'rain').length, 3);
});

test('weather remains deterministic after the authored fourteen days', () => {
  assert.equal(weatherForDay(30, 15), weatherForDay(30, 15));
  assert.ok(['sunny', 'cloudy', 'rain'].includes(weatherForDay(30, 43)));
});
```

- [ ] **Step 2: Implement the weather bag**

Create `src/game/systems/weather.ts`:

```ts
import { createSeededRandom } from './seededRandom';

export type Weather = 'sunny' | 'cloudy' | 'rain';

function fillCalendar(
  calendar: Weather[],
  remaining: Record<Weather, number>,
  random: () => number,
): boolean {
  if (calendar.length === 14) return true;
  const blocked =
    calendar.length >= 2 && calendar.at(-1) === calendar.at(-2)
      ? calendar.at(-1)
      : null;
  const candidates = (Object.keys(remaining) as Weather[])
    .filter((weather) => remaining[weather] > 0 && weather !== blocked)
    .map((weather) => ({ weather, order: random() }))
    .sort((a, b) => a.order - b.order);

  for (const { weather } of candidates) {
    remaining[weather] -= 1;
    calendar.push(weather);
    if (fillCalendar(calendar, remaining, random)) return true;
    calendar.pop();
    remaining[weather] += 1;
  }
  return false;
}

export function createWeatherCalendar(runSeed: number): Weather[] {
  const random = createSeededRandom(runSeed ^ 0x77ea7e);
  const remaining: Record<Weather, number> = { sunny: 7, cloudy: 4, rain: 3 };
  const calendar: Weather[] = [];
  if (!fillCalendar(calendar, remaining, random)) throw new Error('Weather calendar failed');
  return calendar;
}

export function weatherForDay(runSeed: number, day: number): Weather {
  const zeroBased = Math.max(0, day - 1);
  const block = Math.floor(zeroBased / 14);
  const calendar = createWeatherCalendar(runSeed ^ Math.imul(block, 0x45d9f3b));
  return calendar[zeroBased % 14];
}
```

- [ ] **Step 3: Integrate daily weather**

Add to `GameState`:

```ts
weatherCalendar: Weather[];
weather: Weather;
offPathRainSeconds: number;
```

Initialize the first calendar from `profile.runSeed`, and set `weather = weatherForDay(profile.runSeed, day)`. `startMorning()` updates both the active 14-day calendar block and current weather, so post-ending free play never indexes beyond the original array.

During rain, accumulate `offPathRainSeconds` only while the chicken is outside the path/coop. At 4 seconds:

```ts
state.currentDayExperience.muddy = true;
```

Render rain/cloud light changes without adding a weather meter.

- [ ] **Step 4: Add facility idle experiences**

When the chicken is stationary for 2.5 seconds inside an owned facility zone:

- `shade-shelter`: play a 4-second rest/preen animation.
- `loose-soil`: offer a dust-bath action after scratching.
- `low-perch`: play a balance/head-turn idle while perched.

On the first completed rest animation that day:

```ts
if (!state.currentDayExperience.positive.includes('facility-rest')) {
  state.currentDayExperience.positive.push('facility-rest');
}
```

Do not award repeated progress for idling in the same facility.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test
npm run build
git add src/game/systems/weather.ts src/game/simulation/state.ts src/phaser/scenes/GameScene.ts tests/weather.test.ts
git commit -m "feat: add controlled weather and facility life"
```

### Phase 5 exit check

Run:

```powershell
npm test
npm run build
```

Manual expected behavior: Day 1 uses the tutorial egg; spots expand 3 → 5 → 8; clues strengthen without an arrow; every non-keepsake egg schedules one wood; all six facilities can be bought in any order and visibly alter the yard; weather follows the deterministic 7/4/3 calendar and facilities gain small idle-life animations.
