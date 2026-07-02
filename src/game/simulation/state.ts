import {
  COOP_DOOR,
  FOOD_SPAWN_POINTS,
  HOUSE,
  KEEPER_ROUTE,
  KEEPER_START,
  POND,
  PLANT_PATCHES,
  SAFE_LIGHTS,
  TREE_POSITIONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  distance,
  isBlocked,
  isInPlantPatch,
  isNearPond,
  isOnPath,
} from '../content/yard';
import { selectEggSpot } from '../content/eggSpots';
import { YARD_LAMP_POSITION } from '../content/yardUpgrades';
import {
  createChickenProfile,
  normalizeChickenName,
  type AbilityId,
  type ChickenProfile,
} from '../profile/chickenProfile';
import { tutorialForDay, tutorialForAbility } from '../content/abilityTutorials';
import { awakenAbility } from '../systems/abilities';
import {
  consumeFood,
  createDailyFoodPlan,
  createForagingState,
  foodDisplayName,
  foodPoolFor,
  isForagingFood,
  type ForagingFoodType,
  type ForagingState,
} from '../systems/foraging';
import {
  activeActor,
  createDayFlow,
  reduceDayFlow,
  type DayFlowEvent,
  type DayFlowState,
  type StoryPhase,
} from '../systems/dayFlow';
import {
  createTasteProfile,
  resolveFoodOffer,
  touchOptionsFor,
  type TasteProfile,
  type TouchOption,
} from '../systems/closeInteraction';
import {
  createRelationshipState,
  recordTrustMemory,
  relationshipStage,
  type RelationshipState,
} from '../systems/relationship';
import {
  collectCurrentEgg,
  createEggSearchState,
  type EggSearchState,
} from '../systems/eggSearch';
import { createSeededRandom } from '../systems/seededRandom';
import {
  createYardUpgradeState,
  deliverPendingWood,
  type YardUpgradeState,
} from '../systems/yardUpgrades';

export type Phase = 'day' | 'dusk' | 'night' | 'human';
export type PlayerMode = 'chicken' | 'human';
export type FoodType = ForagingFoodType | 'bug' | 'meat';
export type FoodUnlocks = Partial<Record<FoodType, boolean>>;
export type YardAnimalType = 'cat' | 'sparrow';
export type YardAnimalPhase = 'sleeping' | 'stealing' | 'fleeing';
export type EggType =
  | 'fullBelly'
  | 'greenLeaf'
  | 'swift'
  | 'lantern'
  | 'brave'
  | 'sunny'
  | 'balanced'
  | 'cracked';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChickenStats {
  maxStamina: number;
  stamina: number;
  fullness: number;
  speed: number;
  peck: number;
  dig: number;
  courage: number;
  lamp: number;
}

export interface FoodEntity extends Vec2 {
  id: number;
  type: FoodType;
  visibleAt: number;
  expiresAt?: number;
  progress?: number;
  hardness?: number;
  freshUntil?: number;
  fromKeeper?: boolean;
  velocity?: Vec2;
}

export interface HoleEntity extends Vec2 {
  id: number;
  dugDay: number;
  restPower: number;
}

export interface EggEntity extends Vec2 {
  type: EggType;
  name: string;
  effect: string;
  found: boolean;
}

export interface EggArchiveEntry {
  type: EggType;
  name: string;
  effect: string;
  upgrade: string;
  count: number;
}

export interface DaySummary {
  day: number;
  eaten: Record<FoodType, number>;
  gainedMaterials: number;
  materialsTotal: number;
  eggType: EggType;
  eggName: string;
  eggReason: string;
  nearMiss: string;
  fullness: number;
  stuffedness: number;
  drankToday: boolean;
  waterBoost: number;
  effectiveFullness: number;
  nightPressure: number;
  caught: boolean;
}

export interface YardAnimal extends Vec2 {
  id: number;
  type: YardAnimalType;
  active: boolean;
  scared: boolean;
  phase: YardAnimalPhase;
  targetFoodId?: number;
  stealTimer?: number;
  facing: number;
}

export interface WeaselState extends Vec2 {
  active: boolean;
  chasing: boolean;
  stunned: number;
}

export interface KeeperState extends Vec2 {
  active: boolean;
  returning: boolean;
  doneFeeding: boolean;
  rescuing: boolean;
  routeIndex: number;
  scatterCooldown: number;
  facing: number;
}

export interface ChickenWanderState {
  target: Vec2 | null;
  wait: number;
  pause: number;
  facing: number;
}

export interface GameState {
  profile: ChickenProfile;
  saveAvailable: boolean;
  flow: DayFlowState;
  day: number;
  phase: Phase;
  mode: PlayerMode;
  activeAbilityTutorial: AbilityId | null;
  body: {
    walkSpeed: number;
    sprintMultiplier: number;
    fluttering: boolean;
  };
  foraging: ForagingState;
  relationship: RelationshipState;
  taste: TasteProfile;
  closeInteractionUsedToday: boolean;
  carryingChicken: boolean;
  time: number;
  nightPressure: number;
  nutrition: number;
  waterBoost: number;
  affection: number;
  coopSafety: number;
  yard: YardUpgradeState;
  abilityTrainingLevel: number;
  caughtToday: boolean;
  huggedToday: boolean;
  repairedToday: boolean;
  keeperRescueUsedToday: boolean;
  drankToday: boolean;
  holesDugToday: number;
  lightPressureUsed: number[];
  chicken: Vec2;
  human: Vec2;
  chickenWander: ChickenWanderState;
  keeper: KeeperState;
  stats: ChickenStats;
  unlockedFoods: FoodUnlocks;
  eaten: Record<FoodType, number>;
  foods: FoodEntity[];
  holes: HoleEntity[];
  egg: EggEntity | null;
  eggSearch: EggSearchState;
  previousEggSpotId: string | null;
  eggArchive: EggArchiveEntry[];
  animals: YardAnimal[];
  animalCooldown: number;
  catVisitedToday: boolean;
  catWillVisitToday: boolean;
  weasel: WeaselState;
  upgrades: string[];
  daySummary: DaySummary | null;
  forcedEggType: EggType | null;
  message: string;
  reward: { title: string; name: string; effect: string } | null;
  nextId: number;
}

export interface PressureContext {
  dt: number;
  position: Vec2;
  staminaRatio: number;
  inShadow: boolean;
  onPath: boolean;
  nearCoop: boolean;
  nearLight: boolean;
}

export interface HudSnapshot {
  chickenName: string;
  requiresNaming: boolean;
  saveAvailable: boolean;
  storyPhase: StoryPhase;
  day: number;
  phase: Phase;
  mode: PlayerMode;
  phaseLabel: string;
  timeLabel: string;
  clockDeg: number;
  stamina: number;
  staminaPct: number;
  wood: number;
  showSprint: boolean;
  contextPrompt: string;
  fullness: number;
  fullnessPct: number;
  stuffedness: number;
  stuffedPct: number;
  nutrition: number;
  nutritionPct: number;
  waterBoost: number;
  waterBoostPct: number;
  drankToday: boolean;
  holesDugToday: number;
  digLimit: number;
  pressure: number;
  pressurePct: number;
  affection: number;
  affectionPct: number;
  coopSafety: number;
  materials: number;
  repairCost: number;
  trainingCost: number;
  unlockedFoods: FoodUnlocks;
  eaten: Record<FoodType, number>;
  stats: ChickenStats;
  upgrades: string[];
  eggArchive: EggArchiveEntry[];
  yard: YardUpgradeState;
  daySummary: DaySummary | null;
  goalTip: string;
  forcedEggType: EggType | null;
  keeperLabel: string;
  toast: string;
  reward: { title: string; name: string; effect: string } | null;
}

const DAY_SECONDS = 155;
const DUSK_START = 0.58;
const NIGHT_START = 0.76;
const KEEPER_FEED_END = 0.25;
const COMFORT_FULLNESS = 72;
const FULLNESS_LIMIT = 100;
const DIG_SPRINT_COST = 28;
const WATER_BOOST_LIMIT = 100;
const WATER_BOOST_DURATION = DAY_SECONDS / 3;
const WATER_BOOST_DECAY = WATER_BOOST_LIMIT / WATER_BOOST_DURATION;
const BASE_CHICKEN_SPEED = 118;
const CAT_START = 0.39;
const CAT_END = 0.58;
const CAT_VISIT_CHANCE = 0.5;
const KEEPER_RESCUE_AFFECTION = 60;
const KEEPER_SWIFT_RESCUE_AFFECTION = 85;
const LIGHT_PRESSURE_BUDGET = 4;
const WORM_VISIBLE_MIN = 0.1;
const WORM_VISIBLE_RANDOM = 0.06;
const RESTOCK_DISTANCE_FROM_CHICKEN = 420;
const RESTOCK_FOOD_COUNT = 3;

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

export function createGameState(): GameState {
  const profile = createChickenProfile();
  const state: GameState = {
    profile,
    saveAvailable: true,
    flow: createDayFlow(),
    day: 1,
    phase: 'human',
    mode: 'human',
    activeAbilityTutorial: null,
    body: {
      walkSpeed: BASE_CHICKEN_SPEED,
      sprintMultiplier: 1.52,
      fluttering: false,
    },
    foraging: createForagingState(),
    relationship: createRelationshipState(),
    taste: createTasteProfile(profile.runSeed),
    closeInteractionUsedToday: false,
    carryingChicken: false,
    time: 0.08,
    nightPressure: 0,
    nutrition: 0,
    waterBoost: 0,
    affection: 12,
    coopSafety: 0,
    yard: createYardUpgradeState(),
    abilityTrainingLevel: 0,
    caughtToday: false,
    huggedToday: false,
    repairedToday: false,
    keeperRescueUsedToday: false,
    drankToday: false,
    holesDugToday: 0,
    lightPressureUsed: freshLightPressureUsed(),
    chicken: { x: COOP_DOOR.x, y: COOP_DOOR.y + 32 },
    human: { x: 760, y: 450 },
    chickenWander: {
      target: null,
      wait: 0,
      pause: 0,
      facing: 1,
    },
    keeper: {
      ...KEEPER_START,
      active: true,
      returning: false,
      doneFeeding: false,
      rescuing: false,
      routeIndex: 1,
      scatterCooldown: 1.6,
      facing: 1,
    },
    stats: {
      maxStamina: 100,
      stamina: 100,
      fullness: 0,
      speed: BASE_CHICKEN_SPEED,
      peck: 1,
      dig: 1,
      courage: 1,
      lamp: 0,
    },
    unlockedFoods: {
      grain: true,
      grass: false,
      bug: false,
      sunflower: true,
      nightBug: false,
      meat: true,
    },
    eaten: freshEaten(),
    foods: [],
    holes: [],
    egg: createTutorialEgg(),
    eggSearch: createEggSearchState('coop-straw'),
    previousEggSpotId: null,
    eggArchive: [],
    animals: [],
    animalCooldown: 5.8,
    catVisitedToday: false,
    catWillVisitToday: Math.random() < CAT_VISIT_CHANCE,
    weasel: {
      x: -120,
      y: 820,
      active: false,
      chasing: false,
      stunned: 0,
    },
    upgrades: [],
    daySummary: null,
    forcedEggType: null,
    message: '白天开始了，小院里有米粒、草籽和蚯蚓。',
    reward: null,
    nextId: 1,
  };

  spawnDailyFood(state);
  return state;
}

