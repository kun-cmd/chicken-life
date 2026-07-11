import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cluckAt,
  createGameState,
  isFoodLockedByAnimal,
  updateAnimals,
  type FoodEntity,
  type YardAnimal,
} from '../src/game/simulation/state';

test('sparrows watch food without stealing or locking it', () => {
  const state = createGameState();
  const food: FoodEntity = {
    id: 99,
    type: 'grain',
    x: 620,
    y: 610,
    visibleAt: 0,
  };
  const sparrow: YardAnimal = {
    id: 7,
    type: 'sparrow',
    x: 620,
    y: 610,
    active: true,
    scared: false,
    phase: 'watching',
    targetFoodId: food.id,
    stealTimer: 0.01,
    facing: 1,
  };

  state.foods = [food];
  state.animals = [sparrow];

  const result = updateAnimals(state, 1);

  assert.deepEqual(result.stolenFoodIds, []);
  assert.equal(state.foods.some((entry) => entry.id === food.id), true);
  assert.equal(isFoodLockedByAnimal(state, food), false);
});

test('a two-adult two-kitten cat family is present from the morning human stage', () => {
  const state = createGameState();
  state.mode = 'human';
  state.phase = 'human';
  state.time = 0.08;
  state.catWillVisitToday = true;
  state.catVisitedToday = false;

  updateAnimals(state, 1);

  const cats = state.animals.filter((animal) => animal.type === 'cat');
  assert.equal(cats.length, 4);
  assert.equal(cats.filter((cat) => cat.catRole === 'adult').length, 2);
  assert.equal(cats.filter((cat) => cat.catRole === 'kitten').length, 2);
  assert.deepEqual(
    cats.map((cat) => cat.catPersonality),
    ['watcher', 'lounger', 'bold-kitten', 'shy-kitten'],
  );
  assert.equal(cats.every((cat) => cat.active), true);
  assert.equal(state.catFamily.met, true);
});

test('a visited legacy save replaces its unnumbered single cat with the full family', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.4;
  state.catVisitedToday = true;
  state.catWillVisitToday = false;
  state.animals = [
    {
      id: 90,
      type: 'cat',
      x: 700,
      y: 760,
      active: true,
      scared: false,
      phase: 'sleeping',
      facing: 1,
    },
  ];

  updateAnimals(state, 0.1);

  assert.equal(state.animals.filter((animal) => animal.type === 'cat').length, 4);
  assert.equal(state.catVisitedToday, true);
});

test('two sparrows perch at fixed lower-left tree spots without a food target', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.3;
  state.foods = [];
  state.animalCooldown = 0;

  updateAnimals(state, 0.1);

  const sparrows = state.animals.filter((animal) => animal.type === 'sparrow');
  assert.equal(sparrows.length, 2);
  assert.deepEqual(
    sparrows.map((sparrow) => ({
      x: sparrow.x,
      y: sparrow.y,
      perch: sparrow.perch,
      targetFoodId: sparrow.targetFoodId,
      homeIndex: sparrow.homeIndex,
    })),
    [
      { x: 181, y: 942, perch: 'left-tree', targetFoodId: undefined, homeIndex: 0 },
      { x: 216, y: 942, perch: 'left-tree', targetFoodId: undefined, homeIndex: 1 },
    ],
  );
});

test('a tree sparrow can fly down to food and then return home', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.3;
  state.chicken = { x: 620, y: 610 };
  state.message = '';
  state.catVisitedToday = true;
  state.catFamily.met = true;
  state.foods = [
    {
      id: 99,
      type: 'grain',
      x: 620,
      y: 610,
      visibleAt: 0,
    },
  ];
  state.animalCooldown = 0;

  updateAnimals(state, 0.1);

  const visitor = state.animals.find(
    (animal) => animal.type === 'sparrow' && animal.targetFoodId === 99,
  );
  assert.ok(visitor);
  assert.equal(visitor.perch, undefined);
  assert.equal(state.message, '');
  assert.ok(state.animalCooldown >= 18);

  updateAnimals(state, 7);

  assert.equal(visitor.perch, 'left-tree');
  assert.equal(visitor.targetFoodId, undefined);
  assert.equal(visitor.x, visitor.homeIndex === 1 ? 216 : 181);
  assert.equal(visitor.y, 942);
});

