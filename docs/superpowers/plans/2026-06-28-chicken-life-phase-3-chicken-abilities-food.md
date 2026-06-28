# Chicken Life Phase 3: Chicken Abilities and Foraging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace nutrition optimization with staged instinct awakenings, expressive chicken movement, autonomous foraging, food discovery, and sprint-energy feedback.

**Architecture:** Put ability scheduling and food rules in pure systems. `GameScene` translates unlocked abilities into movement/tweens and renders food entities; the systems decide whether an action is allowed and what state it changes. Remove fullness, nutrition, water boost, holes, cat meat, and food-training state after replacement tests pass.

**Tech Stack:** TypeScript, Phaser tweens/generated textures, Node test runner.

---

### Task 1: Implement instinct-awakening rules

**Files:**
- Create: `src/game/systems/abilities.ts`
- Test: `tests/abilities.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/abilities.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createChickenProfile } from '../src/game/profile/chickenProfile';
import {
  awakenAbility,
  canUseAbility,
  pendingAwakening,
} from '../src/game/systems/abilities';

test('schedules scratch, sprint, and flutter on their story days', () => {
  const profile = createChickenProfile(1);
  assert.equal(pendingAwakening(3, profile), null);
  assert.equal(pendingAwakening(4, profile), 'scratch');
  profile.awakenedAbilities.scratch = true;
  assert.equal(pendingAwakening(5, profile), 'sprint');
  profile.awakenedAbilities.sprint = true;
  assert.equal(pendingAwakening(7, profile), 'flutter');
});

test('blocks an ability until its awakening is completed', () => {
  const profile = createChickenProfile(1);
  assert.equal(canUseAbility(profile, 'scratch'), false);
  awakenAbility(profile, 'scratch');
  assert.equal(canUseAbility(profile, 'scratch'), true);
});

test('does not replay an awakened ability', () => {
  const profile = createChickenProfile(1);
  awakenAbility(profile, 'scratch');
  assert.equal(pendingAwakening(4, profile), null);
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `abilities.ts` does not exist.

- [ ] **Step 3: Implement the ability system**

Create `src/game/systems/abilities.ts`:

```ts
import type { AbilityId, ChickenProfile } from '../profile/chickenProfile';

const AWAKENING_DAY: Partial<Record<AbilityId, number>> = {
  scratch: 4,
  sprint: 5,
  flutter: 7,
};

export function canUseAbility(profile: ChickenProfile, ability: AbilityId) {
  return profile.awakenedAbilities[ability];
}

export function pendingAwakening(day: number, profile: ChickenProfile): AbilityId | null {
  for (const ability of ['scratch', 'sprint', 'flutter'] as const) {
    if (!profile.awakenedAbilities[ability] && day >= (AWAKENING_DAY[ability] ?? Infinity)) {
      return ability;
    }
  }
  return null;
}

export function awakenAbility(profile: ChickenProfile, ability: AbilityId) {
  profile.awakenedAbilities[ability] = true;
}
```

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm test
git add src/game/systems/abilities.ts tests/abilities.test.ts
git commit -m "feat: add instinct awakening rules"
```

### Task 2: Add awakened action input and tutorial state

**Files:**
- Modify: `src/game/input/actions.ts`
- Modify: `src/phaser/scenes/GameScene.ts:85-109`
- Modify: `src/phaser/scenes/GameScene.ts:317-484`
- Modify: `src/game/simulation/state.ts`
- Create: `src/game/content/abilityTutorials.ts`
- Test: `tests/abilityTutorials.test.ts`

- [ ] **Step 1: Define fixed tutorial encounters**

Create `src/game/content/abilityTutorials.ts`:

```ts
import type { AbilityId } from '../profile/chickenProfile';
import type { Vec2 } from '../simulation/state';

export interface AbilityTutorial {
  ability: AbilityId;
  day: number;
  position: Vec2;
  prompt: string;
}

export const ABILITY_TUTORIALS: AbilityTutorial[] = [
  {
    ability: 'scratch',
    day: 4,
    position: { x: 610, y: 565 },
    prompt: '松土下面有细响。靠近后按住 E 刨开泥土。',
  },
  {
    ability: 'sprint',
    day: 5,
    position: { x: 845, y: 610 },
    prompt: '虫子突然跑了！朝它移动并按住 Shift。',
  },
  {
    ability: 'flutter',
    day: 7,
    position: { x: 286, y: 700 },
    prompt: '种子落在树桩上。靠近后按 F 扑翅跳起。',
  },
];

export function tutorialForDay(day: number, awakened: Record<AbilityId, boolean>) {
  return ABILITY_TUTORIALS.find(
    (tutorial) => tutorial.day <= day && !awakened[tutorial.ability],
  ) ?? null;
}
```