export function setChickenName(state: GameState, input: string) {
  state.profile.name = normalizeChickenName(input);
  state.profile.named = true;
  state.message = `从今天起，它叫${state.profile.name}。`;
}

export function applyFlowEvent(state: GameState, event: DayFlowEvent) {
  const previousPhase = state.flow.phase;
  state.flow = reduceDayFlow(state.flow, event);
  syncLegacyPhaseFromFlow(state);
  if (previousPhase !== 'chicken-day' && state.flow.phase === 'chicken-day') {
    state.activeAbilityTutorial =
      tutorialForDay(state.day, state.profile.awakenedAbilities)?.ability ?? null;
    if (state.activeAbilityTutorial) {
      const tutorial = tutorialForAbility(state.activeAbilityTutorial);
      state.message = tutorial?.prompt ?? '';
      if (
        tutorial &&
        tutorial.ability === 'sprint' &&
        !state.foods.some((food) => food.type === 'cricket' && distance(food, tutorial.position) < 24)
      ) {
        spawnFood(state, 'cricket', tutorial.position, state.time);
      }
      if (
        tutorial &&
        tutorial.ability === 'flutter' &&
        !state.foods.some((food) => food.type === 'berry' && distance(food, tutorial.position) < 24)
      ) {
        spawnFood(state, 'berry', tutorial.position, state.time);
      }
    }
  }
}

export function currentRelationshipStage(state: GameState) {
  return relationshipStage(state.relationship, state.day);
}