test('sparrows ignore food outside the chicken view area', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.3;
  state.chicken = { x: 120, y: 980 };
  state.foods = [
    {
      id: 99,
      type: 'grain',
      x: 900,
      y: 420,
      visibleAt: 0,
    },
  ];
  state.animalCooldown = 0;

  updateAnimals(state, 0.1);

  const sparrows = state.animals.filter((animal) => animal.type === 'sparrow');
  assert.equal(sparrows.length, 2);
  assert.equal(sparrows.every((sparrow) => sparrow.perch === 'left-tree'), true);
  assert.equal(sparrows.some((sparrow) => sparrow.targetFoodId === 99), false);
  assert.equal(state.animalCooldown, 7.5);
});

test('clucking scares both sparrows away before they return to the tree', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.3;
  state.foods = [];
  state.animalCooldown = 0;

  updateAnimals(state, 0.1);

  const sparrowIds = state.animals
    .filter((animal) => animal.type === 'sparrow')
    .map((animal) => animal.id)
    .sort((a, b) => a - b);
  const result = cluckAt(state, { x: 200, y: 942 });

  assert.deepEqual(result.scaredIds.sort((a, b) => a - b), sparrowIds);
  assert.equal(state.animals.some((animal) => animal.type === 'sparrow'), false);

  updateAnimals(state, 8);

  const returned = state.animals.filter((animal) => animal.type === 'sparrow');
  assert.equal(returned.length, 2);
  assert.deepEqual(
    returned.map((sparrow) => [sparrow.x, sparrow.y, sparrow.perch]),
    [
      [181, 942, 'left-tree'],
      [216, 942, 'left-tree'],
    ],
  );
});

test('clucking at a cat only moves it along without dropping food', () => {
  const state = createGameState();
  state.animals = [
    {
      id: 8,
      type: 'cat',
      x: 690,
      y: 760,
      active: true,
      scared: false,
      phase: 'sleeping',
      catRole: 'adult',
      catPersonality: 'lounger',
      facing: 1,
    },
  ];
  const foodCount = state.foods.length;

  const result = cluckAt(state, { x: 690, y: 760 });

  assert.deepEqual(result.scaredIds, []);
  assert.deepEqual(result.reactedCatIds, [8]);
  assert.deepEqual(result.droppedFoods, []);
  assert.equal(state.foods.length, foodCount);
  assert.equal(state.animals.length, 1);
  assert.equal(state.animals[0].phase, 'walking');
  assert.equal(state.animals[0].active, true);
  assert.equal(state.animals[0].scared, false);
});

test('the bold kitten bats a slow basketball back toward the chicken once familiar', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'day';
  state.time = 0.4;
  state.catVisitedToday = true;
  state.catFamily.trust = 7;
  state.catFamily.experienced = ['quiet-company', 'cluck-conversation'];
  state.chicken = { x: 760, y: 760 };
  state.basketball = {
    ...state.basketball,
    x: 700,
    y: 760,
    vx: 40,
    vy: 0,
  };
  state.animals = [
    {
      id: 8,
      type: 'cat',
      x: 675,
      y: 760,
      active: true,
      scared: false,
      phase: 'sleeping',
      familyIndex: 2,
      catRole: 'kitten',
      catPersonality: 'bold-kitten',
      interestCooldown: 0,
      facing: 1,
    },
  ];

  updateAnimals(state, 0.1);

  assert.ok(state.basketball.vx > 200);
  assert.equal(state.catFamily.today.includes('ball-play'), true);
  assert.equal(state.animals[0].phase, 'watching');
});

test('a trusted watcher cat warns the chicken before the weasel arrives', () => {
  const state = createGameState();
  state.mode = 'chicken';
  state.phase = 'dusk';
  state.time = 0.7;
  state.flow.phase = 'chicken-dusk';
  state.catVisitedToday = true;
  state.catFamily.trust = 20;
  state.catFamily.experienced = [
    'quiet-company',
    'gave-space',
    'cluck-conversation',
    'ball-play',
  ];
  state.weaselApproach = 75;
  state.animals = [
    {
      id: 8,
      type: 'cat',
      x: 690,
      y: 760,
      active: true,
      scared: false,
      phase: 'sleeping',
      familyIndex: 0,
      catRole: 'adult',
      catPersonality: 'watcher',
      facing: 1,
    },
  ];

  updateAnimals(state, 0.1);

  assert.equal(state.catWarningUsedToday, true);
  assert.match(state.message, /黄鼠狼/);
  assert.equal(state.animals[0].phase, 'watching');
});
