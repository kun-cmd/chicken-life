# Chicken Life Phase 4: Human Relationship and Dusk Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hidden relationship growth, first-person close feeding/touch, name recognition, human carrying/following, and the complete dusk collection-and-door ritual.

**Architecture:** Keep relationship scoring and close-interaction outcomes pure and deterministic. The DOM renders the close-up because it provides accessible food choices and hand controls; `GameScene` pauses movement, receives the chosen outcome, and updates world animation. Dusk collection uses the same relationship stage to choose carry, lure, or follow behavior.

**Tech Stack:** TypeScript, Phaser, DOM overlays, Node test runner.

---

### Task 1: Implement hidden relationship memory

**Files:**
- Create: `src/game/systems/relationship.ts`
- Test: `tests/relationship.test.ts`

- [ ] **Step 1: Write failing relationship tests**

Create `tests/relationship.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRelationshipState,
  recordTrustMemory,
  relationshipStage,
} from '../src/game/systems/relationship';

test('records each daily memory category only once', () => {
  const state = createRelationshipState();
  assert.equal(recordTrustMemory(state, 1, 'close-interaction'), true);
  assert.equal(recordTrustMemory(state, 1, 'close-interaction'), false);
  assert.equal(recordTrustMemory(state, 1, 'safe-close'), true);
  assert.equal(state.memories, 2);
});

test('applies both memory thresholds and day gates', () => {
  const state = createRelationshipState();
  state.memories = 19;
  assert.equal(relationshipStage(state, 2), 'wary');
  assert.equal(relationshipStage(state, 3), 'familiar');
  assert.equal(relationshipStage(state, 7), 'trusting');
  assert.equal(relationshipStage(state, 11), 'bonded');
});

test('rescue is a one-time bonus and failure never removes memories', () => {
  const state = createRelationshipState();
  assert.equal(recordTrustMemory(state, 8, 'first-rescue'), true);
  assert.equal(recordTrustMemory(state, 10, 'first-rescue'), false);
  assert.equal(state.memories, 1);
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `relationship.ts` does not exist.

- [ ] **Step 3: Implement relationship state**

Create `src/game/systems/relationship.ts`:

```ts
export type RelationshipStage = 'wary' | 'familiar' | 'trusting' | 'bonded';
export type TrustMemoryKind = 'close-interaction' | 'safe-close' | 'first-rescue';

export interface RelationshipState {
  memories: number;
  dailyKeys: string[];
  rescueRecorded: boolean;
}

export function createRelationshipState(): RelationshipState {
  return { memories: 0, dailyKeys: [], rescueRecorded: false };
}

export function recordTrustMemory(
  state: RelationshipState,
  day: number,
  kind: TrustMemoryKind,
) {
  if (kind === 'first-rescue') {
    if (state.rescueRecorded) return false;
    state.rescueRecorded = true;
    state.memories += 1;
    return true;
  }

  const key = `${day}:${kind}`;
  if (state.dailyKeys.includes(key)) return false;
  state.dailyKeys.push(key);
  state.memories += 1;
  return true;
}

export function relationshipStage(
  state: RelationshipState,
  day: number,
): RelationshipStage {
  if (day >= 11 && state.memories >= 19) return 'bonded';
  if (day >= 7 && state.memories >= 9) return 'trusting';
  if (day >= 3 && state.memories >= 3) return 'familiar';
  return 'wary';
}
```

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm test
git add src/game/systems/relationship.ts tests/relationship.test.ts
git commit -m "feat: add hidden relationship memory"
```

### Task 2: Add deterministic taste and close-interaction outcomes

**Files:**
- Create: `src/game/systems/closeInteraction.ts`
- Test: `tests/closeInteraction.test.ts`

- [ ] **Step 1: Write failing close-interaction tests**

Create `tests/closeInteraction.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTasteProfile,
  resolveFoodOffer,
  touchOptionsFor,
} from '../src/game/systems/closeInteraction';

test('creates stable taste preferences from the run seed', () => {
  assert.deepEqual(createTasteProfile(20), createTasteProfile(20));
  assert.notDeepEqual(createTasteProfile(20), createTasteProfile(21));
});

test('favorite food gives an eager response', () => {
  const taste = createTasteProfile(20);
  const result = resolveFoodOffer(taste.favorite, taste, 'familiar');
  assert.equal(result.reaction, 'eager');
  assert.equal(result.accepted, true);
});

test('touch options grow with relationship stage', () => {
  assert.deepEqual(touchOptionsFor('wary'), []);
  assert.deepEqual(touchOptionsFor('familiar'), ['head']);
  assert.deepEqual(touchOptionsFor('trusting'), ['head', 'back', 'hold']);
  assert.deepEqual(touchOptionsFor('bonded'), ['head', 'back', 'hold']);
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `closeInteraction.ts` does not exist.

- [ ] **Step 3: Implement close interaction**

Create `src/game/systems/closeInteraction.ts`:

```ts
import type { FoodType } from './foraging';
import type { RelationshipStage } from './relationship';