export function applyCloseInteraction(
  state: GameState,
  food: ForagingFoodType,
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

export function completeAbilityTutorial(state: GameState, ability: AbilityId) {
  if (state.activeAbilityTutorial !== ability) return false;
  awakenAbility(state.profile, ability);
  state.activeAbilityTutorial = null;
  const name = ability === 'scratch' ? '会刨土了' : ability === 'sprint' ? '会冲刺了' : '会扑翅了';
  state.reward = {
    title: '本能觉醒',
    name,
    effect: '新的本领已经记住。',
  };
  state.message = `${state.profile.name}${name}。`;
  return true;
}

export function spawnScratchWorm(state: GameState, position: Vec2) {
  const worm = spawnFood(state, 'worm', position, state.time);
  worm.expiresAt = clamp01(state.time + 0.08);
  state.message = '松土里翻出了一条蚯蚓！';
  return worm;
}

function syncLegacyPhaseFromFlow(state: GameState) {
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

export function advanceChickenTime(state: GameState, dt: number) {
  if (state.mode !== 'chicken') return;
  const oldPhase = state.phase;
  state.time = clamp01(state.time + dt / DAY_SECONDS);

  if (state.time >= NIGHT_START) {
    state.phase = 'night';
  } else if (state.time >= DUSK_START) {
    state.phase = 'dusk';
  } else {
    state.phase = 'day';
  }

  if (oldPhase !== state.phase) {
    if (state.phase === 'dusk') state.message = '天色压下来，院子边缘有细碎响动。';
    if (state.phase === 'night') state.message = '夜里彻底黑了，鸡笼的灯还在亮。';
  }
}

export function updateNightPressure(state: GameState, context: PressureContext) {
  if (state.flow.phase !== 'chicken-dusk' && state.flow.phase !== 'dusk-human') return;
  const darkness =
    state.phase === 'night' ? 1 : state.flow.phase === 'chicken-dusk' || state.flow.phase === 'dusk-human' ? 0.48 : 0;
  const distanceToCoop = Math.min(distance(context.position, COOP_DOOR) / 780, 1);
  const lowSprintRisk = context.staminaRatio < 0.2 ? (0.2 - context.staminaRatio) * 10 : 0;
  const stuffedRisk = overstuffRatioFor(state) * 5.5;
  let gain = darkness * (4.8 + distanceToCoop * 8 + stuffedRisk + lowSprintRisk - state.coopSafety * 0.45);

  if (context.inShadow) gain += 3 * darkness;
  if (!context.onPath) gain += 2.2 * darkness;
  if (context.nearLight && state.flow.phase === 'dusk-human') gain *= 0.5;
  const courageReduction = state.stats.courage * 0.9;
  let nextPressure = clamp(state.nightPressure + (gain - courageReduction) * context.dt, 0, 100);

  if (context.nearLight) {
    const lightIndex = usableLightIndexFor(state, context.position);
    if (lightIndex >= 0) {
      const used = state.lightPressureUsed[lightIndex] ?? 0;
      const remaining = Math.max(0, LIGHT_PRESSURE_BUDGET - used);
      const reduction = Math.min(nextPressure, remaining, lightPressureRateFor(state.stats.lamp) * context.dt);
      if (reduction > 0) {
        nextPressure = clamp(nextPressure - reduction, 0, 100);
        state.lightPressureUsed[lightIndex] = clamp(used + reduction, 0, LIGHT_PRESSURE_BUDGET);
      }
    }
  }

  state.nightPressure = nextPressure;
}

export function eatFood(state: GameState, food: FoodEntity) {
  state.eaten[food.type] = (state.eaten[food.type] ?? 0) + 1;
  let discovery: ReturnType<typeof consumeFood> | null = null;
  if (isForagingFood(food.type)) {
    discovery = consumeFood(state.foraging, food.type);
  }
  if (food.type === 'sunflower') {
    state.affection = clamp(state.affection + 4, 0, 100);
  }
  state.foods = state.foods.filter((item) => item.id !== food.id);
  if (discovery?.firstDiscovery && isForagingFood(food.type)) {
    state.reward = {
      title: '发现新口味',
      name: foodDisplayName(food.type),
      effect: `冲刺劲恢复 ${discovery.restored}`,
    };
    state.message = `${state.profile.name}第一次尝到了${foodDisplayName(food.type)}。`;
  } else {
    state.message = foodMessage(food.type);
  }
}

export function digHole(state: GameState, position: Vec2) {
  const digLimit = digLimitFor(state);
  if (state.holesDugToday >= digLimit) {
    state.message = `今天已经刨了 ${digLimit} 个坑，院子再刨就乱了。`;
    return null;
  }

  if (state.stats.stamina < DIG_SPRINT_COST) {
    state.message = '先喘口气，攒一点冲刺劲再刨坑。';
    return null;
  }

  const hole: HoleEntity = {
    id: state.nextId++,
    x: position.x,
    y: position.y,
    dugDay: state.day,
    restPower: 8 + state.stats.dig * 4,
  };
  state.holes.push(hole);
  state.holesDugToday += 1;
  spendStamina(state, DIG_SPRINT_COST);
  state.message = `土被刨开了，坑里能消食，也能让鸡压压惊。今天还能再刨 ${Math.max(0, digLimit - state.holesDugToday)} 个。`;
  return hole;
}

export function restInHole(state: GameState, hole: HoleEntity, dt: number) {
  const digest = Math.min(state.stats.fullness, hole.restPower * 0.9 * dt);
  if (digest > 0) {
    state.stats.fullness = clamp(state.stats.fullness - digest, 0, FULLNESS_LIMIT);
    if (!state.message) state.message = '鸡缩在坑里打了个盹，肚子慢慢空出来，但今天吃到的营养还在。';
  } else if (!state.message && state.phase === 'day') {
    state.message = '坑里暖暖的，不过鸡肚子已经很空了。';
  }
  if (state.phase !== 'day') {
    state.nightPressure = clamp(state.nightPressure - (5 + hole.restPower * 0.22) * dt, 0, 100);
    if (state.weasel.active && distance(state.weasel, hole) > 54) {
      state.weasel.stunned = Math.max(state.weasel.stunned, 0.18 + state.stats.dig * 0.015);
    }
  }
}

export function spendStamina(state: GameState, amount: number) {
  state.stats.stamina = clamp(state.stats.stamina - amount, 0, state.stats.maxStamina);
}

export function recoverStamina(state: GameState, amount: number) {
  state.stats.stamina = clamp(state.stats.stamina + amount, 0, state.stats.maxStamina);
}

export function overstuffAmountFor(state: GameState) {
  return Math.max(0, state.stats.fullness - COMFORT_FULLNESS);
}

export function overstuffRatioFor(state: GameState) {
  return clamp(overstuffAmountFor(state) / (FULLNESS_LIMIT - COMFORT_FULLNESS), 0, 1);
}

export function waterBoostRatioFor(state: GameState) {
  return clamp(state.waterBoost / WATER_BOOST_LIMIT, 0, 1);
}

export function digLimitFor(state: GameState) {
  return 1;
}

export function updateWaterBoost(state: GameState, actionSeconds: number) {
  if (state.mode !== 'chicken' || actionSeconds <= 0) return;
  state.waterBoost = clamp(state.waterBoost - WATER_BOOST_DECAY * actionSeconds, 0, WATER_BOOST_LIMIT);
}

export function drinkAtPond(state: GameState, dt: number) {
  if (state.mode !== 'chicken') return false;
  if (!isNearPond(state.chicken)) return false;

  const before = state.waterBoost;
  const drinkAmount = 42 * dt;
  state.waterBoost = clamp(state.waterBoost + drinkAmount, 0, WATER_BOOST_LIMIT);
  state.drankToday = true;

  if (!state.message) {
    if (before < 70 && state.waterBoost >= 70) {
      state.message = '鸡把喉咙润开了，接下来一阵吃东西会更顺。';
    } else {
      state.message = '鸡低头喝了几口水，润喉感慢慢攒起来。';
    }
  }
  return true;
}

export function updateKeeper(state: GameState, moveDt: number, clockDt = moveDt) {
  if (state.mode !== 'chicken') return null;
  if (state.keeper.rescuing) return null;
  if (state.keeper.doneFeeding) return null;
  if (state.phase === 'night') {
    state.keeper.active = false;
    state.keeper.doneFeeding = true;
    return null;
  }

  if (!state.keeper.active) {
    state.keeper.active = true;
    state.keeper.returning = false;
    state.keeper.routeIndex = 1;
    state.keeper.scatterCooldown = 1.6;
  }

  if (state.time >= KEEPER_FEED_END || state.phase !== 'day') {
    state.keeper.returning = true;
  }

  const target = state.keeper.returning ? KEEPER_START : KEEPER_ROUTE[state.keeper.routeIndex] ?? KEEPER_ROUTE[0];
  const vector = { x: target.x - state.keeper.x, y: target.y - state.keeper.y };
  const length = Math.hypot(vector.x, vector.y);
  const keeperSpeed = state.phase === 'dusk' ? 26 : 32;

  if (length < 8) {
    if (state.keeper.returning) {
      state.keeper.active = false;
      state.keeper.doneFeeding = true;
      state.message = '养鸡人收起小桶回房子了，院子安静下来。';
      return null;
    }
    state.keeper.routeIndex = (state.keeper.routeIndex + 1) % KEEPER_ROUTE.length;
  } else {
    const step = Math.min(length, keeperSpeed * moveDt);
    state.keeper.x += (vector.x / length) * step;
    state.keeper.y += (vector.y / length) * step;
    if (Math.abs(vector.x) > 3) state.keeper.facing = vector.x > 0 ? 1 : -1;
  }

  state.keeper.scatterCooldown -= clockDt;
  if (!state.keeper.returning && state.phase === 'day' && state.time > 0.08 && state.keeper.scatterCooldown <= 0) {
    state.keeper.scatterCooldown = 5.2 + Math.random() * 1.6;
    return scatterSunflowerSeed(state);
  }

  return null;
}

export function peckFood(state: GameState, food: FoodEntity) {
  if (isFoodLockedByAnimal(state, food)) {
    state.message = '麻雀正挡在米粒上，先咯咯叫把它吓走。';
    return 'missed' as const;
  }

  if (!canEatFood(state, food.type)) {
    state.message = foodUnlockHint(food.type);
    return 'missed' as const;
  }

  if (food.type === 'meat') {
    const hardness = food.hardness ?? 3;
    food.progress = (food.progress ?? 0) + 1;
    if (food.progress < hardness) {
      state.message = `猫留下的肉有点韧，还要再啄 ${hardness - food.progress} 下。`;
      return 'pecked' as const;
    }

    eatFood(state, food);
    return 'eaten' as const;
  }

  if (food.type !== 'sunflower' || !food.fromKeeper) {
    eatFood(state, food);
    return 'eaten' as const;
  }

  if (food.freshUntil && state.time > food.freshUntil) {
    state.message = '瓜子滚进泥里了，下一粒再跟上。';
    return 'missed' as const;
  }

  const nearKeeper = state.keeper.active && distance(state.chicken, state.keeper) < 185;
  if (!nearKeeper) {
    state.message = '人刚撒下瓜子，跟近一点就能啄到。';
    return 'missed' as const;
  }

  const hardness = food.hardness ?? 2;
  food.progress = (food.progress ?? 0) + 1;
  if (food.progress < hardness) {
    state.message = `瓜子壳有点硬，还要再啄 ${hardness - food.progress} 下。`;
    return 'pecked' as const;
  }

  eatFood(state, food);
  return 'eaten' as const;
}

export function expireFoods(state: GameState) {
  const expiredIds: number[] = [];
  const spawnedFoods: FoodEntity[] = [];
  state.foods = state.foods.filter((food) => {
    const expiredSeed = food.type === 'sunflower' && food.freshUntil !== undefined && state.time > food.freshUntil;
    const expiredWorm =
      (food.type === 'bug' || food.type === 'worm') &&
      food.expiresAt !== undefined &&
      state.time > food.expiresAt;
    const expired = expiredSeed || expiredWorm;
    if (expired) {
      expiredIds.push(food.id);
    }
    return !expired;
  });
  return { expiredIds, spawnedFoods };
}

export function restockEdibleFoods(state: GameState) {
  if (state.mode !== 'chicken') return [];
  const hasVisibleEdibleFood = visibleFoods(state).some(
    (food) => food.type !== 'sunflower' && canEatFood(state, food.type) && !isFoodLockedByAnimal(state, food),
  );
  if (hasVisibleEdibleFood) return [];

  const types = restockFoodTypes(state);
  const spawnedFoods: FoodEntity[] = [];
  for (let i = 0; i < RESTOCK_FOOD_COUNT; i += 1) {
    const type = types[Math.floor(Math.random() * types.length)];
    const food = spawnFood(state, type, randomFoodPointOutOfView(state, type === 'nightBug'), state.time);
    spawnedFoods.push(food);
  }
  if (!state.message) state.message = '院子远处又冒出几口能吃的。';
  return spawnedFoods;
}

export function isFoodLockedByAnimal(state: GameState, food: FoodEntity) {
  return state.animals.some(
    (animal) => animal.active && animal.type === 'sparrow' && animal.targetFoodId === food.id,
  );
}

export function canEatFood(state: GameState, type: FoodType) {
  return isForagingFood(type) || state.unlockedFoods[type] === true;
}

export function updateAnimals(state: GameState, dt: number) {
  const stolenFoodIds: number[] = [];
  if (state.mode !== 'chicken') return { stolenFoodIds };

  if (state.phase === 'night') {
    state.animals = state.animals.filter((animal) => animal.type !== 'sparrow' && animal.type !== 'cat');
    return { stolenFoodIds };
  }

  maybeSpawnCat(state);
  maybeSpawnSparrow(state, dt);

  for (const animal of state.animals) {
    if (!animal.active) continue;

    if (animal.type === 'cat' && state.time > CAT_END) {
      animal.active = false;
      animal.scared = true;
      animal.phase = 'fleeing';
      if (!state.message) state.message = '野猫伸了个懒腰，慢慢从房檐边溜走了。';
    }

    if (animal.type === 'sparrow') {
      const target = state.foods.find((food) => food.id === animal.targetFoodId);
      if (!target || target.type !== 'grain' || state.time < target.visibleAt) {
        animal.active = false;
        animal.scared = true;
        animal.phase = 'fleeing';
        continue;
      }

      animal.stealTimer = (animal.stealTimer ?? 5.8) - dt;
      if (animal.stealTimer <= 0) {
        state.foods = state.foods.filter((food) => food.id !== target.id);
        stolenFoodIds.push(target.id);
        animal.active = false;
        animal.scared = true;
        animal.phase = 'fleeing';
        state.message = '麻雀叼走了一粒米，院子里少了一口吃的。';
      }
    }
  }

  state.animals = state.animals.filter((animal) => animal.active);
  return { stolenFoodIds };
}

export function cluckAt(state: GameState, position: Vec2) {
  const scaredIds: number[] = [];
  const savedFoodIds: number[] = [];
  const droppedFoods: FoodEntity[] = [];

  for (const animal of state.animals) {
    if (!animal.active || animal.scared) continue;
    const radius = animal.type === 'cat' ? 188 : 156;
    if (distance(position, animal) > radius) continue;

    animal.active = false;
    animal.scared = true;
    animal.phase = 'fleeing';
    scaredIds.push(animal.id);
    if (animal.targetFoodId) savedFoodIds.push(animal.targetFoodId);
    if (animal.type === 'cat') droppedFoods.push(dropCatMeat(state, animal));
  }

  if (scaredIds.length > 0) {
    state.animalCooldown = Math.max(state.animalCooldown, 3.5);
    const scaredCat = state.animals.some((animal) => scaredIds.includes(animal.id) && animal.type === 'cat');
    const scaredSparrow = state.animals.some((animal) => scaredIds.includes(animal.id) && animal.type === 'sparrow');
    if (scaredCat && scaredSparrow) {
      state.message = '母鸡咯咯一叫，野猫和麻雀都被吓开了，猫还落下一小块肉。';
    } else if (scaredCat) {
      state.message = '母鸡咯咯一叫，打盹的野猫抬头跑开了，原地落下一小块肉。';
    } else {
      state.message = '母鸡咯咯一叫，麻雀扑棱棱飞走了，米粒保住了。';
    }
  } else {
    state.message = '母鸡咯咯叫了一声，院子安静地回响。';
  }

  state.animals = state.animals.filter((animal) => animal.active);
  return { scaredIds, savedFoodIds, droppedFoods };
}

export function callKeeperForWeasel(state: GameState) {
  if (state.mode !== 'chicken') return false;
  if (state.phase !== 'dusk' && state.phase !== 'night') return false;
  if (!state.weasel.active) return false;

  if (state.affection < KEEPER_RESCUE_AFFECTION) {
    state.message = `鸡叫得很急，但养鸡人还没熟到能立刻听懂。亲密达到 ${KEEPER_RESCUE_AFFECTION} 后，夜里叫声会把人喊来。`;
    return false;
  }

  if (state.keeper.rescuing) {
    state.message = '养鸡人已经听见了，正提着灯往院子里赶。';
    return false;
  }

  if (state.keeperRescueUsedToday) {
    state.message = '养鸡人刚刚已经出来过一次，屋里的灯还晃着，今晚只能靠鸡自己回笼。';
    return false;
  }

  state.keeperRescueUsedToday = true;
  state.keeper = {
    ...state.keeper,
    ...KEEPER_START,
    active: true,
    returning: false,
    doneFeeding: true,
    rescuing: true,
    routeIndex: 0,
    scatterCooldown: 0,
    facing: state.weasel.x >= KEEPER_START.x ? 1 : -1,
  };
  state.weasel.stunned = Math.max(state.weasel.stunned, state.affection >= KEEPER_SWIFT_RESCUE_AFFECTION ? 1.1 : 0.65);
  state.message = '鸡急急咯咯叫，养鸡人听见了，正从屋里提灯跑出来。';
  return true;
}

export function updateKeeperRescue(state: GameState, dt: number) {
  if (!state.keeper.rescuing) return false;

  if (!state.weasel.active) {
    state.keeper.rescuing = false;
    state.keeper.active = false;
    return false;
  }

  const target = state.weasel;
  const vector = {
    x: target.x - state.keeper.x,
    y: target.y - state.keeper.y,
  };
  const length = Math.hypot(vector.x, vector.y);
  const rescueSpeed = keeperRescueSpeedFor(state);

  if (length > 0.01) {
    const step = Math.min(length, rescueSpeed * dt);
    state.keeper.x += (vector.x / length) * step;
    state.keeper.y += (vector.y / length) * step;
    if (Math.abs(vector.x) > 2) state.keeper.facing = vector.x > 0 ? 1 : -1;
  }

  const remaining = distance(state.keeper, target);
  if (remaining > 42) return false;

  const pressureDrop = state.affection >= KEEPER_SWIFT_RESCUE_AFFECTION ? 40 : 28;
  state.keeper.rescuing = false;
  state.keeper.active = false;
  state.weasel.active = false;
  state.weasel.chasing = false;
  state.weasel.stunned = 0;
  state.nightPressure = clamp(state.nightPressure - pressureDrop, 0, 100);
  state.affection = clamp(state.affection + 2, 0, 100);
  state.message =
    state.affection >= KEEPER_SWIFT_RESCUE_AFFECTION
      ? `养鸡人一眼认出鸡的急叫，快步追上黄鼠狼，把它赶出院子。夜压降低 ${pressureDrop}。`
      : `养鸡人追到黄鼠狼身边，提灯一晃，把它赶出了院子。夜压降低 ${pressureDrop}。`;
  return true;
}

function keeperRescueSpeedFor(state: GameState) {
  return state.affection >= KEEPER_SWIFT_RESCUE_AFFECTION ? 270 : 205 + state.affection * 0.7;
}

export function hugChicken(state: GameState) {
  if (state.mode !== 'human') return false;
  if (state.huggedToday) {
    state.message = '今天已经抱过鸡了，它正暖乎乎地跟着你。';
    return false;
  }

  state.huggedToday = true;
  state.affection = clamp(state.affection + 9, 0, 100);
  state.stats.courage += 1;
  state.chickenWander.pause = 1.4;
  state.chickenWander.wait = 0.8;
  state.chickenWander.target = null;
  state.message = '你轻轻抱起鸡，鸡安静地咯咯了一声。';
  return true;
}

export function repairCoop(state: GameState) {
  return repairNightPressure(state);
}

function repairNightPressure(state: GameState) {
  if (state.mode !== 'human') return false;
  if (state.repairedToday) {
    state.message = '今天已经认真修过窝了，剩下的窝材可以留给训练。';
    return false;
  }

  if (state.nightPressure <= 0) {
    state.message = '昨晚的紧张已经清干净了，可以把窝材用在训练上。';
    return false;
  }

  if (state.yard.wood <= 0) {
    state.message = '没有窝材了，今天只能先让鸡窝保持原样。';
    return false;
  }

  const cost = repairCostFor(state);
  const spent = Math.min(state.yard.wood, cost);
  const repairedPressure = Math.min(state.nightPressure, spent * 4);
  state.repairedToday = true;
  state.yard.wood -= spent;
  state.nightPressure = clamp(state.nightPressure - repairedPressure, 0, 100);
  state.affection = clamp(state.affection + 4, 0, 100);
  state.message =
    state.nightPressure <= 0
      ? `你给鸡窝换了干草和挡风木条，花掉 ${spent} 份窝材，昨晚的夜压被清掉了。`
      : `你花掉 ${spent} 份窝材，修掉 ${Math.round(repairedPressure)} 点夜压，还剩 ${Math.round(state.nightPressure)} 点。`;
  return true;
}

export function improveCoopAbility(state: GameState) {
  if (state.mode !== 'human') return false;
  const blocker = foodTrainingBlocker(state);
  if (blocker) {
    state.message = blocker;
    return false;
  }

  const cost = trainingCostFor(state);
  if (state.yard.wood < cost) {
    state.message = `训练和改窝需要 ${cost} 份窝材，现在只有 ${state.yard.wood} 份。`;
    return false;
  }

  state.yard.wood -= cost;
  const result = applyCoopTraining(state);
  state.abilityTrainingLevel += 1;
  state.affection = clamp(state.affection + 3, 0, 100);
  state.message = `${result} 花掉 ${cost} 份窝材。`;
  return true;
}

export function updateMorningChickenWander(state: GameState, dt: number) {
  if (state.mode !== 'human') return;

  const nearHuman = distance(state.human, state.chicken) < 92;
  if (nearHuman) {
    state.chickenWander.target = null;
    state.chickenWander.wait = Math.max(state.chickenWander.wait, 0.35);
    return;
  }

  if (state.chickenWander.pause > 0) {
    state.chickenWander.pause = Math.max(0, state.chickenWander.pause - dt);
    return;
  }

  if (state.chickenWander.wait > 0) {
    state.chickenWander.wait = Math.max(0, state.chickenWander.wait - dt);
    return;
  }

  if (!state.chickenWander.target || distance(state.chicken, state.chickenWander.target) < 12) {
    state.chickenWander.target = pickMorningChickenTarget(state);
    state.chickenWander.wait = 0.35 + Math.random() * 1.1;
    return;
  }

  const target = state.chickenWander.target;
  const vector = {
    x: target.x - state.chicken.x,
    y: target.y - state.chicken.y,
  };
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.01) {
    state.chickenWander.target = null;
    return;
  }

  const speed = 34 + Math.min(state.affection, 60) * 0.12;
  const step = Math.min(length, speed * dt);
  const next = {
    x: state.chicken.x + (vector.x / length) * step,
    y: state.chicken.y + (vector.y / length) * step,
  };

  if (isBlocked(next, 18)) {
    state.chickenWander.target = null;
    state.chickenWander.wait = 0.7;
    return;
  }

  state.chicken = next;
  if (Math.abs(vector.x) > 2) state.chickenWander.facing = vector.x > 0 ? 1 : -1;
}

function oldRepairCoop(state: GameState) {
  if (state.mode !== 'human') return false;
  if (state.repairedToday) {
    state.message = '鸡窝今天已经整理好了。';
    return false;
  }

  state.repairedToday = true;
  state.coopSafety = clamp(state.coopSafety + 1, 0, 5);
  state.affection = clamp(state.affection + 4, 0, 100);
  state.message = '你给鸡窝添了干草和小木条，夜里会更安心。';
  return true;
}

export function finishChickenRun(state: GameState, caught: boolean) {
  state.caughtToday = caught;
  if (state.flow.phase === 'chicken-day') {
    applyFlowEvent(state, { type: 'tick', amount: 1 });
  }
  if (state.flow.phase === 'chicken-dusk') {
    applyFlowEvent(state, { type: 'call-human' });
  }
  state.nightPressure = caught ? 88 : Math.min(state.nightPressure, 50);
  state.egg = createEgg(state);
  state.human = { x: 750, y: 448 };
  state.chicken = { x: COOP_DOOR.x, y: COOP_DOOR.y + 34 };
  state.chickenWander = { target: null, wait: 0.45, pause: 0.35, facing: 1 };
  state.reward = null;
  state.daySummary = createDaySummary(state, 0);
  state.message = caught
    ? '黄鼠狼扑了过来，鸡惊叫着逃回笼边。明早先去找蛋。'
    : '鸡钻回笼里，咯咯地叫了起来。明早先去找蛋。';
}

export function finishNightResult(state: GameState) {
  recordTrustMemory(state.relationship, state.day, 'safe-close');
  state.carryingChicken = false;
  state.egg = createEgg(state);
  state.reward = null;
  state.daySummary = createDaySummary(state, 0);
  state.message = state.caughtToday
    ? '今晚受了惊，明早去看看留下了什么蛋。'
    : '门关好了。明早先找蛋，再看看昨天换回的木料。';
}

export function advanceNightResult(state: GameState) {
  const nextMorningEgg = state.egg;
  applyFlowEvent(state, { type: 'next-morning' });
  const deliveredWood = deliverPendingWood(state.yard);
  state.nightPressure = 0;
  state.nutrition = 0;
  state.waterBoost = 0;
  state.caughtToday = false;
  state.huggedToday = false;
  state.closeInteractionUsedToday = false;
  state.carryingChicken = false;
  state.repairedToday = false;
  state.keeperRescueUsedToday = false;
  state.drankToday = false;
  state.holesDugToday = 0;
  state.lightPressureUsed = freshLightPressureUsed();
  state.chicken = { x: COOP_DOOR.x, y: COOP_DOOR.y + 32 };
  state.human = { x: 750, y: 448 };
  state.chickenWander = { target: null, wait: 0.4, pause: 0.2, facing: 1 };
  state.keeper = {
    ...KEEPER_START,
    active: true,
    returning: false,
    doneFeeding: false,
    rescuing: false,
    routeIndex: 1,
    scatterCooldown: 1.6,
    facing: 1,
  };
  state.stats.stamina = state.stats.maxStamina;
  state.foraging.sprintEnergy = state.foraging.maxSprintEnergy;
  state.foraging.foodsEatenToday = [];
  state.foraging.refillWave = 0;
  state.body.fluttering = false;
  state.activeAbilityTutorial = null;
  state.stats.fullness = 0;
  state.eaten = freshEaten();
  state.foods = [];
  state.holes = state.holes.filter((hole) => state.day - hole.dugDay <= 1).slice(-4);
  state.animals = [];
  state.animalCooldown = 5.8;
  state.catVisitedToday = false;
  state.catWillVisitToday = Math.random() < CAT_VISIT_CHANCE;
  state.weasel = { x: -120, y: 820, active: false, chasing: false, stunned: 0 };
  state.egg = nextMorningEgg;
  state.reward = null;
  state.message =
    deliveredWood > 0
      ? `清晨到了，昨天换回的 ${deliveredWood} 份木料已经送到。先去找今天的蛋。`
      : '清晨到了。先在院子里找到今天的蛋。';
  spawnDailyFood(state);
}

export function collectEgg(state: GameState) {
  if (!state.egg || state.egg.found || !collectCurrentEgg(state.eggSearch)) return false;
  state.egg.found = true;
  applyEggEffect(state, state.egg.type);
  rememberEgg(state, state.egg.type);
  state.yard.pendingWood += 1;
  state.previousEggSpotId = state.eggSearch.spotId;
  state.reward = {
    title: '找到鸡蛋',
    name: state.egg.name,
    effect: state.egg.effect,
  };
  state.message = `${state.egg.name} 被捧起来换了 1 份木料，明早送到。还可以再照料鸡；准备好后回房门口按 E 回屋。`;
  return true;
}

export function startNextDay(state: GameState) {
  applyFlowEvent(state, { type: 'next-morning' });
  deliverPendingWood(state.yard);
  state.nightPressure = 0;
  state.nutrition = 0;
  state.waterBoost = 0;
  state.caughtToday = false;
  state.huggedToday = false;
  state.closeInteractionUsedToday = false;
  state.carryingChicken = false;
  state.repairedToday = false;
  state.keeperRescueUsedToday = false;
  state.drankToday = false;
  state.holesDugToday = 0;
  state.lightPressureUsed = freshLightPressureUsed();
  state.chicken = { x: COOP_DOOR.x, y: COOP_DOOR.y + 32 };
  state.human = { x: 750, y: 448 };
  state.chickenWander = { target: null, wait: 0, pause: 0, facing: 1 };
  state.keeper = {
    ...KEEPER_START,
    active: true,
    returning: false,
    doneFeeding: false,
    rescuing: false,
    routeIndex: 1,
    scatterCooldown: 1.6,
    facing: 1,
  };
  state.stats.stamina = state.stats.maxStamina;
  state.foraging.sprintEnergy = state.foraging.maxSprintEnergy;
  state.foraging.foodsEatenToday = [];
  state.foraging.refillWave = 0;
  state.body.fluttering = false;
  state.activeAbilityTutorial = null;
  state.stats.fullness = 0;
  state.eaten = freshEaten();
  state.foods = [];
  state.holes = state.holes.filter((hole) => state.day - hole.dugDay <= 1).slice(-4);
  state.egg = null;
  state.daySummary = null;
  state.animals = [];
  state.animalCooldown = 5.8;
  state.catVisitedToday = false;
  state.catWillVisitToday = Math.random() < CAT_VISIT_CHANCE;
  state.weasel = { x: -120, y: 820, active: false, chasing: false, stunned: 0 };
  state.reward = null;
  state.message = '新的一天，小院泥地又冒出细小食物。';
  spawnDailyFood(state);
}

export function buildHudSnapshot(state: GameState, consumeTransient = true): HudSnapshot {
  const snapshot: HudSnapshot = {
    chickenName: state.profile.name,
    requiresNaming: !state.profile.named,
    saveAvailable: state.saveAvailable,
    storyPhase: state.flow.phase,
    day: state.day,
    phase: state.phase,
    mode: state.mode,
    phaseLabel: storyPhaseLabel(state.flow.phase),
    timeLabel: timeLabel(state.time, state.phase),
    clockDeg: state.time * 270 - 60,
    stamina: Math.round(state.foraging.sprintEnergy),
    staminaPct: Math.round((state.foraging.sprintEnergy / state.foraging.maxSprintEnergy) * 100),
    wood: state.yard.wood,
    showSprint: state.mode === 'chicken' && state.profile.awakenedAbilities.sprint,
    contextPrompt: goalTipFor(state),
    fullness: Math.round(state.stats.fullness),
    fullnessPct: Math.round(state.stats.fullness),
    stuffedness: Math.round(overstuffAmountFor(state)),
    stuffedPct: Math.round(overstuffRatioFor(state) * 100),
    nutrition: Math.round(state.nutrition),
    nutritionPct: Math.round(state.nutrition),
    waterBoost: Math.round(state.waterBoost),
    waterBoostPct: Math.round((state.waterBoost / WATER_BOOST_LIMIT) * 100),
    drankToday: state.drankToday,
    holesDugToday: state.holesDugToday,
    digLimit: digLimitFor(state),
    pressure: Math.round(state.nightPressure),
    pressurePct: Math.round(state.nightPressure),
    affection: Math.round(state.affection),
    affectionPct: Math.round(state.affection),
    coopSafety: state.coopSafety,
    materials: state.yard.wood,
    repairCost: repairCostFor(state),
    trainingCost: trainingCostFor(state),
    unlockedFoods: { ...state.unlockedFoods },
    eaten: { ...state.eaten },
    stats: { ...state.stats },
    upgrades: [...state.upgrades],
    eggArchive: state.eggArchive.map((entry) => ({ ...entry })),
    yard: {
      wood: state.yard.wood,
      pendingWood: state.yard.pendingWood,
      owned: [...state.yard.owned],
    },
    daySummary: state.daySummary ? { ...state.daySummary, eaten: { ...state.daySummary.eaten } } : null,
    goalTip: goalTipFor(state),
    forcedEggType: state.forcedEggType,
    keeperLabel: keeperLabel(state),
    toast: state.message,
    reward: state.reward ? { ...state.reward } : null,
  };

  if (consumeTransient) {
    state.message = '';
    state.reward = null;
  }

  return snapshot;
}

function goalTipFor(state: GameState) {
  const tutorial = tutorialForAbility(state.activeAbilityTutorial);
  if (state.mode === 'human') {
    if (state.flow.phase === 'dusk-human') {
      return `按空格撒瓜子引${state.profile.name}回鸡舍；门前撒一粒后按 E 开门，进去后再按 E 关门。`;
    }
    if (state.egg && !state.egg.found) return '按空格搜索；没找到时，看鸡朝哪个方向叫。';
    if (state.flow.morningEggFound) return '还可以靠近鸡按 E 抱一抱，或去鸡窝修缮；准备好后到房门口按 E 回屋。';
    return '靠近鸡按 E 互动。';
  }
  if (tutorial) return tutorial.prompt;
  if (state.flow.phase === 'chicken-dusk') return `连续咯咯叫几声，让屋里听见${state.profile.name}想回窝。`;
  if (state.weasel.active) return '黄鼠狼来了：咯咯叫、冲刺躲开，等养鸡人赶来。';
  const controls = ['空格啄食 / 咯咯叫'];
  if (state.profile.awakenedAbilities.scratch) controls.push('E 刨松土');
  if (state.profile.awakenedAbilities.sprint) controls.push('Shift 冲刺');
  if (state.profile.awakenedAbilities.flutter) controls.push('F 扑翅');
  return controls.join(' · ');
}

export function restoreGameState(saved: unknown): GameState {
  const fresh = createGameState();
  if (!saved || typeof saved !== 'object') return fresh;
  const input = saved as Partial<GameState>;
  const hasSavedFlow = !!input.flow && typeof input.flow === 'object';
  const savedDay = Number(input.day);
  const restoredFlow = createDayFlow(
    hasSavedFlow
      ? input.flow
      : { day: Number.isFinite(savedDay) && savedDay > 0 ? Math.floor(savedDay) : 1 },
  );
  const restoredProfile = {
    ...fresh.profile,
    ...(input.profile ?? {}),
    awakenedAbilities: {
      ...fresh.profile.awakenedAbilities,
      ...(input.profile?.awakenedAbilities ?? {}),
    },
  };
  const restored: GameState = {
    ...fresh,
    ...input,
    flow: restoredFlow,
    profile: restoredProfile,
    activeAbilityTutorial: input.activeAbilityTutorial ?? null,
    body: { ...fresh.body, ...(input.body ?? {}) },
    foraging: {
      ...fresh.foraging,
      ...(input.foraging ?? {}),
      discoveredFoods: Array.isArray(input.foraging?.discoveredFoods)
        ? input.foraging.discoveredFoods
        : fresh.foraging.discoveredFoods,
      foodsEatenToday: Array.isArray(input.foraging?.foodsEatenToday)
        ? input.foraging.foodsEatenToday
        : fresh.foraging.foodsEatenToday,
    },
    relationship: {
      ...fresh.relationship,
      ...(input.relationship ?? {}),
      dailyKeys: Array.isArray(input.relationship?.dailyKeys)
        ? input.relationship.dailyKeys
        : fresh.relationship.dailyKeys,
    },
    taste: {
      ...createTasteProfile(restoredProfile.runSeed),
      ...(input.taste ?? {}),
    },
    closeInteractionUsedToday: input.closeInteractionUsedToday ?? false,
    carryingChicken: input.carryingChicken ?? false,
    saveAvailable: input.saveAvailable ?? true,
    chicken: { ...fresh.chicken, ...(input.chicken ?? {}) },
    human: { ...fresh.human, ...(input.human ?? {}) },
    chickenWander: { ...fresh.chickenWander, ...(input.chickenWander ?? {}) },
    keeper: { ...fresh.keeper, ...(input.keeper ?? {}) },
    lightPressureUsed: restoreLightPressureUsed(input.lightPressureUsed),
    stats: { ...fresh.stats, ...(input.stats ?? {}) },
    unlockedFoods: { ...fresh.unlockedFoods, ...(input.unlockedFoods ?? {}) },
    eaten: { ...fresh.eaten, ...(input.eaten ?? {}) },
    foods: Array.isArray(input.foods) ? input.foods.map((food) => restoreFood(food, fresh)) : fresh.foods,
    holes: Array.isArray(input.holes) ? input.holes : fresh.holes,
    egg: input.egg ?? (hasSavedFlow ? null : createTutorialEgg()),
    eggSearch: {
      ...fresh.eggSearch,
      ...(input.eggSearch ?? {}),
      found: input.egg?.found ?? input.eggSearch?.found ?? fresh.eggSearch.found,
    },
    previousEggSpotId: input.previousEggSpotId ?? null,
    eggArchive: Array.isArray(input.eggArchive) ? input.eggArchive : fresh.eggArchive,
    yard: {
      ...fresh.yard,
      ...(input.yard ?? {}),
      owned: Array.isArray(input.yard?.owned) ? input.yard.owned : fresh.yard.owned,
    },
    animals: Array.isArray(input.animals) ? input.animals : fresh.animals,
    weasel: { ...fresh.weasel, ...(input.weasel ?? {}) },
    upgrades: Array.isArray(input.upgrades) ? input.upgrades : fresh.upgrades,
    daySummary: restoreDaySummary(input.daySummary),
    forcedEggType: isEggType(input.forcedEggType) ? input.forcedEggType : null,
    reward: null,
    message: input.message ?? fresh.message,
  };
  if ((input.stats as Partial<ChickenStats> | undefined)?.speed === 142) {
    restored.stats.speed = BASE_CHICKEN_SPEED;
  }
  const savedNutrition = Number((input as { nutrition?: unknown }).nutrition ?? restored.stats.fullness);
  restored.nutrition = Number.isFinite(savedNutrition) ? clamp(savedNutrition, 0, FULLNESS_LIMIT) : restored.stats.fullness;
  const savedWaterBoost = Number((input as { waterBoost?: unknown }).waterBoost ?? 0);
  restored.waterBoost = Number.isFinite(savedWaterBoost) ? clamp(savedWaterBoost, 0, WATER_BOOST_LIMIT) : 0;
  if (!input.yard) {
    const legacyWood = Number((input as { materials?: unknown }).materials ?? 0);
    restored.yard.wood = Number.isFinite(legacyWood) ? Math.max(0, Math.floor(legacyWood)) : 0;
  }
  if (input.egg && !input.eggSearch) {
    const spot = selectEggSpot(
      restored.day,
      restored.previousEggSpotId,
      createSeededRandom(restored.profile.runSeed + restored.day * 7919),
    );
    restored.egg = { ...input.egg, ...spot.position };
    restored.eggSearch = {
      ...createEggSearchState(spot.id),
      found: input.egg.found,
    };
  }
  syncLegacyPhaseFromFlow(restored);
  return restored;
}

function restoreDaySummary(saved: Partial<DaySummary> | null | undefined): DaySummary | null {
  if (!saved) return null;
  const eggType = isEggType(saved.eggType) ? saved.eggType : 'cracked';
  const waterBoost = Number(saved.waterBoost ?? 0);
  return {
    ...saved,
    day: saved.day ?? 1,
    eaten: { ...freshEaten(), ...(saved.eaten ?? {}) },
    gainedMaterials: saved.gainedMaterials ?? 0,
    materialsTotal: saved.materialsTotal ?? 0,
    eggType,
    eggName: saved.eggName ?? eggCatalog[eggType].name,
    eggReason: saved.eggReason ?? '',
    nearMiss: saved.nearMiss ?? '',
    fullness: saved.fullness ?? 0,
    stuffedness: saved.stuffedness ?? 0,
    drankToday: saved.drankToday ?? false,
    waterBoost: Number.isFinite(waterBoost) ? clamp(waterBoost, 0, WATER_BOOST_LIMIT) : 0,
    effectiveFullness: saved.effectiveFullness ?? saved.fullness ?? 0,
    nightPressure: saved.nightPressure ?? 0,
    caught: saved.caught ?? false,
  };
}

function restoreFood(food: FoodEntity, fresh: GameState): FoodEntity {
  const restored = { ...food };
  if (restored.type === 'bug' && restored.expiresAt === undefined) {
    const start = Math.max(restored.visibleAt ?? fresh.time, fresh.time);
    restored.expiresAt = clamp01(start + WORM_VISIBLE_MIN + Math.random() * WORM_VISIBLE_RANDOM);
  }
  if (restored.type === 'sunflower' && restored.hardness === 1) restored.hardness = 2;
  return restored;
}

function restoreLightPressureUsed(saved: unknown) {
  const fresh = freshLightPressureUsed();
  if (!Array.isArray(saved)) return fresh;
  return fresh.map((_, index) => {
    const value = Number(saved[index] ?? 0);
    return Number.isFinite(value) ? clamp(value, 0, LIGHT_PRESSURE_BUDGET) : 0;
  });
}

export function debugAddAffection(state: GameState, amount = 20) {
  state.affection = clamp(state.affection + amount, 0, 100);
  state.message = `调试：亲密 +${amount}，现在 ${Math.round(state.affection)}。`;
}

export function debugAddMaterials(state: GameState, amount = 30) {
  state.yard.wood += amount;
  state.message = `调试：木料 +${amount}，现在 ${state.yard.wood}。`;
}

export function debugJumpToDusk(state: GameState) {
  if (state.flow.phase !== 'chicken-day' && state.flow.phase !== 'chicken-dusk') {
    state.message = '调试：只有母鸡行动时才能跳到黄昏。';
    return false;
  }
  if (state.flow.phase === 'chicken-day') {
    applyFlowEvent(state, {
      type: 'tick',
      amount: Math.max(0, 0.65 - state.flow.clock),
    });
  }
  state.message = '调试：天色压下来，已经跳到黄昏。';
  return true;
}

export function debugSetEggType(state: GameState, type: EggType) {
  if (!isEggType(type)) return false;
  const info = eggCatalog[type];
  state.forcedEggType = type;
  if (state.mode === 'human' && state.egg && !state.egg.found) {
    state.egg.type = type;
    state.egg.name = info.name;
    state.egg.effect = info.effect;
    const gainedMaterials = state.daySummary?.gainedMaterials ?? 0;
    state.daySummary = createDaySummary(state, gainedMaterials);
  }
  state.message = `调试：下一颗蛋指定为 ${info.name}。`;
  return true;
}

function isEggType(value: unknown): value is EggType {
  return (
    value === 'fullBelly' ||
    value === 'greenLeaf' ||
    value === 'swift' ||
    value === 'lantern' ||
    value === 'brave' ||
    value === 'sunny' ||
    value === 'balanced' ||
    value === 'cracked'
  );
}

export function isGoodFoodSpot(point: Vec2) {
  return !isBlocked(point, 26) && !isOnPath(point);
}

export function isShadowy(point: Vec2) {
  return isInPlantPatch(point) || TREE_POSITIONS.some((tree) => distance(tree, point) < 98);
}

export function isNearLight(point: Vec2, lamp: number, yardLampActive = false) {
  const radius = lightRadiusFor(lamp);
  return (
    SAFE_LIGHTS.some((light) => distance(light, point) < radius) ||
    (yardLampActive && distance(YARD_LAMP_POSITION, point) < radius)
  );
}

function usableLightIndexFor(state: GameState, point: Vec2) {
  const radius = lightRadiusFor(state.stats.lamp);
  const lights = state.yard.owned.includes('yard-lamp')
    ? [...SAFE_LIGHTS, YARD_LAMP_POSITION]
    : SAFE_LIGHTS;
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < lights.length; index += 1) {
    if ((state.lightPressureUsed[index] ?? 0) >= LIGHT_PRESSURE_BUDGET) continue;
    const lightDistance = distance(lights[index], point);
    if (lightDistance < radius && lightDistance < bestDistance) {
      bestDistance = lightDistance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function lightRadiusFor(lamp: number) {
  return 120 + lamp * 28;
}

function lightPressureRateFor(lamp: number) {
  return 9 + lamp * 3;
}

export function visibleFoods(state: GameState) {
  return state.foods.filter((food) => state.time >= food.visibleAt);
}

export function refillForagingFoods(state: GameState, offscreenMudPoints: readonly Vec2[]) {
  if (state.mode !== 'chicken' || offscreenMudPoints.length === 0) return [];
  const remaining = visibleFoods(state).filter((food) => isForagingFood(food.type)).length;
  if (remaining > 2) return [];

  const wave = state.foraging.refillWave;
  const plan = createDailyFoodPlan(
    state.profile.runSeed ^ Math.imul(wave + 1, 0x45d9f3b),
    state.day,
    foodPoolFor(state.profile, state.flow.phase === 'chicken-dusk'),
    offscreenMudPoints,
    4,
  );
  state.foraging.refillWave += 1;
  return plan.map((food) => spawnFood(state, food.type, food, state.time));
}

function spawnDailyFood(state: GameState) {
  const plan = createDailyFoodPlan(
    state.profile.runSeed,
    state.day,
    foodPoolFor(state.profile, false),
    FOOD_SPAWN_POINTS,
    15,
  );
  for (const food of plan) spawnFood(state, food.type, food, 0);

  if (state.profile.awakenedAbilities.sprint) {
    const nightPlan = createDailyFoodPlan(
      state.profile.runSeed ^ 0x51f15e,
      state.day,
      ['nightBug'],
      FOOD_SPAWN_POINTS,
      2,
    );
    for (const food of nightPlan) spawnFood(state, food.type, food, DUSK_START);
  }
}

function maybeSpawnCat(state: GameState) {
  if (
    !state.catWillVisitToday ||
    state.catVisitedToday ||
    state.phase !== 'day' ||
    state.time < CAT_START ||
    state.time > CAT_END
  ) {
    return;
  }
  state.catVisitedToday = true;
  state.animals.push({
    id: state.nextId++,
    type: 'cat',
    x: HOUSE.x - 54,
    y: HOUSE.y + HOUSE.height + 36,
    active: true,
    scared: false,
    phase: 'sleeping',
    facing: 1,
  });
  if (!state.message) state.message = '房子旁边有只野猫趴着睡觉，母鸡可以咯咯叫把它吓开。';
}

function dropCatMeat(state: GameState, animal: YardAnimal) {
  const meat: FoodEntity = {
    id: state.nextId++,
    x: animal.x,
    y: animal.y,
    type: 'meat',
    visibleAt: state.time,
    progress: 0,
    hardness: 3,
  };
  state.foods.push(meat);
  return meat;
}

function maybeSpawnSparrow(state: GameState, dt: number) {
  if (state.phase !== 'day' && state.phase !== 'dusk') return;
  if (state.time < 0.18 || state.time > NIGHT_START) return;
  if (state.animals.some((animal) => animal.active && animal.type === 'sparrow')) return;

  state.animalCooldown -= dt;
  if (state.animalCooldown > 0) return;

  const target = pickSparrowTarget(state);
  state.animalCooldown = target ? 8.5 + Math.random() * 5.5 : 4.2;
  if (!target) return;

  const approachFromLeft = Math.random() > 0.5;
  state.animals.push({
    id: state.nextId++,
    type: 'sparrow',
    x: clamp(target.x + PhaserLikeRandom(-22, 22), 48, WORLD_WIDTH - 48),
    y: clamp(target.y + PhaserLikeRandom(-18, 18), 48, WORLD_HEIGHT - 48),
    active: true,
    scared: false,
    phase: 'stealing',
    targetFoodId: target.id,
    stealTimer: 6.4,
    facing: approachFromLeft ? 1 : -1,
  });
  if (!state.message) state.message = '麻雀落到米粒旁边了，趁它偷吃前叫一声能吓跑它。';
}

function pickSparrowTarget(state: GameState) {
  const targetedIds = new Set(
    state.animals
      .filter((animal) => animal.active && animal.type === 'sparrow' && animal.targetFoodId !== undefined)
      .map((animal) => animal.targetFoodId),
  );
  const grains = visibleFoods(state).filter((food) => food.type === 'grain' && !targetedIds.has(food.id));
  if (grains.length === 0) return null;
  return grains[Math.floor(Math.random() * grains.length)];
}

function scatterSunflowerSeed(state: GameState) {
  const seed: FoodEntity = {
    id: state.nextId++,
    x: clamp(state.keeper.x, 58, WORLD_WIDTH - 58),
    y: clamp(state.keeper.y, 58, WORLD_HEIGHT - 58),
    type: 'sunflower',
    visibleAt: state.time,
    progress: 0,
    hardness: 2,
    freshUntil: clamp01(state.time + 0.11),
    fromKeeper: true,
  };
  state.foods.push(seed);
  state.message = '养鸡人撒下一粒瓜子，鸡凑过去就能啄到。';
  return seed;
}

function spawnFood(state: GameState, type: FoodType, point: Vec2, visibleAt: number) {
  const food: FoodEntity = {
    id: state.nextId++,
    ...point,
    type,
    visibleAt,
  };
  if (type === 'bug' || type === 'worm') {
    food.expiresAt = clamp01(visibleAt + WORM_VISIBLE_MIN + Math.random() * WORM_VISIBLE_RANDOM);
  }
  state.foods.push(food);
  return food;
}

function restockFoodTypes(state: GameState): FoodType[] {
  const types: FoodType[] = ['grain'];
  if (state.unlockedFoods.grass) types.push('grass');
  if (state.unlockedFoods.bug && state.phase !== 'night') types.push('bug');
  if (state.unlockedFoods.nightBug && state.phase !== 'day') types.push('nightBug');
  return types;
}

function randomFoodPoint(preferShadow = false): Vec2 {
  for (let i = 0; i < 120; i += 1) {
    const candidate = preferShadow && Math.random() < 0.75 ? randomPlantPoint() : randomYardPoint();
    if (isGoodFoodSpot(candidate) && (!preferShadow || isShadowy(candidate))) return candidate;
  }
  return randomYardPoint();
}

function randomFoodPointOutOfView(state: GameState, preferShadow = false): Vec2 {
  for (let i = 0; i < 160; i += 1) {
    const candidate = randomFoodPoint(preferShadow);
    if (distance(candidate, state.chicken) >= RESTOCK_DISTANCE_FROM_CHICKEN) return candidate;
  }
  return randomFoodPoint(preferShadow);
}

function randomPondBankPoint(): Vec2 {
  for (let i = 0; i < 80; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radiusX = POND.width * 0.62 + Math.random() * 42;
    const radiusY = POND.height * 0.62 + Math.random() * 34;
    const candidate = {
      x: POND.x + POND.width * 0.5 + Math.cos(angle) * radiusX,
      y: POND.y + POND.height * 0.5 + Math.sin(angle) * radiusY,
    };
    if (isGoodFoodSpot(candidate) && isNearPond(candidate)) return candidate;
  }
  return {
    x: POND.x + POND.width + 36,
    y: POND.y + POND.height * 0.5,
  };
}

function randomYardPoint(): Vec2 {
  return {
    x: 70 + Math.random() * (WORLD_WIDTH - 140),
    y: 70 + Math.random() * (WORLD_HEIGHT - 140),
  };
}

function pickMorningChickenTarget(state: GameState): Vec2 | null {
  for (let i = 0; i < 32; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 70 + Math.random() * 180;
    const point = {
      x: clamp(state.chicken.x + Math.cos(angle) * radius, 58, WORLD_WIDTH - 58),
      y: clamp(state.chicken.y + Math.sin(angle) * radius, 58, WORLD_HEIGHT - 58),
    };
    if (isBlocked(point, 18)) continue;
    if (distance(point, state.human) < 110) continue;
    return point;
  }

  for (let i = 0; i < 24; i += 1) {
    const point = randomYardPoint();
    if (!isBlocked(point, 18) && distance(point, state.human) >= 110) return point;
  }

  return null;
}

function randomPlantPoint(): Vec2 {
  const patch = PLANT_PATCHES[Math.floor(Math.random() * PLANT_PATCHES.length)];
  return {
    x: patch.x + Math.random() * patch.width,
    y: patch.y + Math.random() * patch.height,
  };
}

function createEgg(state: GameState): EggEntity {
  const type = state.forcedEggType ?? pickEggType(state);
  state.forcedEggType = null;
  const eggInfo = eggCatalog[type];
  const eggDay = state.day + 1;
  const spot = selectEggSpot(
    eggDay,
    state.previousEggSpotId,
    createSeededRandom(state.profile.runSeed + eggDay * 7919),
  );
  state.eggSearch = createEggSearchState(spot.id);
  return {
    ...spot.position,
    type,
    found: false,
    name: eggInfo.name,
    effect: eggInfo.effect,
  };
}

function pickEggType(state: GameState): EggType {
  const eaten = state.foraging.foodsEatenToday;
  if (state.caughtToday) return 'cracked';
  if (eaten.includes('nightBug')) return 'lantern';
  if (state.nightPressure >= 58) return 'brave';
  if (eaten.includes('berry') || eaten.filter((food) => food === 'sunflower').length >= 2) return 'sunny';
  if (eaten.includes('cricket') || eaten.includes('beetle')) return 'swift';
  if (eaten.includes('worm') || eaten.filter((food) => food === 'grass').length >= 2) return 'greenLeaf';
  if (eaten.filter((food) => food === 'grain').length >= 4) return 'fullBelly';
  if (eaten.length >= 2) return 'balanced';
  return 'cracked';
}

function createDaySummary(state: GameState, gainedMaterials: number): DaySummary {
  const egg = state.egg;
  const eggType = egg?.type ?? 'cracked';
  const eggInfo = eggCatalog[eggType];
  const metrics = eggMetrics(state);
  return {
    day: state.day,
    eaten: { ...state.eaten },
    gainedMaterials,
    materialsTotal: state.yard.wood,
    eggType,
    eggName: egg?.name ?? eggInfo.name,
    eggReason: eggReasonFor(state, eggType, metrics),
    nearMiss: nearMissEggHint(state, eggType, metrics),
    fullness: Math.round(state.stats.fullness),
    stuffedness: Math.round(overstuffAmountFor(state)),
    drankToday: state.drankToday,
    waterBoost: Math.round(state.waterBoost),
    effectiveFullness: Math.round(metrics.fullness),
    nightPressure: Math.round(state.nightPressure),
    caught: state.caughtToday,
  };
}

function eggMetrics(state: GameState) {
  const eatenTotal =
    state.eaten.grain +
    state.eaten.grass +
    state.eaten.bug +
    state.eaten.sunflower +
    state.eaten.nightBug +
    state.eaten.meat * 2;
  const meatBonus = Math.min(state.eaten.meat, 2) * 12;
  return {
    eatenTotal,
    meatBonus,
    fullness: clamp(state.nutrition + meatBonus, 0, 100),
  };
}

function eggReasonFor(state: GameState, type: EggType, metrics: ReturnType<typeof eggMetrics>) {
  if (state.forcedEggType === type) return '调试工具指定了这颗蛋。';
  if (type === 'cracked') {
    if (state.caughtToday) return '今天被黄鼠狼吓回笼边，鸡太惊险了，只能下裂纹蛋。';
    if (metrics.eatenTotal < 3) return `今天总进食数只有 ${metrics.eatenTotal}，少于 3。`;
    if (metrics.fullness < 35) return `有效营养只有 ${Math.round(metrics.fullness)}，少于 35。`;
    return '没有满足更好蛋的条件，所以落到裂纹蛋。';
  }
  if (type === 'greenLeaf') {
    return state.unlockedFoods.grass
      ? `嫩草吃到 ${state.eaten.grass} 口，有效营养 ${Math.round(metrics.fullness)}，触发青叶蛋，胆量提升。`
      : `米粒吃到 ${state.eaten.grain} 口，有效营养 ${Math.round(metrics.fullness)}，触发青叶蛋；嫩草仍需要清晨训练解锁。`;
  }
  if (type === 'swift') {
    return state.unlockedFoods.bug
      ? `蚯蚓吃到 ${state.eaten.bug} 口，有效营养 ${Math.round(metrics.fullness)}，触发疾走蛋，速度提升。`
      : `嫩草吃到 ${state.eaten.grass} 口，有效营养 ${Math.round(metrics.fullness)}，触发疾走蛋；蚯蚓仍需要清晨训练解锁。`;
  }
  if (type === 'lantern') {
    return state.unlockedFoods.nightBug
      ? `夜虫吃到 ${state.eaten.nightBug} 只，有效营养 ${Math.round(metrics.fullness)}，触发守夜蛋，灯更暖。`
      : `蚯蚓吃到 ${state.eaten.bug} 口，有效营养 ${Math.round(metrics.fullness)}，触发守夜蛋；夜虫仍需要清晨训练解锁。`;
  }
  if (type === 'brave') return `夜压达到 ${Math.round(state.nightPressure)}，鸡安全撑过来，触发铁胆蛋。`;
  if (type === 'sunny') return `瓜子吃到 ${state.eaten.sunflower} 粒，有效营养 ${Math.round(metrics.fullness)}，触发暖瓜子蛋。`;
  if (type === 'fullBelly') return `米粒吃到 ${state.eaten.grain} 口，有效营养 ${Math.round(metrics.fullness)}，触发饱饱蛋。`;
  return `有效营养达到 ${Math.round(metrics.fullness)}，吃得比较稳，触发均衡蛋。`;
}

function nearMissEggHint(state: GameState, currentType: EggType, metrics: ReturnType<typeof eggMetrics>) {
  if (state.caughtToday) return '先安全回笼，避免被黄鼠狼抓到，才有机会下更好的蛋。';

  const candidates = eggCandidatesFor(state, metrics).filter((candidate) => candidate.type !== currentType);
  let best: { name: string; missing: string[]; score: number } | null = null;

  for (const candidate of candidates) {
    const missing = candidate.requirements
      .filter((requirement) => requirement.current < requirement.required)
      .map((requirement) => `${requirement.label}还差 ${formatRequirementGap(requirement.required - requirement.current)}`);
    if (missing.length === 0) continue;
    const score = candidate.requirements.reduce((total, requirement) => {
      if (requirement.current >= requirement.required) return total;
      return total + (requirement.required - requirement.current) / requirement.required;
    }, 0);
    if (!best || score < best.score) best = { name: candidate.name, missing, score };
  }

  if (!best) return '今天已经很接近当前能追到的好蛋了，继续稳定吃饱就行。';
  return `差一点是${best.name}：${best.missing.slice(0, 2).join('，')}。`;
}

function eggCandidatesFor(state: GameState, metrics: ReturnType<typeof eggMetrics>) {
  return [
    !state.unlockedFoods.grass
      ? eggCandidate('greenLeaf', '青叶蛋', [
          requirement('有效营养', metrics.fullness, 58),
          requirement('米粒', state.eaten.grain, 4),
        ])
      : eggCandidate('greenLeaf', '青叶蛋', [
          requirement('有效营养', metrics.fullness, 58),
          requirement('嫩草', state.eaten.grass, 4),
        ]),
    !state.unlockedFoods.bug
      ? eggCandidate('swift', '疾走蛋', [
          requirement('有效营养', metrics.fullness, 64),
          requirement('嫩草', state.eaten.grass, 4),
        ])
      : eggCandidate('swift', '疾走蛋', [
          requirement('有效营养', metrics.fullness, 64),
          requirement('蚯蚓', state.eaten.bug, 3),
        ]),
    !state.unlockedFoods.nightBug
      ? eggCandidate('lantern', '守夜蛋', [
          requirement('有效营养', metrics.fullness, 72),
          requirement('蚯蚓', state.eaten.bug, 3),
        ])
      : eggCandidate('lantern', '守夜蛋', [
          requirement('有效营养', metrics.fullness, 88),
          requirement('夜虫', state.eaten.nightBug, 2),
        ]),
    eggCandidate('brave', '铁胆蛋', [
      requirement('有效营养', metrics.fullness, 55),
      requirement('夜压', state.nightPressure, 58),
      requirement('蚯蚓或夜虫基础', state.unlockedFoods.nightBug ? 1 : state.eaten.bug, state.unlockedFoods.nightBug ? 1 : 2),
    ]),
    eggCandidate('sunny', '暖瓜子蛋', [
      requirement('有效营养', metrics.fullness, 70),
      requirement('瓜子', state.eaten.sunflower, 2),
    ]),
    eggCandidate('fullBelly', '饱饱蛋', [
      requirement('有效营养', metrics.fullness, 72),
      requirement('米粒', state.eaten.grain, 4),
    ]),
    eggCandidate('balanced', '均衡蛋', [requirement('有效营养', metrics.fullness, 50)]),
  ];
}

function eggCandidate(type: EggType, name: string, requirements: Array<{ label: string; current: number; required: number }>) {
  return { type, name, requirements };
}

function requirement(label: string, current: number, required: number) {
  return { label, current, required };
}

function formatRequirementGap(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function applyEggEffect(state: GameState, type: EggType) {
  const info = eggCatalog[type];
  if (type === 'fullBelly') state.stats.maxStamina += 10;
  if (type === 'greenLeaf') {
    state.stats.courage += 2;
  }
  if (type === 'swift') {
    state.stats.speed += 12;
  }
  if (type === 'lantern') {
    state.stats.lamp += 1;
  }
  if (type === 'brave') {
    state.stats.courage += 3;
  }
  if (type === 'sunny') {
    state.stats.peck += 1;
    state.stats.maxStamina += 6;
  }
  if (type === 'balanced') {
    state.stats.peck += 1;
    state.stats.dig += 1;
  }
  if (type === 'cracked') state.stats.courage = Math.max(1, state.stats.courage - 1);

  if (!state.upgrades.includes(info.upgrade)) {
    state.upgrades.push(info.upgrade);
  }
}

function rememberEgg(state: GameState, type: EggType) {
  const info = eggCatalog[type];
  const existing = state.eggArchive.find((entry) => entry.type === type);
  if (existing) {
    existing.count += 1;
    return;
  }

  state.eggArchive.push({
    type,
    name: info.name,
    effect: info.effect,
    upgrade: info.upgrade,
    count: 1,
  });
}

function repairCostFor(state: GameState) {
  if (state.nightPressure <= 0) return 0;
  return Math.max(1, Math.ceil(state.nightPressure / 4));
}

function trainingCostFor(state: GameState) {
  return 10 + state.abilityTrainingLevel * 5;
}

function foodTrainingGoal(state: GameState) {
  if (!state.unlockedFoods.grass) {
    return { food: '米粒', unlock: '嫩草', current: state.eaten.grain, required: 4 };
  }
  if (!state.unlockedFoods.bug) {
    return { food: '嫩草', unlock: '蚯蚓', current: state.eaten.grass, required: 4 };
  }
  if (!state.unlockedFoods.nightBug) {
    return { food: '蚯蚓', unlock: '夜虫', current: state.eaten.bug, required: 3 };
  }
  return null;
}

function foodTrainingBlocker(state: GameState) {
  const goal = foodTrainingGoal(state);
  if (!goal || goal.current >= goal.required) return null;
  return `想训练解锁${goal.unlock}，今天${goal.food}要吃够 ${goal.required} 次，现在 ${goal.current}/${goal.required}。蛋不会解锁新食物。`;
}

function applyCoopTraining(state: GameState) {
  if (!state.unlockedFoods.grass) {
    unlockFood(state, 'grass', '会吃嫩草');
    return '你把嫩草铺在窝边，鸡开始认得草籽和嫩叶';
  }

  if (!state.unlockedFoods.bug) {
    unlockFood(state, 'bug', '会找蚯蚓');
    return '你翻松窝边的土，鸡学会盯住蚯蚓';
  }

  if (!state.unlockedFoods.nightBug) {
    unlockFood(state, 'nightBug', '敢啄夜虫');
    state.stats.courage += 1;
    return '你给窝边添了小灯，鸡敢在夜里啄发光的夜虫';
  }

  const cycle = state.abilityTrainingLevel % 4;
  if (cycle === 0) {
    state.stats.maxStamina += 8;
    addUpgrade(state, '耐走鸡');
    return '鸡窝更暖了，鸡的冲刺余量提高';
  }
  if (cycle === 1) {
    state.stats.speed += 8;
    addUpgrade(state, '稳脚鸡');
    return '你把过道垫平，鸡跑起来更稳';
  }
  if (cycle === 2) {
    state.stats.dig += 1;
    addUpgrade(state, '会刨窝');
    return '你在窝边留了软土，鸡更会刨坑';
  }

  state.stats.courage += 1;
  state.coopSafety = clamp(state.coopSafety + 1, 0, 5);
  addUpgrade(state, '安心窝');
  return '鸡窝更结实了，鸡夜里更安心';
}

function unlockFood(state: GameState, type: FoodType, upgradeName: string) {
  if (state.unlockedFoods[type]) return;
  state.unlockedFoods[type] = true;
  addUpgrade(state, upgradeName);
}

function addUpgrade(state: GameState, upgrade: string) {
  if (!state.upgrades.includes(upgrade)) {
    state.upgrades.push(upgrade);
  }
}

const eggCatalog: Record<EggType, { name: string; effect: string; upgrade: string }> = {
  fullBelly: {
    name: '饱饱蛋',
    effect: '鸡的冲刺上限提升，逃跑和刨坑更有余量。',
    upgrade: '冲刺壳',
  },
  greenLeaf: {
    name: '青叶蛋',
    effect: '胆量提升；嫩草需要清晨训练解锁。',
    upgrade: '青叶胆',
  },
  swift: {
    name: '疾走蛋',
    effect: '移动速度提升；蚯蚓需要清晨训练解锁。',
    upgrade: '快脚爪',
  },
  lantern: {
    name: '守夜蛋',
    effect: '房子和鸡笼的灯更暖；夜虫需要清晨训练解锁。',
    upgrade: '暖灯',
  },
  brave: {
    name: '铁胆蛋',
    effect: '经历黑夜后胆量提升，高夜压时更不容易乱。',
    upgrade: '铁胆',
  },
  sunny: {
    name: '暖瓜子蛋',
    effect: '鸡更会啄硬壳食物，冲刺上限也小幅提升。',
    upgrade: '会追人',
  },
  balanced: {
    name: '均衡蛋',
    effect: '啄食和挖坑能力一起提升。',
    upgrade: '会过日子',
  },
  cracked: {
    name: '裂纹蛋',
    effect: '今天太惊险，鸡需要缓一缓。',
    upgrade: '惊魂未定',
  },
};

function storyPhaseLabel(phase: StoryPhase) {
  if (phase === 'morning-human') return '清晨找蛋';
  if (phase === 'chicken-day') return '白天';
  if (phase === 'chicken-dusk') return '黄昏';
  if (phase === 'dusk-human') return '黄昏收鸡';
  if (phase === 'night-result') return '夜里';
  return '归巢之夜';
}

function timeLabel(time: number, phase: Phase) {
  if (phase === 'human') return '清晨';
  if (time < 0.35) return '上午';
  if (time < DUSK_START) return '午后';
  if (time < NIGHT_START) return '黄昏';
  return '深夜';
}

function freshEaten(): Record<FoodType, number> {
  return {
    grain: 0,
    grass: 0,
    bug: 0,
    sunflower: 0,
    nightBug: 0,
    meat: 0,
    worm: 0,
    cricket: 0,
    beetle: 0,
    berry: 0,
  };
}

function freshLightPressureUsed() {
  return SAFE_LIGHTS.map(() => 0);
}

function foodMessage(type: FoodType) {
  if (type === 'grain') return '嗒，米粒被啄进嘴里，冲刺劲回了一点。';
  if (type === 'grass') return '嫩草带着露水，鸡舒服地抖了抖羽毛。';
  if (type === 'bug' || type === 'worm') return '蚯蚓弹了一下，还是被鸡叼住了。';
  if (type === 'cricket') return '追上的蟋蟀脆生生的。';
  if (type === 'beetle') return '甲虫壳咔地一响，鸡精神起来。';
  if (type === 'berry') return '树莓甜甜的，鸡歪头回味了一会儿。';
  if (type === 'sunflower') return '瓜子又香，鸡凑在人手边舍不得走。';
  if (type === 'meat') return '鸡啄了啄这块奇怪的旧食物。';
  return '夜虫发着微光，吃完之后脚步都轻快了。';
}

function foodUnlockHint(type: FoodType) {
  if (type === 'grass') return '鸡还不会分辨嫩草，先把米粒吃够，清晨在窝边训练后再来。';
  if (type === 'bug') return '鸡还不敢啄蚯蚓，先把嫩草吃够，清晨训练翻土后再来。';
  if (type === 'nightBug') return '夜虫太怪了，先把蚯蚓吃够，清晨训练出灯和胆量之后再吃。';
  if (type === 'sunflower') return '瓜子要跟着养鸡人的手边啄，而且要啄两下。';
  if (type === 'meat') return '肉要啄松了才能吃。';
  return '这口还没学会怎么吃。';
}

function fullnessFor(type: FoodType) {
  if (type === 'grain') return 6;
  if (type === 'grass') return 4;
  if (type === 'bug') return 7;
  if (type === 'sunflower') return 6;
  if (type === 'meat') return 20;
  return 18;
}

function fullnessGainFor(state: GameState, food: FoodEntity) {
  const base = fullnessFor(food.type);
  if (food.type === 'nightBug' || food.type === 'meat' || state.phase !== 'day') return base;

  const roomBeforeStuffed = Math.max(0, COMFORT_FULLNESS - state.stats.fullness);
  const normalGain = Math.min(base, roomBeforeStuffed);
  const stuffedGain = base - normalGain;
  if (stuffedGain <= 0) return normalGain;
  const moistenedRatio = 0.45 + waterBoostRatioFor(state) * 0.25;
  return normalGain + Math.max(1, Math.ceil(stuffedGain * moistenedRatio));
}

function keeperLabel(state: GameState) {
  if (state.mode !== 'chicken') return '找蛋时间';
  if (state.keeper.doneFeeding) return '人已经回屋';
  if (state.keeper.returning) return '人在回房子';
  if (state.phase === 'night') return '人已经回屋';
  if (state.phase === 'dusk') return '人在收拾院子';
  return '养鸡人在撒食';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function PhaserLikeRandom(min: number, max: number) {
  return min + Math.random() * (max - min);
}