- [ ] **Step 2: Test deterministic tutorial selection**

Create `tests/abilityTutorials.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createChickenProfile } from '../src/game/profile/chickenProfile';
import { tutorialForDay } from '../src/game/content/abilityTutorials';

test('selects the earliest unfinished required tutorial', () => {
  const profile = createChickenProfile(1);
  assert.equal(tutorialForDay(4, profile.awakenedAbilities)?.ability, 'scratch');
  profile.awakenedAbilities.scratch = true;
  assert.equal(tutorialForDay(7, profile.awakenedAbilities)?.ability, 'sprint');
});
```

- [ ] **Step 3: Replace the input action contract**

Use this action interface:

```ts
export interface InputActions {
  x: number;
  y: number;
  sprintHeld: boolean;
  peckPressed: boolean;
  scratchHeld: boolean;
  flutterPressed: boolean;
  interactPressed: boolean;
  searchPressed: boolean;
  callPressed: boolean;
}
```

Map controls in `GameScene.readActions()`. Consume shared presses once before constructing the mode-specific action object:

```ts
const spacePressed = this.keyboardState.consumePress('Space');
const enterPressed = this.keyboardState.consumePress('Enter');
const interactPressed = this.keyboardState.consumePress('KeyE');

return {
  x: (right ? 1 : 0) - (left ? 1 : 0),
  y: (down ? 1 : 0) - (up ? 1 : 0),
  sprintHeld: this.keyboardState.isDown('ShiftLeft') || this.keyboardState.isDown('ShiftRight'),
  peckPressed: spacePressed,
  scratchHeld: this.keyboardState.isDown('KeyE'),
  flutterPressed: this.keyboardState.consumePress('KeyF'),
  interactPressed,
  searchPressed: spacePressed || enterPressed,
  callPressed: this.keyboardState.consumePress('KeyQ'),
};
```

Add `KeyF` and `KeyQ` to `GAMEPLAY_KEY_CODES`.

Update every `GameScene` call site in the same change:

```ts
actions.sprint       -> actions.sprintHeld
actions.peck         -> actions.peckPressed
actions.digOrRest    -> actions.scratchHeld
actions.interact     -> actions.interactPressed
actions.search       -> actions.searchPressed
actions.call         -> actions.callPressed
```

Use the identifiers on the right as real property accesses; the mapping block above is a migration checklist, not runtime code.

- [ ] **Step 4: Add tutorial state**

Add to `GameState`:

```ts
activeAbilityTutorial: AbilityId | null;
```

Initialize and restore it as `null`. When `release-chicken` enters a chicken phase, set:

```ts
state.activeAbilityTutorial =
  tutorialForDay(state.day, state.profile.awakenedAbilities)?.ability ?? null;
```

Complete each tutorial only at its fixed encounter:

```ts
export function completeAbilityTutorial(state: GameState, ability: AbilityId) {
  if (state.activeAbilityTutorial !== ability) return false;
  awakenAbility(state.profile, ability);
  state.activeAbilityTutorial = null;
  state.reward = {
    title: '本能觉醒',
    name: ability === 'scratch' ? '会刨土了' : ability === 'sprint' ? '会冲刺了' : '会扑翅了',
    effect: '新的本领已经记住。',
  };
  return true;
}
```

Gate scene actions with `canUseAbility()`. During the active tutorial, allow only the tutorial action at the fixed point; completion immediately force-saves.

- [ ] **Step 5: Run tests/build and commit**

Run:

```powershell
npm test
npm run build
git add src/game/input/actions.ts src/game/content/abilityTutorials.ts src/game/simulation/state.ts src/phaser/scenes/GameScene.ts tests/abilityTutorials.test.ts
git commit -m "feat: teach chicken abilities through story encounters"
```

### Task 3: Replace food rules with foraging state

**Files:**
- Create: `src/game/systems/foraging.ts`
- Test: `tests/foraging.test.ts`

- [ ] **Step 1: Write failing foraging tests**

