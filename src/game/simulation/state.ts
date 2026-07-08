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
  isInCoop,
  isInPlantPatch,
  isNearPond,
  isOnPath,
} from '../content/yard';
import { EGG_SPOTS, selectEggSpot } from '../content/eggSpots';
import {
  PREMIUM_FEED_POSITION,
  WATER_BASIN_POSITION,
  YARD_LAMP_POSITION,
} from '../content/yardUpgrades';
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
  foodPoolForFamiliarity,
  isForagingFood,
  type DailyFoodSpawn,
  type ForagingFoodType,
  type ForagingState,
} from '../systems/foraging';
import {
  activeActor,
  createDayFlow,
  DAY_ACTIVE_SECONDS,
  DUSK_AT,
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
  createWeatherCalendar,
  isWeather,
  weatherForDay,
  type Weather,
} from '../systems/weather';
import {
  createFacilityLifeState,
  createYardUpgradeState,
  deliverPendingWood,
  ownedFacilityAt,
  resetFacilityLifeDay,
  type FacilityLifeState,
  type YardUpgradeState,
} from '../systems/yardUpgrades';
import {
  createYardFamiliarityState,
  regionFamiliarityFor,
  restoreYardFamiliarityState,
  type YardFamiliarityState,
} from '../systems/yardFamiliarity';
import {
  type WeaselEncounterState,
  type WeaselOutcome,
} from '../systems/weaselEncounter';
import { createWeaselSchedule } from '../systems/weaselSchedule';
import {
  captureFinaleCheckpoint,
  restoreFinaleCheckpoint,
  shouldStartFinale,
} from '../systems/finale';
import {
  advanceHeat,
  BODY_COMFORT_TUNING,
  sprintScaleForHeat,
  type HeatContext,
} from '../systems/bodyComfort';
import {
  eggQualityLabel,
  evaluateEggQuality,
  type EggQuality,
} from '../systems/eggEconomy';

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
  buried?: boolean;
}

export type HoleTerritoryKind = 'fresh' | 'cool-pit' | 'dust-bath' | 'safe-rest';

export interface HoleEntity extends Vec2 {
  id: number;
  dugDay: number;
  lastUsedDay: number;
  restPower: number;
  depth: number;
  moisture: number;
  useSeconds: number;
  kind: HoleTerritoryKind;
}

export interface EggEntity extends Vec2 {
  type: EggType;
  name: string;
  effect: string;
  found: boolean;
  quality: EggQuality;
  budget: number;
}

export interface EggArchiveEntry {
  type: EggType;
  name: string;
  effect: string;
  upgrade: string;
  quality?: EggQuality;
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
  nutrition: number;
  rawNutrition: number;
  nutritionCap: number;
  drankToday: boolean;
  waterBoost: number;
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
  heat: number;
  nutrition: number;
  waterBoost: number;
  affection: number;
  coopSafety: number;
  yard: YardUpgradeState;
  facilityLife: FacilityLifeState;
  yardFamiliarity: YardFamiliarityState;
  weatherCalendar: Weather[];
  weather: Weather;
  offPathRainSeconds: number;
  muddyToday: boolean;
  abilityTrainingLevel: number;
  caughtToday: boolean;
  huggedToday: boolean;
  repairedToday: boolean;
  keeperRescueUsedToday: boolean;
  drankToday: boolean;
  premiumFeedServedToday: boolean;
  waterBasinLevel: number;
  dryRestTonight: boolean;
  chickenWetFromRain: boolean;
  porchLightReliefUsed: boolean;
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
  weaselSchedule: number[];
  weaselApproach: number;
  weaselEncounter: WeaselEncounterState | null;
  weaselEncounterDoneToday: boolean;
  handLanternActive: boolean;
  endingSeen: boolean;
  freePlay: boolean;
  finaleCheckpointJson: string | null;
  stormActive: boolean;
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
  nutrition: number;
  nutritionPct: number;
  effectiveNutrition: number;
  effectiveNutritionPct: number;
  nutritionCap: number;
  nutritionCapPct: number;
  waterBoost: number;
  waterBoostPct: number;
  drankToday: boolean;
  holesDugToday: number;
  digLimit: number;
  pressure: number;
  pressurePct: number;
  heat: number;
  heatPct: number;
  showHeat: boolean;
  showPressure: boolean;
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
  yardFamiliarity: YardFamiliarityState;
  currentEggQuality: EggQuality | null;
  currentEggBudget: number;
  projectedEggQuality: EggQuality;
  eggQualityScore: number;
  eggWildKinds: number;
  eggDryRest: boolean;
  daySummary: DaySummary | null;
  goalTip: string;
  forcedEggType: EggType | null;
  keeperLabel: string;
  endingMemories: string[];
  toast: string;
  reward: { title: string; name: string; effect: string } | null;
}

const DAY_SECONDS = DAY_ACTIVE_SECONDS;
const DUSK_START = 0.58;
const NIGHT_START = 0.82;
const KEEPER_FEED_END = DUSK_START;
const NUTRITION_LIMIT = 100;
const FOOD_NUTRITION_GAIN_SCALE = 0.7;
const PREMIUM_FEED_NUTRITION_GAIN = 4;
const SUNFLOWER_NUTRITION_GAIN = 3;
const HOLE_HEAT_COOLING_SCALE = 1.4;
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
const KEEPER_VISIT_DELAY_MIN = 18;
const KEEPER_VISIT_DELAY_RANDOM = 36;
const KEEPER_SUNFLOWER_LIMIT = 5;
export const CORE_LOOP_TUNING = {
  predatorContactPressure: 34,
  porchLightReliefMin: 5,
  porchLightReliefMax: 6,
  waterBasinCapacity: 100,
  waterBasinUsePerSecond: 9,
  premiumFeedPieces: 3,
} as const;
const LIGHT_PRESSURE_BUDGET = 4;
const WORM_VISIBLE_MIN = 0.1;
const WORM_VISIBLE_RANDOM = 0.06;
const RESTOCK_DISTANCE_FROM_CHICKEN = 420;
const RESTOCK_FOOD_COUNT = 3;
const RAIN_MUD_SECONDS = 4;
const HOLE_REUSE_RADIUS = 62;
const HOLE_MAX_DEPTH = 6;
const HOLE_KEEP_DAYS = 2;
const TERRITORY_KEEP_DAYS = 8;
const MAX_REMEMBERED_HOLES = 5;

function createTutorialEgg(): EggEntity {
  return {
    ...EGG_SPOTS[0].position,
    type: 'balanced',
    name: eggQualityLabel('poor'),
    effect: '找到蛋后，才放心把鸡放进院子。',
    found: false,
    quality: 'poor',
    budget: 2,
  };
}

