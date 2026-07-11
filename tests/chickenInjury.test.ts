import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceNightResult,
  createGameState,
  finishChickenNight,
  refuseInjuredTouch,
  resolveWeaselOutcome,
  sootheInjuredChicken,
  updateIdleChickenWander,
  type GameState,
} from '../src/game/simulation/state';

function enterChickenNight(state: GameState) {
  state.flow.phase = 'chicken-night';
  state.flow.day = state.day;
  state.mode = 'chicken';
  state.phase = 'night';
  state.nutrition = 100;
  state.nightPressure = 0;
  state.dryRestTonight = true;
  state.caughtToday = false;
}

test('a weasel injury creates a two-budget startled egg', () => {
  const state = createGameState();
  enterChickenNight(state);

  resolveWeaselOutcome(state, 'caught');
  assert.equal(finishChickenNight(state), true);

  assert.equal(state.chickenInjury, 'untreated');
  assert.equal(state.egg?.name, '受惊蛋');
  assert.equal(state.egg?.quality, 'poor');
  assert.equal(state.egg?.budget, 2);
});

test('soothing restores the next egg while skipped care caps it at ordinary', () => {
  const soothed = createGameState();
  enterChickenNight(soothed);
  resolveWeaselOutcome(soothed, 'caught');
  finishChickenNight(soothed);
  advanceNightResult(soothed);

  assert.equal(sootheInjuredChicken(soothed), true);
  assert.equal(soothed.chickenInjury, 'recovering');
  assert.equal(soothed.closeInteractionUsedToday, true);
  enterChickenNight(soothed);
  finishChickenNight(soothed);
  assert.equal(soothed.egg?.quality, 'excellent');
  assert.equal(soothed.egg?.budget, 5);

  const untreated = createGameState();
  enterChickenNight(untreated);
  resolveWeaselOutcome(untreated, 'caught');
  finishChickenNight(untreated);
  advanceNightResult(untreated);
  enterChickenNight(untreated);
  finishChickenNight(untreated);
  assert.equal(untreated.egg?.quality, 'ordinary');
  assert.equal(untreated.egg?.budget, 3);
  advanceNightResult(untreated);
  assert.equal(untreated.chickenInjury, 'none');
});

test('a recovering chicken refuses touch and moves away without relationship loss', () => {
  const state = createGameState();
  state.flow.phase = 'morning-human';
  state.mode = 'human';
  state.phase = 'human';
  state.chickenInjury = 'recovering';
  state.chickenInjuryDay = state.day - 1;
  state.human = { x: 760, y: 900 };
  state.chicken = { x: 812, y: 900 };
  const beforeDistance = Math.hypot(
    state.chicken.x - state.human.x,
    state.chicken.y - state.human.y,
  );
  const beforeMemories = state.relationship.memories;

  assert.equal(refuseInjuredTouch(state), true);
  for (let index = 0; index < 12; index += 1) updateIdleChickenWander(state, 0.05);

  const afterDistance = Math.hypot(
    state.chicken.x - state.human.x,
    state.chicken.y - state.human.y,
  );
  assert.ok(afterDistance > beforeDistance);
  assert.equal(state.relationship.memories, beforeMemories);
  assert.match(state.message, /今天不想再被碰/);
});