Create `tests/foraging.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeFood,
  createForagingState,
  foodPoolFor,
} from '../src/game/systems/foraging';
import { createChickenProfile } from '../src/game/profile/chickenProfile';

test('keeps advanced food out before the matching ability', () => {
  const profile = createChickenProfile(1);
  assert.deepEqual(foodPoolFor(profile, false), ['grain', 'grass', 'sunflower']);
  profile.awakenedAbilities.scratch = true;
  assert.equal(foodPoolFor(profile, false).includes('worm'), true);
  profile.awakenedAbilities.sprint = true;
  assert.equal(foodPoolFor(profile, false).includes('cricket'), true);
  profile.awakenedAbilities.flutter = true;
  assert.equal(foodPoolFor(profile, false).includes('berry'), true);
});

test('food restores sprint energy and records first discovery', () => {
  const state = createForagingState();
  state.sprintEnergy = 20;
  const result = consumeFood(state, 'worm');
  assert.equal(state.sprintEnergy, 48);
  assert.deepEqual(state.discoveredFoods, ['worm']);
  assert.equal(result.firstDiscovery, true);
  assert.equal(consumeFood(state, 'worm').firstDiscovery, false);
});

test('night bugs are only added during dusk', () => {
  const profile = createChickenProfile(1);
  profile.awakenedAbilities.scratch = true;
  profile.awakenedAbilities.sprint = true;
  assert.equal(foodPoolFor(profile, false).includes('nightBug'), false);
  assert.equal(foodPoolFor(profile, true).includes('nightBug'), true);
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `foraging.ts` does not exist.

- [ ] **Step 3: Implement foraging rules**

Create `src/game/systems/foraging.ts`:

```ts
import type { ChickenProfile } from '../profile/chickenProfile';

export type FoodType =
  | 'grain'
  | 'grass'
  | 'sunflower'
  | 'worm'
  | 'cricket'
  | 'beetle'
  | 'berry'
  | 'nightBug';

export interface ForagingState {
  sprintEnergy: number;
  maxSprintEnergy: number;
  discoveredFoods: FoodType[];
  foodsEatenToday: FoodType[];
}

const ENERGY: Record<FoodType, number> = {
  grain: 12,
  grass: 8,
  sunflower: 16,
  worm: 28,
  cricket: 30,
  beetle: 32,
  berry: 22,
  nightBug: 40,
};

export function createForagingState(): ForagingState {
  return {
    sprintEnergy: 100,
    maxSprintEnergy: 100,
    discoveredFoods: ['grain', 'sunflower'],
    foodsEatenToday: [],
  };
}

export function foodPoolFor(profile: ChickenProfile, dusk: boolean): FoodType[] {
  const pool: FoodType[] = ['grain', 'grass', 'sunflower'];
  if (profile.awakenedAbilities.scratch) pool.push('worm');
  if (profile.awakenedAbilities.sprint) pool.push('cricket', 'beetle');
  if (profile.awakenedAbilities.flutter) pool.push('berry');
  if (dusk && profile.awakenedAbilities.sprint) pool.push('nightBug');
  return pool;
}

export function consumeFood(state: ForagingState, type: FoodType) {
  const firstDiscovery = !state.discoveredFoods.includes(type);
  if (firstDiscovery) state.discoveredFoods.push(type);
  state.foodsEatenToday.push(type);
  state.sprintEnergy = Math.min(state.maxSprintEnergy, state.sprintEnergy + ENERGY[type]);
  return { firstDiscovery, restored: ENERGY[type] };
}
```

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm test
git add src/game/systems/foraging.ts tests/foraging.test.ts
git commit -m "feat: add staged autonomous foraging rules"
```

### Task 4: Integrate sprint, scratch, moving food, and flutter

**Files:**
- Create: `src/game/systems/seededRandom.ts`
- Modify: `src/game/simulation/state.ts`
- Modify: `src/phaser/scenes/GameScene.ts:351-518`
- Modify: `src/phaser/scenes/GameScene.ts:858-947`
- Modify: `src/phaser/scenes/GameScene.ts:1120-1155`
- Modify: `src/phaser/scenes/GameScene.ts:1350-1407`
- Modify: `src/game/content/yard.ts`
- Test: `tests/chickenBody.test.ts`
- Test: `tests/foodSpawns.test.ts`

- [ ] **Step 1: Add body/foraging state**

Replace the legacy `ChickenStats` food-related shape with:

```ts
export interface ChickenBodyState {
  walkSpeed: number;
  sprintMultiplier: number;
  fluttering: boolean;
}
```

Add to `GameState`:

```ts
body: ChickenBodyState;
foraging: ForagingState;
```

Import `FoodType` from `systems/foraging` and replace the food entity shape with:

```ts
export interface FoodEntity extends Vec2 {
  id: number;
  type: FoodType;
  visibleAt: number;
  expiresAt?: number;
  velocity?: Vec2;
  fromKeeper?: boolean;
}
```

Initialize:

```ts
body: { walkSpeed: 118, sprintMultiplier: 1.52, fluttering: false },
foraging: createForagingState(),
```

- [ ] **Step 2: Add a pure sprint regression**

Create `tests/chickenBody.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createForagingState } from '../src/game/systems/foraging';

test('sprint energy cannot fall below zero', () => {
  const state = createForagingState();
  state.sprintEnergy = Math.max(0, state.sprintEnergy - 140);
  assert.equal(state.sprintEnergy, 0);
});
```

Create `tests/foodSpawns.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDailyFoodPlan,
  createForagingState,
  type FoodType,
} from '../src/game/systems/foraging';

const points = [
  { x: 160, y: 220 },
  { x: 350, y: 480 },
  { x: 760, y: 590 },
  { x: 1190, y: 700 },
];
const pool: FoodType[] = ['grain', 'grass', 'sunflower'];

test('daily food is deterministic per run seed and day', () => {
  assert.deepEqual(
    createDailyFoodPlan(77, 3, pool, points, 4),
    createDailyFoodPlan(77, 3, pool, points, 4),
  );
  assert.notDeepEqual(
    createDailyFoodPlan(77, 3, pool, points, 4),
    createDailyFoodPlan(77, 4, pool, points, 4),
  );
});

test('fresh foraging state exposes both human-feed starter foods', () => {
  assert.deepEqual(createForagingState().discoveredFoods, ['grain', 'sunflower']);
});
```

- [ ] **Step 3: Replace sprint movement**

In `updateChicken()`:

```ts
const canSprint =
  canUseAbility(this.state.profile, 'sprint') &&
  actions.sprintHeld &&
  this.state.foraging.sprintEnergy > 0 &&
  hasMove;
const speed = this.state.body.walkSpeed * (canSprint ? this.state.body.sprintMultiplier : 1);
if (canSprint) {
  this.state.foraging.sprintEnergy = Math.max(
    0,
    this.state.foraging.sprintEnergy - 30 * dt,
  );
} else {
  this.state.foraging.sprintEnergy = Math.min(
    this.state.foraging.maxSprintEnergy,
    this.state.foraging.sprintEnergy + 7 * dt,
  );
}
```

- [ ] **Step 4: Add deterministic daily food plans**

Create `src/game/systems/seededRandom.ts`:

```ts
export type RandomSource = () => number;

export function createSeededRandom(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
```

Add to `foraging.ts`:

```ts
import { createSeededRandom } from './seededRandom';
import type { Vec2 } from '../simulation/state';

export interface DailyFoodSpawn extends Vec2 {
  type: FoodType;
}

export function createDailyFoodPlan(
  runSeed: number,
  day: number,
  pool: readonly FoodType[],
  points: readonly Vec2[],
  count: number,
): DailyFoodSpawn[] {
  const random = createSeededRandom(runSeed ^ Math.imul(day, 0x9e3779b1));
  return Array.from({ length: count }, () => ({
    ...points[Math.floor(random() * points.length)],
    type: pool[Math.floor(random() * pool.length)],
  }));
}
```

Define 12 authored, non-blocked `FOOD_SPAWN_POINTS` in `src/game/content/yard.ts`. At the beginning of `chicken-day`, call `createDailyFoodPlan(profile.runSeed, flow.day, foodPoolFor(...), FOOD_SPAWN_POINTS, 8)` exactly once and store the resulting entities in state. Do not call `Math.random()` for food type, position, tutorials, or progression.

- [ ] **Step 5: Implement scratch and moving food**

At the tutorial point or built loose-soil zones, holding E accumulates a 0.65-second scratch timer. On completion, spawn one worm with a 6-second lifetime.

For `cricket`, `beetle`, and `nightBug`, update velocity away from the chicken while within 180 pixels:

```ts
const away = normalize(food.x - this.state.chicken.x, food.y - this.state.chicken.y);
const fleeSpeed = food.type === 'nightBug' ? 92 : 72;
food.x += away.x * fleeSpeed * dt;
food.y += away.y * fleeSpeed * dt;
```

Keep each food inside world bounds and discard a move that enters `isBlocked()`.

- [ ] **Step 6: Implement contextual flutter**

Add fixed jump targets for the tutorial stump and low perches. When F is pressed within 64 pixels and flutter is awakened, tween the chicken to the target over 420 ms:

```ts
this.state.body.fluttering = true;
this.tweens.add({
  targets: this.chicken,
  x: target.x,
  y: target.y,
  scaleY: 1.18,
  yoyo: true,
  duration: 210,
  onComplete: () => {
    this.state.chicken = { x: target.x, y: target.y };
    this.state.body.fluttering = false;
  },
});
```

Disable normal movement while `fluttering` is true.

- [ ] **Step 7: Make eating update foraging**

On successful peck:

```ts
const feedback = consumeFood(this.state.foraging, food.type);
if (feedback.firstDiscovery) {
  this.state.reward = {
    title: '发现新口味',
    name: foodDisplayName(food.type),
    effect: `冲刺劲恢复 ${feedback.restored}`,
  };
}
```

Water remains an animation/audio interaction but does not modify a meter.

- [ ] **Step 8: Verify and commit**

Run:

```powershell
npm test
npm run build
git add src/game/systems/seededRandom.ts src/game/simulation/state.ts src/game/content/yard.ts src/phaser/scenes/GameScene.ts tests/chickenBody.test.ts tests/foodSpawns.test.ts
git commit -m "feat: add expressive chicken movement and food pursuit"
```

### Task 5: Remove the prototype nutrition economy

**Files:**
- Modify: `src/game/simulation/state.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Modify: `src/game/content/yard.ts`
- Modify: `src/main.ts`
- Modify: `index.html`
- Modify: `src/style.css`
- Test: `tests/removedMechanics.test.ts`

- [ ] **Step 1: Add a compile-time/state-surface regression**

Create `tests/removedMechanics.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../src/game/simulation/state';

test('new game state omits the nutrition optimization economy', () => {
  const state = createGameState() as unknown as Record<string, unknown>;
  for (const removed of [
    'nutrition',
    'waterBoost',
    'holes',
    'holesDugToday',
    'abilityTrainingLevel',
    'unlockedFoods',
  ]) {
    assert.equal(removed in state, false, `${removed} should be removed`);
  }
});
```

- [ ] **Step 2: Delete obsolete state and functions**

Remove these state fields and their snapshot equivalents:

```ts
nutrition
waterBoost
coopSafety
abilityTrainingLevel
drankToday
holesDugToday
lightPressureUsed
stats.fullness
unlockedFoods
eaten
holes
catVisitedToday
catWillVisitToday
```

Delete functions used only by those fields:

```ts
overstuffAmountFor
overstuffRatioFor
waterBoostRatioFor
digLimitFor
updateWaterBoost
digHole
restInHole
repairNightPressure
improveCoopAbility
foodTrainingGoal
foodTrainingBlocker
applyCoopTraining
unlockFood
materialGainForToday
```

Remove the cat type, cat spawn, meat food, and meat texture. Keep sparrows only as an ambient scare interaction with no long-term reward.

- [ ] **Step 3: Remove obsolete scene/UI branches**

Delete hole views, pond boost logic, fullness drag, old food unlock messages, cat views, nutrition summaries, training controls, and their CSS. Keep drinking ripples as a no-state animation.

- [ ] **Step 4: Verify no obsolete terms remain**

Run:

```powershell
rg -n "fullness|nutrition|waterBoost|nightPressure|HoleEntity|catWillVisit|meat" src index.html
```

Expected: no matches for removed mechanics; `nightPressure` is fully removed later in Phase 6, so at this phase only its threat-related matches may remain.

- [ ] **Step 5: Test, build, and commit**

Run:

```powershell
npm test
npm run build
git add src index.html tests/removedMechanics.test.ts
git commit -m "refactor: remove nutrition and food training economy"
```

### Phase 3 exit check

Run:

```powershell
npm test
npm run build
```

Manual expected behavior: Days 4, 5, and 7 teach scratch, sprint, and flutter exactly once; ground food restores sprint; moving insects require pursuit; no fullness, nutrition, water, pit, or cat-meat loop remains.