export function createGameState(): GameState {
  const profile = createChickenProfile();
  const weatherCalendar = createWeatherCalendar(profile.runSeed);
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
    heat: 0,
    nutrition: 0,
    waterBoost: 0,
    affection: 12,
    coopSafety: 0,
    yard: createYardUpgradeState(),
    facilityLife: createFacilityLifeState(),
    yardFamiliarity: createYardFamiliarityState(),
    weatherCalendar,
    weather: weatherCalendar[0],
    offPathRainSeconds: 0,
    muddyToday: false,
    abilityTrainingLevel: 0,
    caughtToday: false,
    huggedToday: false,
    repairedToday: false,
    keeperRescueUsedToday: false,
    drankToday: false,
    premiumFeedServedToday: false,
    waterBasinLevel: 0,
    dryRestTonight: true,
    chickenWetFromRain: false,
    porchLightReliefUsed: false,
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
      active: false,
      returning: false,
      doneFeeding: true,
      rescuing: false,
      routeIndex: 1,
      scatterCooldown: 1.6,
      facing: 1,
    },
    stats: {
      maxStamina: 100,
      stamina: 100,
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
    eggSearch: createEggSearchState(EGG_SPOTS[0].id),
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
    weaselSchedule: createWeaselSchedule(profile.runSeed),
    weaselApproach: 0,
    weaselEncounter: null,
    weaselEncounterDoneToday: false,
    handLanternActive: false,
    endingSeen: false,
    freePlay: false,
    finaleCheckpointJson: null,
    stormActive: false,
    upgrades: [],
    daySummary: null,
    forcedEggType: null,
    message: '清晨到了。鸡已经在院子里，先跟着它的叫声找蛋。',
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
  if (
    previousPhase !== 'chicken-dusk' &&
    state.flow.phase === 'chicken-dusk' &&
    shouldStartFinale(state.day, state.endingSeen) &&
    !state.finaleCheckpointJson
  ) {
    state.stormActive = true;
    state.finaleCheckpointJson = captureFinaleCheckpoint(state);
  }
  if (
    !state.freePlay &&
    previousPhase !== 'chicken-day' &&
    state.flow.phase === 'chicken-day'
  ) {
    scheduleKeeperFeeding(state);
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

function scheduleKeeperFeeding(state: GameState) {
  if (state.keeper.rescuing) return;
  state.keeper = {
    ...KEEPER_START,
    active: false,
    returning: false,
    doneFeeding: false,
    rescuing: false,
    routeIndex: 1,
    scatterCooldown: KEEPER_VISIT_DELAY_MIN + Math.random() * KEEPER_VISIT_DELAY_RANDOM,
    facing: 1,
  };
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

export function revealBuriedNightBug(state: GameState, food: FoodEntity) {
  if (food.type !== 'nightBug' || !food.buried) return false;
  food.buried = false;
  state.message = '泥土裂开，月光虫钻了出来；刨土声也让远处草丛动了一下。';
  return true;
}

function syncLegacyPhaseFromFlow(state: GameState) {
  const actor = activeActor(state.flow.phase);
  state.mode = actor === 'none' ? state.mode : actor;
  state.phase =
    state.flow.phase === 'morning-human' ||
    state.flow.phase === 'epilogue-human'
      ? 'human'
      : state.flow.phase === 'chicken-dusk' || state.flow.phase === 'dusk-human'
        ? 'dusk'
        : state.flow.phase === 'chicken-night'
          ? 'night'
        : state.flow.phase === 'night-result'
          ? 'night'
          : 'day';
  state.day = state.flow.day;
  state.time = state.flow.clock;
}

export function advanceChickenTime(state: GameState, dt: number) {
  if (state.mode !== 'chicken') return;
  state.time = clamp01(state.time + dt / DAY_SECONDS);

  if (state.time >= NIGHT_START) {
    state.phase = 'night';
  } else if (state.time >= DUSK_START) {
    state.phase = 'dusk';
  } else {
    state.phase = 'day';
  }

}

export function updateNightPressure(state: GameState, context: PressureContext) {
  if (state.flow.phase !== 'chicken-dusk' && state.flow.phase !== 'chicken-night') return 0;
  let nextPressure = state.nightPressure;

  let porchRelief = 0;
  const nearOwnedPorchLight =
    state.yard.owned.includes('yard-lamp') &&
    distance(context.position, YARD_LAMP_POSITION) < lightRadiusFor(state.stats.lamp);
  if (
    state.flow.phase === 'chicken-night' &&
    nearOwnedPorchLight &&
    !state.porchLightReliefUsed &&
    state.nightPressure > 0
  ) {
    const reliefSpan =
      CORE_LOOP_TUNING.porchLightReliefMax - CORE_LOOP_TUNING.porchLightReliefMin + 1;
    porchRelief =
      CORE_LOOP_TUNING.porchLightReliefMin +
      (Math.abs(state.profile.runSeed + state.day) % reliefSpan);
    nextPressure = clamp(nextPressure - porchRelief, 0, 100);
    state.porchLightReliefUsed = true;
    state.message = `门外的暖光让${state.profile.name}松了口气，夜压降低 ${porchRelief}。`;
  }

  state.nightPressure = nextPressure;
  return porchRelief;
}

export function addNightPressure(state: GameState, amount: number) {
  const before = state.nightPressure;
  state.nightPressure = clamp(state.nightPressure + Math.max(0, amount), 0, 100);
  return state.nightPressure - before;
}

export function nutritionPressureFor(state: GameState, bonus = 0) {
  const pressure = clamp(state.nightPressure, 0, NUTRITION_LIMIT);
  const rawNutrition = clamp(state.nutrition + bonus, 0, NUTRITION_LIMIT);
  const nutritionCap = clamp(NUTRITION_LIMIT - pressure, 0, NUTRITION_LIMIT);
  return {
    rawNutrition,
    nutritionCap,
    effectiveNutrition: Math.min(rawNutrition, nutritionCap),
  };
}

export function eatFood(state: GameState, food: FoodEntity) {
  state.eaten[food.type] = (state.eaten[food.type] ?? 0) + 1;
  const nutritionGain = nutritionFor(food);
  state.nutrition = clamp(state.nutrition + nutritionGain, 0, NUTRITION_LIMIT);
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
      effect: foodDiscoveryEffect(food.type, discovery.restored),
    };
    state.message = `${state.profile.name}第一次尝到了${foodDisplayName(food.type)}。`;
  } else {
    state.message = foodMessage(food);
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

  const existingHole = nearestHole(state.holes, position, HOLE_REUSE_RADIUS);
  const hole: HoleEntity = existingHole ?? {
    id: state.nextId++,
    x: position.x,
    y: position.y,
    dugDay: state.day,
    lastUsedDay: state.day,
    restPower: 8 + state.stats.dig * 4,
    depth: 0,
    moisture: baseHoleMoisture(state, position),
    useSeconds: 0,
    kind: 'fresh',
  };

  hole.depth = clamp(hole.depth + 1, 1, HOLE_MAX_DEPTH);
  hole.restPower = Math.max(hole.restPower, 8 + state.stats.dig * 4) + (existingHole ? 2 : 0);
  hole.lastUsedDay = state.day;
  hole.moisture = clamp((hole.moisture + baseHoleMoisture(state, hole)) / 2, 0, 1);
  hole.kind = classifyHole(state, hole);

  if (!existingHole) state.holes.push(hole);
  state.holesDugToday += 1;
  spendStamina(state, DIG_SPRINT_COST);
  state.message = existingHole
    ? `${state.profile.name}又把熟悉的坑刨深了一点，现在更像${holeKindLabel(hole.kind)}。`
    : `土被刨开了，坑里能消食，也能让鸡压压惊。今天还能再刨 ${Math.max(0, digLimit - state.holesDugToday)} 个。`;
  return hole;
}

export function restInHole(state: GameState, hole: HoleEntity, dt: number) {
  const seconds = Math.max(0, dt);
  hole.useSeconds += seconds;
  hole.lastUsedDay = state.day;
  hole.kind = classifyHole(state, hole);

  const coolingKind = physicalHoleKind(state, hole);
  const cooling =
    coolingKind === 'cool-pit' || hole.depth >= 3
      ? 12 + hole.depth * 2.6 + hole.moisture * 4
      : coolingKind === 'dust-bath'
        ? 8.6 + hole.depth * 1.1
        : 10.8 + hole.depth * 1.4 + hole.moisture * 3.2;
  state.heat = clamp(state.heat - cooling * HOLE_HEAT_COOLING_SCALE * seconds, 0, 100);
  state.foraging.sprintEnergy = clamp(
    state.foraging.sprintEnergy + (3.5 + hole.depth * 1.1) * seconds,
    0,
    state.foraging.maxSprintEnergy,
  );

  if (!state.message && state.phase === 'day') {
    state.message =
      hole.kind === 'cool-pit'
        ? '坑底凉凉的，鸡把翅膀松开，安静趴了一会儿。'
        : `鸡缩进${holeKindLabel(hole.kind)}里，身体慢慢松下来。`;
  }
  if (state.phase !== 'day') {
    state.nightPressure = clamp(state.nightPressure - (5 + hole.restPower * 0.22) * seconds, 0, 100);
    if (state.weasel.active && distance(state.weasel, hole) > 54) {
      state.weasel.stunned = Math.max(state.weasel.stunned, 0.18 + state.stats.dig * 0.015);
    }
  }
}

function nearestHole(holes: readonly HoleEntity[], position: Vec2, radius: number) {
  let best: HoleEntity | null = null;
  let bestDistance = radius;
  for (const hole of holes) {
    const holeDistance = distance(hole, position);
    if (holeDistance < bestDistance) {
      best = hole;
      bestDistance = holeDistance;
    }
  }
  return best;
}

function baseHoleMoisture(state: GameState, position: Vec2) {
  if (state.weather === 'rain') return 0.78;
  if (isNearPond(position)) return 0.58;
  if (isShadowy(position)) return 0.38;
  return 0.16;
}

function physicalHoleKind(state: GameState, hole: HoleEntity): Exclude<HoleTerritoryKind, 'safe-rest'> {
  const facility = ownedFacilityAt(state.yard, hole);
  if (facility === 'loose-soil' || (hole.moisture < 0.28 && hole.depth >= 2)) {
    return 'dust-bath';
  }
  if (isShadowy(hole) || hole.moisture >= 0.46 || hole.depth >= 3) return 'cool-pit';
  return 'fresh';
}

function classifyHole(state: GameState, hole: HoleEntity): HoleTerritoryKind {
  const physicalKind = physicalHoleKind(state, hole);
  if (state.phase !== 'day' && hole.useSeconds >= 2 && physicalKind === 'fresh') {
    return 'safe-rest';
  }
  return physicalKind;
}

function holeKindLabel(kind: HoleTerritoryKind) {
  if (kind === 'cool-pit') return '凉坑';
  if (kind === 'dust-bath') return '沙浴地';
  if (kind === 'safe-rest') return '安全休息地';
  return '小土坑';
}

export function spendStamina(state: GameState, amount: number) {
  state.stats.stamina = clamp(state.stats.stamina - amount, 0, state.stats.maxStamina);
}

export function recoverStamina(state: GameState, amount: number) {
  state.stats.stamina = clamp(state.stats.stamina + amount, 0, state.stats.maxStamina);
}

export function waterBoostRatioFor(state: GameState) {
  return clamp(state.waterBoost / WATER_BOOST_LIMIT, 0, 1);
}

export function advanceChickenHeat(state: GameState, dt: number, context: HeatContext) {
  if (state.mode !== 'chicken') return state.heat;
  state.heat = advanceHeat(state.heat, dt, context);
  return state.heat;
}

export function chickenSprintScaleForHeat(state: GameState) {
  return sprintScaleForHeat(state.heat);
}

export function digLimitFor(state: GameState) {
  return 1;
}

export function updateWaterBoost(state: GameState, actionSeconds: number) {
  if (state.mode !== 'chicken' || actionSeconds <= 0) return;
  state.waterBoost = clamp(state.waterBoost - WATER_BOOST_DECAY * actionSeconds, 0, WATER_BOOST_LIMIT);
}

export function drinkAtWaterSource(state: GameState, dt: number) {
  if (state.mode !== 'chicken') return false;
  const atPond = isNearPond(state.chicken);
  const atBasin =
    state.yard.owned.includes('water-basin') &&
    distance(state.chicken, WATER_BASIN_POSITION) < 58 &&
    state.waterBasinLevel > 0;
  if (!atPond && !atBasin) return false;

  const before = state.waterBoost;
  const drinkAmount = 42 * dt;
  state.waterBoost = clamp(state.waterBoost + drinkAmount, 0, WATER_BOOST_LIMIT);
  state.heat = clamp(
    state.heat - BODY_COMFORT_TUNING.waterCoolingPerActiveSecond * dt,
    0,
    100,
  );
  if (atBasin) {
    state.waterBasinLevel = clamp(
      state.waterBasinLevel - CORE_LOOP_TUNING.waterBasinUsePerSecond * dt,
      0,
      CORE_LOOP_TUNING.waterBasinCapacity,
    );
  }
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

export function drinkAtPond(state: GameState, dt: number) {
  return drinkAtWaterSource(state, dt);
}

export function refillWaterBasin(state: GameState) {
  if (state.mode !== 'human' || !state.yard.owned.includes('water-basin')) return false;
  state.waterBasinLevel = CORE_LOOP_TUNING.waterBasinCapacity;
  state.message = '水盆装满了，清水够喝上好几次。';
  return true;
}

export function servePremiumFeed(state: GameState) {
  if (
    state.mode !== 'human' ||
    !state.yard.owned.includes('premium-feed') ||
    state.premiumFeedServedToday
  ) {
    return [];
  }
  state.premiumFeedServedToday = true;
  const foods = Array.from({ length: CORE_LOOP_TUNING.premiumFeedPieces }, (_, index) => {
    const food = spawnFood(
      state,
      'grain',
      {
        x: PREMIUM_FEED_POSITION.x + 32 + index * 17,
        y: PREMIUM_FEED_POSITION.y + 34 + (index % 2) * 10,
      },
      state.time,
    );
    food.fromKeeper = true;
    return food;
  });
  state.message = '你从饲料桶舀出一勺，今天院子里多了一份稳稳的谷物。';
  return foods;
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
    state.keeper.scatterCooldown -= clockDt;
    if (state.keeper.scatterCooldown > 0) return null;
    state.keeper.active = true;
    state.keeper.returning = false;
    state.keeper.routeIndex = 1;
    state.keeper.scatterCooldown = 2.2 + Math.random() * 2.2;
    if (!state.message) state.message = '养鸡人拎着小桶走进院子，准备撒几粒瓜子。';
    return null;
  }

  if (keeperSunflowerCount(state) >= KEEPER_SUNFLOWER_LIMIT || state.time >= KEEPER_FEED_END || state.phase !== 'day') {
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
    state.keeper.scatterCooldown = 9 + Math.random() * 4;
    return scatterSunflowerSeed(state);
  }

  return null;
}

function keeperSunflowerCount(state: GameState) {
  return (
    state.eaten.sunflower +
    state.foods.filter((food) => food.type === 'sunflower' && food.fromKeeper).length
  );
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

  if (food.type === 'meat' || food.type === 'cricket' || food.type === 'beetle' || food.type === 'nightBug') {
    const hardness = food.hardness ?? foodHardness(food.type);
    food.progress = (food.progress ?? 0) + 1;
    if (food.progress < hardness) {
      state.message = hardFoodPeckMessage(food.type, hardness - food.progress);
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

export function updateWeatherExposure(state: GameState, dt: number) {
  updateHoleMoisture(state, dt);
  if (
    state.weather !== 'rain' ||
    isOnPath(state.chicken) ||
    isInCoop(state.chicken)
  ) {
    state.offPathRainSeconds = 0;
    return false;
  }
  const wasMuddy = state.muddyToday;
  state.offPathRainSeconds = Math.min(RAIN_MUD_SECONDS, state.offPathRainSeconds + Math.max(0, dt));
  if (state.offPathRainSeconds >= RAIN_MUD_SECONDS) state.muddyToday = true;
  return !wasMuddy && state.muddyToday;
}

function updateHoleMoisture(state: GameState, dt: number) {
  const seconds = Math.max(0, dt);
  if (seconds <= 0) return;
  const delta = state.weather === 'rain' ? 0.0075 * seconds : -0.0028 * seconds;
  for (const hole of state.holes) {
    hole.moisture = clamp(hole.moisture + delta, 0, 1);
    hole.kind = classifyHole(state, hole);
  }
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

export function updateIdleChickenWander(
  state: GameState,
  dt: number,
  keepDistanceFromHuman = true,
) {
  if (state.mode !== 'human') return;

  const nearHuman = distance(state.human, state.chicken) < 92;
  if (keepDistanceFromHuman && nearHuman) {
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
    state.chickenWander.target = pickChickenWanderTarget(state, keepDistanceFromHuman);
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
  if (state.flow.phase === 'chicken-day') {
    applyFlowEvent(state, { type: 'tick', amount: 1 });
  }
  return finishChickenNight(state, caught);
}

export function finishChickenNight(state: GameState, caught = false) {
  if (state.flow.phase !== 'chicken-dusk' && state.flow.phase !== 'chicken-night') {
    return false;
  }
  state.caughtToday = state.caughtToday || caught;
  if (caught) addNightPressure(state, CORE_LOOP_TUNING.predatorContactPressure);
  state.dryRestTonight = state.weather !== 'rain' || state.yard.owned.includes('coop-roof');
  if (!caught) recordTrustMemory(state.relationship, state.day, 'safe-close');
  state.egg = createEgg(state);
  state.reward = null;
  state.daySummary = createDaySummary(state, 0);
  state.chicken = { x: COOP_DOOR.x, y: COOP_DOOR.y + 20 };
  applyFlowEvent(state, { type: 'settle-for-night' });
  state.message = caught
    ? `${state.profile.name}丢下夜食，惊叫着逃回了鸡窝。明早还能从羽毛和蛋看见今晚的故事。`
    : state.dryRestTonight
      ? `${state.profile.name}自己钻进鸡窝，院子安静下来。`
      : `雨从旧屋顶漏下来，${state.profile.name}缩成了一只湿漉漉的落汤鸡。`;
  return true;
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

export function resolveWeaselOutcome(state: GameState, outcome: WeaselOutcome) {
  if (outcome === 'active') return;
  if (outcome === 'caught') {
    state.caughtToday = true;
    addNightPressure(state, CORE_LOOP_TUNING.predatorContactPressure);
    return;
  }
  if (outcome === 'repelled') {
    recordTrustMemory(state.relationship, state.day, 'first-rescue');
  }
  state.weaselEncounter = null;
  state.weaselEncounterDoneToday = true;
  state.handLanternActive = false;
}

export function advanceNightResult(state: GameState) {
  if (shouldStartFinale(state.day, state.endingSeen)) {
    startEpilogueMorning(state);
    return;
  }

  const nextMorningEgg = state.egg;
  const hadDryRest = state.dryRestTonight;
  applyFlowEvent(state, { type: 'next-morning' });
  const deliveredWood = resetMorningState(state, nextMorningEgg);
  state.chickenWetFromRain = !hadDryRest;
  const baseMessage =
    deliveredWood > 0
      ? `清晨到了，昨天换回的 ${deliveredWood} 份木料已经送到。先去找今天的蛋。`
      : '清晨到了。先在院子里找到今天的蛋。';
  const rainOffset = [1, 2].find(
    (offset) => weatherForDay(state.profile.runSeed, state.day + offset) === 'rain',
  );
  state.message =
    rainOffset === undefined
      ? baseMessage
      : `${baseMessage} 收音机说明${rainOffset === 1 ? '天' : '后天'}会有一场大雨。`;
  if (state.chickenWetFromRain) {
    state.message += ` ${state.profile.name}昨晚被雨淋透了，羽毛还是湿的。靠近鸡按E也许能帮它擦干。`;
  }
}


export function dryRainSoakedChicken(state: GameState) {
  if (state.flow.phase !== 'morning-human') return false;
  if (!state.chickenWetFromRain) return false;
  state.chickenWetFromRain = false;
  state.affection = Math.min(state.affection + 8, 100);
  recordTrustMemory(state.relationship, state.day, 'close-interaction');
  state.message = `${state.profile.name}舒服地抖了抖羽毛，重新变得蓬松干爽。`;
  return true;
}
export function startEpilogueMorning(state: GameState) {
  applyFlowEvent(state, { type: 'start-epilogue' });
  const spot = EGG_SPOTS.find((candidate) => candidate.id === 'far-hedge');
  if (!spot) throw new Error('Finale keepsake spot is missing');
  const keepsake: EggEntity = {
    ...spot.position,
    type: 'balanced',
    name: '温热的纪念蛋',
    effect: '这枚蛋记着两周以来的小院生活。',
    found: false,
    quality: 'excellent',
    budget: 5,
  };
  const deliveredWood = resetMorningState(state, keepsake);
  state.eggSearch = createEggSearchState(spot.id);
  state.chicken = { x: COOP_DOOR.x + 28, y: COOP_DOOR.y - 42 };
  state.keeper.active = false;
  state.stormActive = false;
  state.finaleCheckpointJson = null;
  state.message =
    deliveredWood > 0
      ? `暴风过去了，${deliveredWood} 份木料已经送到。远端草丛里留着一份温热的礼物。`
      : '暴风过去了。远端草丛里留着一份温热的礼物。';
}

export function collectKeepsakeEgg(state: GameState) {
  if (
    state.flow.phase !== 'epilogue-human' ||
    !state.egg ||
    state.egg.found ||
    !collectCurrentEgg(state.eggSearch)
  ) {
    return false;
  }
  state.egg.found = true;
  state.endingSeen = true;
  state.previousEggSpotId = state.eggSearch.spotId;
  rememberEgg(state, state.egg.type, state.egg.quality);
  applyFlowEvent(state, { type: 'keepsake-found' });
  state.reward = {
    title: '清晨的礼物',
    name: state.egg.name,
    effect: state.egg.effect,
  };
  state.message = '蛋还带着温度。两周的小院日子，一段一段地亮了起来。';
  return true;
}

export function continueFreePlay(state: GameState) {
  if (state.flow.phase !== 'ending') return false;
  applyFlowEvent(state, { type: 'continue-free-play' });
  state.freePlay = true;
  state.stormActive = false;
  state.finaleCheckpointJson = null;
  state.chicken = { x: COOP_DOOR.x, y: COOP_DOOR.y + 32 };
  state.keeper.active = true;
  state.message = '故事讲完了，小院的普通日子还会继续。';
  return true;
}

export function canRetryFinale(state: GameState) {
  return (
    shouldStartFinale(state.day, state.endingSeen) &&
    state.stormActive &&
    state.caughtToday &&
    Boolean(state.finaleCheckpointJson)
  );
}

export function restoreFinaleState(checkpointJson: string) {
  const restored = restoreGameState(
    restoreFinaleCheckpoint<GameState>(checkpointJson),
  );
  restored.finaleCheckpointJson = checkpointJson;
  restored.caughtToday = false;
  restored.message = '风雨回到了黄昏。再试一次，把鸡安全带回窝。';
  return restored;
}

function resetMorningState(state: GameState, nextMorningEgg: EggEntity | null) {
  const deliveredWood = deliverPendingWood(state.yard);
  state.nightPressure = 0;
  state.heat = 0;
  state.nutrition = 0;
  state.waterBoost = 0;
  state.caughtToday = false;
  state.huggedToday = false;
  state.closeInteractionUsedToday = false;
  state.carryingChicken = false;
  state.repairedToday = false;
  state.keeperRescueUsedToday = false;
  state.weaselApproach = 0;
  state.weaselEncounter = null;
  state.weaselEncounterDoneToday = false;
  state.handLanternActive = false;
  state.drankToday = false;
  state.premiumFeedServedToday = false;
  state.dryRestTonight = true;
  state.porchLightReliefUsed = false;
  state.holesDugToday = 0;
  resetFacilityLifeDay(state.facilityLife);
  state.weatherCalendar = createWeatherCalendar(
    state.profile.runSeed ^ Math.imul(Math.floor((state.day - 1) / 14), 0x45d9f3b),
  );
  state.weather = weatherForDay(state.profile.runSeed, state.day);
  state.offPathRainSeconds = 0;
  state.muddyToday = false;
  state.lightPressureUsed = freshLightPressureUsed();
  state.chicken = { x: COOP_DOOR.x, y: COOP_DOOR.y + 32 };
  state.human = { x: 750, y: 448 };
  state.chickenWander = { target: null, wait: 0.4, pause: 0.2, facing: 1 };
  state.keeper = {
    ...KEEPER_START,
    active: false,
    returning: false,
    doneFeeding: true,
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
  state.eaten = freshEaten();
  state.foods = [];
  state.holes = ageHolesForMorning(state);
  state.animals = [];
  state.animalCooldown = 5.8;
  state.catVisitedToday = false;
  state.catWillVisitToday = Math.random() < CAT_VISIT_CHANCE;
  state.weasel = { x: -120, y: 820, active: false, chasing: false, stunned: 0 };
  state.egg = nextMorningEgg;
  state.reward = null;
  spawnDailyFood(state);
  return deliveredWood;
}

function ageHolesForMorning(state: GameState) {
  const moistureDelta = state.weather === 'rain' ? 0.22 : -0.12;
  return state.holes
    .map((hole) => {
      const aged: HoleEntity = {
        ...hole,
        moisture: clamp(hole.moisture + moistureDelta, 0, 1),
      };
      aged.kind = classifyHole(state, aged);
      return aged;
    })
    .filter((hole) => {
      const daysSinceUse = state.day - hole.lastUsedDay;
      const daysSinceDug = state.day - hole.dugDay;
      if (hole.depth >= 2 || hole.useSeconds >= 4) return daysSinceUse <= TERRITORY_KEEP_DAYS;
      return daysSinceDug <= HOLE_KEEP_DAYS;
    })
    .sort((a, b) => holeMemoryScore(state, b) - holeMemoryScore(state, a))
    .slice(0, MAX_REMEMBERED_HOLES);
}

function holeMemoryScore(state: GameState, hole: HoleEntity) {
  return hole.depth * 8 + hole.useSeconds * 0.8 - Math.max(0, state.day - hole.lastUsedDay);
}

export function collectEgg(state: GameState) {
  if (!state.egg || state.egg.found || !collectCurrentEgg(state.eggSearch)) return false;
  state.egg.found = true;
  applyEggEffect(state, state.egg.type);
  rememberEgg(state, state.egg.type, state.egg.quality);
  const earnedBudget = state.egg.budget;
  state.yard.wood += earnedBudget;
  state.previousEggSpotId = state.eggSearch.spotId;
  state.reward = {
    title: '找到鸡蛋',
    name: state.egg.name,
    effect: state.egg.effect,
  };
  state.message = `这枚蛋是${eggQualityLabel(state.egg.quality)}，院子预算 +${earnedBudget}。还可以再照料鸡；准备好后回房门口按 E 回屋。`;
  return true;
}

export function startNextDay(state: GameState) {
  applyFlowEvent(state, { type: 'next-morning' });
  deliverPendingWood(state.yard);
  state.nightPressure = 0;
  state.heat = 0;
  state.nutrition = 0;
  state.waterBoost = 0;
  state.caughtToday = false;
  state.huggedToday = false;
  state.closeInteractionUsedToday = false;
  state.carryingChicken = false;
  state.repairedToday = false;
  state.keeperRescueUsedToday = false;
  state.weaselApproach = 0;
  state.drankToday = false;
  state.premiumFeedServedToday = false;
  state.dryRestTonight = true;
  state.porchLightReliefUsed = false;
  state.holesDugToday = 0;
  state.lightPressureUsed = freshLightPressureUsed();
  state.chicken = { x: COOP_DOOR.x, y: COOP_DOOR.y + 32 };
  state.human = { x: 750, y: 448 };
  state.chickenWander = { target: null, wait: 0, pause: 0, facing: 1 };
  state.keeper = {
    ...KEEPER_START,
    active: false,
    returning: false,
    doneFeeding: true,
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
  state.eaten = freshEaten();
  state.foods = [];
  state.holes = ageHolesForMorning(state);
  state.egg = null;
  state.daySummary = null;
  state.animals = [];
  state.animalCooldown = 5.8;
  state.catVisitedToday = false;
  state.catWillVisitToday = Math.random() < CAT_VISIT_CHANCE;
  state.weasel = { x: -120, y: 820, active: false, chasing: false, stunned: 0 };
  state.weaselEncounter = null;
  state.weaselEncounterDoneToday = false;
  state.reward = null;
  state.message = '新的一天，小院泥地又冒出细小食物。';
  spawnDailyFood(state);
}

export function buildHudSnapshot(state: GameState, consumeTransient = true): HudSnapshot {
  const nutritionPressure = nutritionPressureFor(state);
  const projectedEgg = evaluateEggQuality({
    nutrition: nutritionPressure.effectiveNutrition,
    foodsEaten: state.foraging.foodsEatenToday,
    dryRest: state.dryRestTonight,
  });
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
    nutrition: Math.round(nutritionPressure.rawNutrition),
    nutritionPct: Math.round(nutritionPressure.rawNutrition),
    effectiveNutrition: Math.round(nutritionPressure.effectiveNutrition),
    effectiveNutritionPct: Math.round(nutritionPressure.effectiveNutrition),
    nutritionCap: Math.round(nutritionPressure.nutritionCap),
    nutritionCapPct: Math.round(nutritionPressure.nutritionCap),
    waterBoost: Math.round(state.waterBoost),
    waterBoostPct: Math.round((state.waterBoost / WATER_BOOST_LIMIT) * 100),
    drankToday: state.drankToday,
    holesDugToday: state.holesDugToday,
    digLimit: digLimitFor(state),
    pressure: Math.round(state.nightPressure),
    pressurePct: Math.round(state.nightPressure),
    heat: Math.round(state.heat),
    heatPct: Math.round(state.heat),
    showHeat: state.mode === 'chicken',
    showPressure: state.mode === 'chicken' || state.nightPressure > 0,
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
    eggArchive: state.eggArchive.map((entry) => ({
      ...entry,
      name: archiveEggDisplayName(entry),
    })),
    yard: {
      wood: state.yard.wood,
      pendingWood: state.yard.pendingWood,
      owned: [...state.yard.owned],
    },
    yardFamiliarity: {
      regions: Object.fromEntries(
        Object.entries(state.yardFamiliarity.regions).map(([region, entry]) => [
          region,
          { ...entry },
        ]),
      ) as YardFamiliarityState['regions'],
    },
    currentEggQuality: state.egg?.quality ?? null,
    currentEggBudget: state.egg?.budget ?? 0,
    projectedEggQuality: projectedEgg.quality,
    eggQualityScore: projectedEgg.score,
    eggWildKinds: projectedEgg.wildKinds,
    eggDryRest: state.dryRestTonight,
    daySummary: state.daySummary ? { ...state.daySummary, eaten: { ...state.daySummary.eaten } } : null,
    goalTip: goalTipFor(state),
    forcedEggType: state.forcedEggType,
    keeperLabel: keeperLabel(state),
    endingMemories: endingMemoriesFor(state),
    toast: state.message,
    reward: state.reward ? { ...state.reward } : null,
  };

  if (consumeTransient) {
    state.message = '';
    state.reward = null;
  }

  return snapshot;
}

function archiveEggDisplayName(entry: EggArchiveEntry) {
  if (entry.quality) return eggQualityLabel(entry.quality);
  return isQualityEggName(entry.name) ? entry.name : '普通蛋';
}

function isQualityEggName(name: string) {
  return name === '差蛋' || name === '普通蛋' || name === '较好蛋' || name === '好蛋' || name === '金蛋';
}

function endingMemoriesFor(state: GameState) {
  const abilities = [
    state.profile.awakenedAbilities.scratch ? '刨土' : null,
    state.profile.awakenedAbilities.sprint ? '冲刺' : null,
    state.profile.awakenedAbilities.flutter ? '扑翅' : null,
  ].filter((ability): ability is string => ability !== null);
  const foundEggs = state.eggArchive.reduce((total, entry) => total + entry.count, 0);
  const sharedCloseMoment = state.relationship.dailyKeys.some((key) =>
    key.endsWith(':close-interaction'),
  );
  const safeNights = state.relationship.dailyKeys.filter((key) =>
    key.endsWith(':safe-close'),
  ).length;

  return [
    sharedCloseMoment
      ? `第一次把食物放进手心时，${state.profile.name}记住了你的气味。`
      : `${state.profile.name}从最初的戒备，慢慢熟悉了这双手。`,
    abilities.length > 0
      ? `${state.profile.name}先后学会了${abilities.join('、')}。`
      : `${state.profile.name}在院子里找到了自己的生活节奏。`,
    foundEggs > 0
      ? `你们一起找到了 ${foundEggs} 枚藏在草地里的蛋。`
      : '每一个清晨，你都循着叫声走过草地。',
    state.yard.owned.length > 0
      ? `小院里有 ${state.yard.owned.length} 处修缮，留下了共同生活的痕迹。`
      : '旧院子也因为每天的照料，渐渐有了家的样子。',
    state.relationship.rescueRecorded
      ? '那次危险里，你第一次真正挡在了它前面。'
      : `你一次次在黄昏守着${state.profile.name}走回鸡舍。`,
    safeNights > 0
      ? `最后一扇门安稳关上，也记着此前 ${safeNights} 个平安夜晚。`
      : '暴风的最后一夜，鸡舍门终于在身后安稳关上。',
  ];
}

function hasNearbyBuriedNightBug(state: GameState) {
  if (state.flow.phase !== 'chicken-dusk' && state.flow.phase !== 'chicken-night') return false;
  return state.foods.some(
    (food) =>
      food.type === 'nightBug' &&
      food.buried &&
      state.time >= food.visibleAt &&
      distance(food, state.chicken) <= 90,
  );
}

function goalTipFor(state: GameState) {
  const tutorial = tutorialForAbility(state.activeAbilityTutorial);
  if (state.mode === 'human') {
    if (state.flow.phase === 'epilogue-human') {
      return '沿着最明显的痕迹，在远端草丛寻找昨夜留下的温热鸡蛋。';
    }
    if (state.flow.phase === 'dusk-human') {
      return '黄昏仍由鸡自己行动；回到鸡窝门前按 E 可以休息。';
    }
    if (state.egg && !state.egg.found) return '按空格搜索；没找到时，看鸡朝哪个方向叫。';
    if (state.flow.morningEggFound) return '还可以靠近鸡按 E 抱一抱，或去鸡窝修缮；准备好后到房门口按 E 回屋。';
    return '靠近鸡按 E 互动。';
  }
  if (state.weaselEncounter) return '黄鼠狼靠近了：听草丛方向，沿熟悉路线冲回鸡窝。';
  if (tutorial) return tutorial.prompt;
  if (hasNearbyBuriedNightBug(state)) return '脚下泥土在鼓动，按住 E 刨开看看。';
  if (state.flow.phase === 'chicken-dusk') {
    if (distance(state.chicken, COOP_DOOR) < 94) return '鸡舍里有暖光，按 E 就能窝下。';
    return '鸡舍门口亮着暖光；院子边缘有细小声响。';
  }
  if (state.flow.phase === 'chicken-night') {
    if (distance(state.chicken, COOP_DOOR) < 94) return '鸡舍里有暖光，按 E 就能窝下。';
    return '暖光在身后，泥土和草边偶尔有细小声响。';
  }
  if (state.weasel.active) return '黄鼠狼来了：沿熟悉路线冲回鸡窝。';
  const facility = ownedFacilityAt(state.yard, state.chicken);
  if (state.facilityLife.activity === 'dust-bath') return '正在松土里沙浴。';
  if (state.facilityLife.activity === 'shade-rest') return '正在遮阴棚下休息和梳理羽毛。';
  if (state.facilityLife.activity === 'hole-rest') return '正在自己刨过的坑里休息。';
  if (state.facilityLife.activity === 'perch-idle') return '正在低栖木上站稳、看看院子。';
  if (state.facilityLife.dustBathReady && facility === 'loose-soil') return '松开再按 E，在松土里沙浴。';
  if (facility === 'shade-shelter') return '在遮阴棚里停下 2.5 秒，可以休息。';
  if (facility === 'low-perch') return '靠近低栖木按 F 跳上去，停稳后会栖息。';
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
  let restoredFlow = createDayFlow(
    hasSavedFlow
      ? input.flow
      : { day: Number.isFinite(savedDay) && savedDay > 0 ? Math.floor(savedDay) : 1 },
  );
  if (restoredFlow.phase === 'dusk-human') {
    restoredFlow = { ...restoredFlow, phase: 'chicken-dusk' };
  }
  const restoredProfile = {
    ...fresh.profile,
    ...(input.profile ?? {}),
    awakenedAbilities: {
      ...fresh.profile.awakenedAbilities,
      ...(input.profile?.awakenedAbilities ?? {}),
      sprint: true,
    },
  };
  const defaultWeatherCalendar = createWeatherCalendar(
    restoredProfile.runSeed ^
      Math.imul(Math.floor((restoredFlow.day - 1) / 14), 0x45d9f3b),
  );
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
    heat: Number.isFinite(input.heat) ? clamp(Number(input.heat), 0, 100) : 0,
    premiumFeedServedToday: input.premiumFeedServedToday ?? false,
    waterBasinLevel: Number.isFinite(input.waterBasinLevel)
      ? clamp(
          Number(input.waterBasinLevel),
          0,
          CORE_LOOP_TUNING.waterBasinCapacity,
        )
      : 0,
    dryRestTonight: input.dryRestTonight ?? true,
    chickenWetFromRain: input.chickenWetFromRain ?? false,
    porchLightReliefUsed: input.porchLightReliefUsed ?? false,
    chicken: { ...fresh.chicken, ...(input.chicken ?? {}) },
    human: { ...fresh.human, ...(input.human ?? {}) },
    chickenWander: { ...fresh.chickenWander, ...(input.chickenWander ?? {}) },
    keeper: {
      ...fresh.keeper,
      ...(input.keeper ?? {}),
      active: false,
      doneFeeding: true,
      rescuing: false,
    },
    lightPressureUsed: restoreLightPressureUsed(input.lightPressureUsed),
    stats: { ...fresh.stats, ...(input.stats ?? {}) },
    unlockedFoods: { ...fresh.unlockedFoods, ...(input.unlockedFoods ?? {}) },
    eaten: { ...fresh.eaten, ...(input.eaten ?? {}) },
    foods: Array.isArray(input.foods) ? input.foods.map((food) => restoreFood(food, fresh)) : fresh.foods,
    holes: Array.isArray(input.holes)
      ? input.holes
          .map((hole) => restoreHole(hole))
          .filter((hole): hole is HoleEntity => Boolean(hole))
      : fresh.holes,
    egg: restoreEgg(input.egg, hasSavedFlow),
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
    facilityLife: {
      ...createFacilityLifeState(),
      restedToday: input.facilityLife?.restedToday ?? false,
    },
    yardFamiliarity: restoreYardFamiliarityState(input.yardFamiliarity),
    weatherCalendar:
      Array.isArray(input.weatherCalendar) &&
      input.weatherCalendar.length === 14 &&
      input.weatherCalendar.every(isWeather)
        ? input.weatherCalendar
        : defaultWeatherCalendar,
    weather: isWeather(input.weather)
      ? input.weather
      : weatherForDay(restoredProfile.runSeed, restoredFlow.day),
    offPathRainSeconds: Number.isFinite(input.offPathRainSeconds)
      ? Math.max(0, Math.min(RAIN_MUD_SECONDS, Number(input.offPathRainSeconds)))
      : 0,
    muddyToday: input.muddyToday ?? false,
    animals: Array.isArray(input.animals) ? input.animals : fresh.animals,
    weasel: { ...fresh.weasel, ...(input.weasel ?? {}) },
    weaselSchedule: Array.isArray(input.weaselSchedule)
      ? input.weaselSchedule
      : createWeaselSchedule(restoredProfile.runSeed),
    weaselApproach: Number.isFinite(input.weaselApproach)
      ? clamp(Number(input.weaselApproach), 0, 100)
      : 0,
    weaselEncounter:
      input.weaselEncounter &&
      typeof input.weaselEncounter === 'object' &&
      input.weaselEncounter.position
        ? {
            ...input.weaselEncounter,
            position: { ...input.weaselEncounter.position },
            phase: input.weaselEncounter.phase ?? 'lurking',
            lightExposure: Number(input.weaselEncounter.lightExposure ?? 0),
            warningSeconds: Number(input.weaselEncounter.warningSeconds ?? 0),
            phaseSeconds: Number(input.weaselEncounter.phaseSeconds ?? 0),
            target: input.weaselEncounter.target ? { ...input.weaselEncounter.target } : null,
          }
        : null,
    weaselEncounterDoneToday: input.weaselEncounterDoneToday ?? false,
    handLanternActive: false,
    endingSeen: input.endingSeen ?? false,
    freePlay: input.freePlay ?? false,
    finaleCheckpointJson:
      typeof input.finaleCheckpointJson === 'string' ? input.finaleCheckpointJson : null,
    stormActive: input.stormActive ?? false,
    upgrades: Array.isArray(input.upgrades) ? input.upgrades : fresh.upgrades,
    daySummary: restoreDaySummary(input.daySummary),
    forcedEggType: isEggType(input.forcedEggType) ? input.forcedEggType : null,
    reward: null,
    message: input.message ?? fresh.message,
  };
  if ((input.stats as Partial<ChickenStats> | undefined)?.speed === 142) {
    restored.stats.speed = BASE_CHICKEN_SPEED;
  }
  delete (restored.stats as ChickenStats & { fullness?: unknown }).fullness;
  const legacyFullness = (input.stats as { fullness?: unknown } | undefined)?.fullness ?? 0;
  const savedNutrition = Number((input as { nutrition?: unknown }).nutrition ?? legacyFullness);
  restored.nutrition = Number.isFinite(savedNutrition) ? clamp(savedNutrition, 0, NUTRITION_LIMIT) : 0;
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
  if (restored.egg && !restored.egg.found) {
    const spot =
      EGG_SPOTS.find((candidate) => candidate.id === restored.eggSearch.spotId) ??
      selectEggSpot(
        restored.day,
        restored.previousEggSpotId,
        createSeededRandom(restored.profile.runSeed + restored.day * 7919),
      );
    restored.egg = { ...restored.egg, ...spot.position };
    restored.eggSearch.spotId = spot.id;
  }
  syncLegacyPhaseFromFlow(restored);
  return restored;
}

function restoreEgg(
  saved: Partial<EggEntity> | null | undefined,
  hasSavedFlow: boolean,
): EggEntity | null {
  if (!saved) return hasSavedFlow ? null : createTutorialEgg();
  const fallback = createTutorialEgg();
  const quality = isEggQuality(saved.quality) ? saved.quality : 'poor';
  const budget = Number(saved.budget);
  return {
    ...fallback,
    ...saved,
    quality,
    name: eggQualityLabel(quality),
    budget: Number.isFinite(budget) ? clamp(Math.round(budget), 2, 5) : 2,
  };
}

function isEggQuality(value: unknown): value is EggQuality {
  return value === 'poor' || value === 'ordinary' || value === 'good' || value === 'excellent';
}

function restoreDaySummary(saved: Partial<DaySummary> | null | undefined): DaySummary | null {
  if (!saved) return null;
  const legacySummary = saved as Partial<DaySummary> & {
    fullness?: number;
    effectiveFullness?: number;
    stuffedness?: number;
  };
  const eggType = isEggType(saved.eggType) ? saved.eggType : 'cracked';
  const waterBoost = Number(saved.waterBoost ?? 0);
  return {
    ...saved,
    day: saved.day ?? 1,
    eaten: { ...freshEaten(), ...(saved.eaten ?? {}) },
    gainedMaterials: saved.gainedMaterials ?? 0,
    materialsTotal: saved.materialsTotal ?? 0,
    eggType,
    eggName: isQualityEggName(saved.eggName ?? '') ? saved.eggName! : '普通蛋',
    eggReason: saved.eggReason ?? '',
    nearMiss: saved.nearMiss ?? '',
    nutrition: saved.nutrition ?? legacySummary.effectiveFullness ?? legacySummary.fullness ?? 0,
    rawNutrition:
      saved.rawNutrition ??
      saved.nutrition ??
      legacySummary.effectiveFullness ??
      legacySummary.fullness ??
      0,
    nutritionCap: clamp(saved.nutritionCap ?? NUTRITION_LIMIT - (saved.nightPressure ?? 0), 0, NUTRITION_LIMIT),
    drankToday: saved.drankToday ?? false,
    waterBoost: Number.isFinite(waterBoost) ? clamp(waterBoost, 0, WATER_BOOST_LIMIT) : 0,
    nightPressure: saved.nightPressure ?? 0,
    caught: saved.caught ?? false,
  };
}

function restoreHole(saved: Partial<HoleEntity> | null | undefined): HoleEntity | null {
  if (!saved) return null;
  const x = Number(saved.x);
  const y = Number(saved.y);
  const id = Number(saved.id);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(id)) return null;
  const dugDay = Number(saved.dugDay);
  const lastUsedDay = Number(saved.lastUsedDay ?? saved.dugDay);
  const restPower = Number(saved.restPower);
  const depth = Number(saved.depth ?? 1);
  const moisture = Number(saved.moisture ?? 0.2);
  const useSeconds = Number(saved.useSeconds ?? 0);
  return {
    id: Math.floor(id),
    x,
    y,
    dugDay: Number.isFinite(dugDay) ? Math.floor(dugDay) : 1,
    lastUsedDay: Number.isFinite(lastUsedDay) ? Math.floor(lastUsedDay) : 1,
    restPower: Number.isFinite(restPower) ? clamp(restPower, 1, 48) : 12,
    depth: Number.isFinite(depth) ? clamp(Math.round(depth), 1, HOLE_MAX_DEPTH) : 1,
    moisture: Number.isFinite(moisture) ? clamp(moisture, 0, 1) : 0.2,
    useSeconds: Number.isFinite(useSeconds) ? clamp(useSeconds, 0, 999) : 0,
    kind: isHoleKind(saved.kind) ? saved.kind : 'fresh',
  };
}

function isHoleKind(value: unknown): value is HoleTerritoryKind {
  return value === 'fresh' || value === 'cool-pit' || value === 'dust-bath' || value === 'safe-rest';
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
  state.message = `调试：院子预算 +${amount}，现在 ${state.yard.wood}。`;
}

export function debugSetDay(state: GameState, requestedDay: number) {
  const day = clamp(
    Number.isFinite(requestedDay) ? Math.floor(requestedDay) : state.day,
    1,
    999,
  );
  state.flow = createDayFlow({ day });
  syncLegacyPhaseFromFlow(state);
  state.freePlay = day > 14;
  state.endingSeen = day > 14;
  state.finaleCheckpointJson = null;
  state.stormActive = false;
  if (day >= 4) state.profile.awakenedAbilities.scratch = true;
  state.profile.awakenedAbilities.sprint = true;
  if (day >= 7) state.profile.awakenedAbilities.flutter = true;

  const egg = createMorningEggForDay(state, day, 'balanced');
  resetMorningState(state, egg);
  state.daySummary = null;
  state.message = `调试：已切换到第 ${day} 天清晨。`;
  return day;
}

export function debugJumpToDusk(state: GameState) {
  if (
    state.flow.phase !== 'chicken-day' &&
    state.flow.phase !== 'chicken-dusk' &&
    state.flow.phase !== 'chicken-night'
  ) {
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
    state.egg.name = eggQualityLabel(state.egg.quality);
    state.egg.effect = info.effect;
    const gainedMaterials = state.daySummary?.gainedMaterials ?? 0;
    state.daySummary = createDaySummary(state, gainedMaterials);
  }
  state.message = '调试：下一颗蛋的内部效果已指定，显示名仍按品质。';
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
  const plan = createFamiliarFoodPlan(
    state,
    state.profile.runSeed ^ Math.imul(wave + 1, 0x45d9f3b),
    state.flow.phase === 'chicken-dusk',
    offscreenMudPoints,
    4,
  );
  state.foraging.refillWave += 1;
  return plan.map((food) => {
    const spawnedFood = spawnFood(state, food.type, food, state.time);
    if (spawnedFood.type === 'nightBug') spawnedFood.buried = true;
    return spawnedFood;
  });
}

function createFamiliarFoodPlan(
  state: GameState,
  runSeed: number,
  dusk: boolean,
  points: readonly Vec2[],
  count: number,
): DailyFoodSpawn[] {
  const random = createSeededRandom(runSeed ^ Math.imul(state.day, 0x9e3779b1));
  if (points.length === 0 || count <= 0) return [];

  const shuffledPoints = [...points];
  for (let index = shuffledPoints.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffledPoints[index], shuffledPoints[swapIndex]] = [
      shuffledPoints[swapIndex],
      shuffledPoints[index],
    ];
  }

  return Array.from({ length: Math.min(count, shuffledPoints.length) }, (_, index) => {
    const point = shuffledPoints[index];
    const pool = foodPoolForFamiliarity({
      profile: state.profile,
      dusk,
      day: state.day,
      familiarity: regionFamiliarityFor(state.yardFamiliarity, point),
    });
    return {
      ...point,
      type: pool[Math.floor(random() * pool.length)],
    };
  });
}

function spawnDailyFood(state: GameState) {
  const plan = createFamiliarFoodPlan(
    state,
    state.profile.runSeed,
    false,
    FOOD_SPAWN_POINTS,
    15,
  );
  for (const food of plan) spawnFood(state, food.type, food, 0);

  const nightBugPoints = FOOD_SPAWN_POINTS.filter(
    (point) => point.x < 260 || point.x > WORLD_WIDTH - 260 || point.y > WORLD_HEIGHT - 170,
  );
  const nightPlan = createDailyFoodPlan(
    state.profile.runSeed ^ 0x51f15e,
    state.day,
    ['nightBug'],
    nightBugPoints,
    2,
  );
  for (const food of nightPlan) {
    const nightBug = spawnFood(state, food.type, food, DUSK_AT);
    nightBug.buried = true;
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
  const hardness = foodHardness(type);
  if (hardness > 1) {
    food.hardness = hardness;
    food.progress = 0;
  }
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

function pickChickenWanderTarget(
  state: GameState,
  keepDistanceFromHuman: boolean,
): Vec2 | null {
  for (let i = 0; i < 32; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 70 + Math.random() * 180;
    const point = {
      x: clamp(state.chicken.x + Math.cos(angle) * radius, 58, WORLD_WIDTH - 58),
      y: clamp(state.chicken.y + Math.sin(angle) * radius, 58, WORLD_HEIGHT - 58),
    };
    if (isBlocked(point, 18)) continue;
    if (keepDistanceFromHuman && distance(point, state.human) < 110) continue;
    return point;
  }

  for (let i = 0; i < 24; i += 1) {
    const point = randomYardPoint();
    if (
      !isBlocked(point, 18) &&
      (!keepDistanceFromHuman || distance(point, state.human) >= 110)
    ) {
      return point;
    }
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
  const metrics = eggMetrics(state);
  const outcome = evaluateEggQuality({
    nutrition: metrics.nutrition,
    foodsEaten: state.foraging.foodsEatenToday,
    dryRest: state.dryRestTonight,
  });
  return createMorningEggForDay(
    state,
    state.day + 1,
    type,
    outcome.quality,
    outcome.budget,
  );
}

function createMorningEggForDay(
  state: GameState,
  eggDay: number,
  type: EggType,
  quality: EggQuality = 'poor',
  budget = 2,
): EggEntity {
  const eggInfo = eggCatalog[type];
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
    name: eggQualityLabel(quality),
    effect: eggInfo.effect,
    quality,
    budget,
  };
}

function pickEggType(state: GameState): EggType {
  const eaten = state.foraging.foodsEatenToday;
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
  const metrics = eggMetrics(state);
  return {
    day: state.day,
    eaten: { ...state.eaten },
    gainedMaterials,
    materialsTotal: state.yard.wood,
    eggType,
    eggName: egg?.name ?? '普通蛋',
    eggReason: eggReasonFor(state, eggType, metrics),
    nearMiss: nearMissEggHint(state, eggType, metrics),
    nutrition: Math.round(metrics.nutrition),
    rawNutrition: Math.round(metrics.rawNutrition),
    nutritionCap: Math.round(metrics.nutritionCap),
    drankToday: state.drankToday,
    waterBoost: Math.round(state.waterBoost),
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
  const pressure = nutritionPressureFor(state, meatBonus);
  return {
    eatenTotal,
    meatBonus,
    rawNutrition: pressure.rawNutrition,
    nutritionCap: pressure.nutritionCap,
    nutrition: pressure.effectiveNutrition,
  };
}

function eggReasonFor(state: GameState, type: EggType, metrics: ReturnType<typeof eggMetrics>) {
  if (state.forcedEggType === type) return '调试工具指定了这颗蛋。';
  const pressureCovered = metrics.rawNutrition > metrics.nutrition;
  if (type === 'cracked') {
    if (pressureCovered) {
      return `原本营养有 ${Math.round(metrics.rawNutrition)}，但夜压 ${Math.round(state.nightPressure)} 把今天的有效营养压到 ${Math.round(metrics.nutrition)}。`;
    }
    if (metrics.eatenTotal < 3) return `今天总进食数只有 ${metrics.eatenTotal}，少于 3。`;
    if (metrics.nutrition < 35) return `有效营养只有 ${Math.round(metrics.nutrition)}，少于 35。`;
    return '没有满足更好蛋的条件，所以只是差蛋。';
  }
  if (type === 'greenLeaf') {
    return state.unlockedFoods.grass
      ? `嫩草吃到 ${state.eaten.grass} 口，有效营养 ${Math.round(metrics.nutrition)}，这颗蛋让胆量提升。`
      : `米粒吃到 ${state.eaten.grain} 口，有效营养 ${Math.round(metrics.nutrition)}，这颗蛋让胆量提升；嫩草仍需要清晨训练解锁。`;
  }
  if (type === 'swift') {
    return state.unlockedFoods.bug
      ? `蚯蚓吃到 ${state.eaten.bug} 口，有效营养 ${Math.round(metrics.nutrition)}，这颗蛋让速度提升。`
      : `嫩草吃到 ${state.eaten.grass} 口，有效营养 ${Math.round(metrics.nutrition)}，这颗蛋让速度提升；蚯蚓仍需要清晨训练解锁。`;
  }
  if (type === 'lantern') {
    return state.unlockedFoods.nightBug
      ? `夜虫吃到 ${state.eaten.nightBug} 只，有效营养 ${Math.round(metrics.nutrition)}，这颗蛋让灯更暖。`
      : `蚯蚓吃到 ${state.eaten.bug} 口，有效营养 ${Math.round(metrics.nutrition)}，这颗蛋让灯更暖；夜虫仍需要清晨训练解锁。`;
  }
  if (type === 'brave') return `夜压达到 ${Math.round(state.nightPressure)}，鸡安全撑过来，这颗蛋记住了胆量。`;
  if (type === 'sunny') return `瓜子吃到 ${state.eaten.sunflower} 粒，有效营养 ${Math.round(metrics.nutrition)}，这颗蛋记住了特别喂食。`;
  if (type === 'fullBelly') return `米粒吃到 ${state.eaten.grain} 口，有效营养 ${Math.round(metrics.nutrition)}，这颗蛋让体力更稳。`;
  return `有效营养达到 ${Math.round(metrics.nutrition)}，饮食比较丰富，这颗蛋让小院生活更稳定。`;
}

function nearMissEggHint(state: GameState, currentType: EggType, metrics: ReturnType<typeof eggMetrics>) {
  if (metrics.rawNutrition > metrics.nutrition) {
    return `夜压盖住了营养：原本 ${Math.round(metrics.rawNutrition)}，今天只能算 ${Math.round(metrics.nutrition)}。先躲开捕食者或去灯下缓一口气。`;
  }

  const candidates = eggCandidatesFor(state, metrics).filter((candidate) => candidate.type !== currentType);
  let best: { missing: string[]; score: number } | null = null;

  for (const candidate of candidates) {
    const missing = candidate.requirements
      .filter((requirement) => requirement.current < requirement.required)
      .map((requirement) => `${requirement.label}还差 ${formatRequirementGap(requirement.required - requirement.current)}`);
    if (missing.length === 0) continue;
    const score = candidate.requirements.reduce((total, requirement) => {
      if (requirement.current >= requirement.required) return total;
      return total + (requirement.required - requirement.current) / requirement.required;
    }, 0);
    if (!best || score < best.score) best = { missing, score };
  }

  if (!best) return '今天已经很接近当前能追到的金蛋了，继续稳定觅食就行。';
  return `再补一点就能让蛋更有记忆：${best.missing.slice(0, 2).join('，')}。`;
}

function eggCandidatesFor(state: GameState, metrics: ReturnType<typeof eggMetrics>) {
  return [
    !state.unlockedFoods.grass
      ? eggCandidate('greenLeaf', '更好的蛋', [
          requirement('有效营养', metrics.nutrition, 58),
          requirement('米粒', state.eaten.grain, 4),
        ])
      : eggCandidate('greenLeaf', '更好的蛋', [
          requirement('有效营养', metrics.nutrition, 58),
          requirement('嫩草', state.eaten.grass, 4),
        ]),
    !state.unlockedFoods.bug
      ? eggCandidate('swift', '更好的蛋', [
          requirement('有效营养', metrics.nutrition, 64),
          requirement('嫩草', state.eaten.grass, 4),
        ])
      : eggCandidate('swift', '更好的蛋', [
          requirement('有效营养', metrics.nutrition, 64),
          requirement('蚯蚓', state.eaten.bug, 3),
        ]),
    !state.unlockedFoods.nightBug
      ? eggCandidate('lantern', '更好的蛋', [
          requirement('有效营养', metrics.nutrition, 72),
          requirement('蚯蚓', state.eaten.bug, 3),
        ])
      : eggCandidate('lantern', '更好的蛋', [
          requirement('有效营养', metrics.nutrition, 88),
          requirement('夜虫', state.eaten.nightBug, 2),
        ]),
    eggCandidate('brave', '更好的蛋', [
      requirement('有效营养', metrics.nutrition, 55),
      requirement('夜压', state.nightPressure, 58),
      requirement('蚯蚓或夜虫基础', state.unlockedFoods.nightBug ? 1 : state.eaten.bug, state.unlockedFoods.nightBug ? 1 : 2),
    ]),
    eggCandidate('sunny', '更好的蛋', [
      requirement('有效营养', metrics.nutrition, 70),
      requirement('瓜子', state.eaten.sunflower, 2),
    ]),
    eggCandidate('fullBelly', '更好的蛋', [
      requirement('有效营养', metrics.nutrition, 72),
      requirement('米粒', state.eaten.grain, 4),
    ]),
    eggCandidate('balanced', '更好的蛋', [requirement('有效营养', metrics.nutrition, 50)]),
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

function rememberEgg(state: GameState, type: EggType, quality: EggQuality) {
  const info = eggCatalog[type];
  const name = eggQualityLabel(quality);
  const existing = state.eggArchive.find((entry) => entry.quality === quality);
  if (existing) {
    existing.count += 1;
    return;
  }

  state.eggArchive.push({
    type,
    name,
    effect: info.effect,
    upgrade: info.upgrade,
    quality,
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
    name: '普通蛋',
    effect: '鸡的冲刺上限提升，逃跑和刨坑更有余量。',
    upgrade: '冲刺壳',
  },
  greenLeaf: {
    name: '普通蛋',
    effect: '胆量提升；嫩草需要清晨训练解锁。',
    upgrade: '青叶胆',
  },
  swift: {
    name: '普通蛋',
    effect: '移动速度提升；蚯蚓需要清晨训练解锁。',
    upgrade: '快脚爪',
  },
  lantern: {
    name: '普通蛋',
    effect: '房子和鸡笼的灯更暖；夜虫需要清晨训练解锁。',
    upgrade: '暖灯',
  },
  brave: {
    name: '普通蛋',
    effect: '经历黑夜后胆量提升，高夜压时更不容易乱。',
    upgrade: '铁胆',
  },
  sunny: {
    name: '普通蛋',
    effect: '鸡更会啄硬壳食物，冲刺上限也小幅提升。',
    upgrade: '会追人',
  },
  balanced: {
    name: '普通蛋',
    effect: '啄食和挖坑能力一起提升。',
    upgrade: '会过日子',
  },
  cracked: {
    name: '差蛋',
    effect: '今天太惊险，鸡需要缓一缓。',
    upgrade: '惊魂未定',
  },
};

function storyPhaseLabel(phase: StoryPhase) {
  if (phase === 'morning-human') return '清晨找蛋';
  if (phase === 'chicken-day') return '白天';
  if (phase === 'chicken-dusk') return '黄昏';
  if (phase === 'chicken-night') return '夜间冒险';
  if (phase === 'dusk-human') return '黄昏';
  if (phase === 'night-result') return '夜里';
  if (phase === 'epilogue-human') return '清晨的礼物';
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

function foodMessage(food: FoodEntity) {
  const type = food.type;
  if (type === 'grain' && food.fromKeeper) return '优质谷物带着香味，鸡啄完肚子明显更踏实。';
  if (type === 'grain') return '嗒，米粒被啄进嘴里，肚子稳稳垫了一点。';
  if (type === 'grass') return '嫩草带着露水，鸡舒服地抖了抖羽毛。';
  if (type === 'bug' || type === 'worm') return '蚯蚓弹了一下，还是被鸡叼住了，肚子暖起来。';
  if (type === 'cricket') return '追上的蟋蟀脆生生的，鸡喘了口气又精神起来。';
  if (type === 'beetle') return '甲虫壳咔地一响，吃得很顶饱，明天的蛋会记住这口。';
  if (type === 'berry') return '树莓甜甜的，鸡歪头回味了一会儿。';
  if (type === 'sunflower') return '瓜子又香，鸡凑在人手边舍不得走。';
  if (type === 'meat') return '鸡啄了啄这块奇怪的旧食物。';
  return '夜虫发着微光，吃完后肚子暖亮亮的，今晚的冒险被记住了。';
}

function foodUnlockHint(type: FoodType) {
  if (type === 'grass') return '鸡还不会分辨嫩草，先把米粒吃够，清晨在窝边训练后再来。';
  if (type === 'bug') return '鸡还不敢啄蚯蚓，先把嫩草吃够，清晨训练翻土后再来。';
  if (type === 'nightBug') return '夜虫太怪了，先把蚯蚓吃够，清晨训练出灯和胆量之后再吃。';
  if (type === 'sunflower') return '瓜子要跟着养鸡人的手边啄，而且要啄两下。';
  if (type === 'meat') return '肉要啄松了才能吃。';
  return '这口还没学会怎么吃。';
}

function nutritionFor(food: FoodEntity) {
  const type = food.type;
  if (type === 'grain' && food.fromKeeper) return scaledNutritionGain(PREMIUM_FEED_NUTRITION_GAIN);
  if (type === 'grain') return scaledNutritionGain(3);
  if (type === 'grass') return scaledNutritionGain(2);
  if (type === 'bug' || type === 'worm') return scaledNutritionGain(5);
  if (type === 'cricket') return scaledNutritionGain(7);
  if (type === 'beetle') return scaledNutritionGain(10);
  if (type === 'berry') return scaledNutritionGain(6);
  if (type === 'sunflower') return scaledNutritionGain(SUNFLOWER_NUTRITION_GAIN);
  if (type === 'meat') return scaledNutritionGain(12);
  return scaledNutritionGain(13);
}

function scaledNutritionGain(gain: number) {
  return Math.max(1, Math.round(gain * FOOD_NUTRITION_GAIN_SCALE));
}

function foodDiscoveryEffect(type: ForagingFoodType, restored: number) {
  if (type === 'cricket') return `冲刺劲 +${restored}，野味会提高蛋的记忆。`;
  if (type === 'beetle') return `冲刺劲 +${restored}，很顶饱，蛋品质更容易变好。`;
  if (type === 'nightBug') return `冲刺劲 +${restored}，可能留下夜食蛋记忆。`;
  if (type === 'sunflower') return `冲刺劲 +${restored}，这是人给的特别好吃。`;
  return `冲刺劲 +${restored}`;
}

function foodHardness(type: FoodType) {
  if (type === 'cricket') return 2;
  if (type === 'beetle') return 3;
  if (type === 'nightBug') return 2;
  if (type === 'meat') return 3;
  return 1;
}

function hardFoodPeckMessage(type: FoodType, remaining: number) {
  if (type === 'cricket') return `蟋蟀啪地弹了一下，还要追上再啄 ${remaining} 下。`;
  if (type === 'beetle') return `甲虫壳很硬，还要再啄 ${remaining} 下才裂开。`;
  if (type === 'nightBug') return `夜虫在泥光里挣了一下，还要再啄 ${remaining} 下。`;
  return `猫留下的肉有点韧，还要再啄 ${remaining} 下。`;
}

function keeperLabel(state: GameState) {
  if (state.mode !== 'chicken') return '找蛋时间';
  if (state.keeper.doneFeeding) return '人已经回屋';
  if (!state.keeper.active) return '人还没出来';
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