const TREAT_FOODS: FoodType[] = ['grain', 'grass', 'sunflower', 'worm', 'berry'];

export interface TasteProfile {
  favorite: FoodType;
  disliked: FoodType;
}

export type TouchOption = 'head' | 'back' | 'hold';

export function createTasteProfile(runSeed: number): TasteProfile {
  const favoriteIndex = Math.abs(runSeed) % TREAT_FOODS.length;
  const dislikedIndex = (favoriteIndex + 2 + (Math.abs(runSeed) % 2)) % TREAT_FOODS.length;
  return {
    favorite: TREAT_FOODS[favoriteIndex],
    disliked: TREAT_FOODS[dislikedIndex],
  };
}

export function resolveFoodOffer(
  food: FoodType,
  taste: TasteProfile,
  stage: RelationshipStage,
) {
  if (food === taste.disliked && stage === 'wary') {
    return { accepted: false, reaction: 'retreat' as const };
  }
  if (food === taste.favorite) {
    return { accepted: true, reaction: 'eager' as const };
  }
  return {
    accepted: true,
    reaction: stage === 'wary' ? ('cautious' as const) : ('calm' as const),
  };
}

export function touchOptionsFor(stage: RelationshipStage): TouchOption[] {
  if (stage === 'wary') return [];
  if (stage === 'familiar') return ['head'];
  return ['head', 'back', 'hold'];
}
```

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm test
git add src/game/systems/closeInteraction.ts tests/closeInteraction.test.ts
git commit -m "feat: add chicken taste and touch outcomes"
```

### Task 3: Add relationship and close-interaction state

**Files:**
- Modify: `src/game/simulation/state.ts`
- Test: `tests/relationshipState.test.ts`

- [ ] **Step 1: Write failing state tests**

Create `tests/relationshipState.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCloseInteraction,
  createGameState,
  currentRelationshipStage,
} from '../src/game/simulation/state';

test('accepted close interaction records one daily memory', () => {
  const state = createGameState();
  state.profile.named = true;
  const food = state.taste.favorite;
  assert.equal(applyCloseInteraction(state, food, null), true);
  assert.equal(state.relationship.memories, 1);
  assert.equal(applyCloseInteraction(state, food, null), true);
  assert.equal(state.relationship.memories, 1);
});

test('relationship stage is derived rather than stored separately', () => {
  const state = createGameState();
  state.day = 7;
  state.flow.day = 7;
  state.relationship.memories = 9;
  assert.equal(currentRelationshipStage(state), 'trusting');
});
```

- [ ] **Step 2: Add nested state**

Add to `GameState`:

```ts
relationship: RelationshipState;
taste: TasteProfile;
closeInteractionUsedToday: boolean;
carryingChicken: boolean;
```

Initialize:

```ts
relationship: createRelationshipState(),
taste: createTasteProfile(profile.runSeed),
closeInteractionUsedToday: false,
carryingChicken: false,
```

Create `profile` in a local variable before the `GameState` literal so the same `runSeed` is used for `taste`.

Restore nested relationship/taste state and reset only `closeInteractionUsedToday` at the next morning.

- [ ] **Step 3: Add pure-facing state mutations**

Add:

```ts
export function currentRelationshipStage(state: GameState) {
  return relationshipStage(state.relationship, state.day);
}

export function applyCloseInteraction(
  state: GameState,
  food: FoodType,
  touch: TouchOption | null,
) {
  if (state.flow.phase !== 'morning-human') return false;
  const stage = currentRelationshipStage(state);
  const foodResult = resolveFoodOffer(food, state.taste, stage);
  if (!foodResult.accepted) {
    state.message = `${state.profile.name}往后退了一步。`;
    return false;
  }
  if (touch && !touchOptionsFor(stage).includes(touch)) return false;
  recordTrustMemory(state.relationship, state.day, 'close-interaction');
  state.closeInteractionUsedToday = true;
  state.message =
    foodResult.reaction === 'eager'
      ? `${state.profile.name}很喜欢这口，啄得又快又轻。`
      : `${state.profile.name}慢慢把手心里的食物吃完了。`;
  return true;
}
```

- [ ] **Step 4: Run tests/build and commit**

Run:

```powershell
npm test
npm run build
git add src/game/simulation/state.ts tests/relationshipState.test.ts
git commit -m "feat: connect relationship state to close interaction"
```

### Task 4: Build the first-person close-interaction overlay

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `src/main.ts`
- Modify: `src/phaser/scenes/GameScene.ts`

- [ ] **Step 1: Add close-interaction markup**

Insert after the naming panel:

```html
<section id="closeInteractionPanel" class="close-interaction" hidden>
  <div class="close-interaction__scene">
    <div id="closeChicken" class="close-chicken" aria-hidden="true"></div>
    <div class="close-hand" aria-hidden="true"></div>
  </div>
  <div class="close-interaction__controls">
    <p id="closeInteractionPrompt">把手放低，等它自己靠近。</p>
    <div id="closeFoodChoices" class="close-choice-row"></div>
    <div id="closeTouchChoices" class="close-choice-row"></div>
    <button id="closeInteractionDone" type="button">轻轻收回手</button>
  </div>
</section>
```

- [ ] **Step 2: Add typed DOM events**

`GameScene` dispatches:

```ts
window.dispatchEvent(
  new CustomEvent('chicken-life:close-open', {
    detail: {
      chickenName: this.state.profile.name,
      foods: this.state.foraging.discoveredFoods,
      touchOptions: touchOptionsFor(currentRelationshipStage(this.state)),
    },
  }),
);
```

`main.ts` renders food buttons with `textContent`, never `innerHTML` from the chicken name. Selecting food and optional touch dispatches:

```ts
window.dispatchEvent(
  new CustomEvent('chicken-life:close-complete', {
    detail: { food: selectedFood, touch: selectedTouch },
  }),
);
```

- [ ] **Step 3: Apply outcome in the scene**

When the human presses E within 74 pixels during `morning-human`, pause world input and open the panel. On `close-complete`, validate food/touch with `applyCloseInteraction()`, play the peck/heart/hold animation, close the panel, and force-save.

Use a 5–8 second animation sequence:

1. Chicken head tilts.
2. Chicken approaches the hand.
3. Three peck beats play with existing peck SFX.
4. Optional touch animation plays.
5. Control returns to the yard.

- [ ] **Step 4: Add CSS and build**

Style the overlay as a close 2D cut-in with the hand at the bottom and chicken head at center. Include `[hidden] { display: none; }`, focus-visible buttons, and a reduced-motion rule that shortens transitions.

Run:

```powershell
npm test
npm run build
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add index.html src/style.css src/main.ts src/phaser/scenes/GameScene.ts
git commit -m "feat: add first person chicken interaction"
```

### Task 5: Replace temporary dusk following with relationship behavior

**Files:**
- Create: `src/game/systems/duskCollection.ts`
- Modify: `src/game/simulation/state.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Test: `tests/duskCollection.test.ts`

- [ ] **Step 1: Write failing collection tests**

Create `tests/duskCollection.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionResponse } from '../src/game/systems/duskCollection';

test('collection response changes with relationship stage', () => {
  assert.equal(collectionResponse('wary', false), 'carry');
  assert.equal(collectionResponse('familiar', true), 'lure');
  assert.equal(collectionResponse('trusting', false), 'follow');
  assert.equal(collectionResponse('bonded', false), 'follow');
});
```

- [ ] **Step 2: Implement dusk collection policy**

Create `src/game/systems/duskCollection.ts`:

```ts
import type { RelationshipStage } from './relationship';

export type CollectionResponse = 'carry' | 'lure' | 'follow';

export function collectionResponse(
  stage: RelationshipStage,
  holdingFood: boolean,
): CollectionResponse {
  if (stage === 'wary') return 'carry';
  if (stage === 'familiar') return holdingFood ? 'lure' : 'carry';
  return 'follow';
}
```

- [ ] **Step 3: Implement carrying and following**

During `dusk-human`:

- Wary: E within 58 pixels sets `carryingChicken = true`.
- Familiar: an offered discovered food makes the chicken follow within 180 pixels; E still permits carrying.
- Trusting/bonded: pressing Q calls the saved chicken name and makes the chicken follow within 260/340 pixels.

While carrying:

```ts
this.state.chicken = {
  x: this.state.human.x + 18 * this.human.scaleX,
  y: this.state.human.y - 22,
};
```

When the carried/following chicken reaches `COOP_DOOR`, dispatch `chicken-entered-coop`, clear `carryingChicken`, and leave the door open.

- [ ] **Step 4: Require a separate door action**

After the chicken is inside, E at the door dispatches `close-door`. Record:

```ts
recordTrustMemory(this.state.relationship, this.state.day, 'safe-close');
```

Do not combine entry and closure in one keypress. Draw an open/closed door state so the player sees the ritual.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test
npm run build
git add src/game/systems/duskCollection.ts src/game/simulation/state.ts src/phaser/scenes/GameScene.ts tests/duskCollection.test.ts
git commit -m "feat: make dusk collection reflect relationship"
```

### Phase 4 exit check

Run:

```powershell
npm test
npm run build
```

Manual expected behavior: morning feeding uses a close-up and records at most one memory; the saved name appears in reactions; at dusk the chicken is carried, lured, or follows according to relationship; chicken entry and door closure are two visible actions.
