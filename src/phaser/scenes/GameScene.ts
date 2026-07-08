import Phaser from 'phaser';
import {
  BLOCKERS,
  COOP,
  COOP_DOOR,
  EGG_HIDE_AREAS,
  FOOD_SPAWN_POINTS,
  FLUTTER_TARGETS,
  HOUSE,
  HOUSE_PATH,
  MAIN_PATH,
  POND,
  PLANT_PATCHES,
  SAFE_LIGHTS,
  TREE_POSITIONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  distance,
  isBlocked,
  isInCoop,
  isNearPond,
  isOnPath,
} from '../../game/content/yard';
import { tutorialForAbility } from '../../game/content/abilityTutorials';
import { EGG_SPOTS, type EggSpot } from '../../game/content/eggSpots';
import {
  COOP_ROOF_POSITION,
  PREMIUM_FEED_POSITION,
  WATER_BASIN_POSITION,
  YARD_LAMP_POSITION,
  YARD_UPGRADES,
  isYardUpgradeId,
  type YardUpgradeId,
} from '../../game/content/yardUpgrades';
import { canUseAbility } from '../../game/systems/abilities';
import { DAY_ACTIVE_SECONDS, DUSK_AT, NIGHT_AT } from '../../game/systems/dayFlow';
import {
  createDuskCollectionState,
  visionRadiusFor,
} from '../../game/systems/duskCollection';
import {
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  loadSaveEnvelope,
  writeSaveEnvelope,
} from '../../game/persistence/saveGame';
import {
  advanceChickenHeat,
  advanceNightResult,
  applyCloseInteraction,
  applyFlowEvent,
  buildHudSnapshot,
  canRetryFinale,
  chickenSprintScaleForHeat,
  cluckAt,
  collectEgg,
  collectKeepsakeEgg,
  completeAbilityTutorial,
  continueFreePlay,
  createGameState,
  currentRelationshipStage,
  debugAddMaterials,
  debugJumpToDusk,
  debugSetDay,
  digHole,
  drinkAtWaterSource,
  dryRainSoakedChicken,
  expireFoods,
  finishChickenNight,
  improveCoopAbility,
  isFoodLockedByAnimal,
  isNearLight,
  isShadowy,
  peckFood,
  repairCoop,
  refillForagingFoods,
  refillWaterBasin,
  recoverStamina,
  restockEdibleFoods,
  restInHole,
  resolveWeaselOutcome,
  restoreFinaleState,
  restoreGameState,
  revealBuriedNightBug,
  setChickenName,
  servePremiumFeed,
  spawnScratchWorm,
  spendStamina,
  updateAnimals,
  updateKeeper,
  updateNightPressure,
  updateWaterBoost,
  updateWeatherExposure,
  updateIdleChickenWander,
  visibleFoods,
} from '../../game/simulation/state';
import type { FoodEntity, HoleEntity, Vec2, YardAnimal } from '../../game/simulation/state';
import type { InputActions } from '../../game/input/actions';
import { KeyboardState } from '../../game/input/keyboardState';
import { isForagingFood } from '../../game/systems/foraging';
import { touchOptionsFor, type TouchOption } from '../../game/systems/closeInteraction';
import { advanceEggSearch } from '../../game/systems/eggSearch';
import {
  FACILITY_IDLE_SECONDS,
  advanceFacilityActivity,
  buyUpgrade,
  ownedFacilityAt,
  startFacilityActivity,
} from '../../game/systems/yardUpgrades';
import {
  movementFamiliarityScale,
  recordRegionExploration,
  markTipShownForRegion,
} from '../../game/systems/yardFamiliarity';
import {
  createWeaselEncounter,
  isHumanBlocking,
  updateWeaselEncounter as advanceWeaselEncounter,
} from '../../game/systems/weaselEncounter';

type FoodView = Phaser.GameObjects.Image & { foodId: number };
type AnimalView = Phaser.GameObjects.Image & { animalId: number; animalType: YardAnimal['type'] };
type DebugAction =
  | { action: 'addMaterials' }
  | { action: 'jumpDusk' }
  | { action: 'setDay'; day: number }
  | { action: 'setAffection'; affection: number }
  | { action: 'skipPhase' }
  | { action: 'spawnWeasel' }
  | { action: 'clearSave' };

const VOLUME_STORAGE_KEY = 'chicken-life-master-volume';
const BASE_CAMERA_ZOOM = 1;
const DAY_BGM_KEY = 'bgm-day';
const NIGHT_BGM_KEY = 'bgm-night';
const DEFAULT_MASTER_VOLUME = 0.7;
const DAY_BGM_VOLUME = 0.36;
const NIGHT_BGM_VOLUME = 0.42;
const SFX_PECK_KEY = 'sfx-peck';
const SFX_DIG_KEY = 'sfx-dig';
const SFX_DRINK_KEY = 'sfx-drink';
const SFX_REWARD_KEY = 'sfx-reward';
const SFX_UPGRADE_KEY = 'sfx-upgrade';
const SFX_NIGHT_RUSTLE_KEY = 'sfx-night-rustle';
const CHICKEN_WALK_MOVE_EPSILON = 0.04;
const CHICKEN_WALK_TELEPORT_DISTANCE = 28;
const HOLE_REST_RADIUS = 36;
const CLOSE_INTERACTION_RANGE = 74;
const EGG_PICKUP_RANGE = 76;
const EGG_SHAPE_REVEAL_RANGE = 112;
const EGG_SHAPE_ALPHA = 0.68;
const CLOSE_INTERACTION_DURATION = 4800;
const CLOSE_INTERACTION_REDUCED_DURATION = 720;
const GAMEPLAY_KEY_CODES = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ShiftLeft',
  'ShiftRight',
  'Space',
  'KeyE',
  'KeyF',
  'Enter',
]);
const SFX_CLUCK_KEYS = [
  'sfx-cluck-1',
  'sfx-cluck-2',
  'sfx-cluck-3',
  'sfx-cluck-4',
  'sfx-cluck-5',
  'sfx-cluck-6',
] as const;
const PUBLIC_BASE_URL = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';

function publicAsset(path: string) {
  return `${PUBLIC_BASE_URL}${path}`;
}

function loadSavedGameState() {
  const result = loadSaveEnvelope(window.localStorage);
  return result.kind === 'loaded' ? restoreGameState(result.state) : createGameState();
}

function loadSavedMasterVolume() {
  try {
    const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw === null || raw.trim() === '') return DEFAULT_MASTER_VOLUME;
    const saved = Number(raw);
    return Number.isFinite(saved) ? clampMasterVolume(saved / 100) : DEFAULT_MASTER_VOLUME;
  } catch {
    return DEFAULT_MASTER_VOLUME;
  }
}

function clampMasterVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MASTER_VOLUME;
  return Math.max(0, Math.min(1, value));
}

export class GameScene extends Phaser.Scene {
  private state = loadSavedGameState();
  private keyboardState = new KeyboardState();
  private chicken!: Phaser.GameObjects.Image;
  private human!: Phaser.GameObjects.Image;
  private keeper!: Phaser.GameObjects.Image;
  private weasel!: Phaser.GameObjects.Image;
  private nightVeil!: Phaser.GameObjects.Graphics;
  private weatherOverlay!: Phaser.GameObjects.Graphics;
  private rainView!: Phaser.GameObjects.Graphics;
  private chickenBodyFx!: Phaser.GameObjects.Graphics;
  private foodViews = new Map<number, FoodView>();
  private holeViews = new Map<number, Phaser.GameObjects.Graphics>();
  private animalViews = new Map<number, AnimalView>();
  private eggView: Phaser.GameObjects.Container | null = null;
  private eggClueView: Phaser.GameObjects.Graphics | null = null;
  private eggClueSpotId: string | null = null;
  private duskSeedViews = new Map<number, Phaser.GameObjects.Image>();
  private yardUpgradeGraphics!: Phaser.GameObjects.Graphics;
  private coopDoorInterior!: Phaser.GameObjects.Rectangle;
  private coopDoorPanel!: Phaser.GameObjects.Rectangle;
  private humanLanternGlow!: Phaser.GameObjects.Arc;
  private handLanternAim!: Phaser.GameObjects.Arc;
  private duskVisionRing!: Phaser.GameObjects.Arc;
  private yardLampGlow!: Phaser.GameObjects.Arc;
  private houseResponseLight: Phaser.GameObjects.Arc | null = null;
  private lastHudAt = 0;
  private nightResultTimer = 0;
  private peckCooldown = 0;
  private digCooldown = 0;
  private scratchProgress = 0;
  private drinkSfxCooldown = 0;
  private caughtCooldown = 0;
  private eggClueSoundCooldown = 0;
  private eggDirectionTimer = 0;
  private rustleSfxCooldown = 0;
  private nightAmbienceCooldown = 0;
  private humanFacingDirection: Vec2 = { x: 0, y: 1 };
  private chickenLiftTimer = 0;
  private chickenWalkPhase = 0;
  private chickenWalkBlend = 0;
  private lastChickenPosition: Vec2 | null = null;
  private duskCollection = createDuskCollectionState();
  private lastSavedAt = 0;
  private lastNightVeilAt = 0;
  private dayMusic: Phaser.Sound.BaseSound | null = null;
  private nightMusic: Phaser.Sound.BaseSound | null = null;
  private activeMusic: 'day' | 'night' | null = null;
  private musicUnlocked = false;
  private masterVolume = loadSavedMasterVolume();
  private recentCluckSfx: string[] = [];
  private closeInteractionOpen = false;
  private closeInteractionAnimating = false;
  private closeInteractionTimer: Phaser.Time.TimerEvent | null = null;
  private yardPanelOpen = false;
  private finaleRetryOpen = false;

  private handleGameplayKeyDown = (event: KeyboardEvent) => {
    if (
      this.closeInteractionOpen ||
      this.yardPanelOpen ||
      !this.state.profile.named ||
      isTextEntryTarget(event.target)
    ) {
      return;
    }
    if (!GAMEPLAY_KEY_CODES.has(event.code)) return;
    this.keyboardState.keyDown(event.code, event.repeat);
    event.preventDefault();
  };

  private handleGameplayKeyUp = (event: KeyboardEvent) => {
    if (
      this.closeInteractionOpen ||
      this.yardPanelOpen ||
      !this.state.profile.named ||
      isTextEntryTarget(event.target)
    ) {
      return;
    }
    if (!GAMEPLAY_KEY_CODES.has(event.code)) return;
    this.keyboardState.keyUp(event.code);
    event.preventDefault();
  };

  private resetGameplayKeys = () => {
    this.keyboardState.reset();
  };

  private handleVisibilityChange = () => {
    if (document.hidden) this.resetGameplayKeys();
  };

  private handleNameConfirmed = (event: Event) => {
    const name = String((event as CustomEvent<{ name?: unknown }>).detail?.name ?? '');
    setChickenName(this.state, name);
    this.resetGameplayKeys();
    this.emitHud(true, true);
  };

  private handleCloseInteractionComplete = (event: Event) => {
    if (!this.closeInteractionOpen || this.closeInteractionAnimating) return;
    const detail = (event as CustomEvent<{ food?: unknown; touch?: unknown }>).detail;
    const food = typeof detail?.food === 'string' ? detail.food : '';
    const touch = detail?.touch === null ? null : detail?.touch;
    if (!isForagingFood(food) || !isTouchOptionOrNull(touch)) return;

    const accepted = applyCloseInteraction(this.state, food, touch);
    this.closeInteractionAnimating = true;
    this.resetGameplayKeys();
    this.saveGame(true);
    window.dispatchEvent(
      new CustomEvent('chicken-life:close-play', {
        detail: { accepted, touch: accepted ? touch : null },
      }),
    );

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = accepted
      ? reducedMotion
        ? CLOSE_INTERACTION_REDUCED_DURATION
        : CLOSE_INTERACTION_DURATION
      : reducedMotion
        ? 420
        : 1450;
    if (accepted) this.scheduleCloseInteractionPecks(reducedMotion);
    this.closeInteractionTimer = this.time.delayedCall(duration, () => {
      this.closeInteractionOpen = false;
      this.closeInteractionAnimating = false;
      this.closeInteractionTimer = null;
      window.dispatchEvent(new CustomEvent('chicken-life:close-close'));
      if (accepted && touch) this.showHeartFx(this.state.chicken);
      this.emitHud(true, true);
    });
  };

  private handleYardPanelOpen = () => {
    this.yardPanelOpen = true;
    this.resetGameplayKeys();
  };

  private handleYardPanelClose = () => {
    this.yardPanelOpen = false;
    this.resetGameplayKeys();
  };

  private handleFinaleRetry = () => {
    const checkpointJson = this.state.finaleCheckpointJson;
    if (!checkpointJson) return;
    this.state = restoreFinaleState(checkpointJson);
    this.finaleRetryOpen = false;
    this.duskCollection = createDuskCollectionState();
    this.clearDuskSeedViews();
    this.clearHouseResponseLight();
    this.resetGameplayKeys();
    this.rebuildWorldFromState();
    this.emitHud(true, true);
  };

  private handleEndingContinue = () => {
    if (!continueFreePlay(this.state)) return;
    this.duskCollection = createDuskCollectionState();
    this.clearDuskSeedViews();
    this.clearHouseResponseLight();
    this.resetGameplayKeys();
    this.rebuildWorldFromState();
    this.emitHud(true, true);
  };

  private handleBuyUpgrade = (event: Event) => {
    const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
    if (!isYardUpgradeId(id)) return;
    if (this.state.flow.phase !== 'morning-human') {
      this.state.message = '院子道具只能在清晨由人购买和安装。';
      this.emitHud(true, true);
      return;
    }
    const upgrade = YARD_UPGRADES.find((item) => item.id === id);
    if (!upgrade || !buyUpgrade(this.state.yard, id)) {
      this.state.message = upgrade
        ? `购买${upgrade.name}需要 ${upgrade.cost} 点院子预算。`
        : '这项修缮现在还不能进行。';
      this.emitHud(true, true);
      return;
    }
    if (id === 'water-basin') refillWaterBasin(this.state);
    this.drawOwnedYardUpgrades();
    this.playSfx(SFX_UPGRADE_KEY, 0.58);
    this.state.message =
      id === 'water-basin'
        ? `${upgrade.name}放好了，也已经装满清水。`
        : `${upgrade.name}准备好了，院子里多了一处新变化。`;
    this.emitHud(true, true);
  };

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.audio(DAY_BGM_KEY, publicAsset('audio/bgm-day.mp3'));
    this.load.audio(NIGHT_BGM_KEY, publicAsset('audio/bgm-night.mp3'));
    this.load.audio(SFX_PECK_KEY, publicAsset('audio/sfx-peck.mp3'));
    this.load.audio(SFX_DIG_KEY, publicAsset('audio/sfx-dig.mp3'));
    this.load.audio(SFX_DRINK_KEY, publicAsset('audio/sfx-drink.mp3'));
    this.load.audio(SFX_REWARD_KEY, publicAsset('audio/sfx-reward.mp3'));
    this.load.audio(SFX_UPGRADE_KEY, publicAsset('audio/sfx-upgrade.mp3'));
    this.load.audio(SFX_NIGHT_RUSTLE_KEY, publicAsset('audio/sfx-night-rustle.mp3'));
    for (const key of SFX_CLUCK_KEYS) {
      this.load.audio(key, publicAsset(`audio/${key}.mp3`));
    }
  }

  private handleDebugEvent = (event: Event) => {
    const detail = (event as CustomEvent<DebugAction>).detail;
    if (!detail) return;

    if (detail.action === 'setDay') {
      debugSetDay(this.state, detail.day);
      this.duskCollection = createDuskCollectionState();
      this.clearDuskSeedViews();
      this.clearHouseResponseLight();
      this.resetGameplayKeys();
      this.rebuildWorldFromState();
      this.emitHud(true, true);
      return;
    }
    if (detail.action === 'setAffection') {
      this.state.affection = Phaser.Math.Clamp(
        Number.isFinite(detail.affection) ? Math.round(detail.affection) : this.state.affection,
        0,
        100,
      );
      this.state.message = `调试：当前亲密度 ${this.state.affection}。`;
      this.emitHud(true, true);
      return;
    }
    if (detail.action === 'skipPhase') {
      this.skipDebugPhase();
      return;
    }
    if (detail.action === 'addMaterials') debugAddMaterials(this.state);
    if (detail.action === 'jumpDusk') {
      debugJumpToDusk(this.state);
      this.duskCollection = createDuskCollectionState();
      this.clearDuskSeedViews();
      this.clearHouseResponseLight();
      this.syncCoopDoorView();
    }
    if (detail.action === 'spawnWeasel') {
      if (
        this.state.flow.phase === 'chicken-dusk' ||
        this.state.flow.phase === 'chicken-night'
      ) {
        this.spawnWeasel(true);
        this.state.message = '调试：院墙边出现了黄鼠狼的动静。';
      } else {
        this.state.message = '调试：只有黄昏或夜间才能生成黄鼠狼。';
      }
    }
    if (detail.action === 'clearSave') {
      try {
        window.localStorage.removeItem(SAVE_KEY);
        window.localStorage.removeItem(LEGACY_SAVE_KEY);
      } catch {
        // Saving can be unavailable in restricted browser modes; the warning is shown by the HUD.
      }
      this.state = createGameState();
      this.rebuildWorldFromState();
      this.state.message = '调试：存档已清空，重新开始。';
    }

    this.emitHud(true);
    this.saveGame(true);
  };

  private skipDebugPhase() {
    const phase = this.state.flow.phase;
    if (phase === 'morning-human') {
      if (this.state.egg && !this.state.egg.found) collectEgg(this.state);
      if (!this.state.flow.morningEggFound) applyFlowEvent(this.state, { type: 'egg-found' });
      applyFlowEvent(this.state, { type: 'return-home' });
      this.state.message = '调试：已跳过清晨，进入鸡的白天。';
      this.switchToChicken();
      return;
    }
    if (phase === 'chicken-day') {
      debugJumpToDusk(this.state);
      this.duskCollection = createDuskCollectionState();
      this.clearDuskSeedViews();
      this.clearHouseResponseLight();
      this.syncCoopDoorView();
      this.emitHud(true, true);
      return;
    }
    if (phase === 'chicken-dusk') {
      applyFlowEvent(this.state, { type: 'tick', amount: 1 });
      this.state.message = '调试：已跳到夜间冒险。';
      this.emitHud(true, true);
      return;
    }
    if (phase === 'chicken-night') {
      finishChickenNight(this.state, false);
      this.nightResultTimer = 0.2;
      this.chicken.setVisible(false);
      this.syncCoopDoorView();
      this.state.message = '调试：鸡已自行回窝，进入夜间结算。';
      this.emitHud(true, true);
      return;
    }
    if (phase === 'dusk-human') {
      if (this.state.weaselEncounter) resolveWeaselOutcome(this.state, 'safe');
      this.state.flow.phase = 'chicken-dusk';
      this.state.mode = 'chicken';
      this.state.phase = 'dusk';
      finishChickenNight(this.state, false);
      this.nightResultTimer = 0.2;
      this.chicken.setVisible(false);
      this.clearDuskSeedViews();
      this.syncCoopDoorView();
      this.state.message = '调试：鸡已自行回窝，进入夜间结算。';
      this.emitHud(true, true);
      return;
    }
    if (phase === 'night-result') {
      advanceNightResult(this.state);
      this.state.message = '调试：已跳过夜间结算。';
      this.switchToHuman();
      return;
    }
    if (phase === 'epilogue-human') {
      collectKeepsakeEgg(this.state);
      this.clearEggClueView();
      this.emitHud(true, true);
      return;
    }
    if (phase === 'ending' && continueFreePlay(this.state)) {
      this.rebuildWorldFromState();
      this.emitHud(true, true);
    }
  }

  private handleVolumeEvent = (event: Event) => {
    const volume = Number((event as CustomEvent<{ volume?: number }>).detail?.volume);
    this.masterVolume = clampMasterVolume(volume);
    this.applyMasterVolume();
  };

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(BASE_CAMERA_ZOOM);
    window.addEventListener('keydown', this.handleGameplayKeyDown, { capture: true });
    window.addEventListener('keyup', this.handleGameplayKeyUp, { capture: true });
    window.addEventListener('blur', this.resetGameplayKeys);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.createGeneratedTextures();
    this.drawYard();
    this.yardUpgradeGraphics = this.add.graphics().setDepth(36);
    this.drawOwnedYardUpgrades();
    this.createFoodViews();
    this.createHoleViews();
    this.chicken = this.createChickenSprite(this.state.chicken);
    this.chickenBodyFx = this.add.graphics().setDepth(66);
    this.human = this.createHumanSprite(this.state.human);
    this.human.setVisible(false);
    this.keeper = this.createKeeperSprite(this.state.keeper);
    this.weasel = this.createWeaselSprite(this.state.weasel);
    this.weatherOverlay = this.add.graphics().setDepth(94);
    this.nightVeil = this.add.graphics().setDepth(95);
    this.rainView = this.add.graphics().setDepth(97);
    this.createHomecomingViews();
    this.setupMusic();
    window.addEventListener('chicken-life:debug', this.handleDebugEvent);
    window.addEventListener('chicken-life:volume', this.handleVolumeEvent);
    window.addEventListener('chicken-life:name-confirmed', this.handleNameConfirmed);
    window.addEventListener('chicken-life:close-complete', this.handleCloseInteractionComplete);
    window.addEventListener('chicken-life:yard-panel-open', this.handleYardPanelOpen);
    window.addEventListener('chicken-life:yard-panel-close', this.handleYardPanelClose);
    window.addEventListener('chicken-life:buy-upgrade', this.handleBuyUpgrade);
    window.addEventListener('chicken-life:finale-retry', this.handleFinaleRetry);
    window.addEventListener('chicken-life:ending-continue', this.handleEndingContinue);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('chicken-life:debug', this.handleDebugEvent);
      window.removeEventListener('chicken-life:volume', this.handleVolumeEvent);
      window.removeEventListener('chicken-life:name-confirmed', this.handleNameConfirmed);
      window.removeEventListener('chicken-life:close-complete', this.handleCloseInteractionComplete);
      window.removeEventListener('chicken-life:yard-panel-open', this.handleYardPanelOpen);
      window.removeEventListener('chicken-life:yard-panel-close', this.handleYardPanelClose);
      window.removeEventListener('chicken-life:buy-upgrade', this.handleBuyUpgrade);
      window.removeEventListener('chicken-life:finale-retry', this.handleFinaleRetry);
      window.removeEventListener('chicken-life:ending-continue', this.handleEndingContinue);
      window.removeEventListener('keydown', this.handleMusicUnlock);
      window.removeEventListener('keydown', this.handleGameplayKeyDown, { capture: true });
      window.removeEventListener('keyup', this.handleGameplayKeyUp, { capture: true });
      window.removeEventListener('blur', this.resetGameplayKeys);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.input.off('pointerdown', this.handleMusicUnlock);
      this.dayMusic?.stop();
      this.nightMusic?.stop();
      this.closeInteractionTimer?.remove(false);
    });
    this.applySceneViewFromState();
    if (canRetryFinale(this.state)) this.showFinaleRetry();
    this.updateWeatherView(0);
    this.emitHud(true);
  }

  update(time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (!this.state.profile.named) {
      this.updateSprites(dt);
      this.updateWeatherView(time);
      return;
    }

    if (this.closeInteractionOpen || this.yardPanelOpen || this.finaleRetryOpen) {
      this.resetGameplayKeys();
      this.updateSprites(0);
      this.updateWeatherView(time);
      this.updateMusic();
      return;
    }

    if (this.state.flow.phase === 'night-result') {
      this.nightResultTimer = Math.max(0, this.nightResultTimer - dt);
      if (this.nightResultTimer === 0) {
        advanceNightResult(this.state);
        this.switchToHuman();
      }
      this.updateSprites(dt);
      this.updateWeatherView(time);
      return;
    }

    const actions = this.readActions();
    this.peckCooldown = Math.max(0, this.peckCooldown - dt);
    this.digCooldown = Math.max(0, this.digCooldown - dt);
    this.drinkSfxCooldown = Math.max(0, this.drinkSfxCooldown - dt);
    this.caughtCooldown = Math.max(0, this.caughtCooldown - dt);
    this.chickenLiftTimer = Math.max(0, this.chickenLiftTimer - dt);

    const storyPhase = this.state.flow.phase;
    if (
      storyPhase === 'morning-human' ||
      storyPhase === 'dusk-human' ||
      storyPhase === 'epilogue-human'
    ) {
      this.updateHuman(dt, actions);
    } else if (
      storyPhase === 'chicken-day' ||
      storyPhase === 'chicken-dusk' ||
      storyPhase === 'chicken-night'
    ) {
      this.updateChicken(dt, actions);
    }

    this.updateAmbientNightCues(dt);
    this.updateSprites(dt);
    this.updateWeatherView(time);
    this.updateNightVeil(time);
    this.updateMusic();

    if (time - this.lastHudAt > 240) {
      this.emitHud();
      this.lastHudAt = time;
    }
  }

  private readActions(): InputActions {
    const arrowLeftPressed = this.keyboardState.consumePress('ArrowLeft');
    const arrowRightPressed = this.keyboardState.consumePress('ArrowRight');
    const arrowUpPressed = this.keyboardState.consumePress('ArrowUp');
    const arrowDownPressed = this.keyboardState.consumePress('ArrowDown');
    const aPressed = this.keyboardState.consumePress('KeyA');
    const dPressed = this.keyboardState.consumePress('KeyD');
    const wPressed = this.keyboardState.consumePress('KeyW');
    const sPressed = this.keyboardState.consumePress('KeyS');
    const leftPressed = arrowLeftPressed || aPressed;
    const rightPressed = arrowRightPressed || dPressed;
    const upPressed = arrowUpPressed || wPressed;
    const downPressed = arrowDownPressed || sPressed;
    const left =
      leftPressed || this.keyboardState.isDown('ArrowLeft') || this.keyboardState.isDown('KeyA');
    const right =
      rightPressed || this.keyboardState.isDown('ArrowRight') || this.keyboardState.isDown('KeyD');
    const up = upPressed || this.keyboardState.isDown('ArrowUp') || this.keyboardState.isDown('KeyW');
    const down =
      downPressed || this.keyboardState.isDown('ArrowDown') || this.keyboardState.isDown('KeyS');
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
    };
  }

  private updateChicken(dt: number, actions: InputActions) {
    let actionSeconds = 0;
    let diggingSeconds = 0;
    let huntingSeconds = 0;
    let holeRestSeconds = 0;
    let pausedOtherMovementSeconds = 0;
    let heatFreeActionSeconds = 0;
    this.expireAndSyncFoods();
    if (
      this.state.facilityLife.activity === 'hole-rest' &&
      (!actions.scratchHeld || actions.x !== 0 || actions.y !== 0)
    ) {
      this.state.facilityLife.activity = null;
      this.state.facilityLife.activitySeconds = 0;
      this.state.facilityLife.needsMovement = false;
      this.state.message = '鸡从坑里站起来，抖了抖羽毛。';
    }
    if (this.state.facilityLife.activity && this.state.facilityLife.activity !== 'hole-rest') {
      const activeSeconds = dt * 0.72;
      const completed = advanceFacilityActivity(this.state.facilityLife, dt);
      if (completed) {
        this.state.message = completed.firstToday
          ? '鸡舒舒服服地活动完，这段小院生活被记住了。'
          : '鸡伸了伸翅膀，又精神起来。';
        this.saveGame(true);
      }
      this.updateMovingFoods(activeSeconds);
      if (updateWeatherExposure(this.state, activeSeconds)) {
        this.state.message = '雨水把泥地打湿了，鸡爪和腹羽都沾上了一点泥。';
      }
      advanceChickenHeat(this.state, activeSeconds, {
        sprinting: false,
        moving: false,
        inShade: this.state.facilityLife.activity === 'shade-rest',
        drinking: false,
        raining: this.state.weather === 'rain',
        night: this.state.flow.phase === 'chicken-night',
      });
      this.advanceChickenWorld(activeSeconds);
      this.updateKeeperFeeding(activeSeconds);
      this.updateChickenPressure(activeSeconds);
      this.updateRealtimeThreats(dt);
      return;
    }
    if (this.state.body.fluttering) {
      const activeSeconds = dt * 0.35;
      this.updateMovingFoods(activeSeconds);
      if (updateWeatherExposure(this.state, activeSeconds)) {
        this.state.message = '雨水把泥地打湿了，鸡爪和腹羽都沾上了一点泥。';
      }
      advanceChickenHeat(this.state, activeSeconds, {
        sprinting: true,
        moving: true,
        inShade: false,
        drinking: false,
        raining: this.state.weather === 'rain',
        night: this.state.flow.phase === 'chicken-night',
      });
      this.advanceChickenWorld(activeSeconds);
      this.updateKeeperFeeding(activeSeconds);
      this.updateChickenPressure(activeSeconds);
      this.updateRealtimeThreats(dt);
      return;
    }
    if (
      actions.interactPressed &&
      (this.state.flow.phase === 'chicken-dusk' ||
        this.state.flow.phase === 'chicken-night') &&
      this.isAtCoopDoor()
    ) {
      if (finishChickenNight(this.state, false)) {
        this.nightResultTimer = 2.1;
        this.chicken.setVisible(false);
        this.weasel.setVisible(false);
        this.syncCoopDoorView();
        this.emitHud(true, true);
      }
      return;
    }
    const direction = normalize(actions.x, actions.y);
    const hasMove = direction.x !== 0 || direction.y !== 0;
    const sprintTutorial = this.state.activeAbilityTutorial === 'sprint';
    const tutorialPoint = tutorialForAbility('sprint')!.position!;
    const atSprintTutorial = sprintTutorial && distance(this.state.chicken, tutorialPoint) < 105;
    const canSprint =
      (canUseAbility(this.state.profile, 'sprint') || atSprintTutorial) &&
      actions.sprintHeld &&
      this.state.foraging.sprintEnergy > 0 &&
      hasMove;
    const speed =
      this.state.body.walkSpeed *
      (canSprint
        ? this.state.body.sprintMultiplier * chickenSprintScaleForHeat(this.state)
        : 1) *
      (isOnPath(this.state.chicken) ? 1.06 : 1) *
      movementFamiliarityScale(this.state.yardFamiliarity, this.state.chicken);

    if (hasMove) {
      const target = {
        x: this.state.chicken.x + direction.x * speed * dt,
        y: this.state.chicken.y + direction.y * speed * dt,
      };
      if (!isBlocked(target, 18)) {
        this.state.chicken = target;
        actionSeconds += dt * (canSprint ? 1.25 : 0.78);
      }
      this.chicken.scaleX = direction.x < -0.05 ? -1 : direction.x > 0.05 ? 1 : this.chicken.scaleX;
      this.state.facilityLife.idleSeconds = 0;
      this.state.facilityLife.needsMovement = false;
      this.state.facilityLife.dustBathReady = false;
    }
    if (canSprint) {
      this.state.foraging.sprintEnergy = Math.max(0, this.state.foraging.sprintEnergy - 30 * dt);
      if (atSprintTutorial && completeAbilityTutorial(this.state, 'sprint')) {
        this.playSfx(SFX_UPGRADE_KEY, 0.62);
        this.saveGame(true);
      }
    } else {
      this.state.foraging.sprintEnergy = Math.min(
        this.state.foraging.maxSprintEnergy,
        this.state.foraging.sprintEnergy + 7 * dt,
      );
    }

    const drinking = actions.scratchHeld && drinkAtWaterSource(this.state, dt);
    if (drinking) {
      actionSeconds += dt;
      this.scratchProgress = 0;
      this.showDrinkRipples(this.state.chicken);
      if (distance(this.state.chicken, WATER_BASIN_POSITION) < 64) {
        this.drawOwnedYardUpgrades();
      }
      if (this.drinkSfxCooldown <= 0) {
        this.playSfx(SFX_DRINK_KEY, 0.42);
        this.drinkSfxCooldown = 0.55;
      }
    } else {
      const restingHole = actions.scratchHeld && !hasMove ? this.nearestHole(HOLE_REST_RADIUS) : null;
      if (restingHole) {
        holeRestSeconds = this.handleHeldHoleRest(dt, restingHole);
        actionSeconds += holeRestSeconds;
        this.scratchProgress = 0;
      } else {
        const handled = this.handleChickenActions(dt, actions);
        actionSeconds += handled.actionSeconds;
        diggingSeconds += handled.diggingSeconds;
        huntingSeconds += handled.huntingSeconds;
        pausedOtherMovementSeconds += handled.pausedOtherMovementSeconds;
        heatFreeActionSeconds += handled.heatFreeActionSeconds;
      }
    }
    if (!this.state.facilityLife.activity) this.updateFacilityIdle(dt, hasMove);

    const inShade =
      isShadowy(this.state.chicken) ||
      ownedFacilityAt(this.state.yard, this.state.chicken) === 'shade-shelter' ||
      holeRestSeconds > 0;
    if (actionSeconds > 0) {
      const movingWorldSeconds = Math.max(0, actionSeconds - pausedOtherMovementSeconds);
      if (hasMove) {
        const explored = recordRegionExploration(
          this.state.yardFamiliarity,
          this.state.chicken,
          actionSeconds,
          this.state.flow.day,
        );
        if (explored.canShowTip) {
          const tipMsgs: Record<string, string> = {
            'pond-bank': '鸡伸长脖子，歪着头听池塘边的水声。',
            'tree-shade': '鸡在树荫下停了一下，警惕地四处张望。',
            'coop-yard': '鸡在鸡舍附近踱步，不时回头看看。',
            'outer-growth': '鸡钻进杂草丛，小心翼翼地探路。',
            'main-path': '鸡在小路上站定，确认四周安全。',
            'house-yard': '鸡靠近屋子，谨慎地打量着这片区域。',
          };
          const tip = tipMsgs[explored.region];
          if (tip && !this.state.message) {
            this.state.message = tip;
          }
          markTipShownForRegion(this.state.yardFamiliarity, explored.region);
        }
      }
      this.updateMovingFoods(movingWorldSeconds);
      if (updateWeatherExposure(this.state, actionSeconds)) {
        this.state.message = '雨水把泥地打湿了，鸡爪和腹羽都沾上了一点泥。';
      }
      const heatSeconds = Math.max(
        0,
        actionSeconds -
          (drinking ? dt : 0) -
          diggingSeconds -
          huntingSeconds -
          holeRestSeconds -
          heatFreeActionSeconds,
      );
      if (heatSeconds > 0) {
        advanceChickenHeat(this.state, heatSeconds, {
          sprinting: canSprint,
          moving: hasMove,
          inShade,
          drinking: false,
          raining: this.state.weather === 'rain',
          night: this.state.flow.phase === 'chicken-night',
        });
      }
      if (diggingSeconds > 0) {
        advanceChickenHeat(this.state, diggingSeconds, {
          sprinting: false,
          moving: true,
          inShade: false,
          drinking: false,
          raining: this.state.weather === 'rain',
          night: this.state.flow.phase === 'chicken-night',
        });
      }
      if (huntingSeconds > 0) {
        advanceChickenHeat(this.state, huntingSeconds, {
          sprinting: false,
          moving: true,
          inShade: false,
          drinking: false,
          raining: this.state.weather === 'rain',
          night: this.state.flow.phase === 'chicken-night',
        });
      }

      this.advanceChickenWorld(actionSeconds);
      this.updateKeeperFeeding(movingWorldSeconds);
      this.updateWeaselApproach(actionSeconds, canSprint, diggingSeconds + huntingSeconds);
      this.updateChickenPressure(actionSeconds);
    }
    if (this.updateRealtimeThreats(dt)) return;
  }

  private updateChickenPressure(dt: number) {
    if (
      this.state.flow.phase !== 'chicken-dusk' &&
      this.state.flow.phase !== 'chicken-night'
    ) {
      return;
    }
    const relief = updateNightPressure(this.state, {
      dt,
      position: this.state.chicken,
      staminaRatio:
        this.state.foraging.sprintEnergy / this.state.foraging.maxSprintEnergy,
      inShadow: isShadowy(this.state.chicken),
      onPath: isOnPath(this.state.chicken),
      nearCoop: this.isAtCoopDoor(),
      nearLight: isNearLight(
        this.state.chicken,
        this.state.stats.lamp,
        this.state.yard.owned.includes('yard-lamp'),
      ),
    });
    if (relief > 0) this.playSfx(SFX_REWARD_KEY, 0.32);
  }

  private updateAmbientNightCues(dt: number) {
    const phase = this.state.flow.phase;
    const active = phase === 'chicken-dusk' || phase === 'chicken-night';
    if (!active || this.state.weaselEncounter) {
      this.nightAmbienceCooldown = 0;
      return;
    }

    this.nightAmbienceCooldown = Math.max(0, this.nightAmbienceCooldown - dt);
    if (this.nightAmbienceCooldown > 0) return;

    const point = this.pickNightAmbiencePoint();
    if (point) {
      this.showNightAmbienceFx(point);
      this.playSfx(SFX_NIGHT_RUSTLE_KEY, phase === 'chicken-night' ? 0.15 : 0.09);
    }
    this.nightAmbienceCooldown =
      phase === 'chicken-night'
        ? Phaser.Math.FloatBetween(4.2, 7.5)
        : Phaser.Math.FloatBetween(6.5, 11);
  }

  private pickNightAmbiencePoint(): Vec2 {
    const buriedBugs = this.state.foods.filter(
      (food) =>
        food.type === 'nightBug' &&
        food.buried &&
        this.state.time >= food.visibleAt &&
        distance(food, this.state.chicken) > 110,
    );
    if (buriedBugs.length > 0) {
      const food = buriedBugs[Phaser.Math.Between(0, buriedBugs.length - 1)];
      return {
        x: Phaser.Math.Clamp(food.x + Phaser.Math.Between(-18, 18), 36, WORLD_WIDTH - 36),
        y: Phaser.Math.Clamp(food.y + Phaser.Math.Between(-14, 14), 36, WORLD_HEIGHT - 36),
      };
    }

    let point = this.randomEdgePoint();
    for (let i = 0; i < 7; i += 1) {
      const candidate = this.randomEdgePoint();
      if (distance(candidate, this.state.chicken) > distance(point, this.state.chicken)) {
        point = candidate;
      }
    }
    return point;
  }

  private handleHeldHoleRest(dt: number, hole: HoleEntity) {
    const activeSeconds = dt * 0.72;
    if (this.state.facilityLife.activity !== 'hole-rest') {
      this.state.message = '鸡趴进自己刨过的坑里。松开 E 就会站起来。';
      if (completeAbilityTutorial(this.state, 'scratch')) {
        this.playSfx(SFX_UPGRADE_KEY, 0.62);
        this.saveGame(true);
      }
    }
    this.state.facilityLife.activity = 'hole-rest';
    this.state.facilityLife.activitySeconds = 0;
    this.state.facilityLife.idleSeconds = 0;
    this.state.facilityLife.dustBathReady = false;
    this.state.facilityLife.needsMovement = false;
    restInHole(this.state, hole, activeSeconds);
    this.refreshHoleView(hole);
    this.showRestPuffs(hole);
    return activeSeconds;
  }

  private handleChickenActions(dt: number, actions: InputActions) {
    let actionSeconds = 0;
    let diggingSeconds = 0;
    let huntingSeconds = 0;
    let pausedOtherMovementSeconds = 0;
    let heatFreeActionSeconds = 0;
    const scratchTutorial = this.state.activeAbilityTutorial === 'scratch';
    const onScratchableGround = this.isScratchableGround(this.state.chicken);
    const buriedNightBug = this.nearestBuriedNightBug(70);
    const canScratchHere =
      !!buriedNightBug ||
      ((canUseAbility(this.state.profile, 'scratch') || scratchTutorial) && onScratchableGround);

    if (actions.scratchHeld && canScratchHere && this.digCooldown <= 0) {
      this.scratchProgress += dt;
      actionSeconds += dt * 1.4;
      diggingSeconds += dt * 1.4;
      if (this.scratchProgress >= 0.65) {
        let dugHole: HoleEntity | null = null;
        if (buriedNightBug && revealBuriedNightBug(this.state, buriedNightBug)) {
          this.refreshFoodView(buriedNightBug);
        } else {
          const hole = digHole(this.state, {
            x: this.state.chicken.x,
            y: this.state.chicken.y + 12,
          });
          dugHole = hole;
          if (hole) {
            this.refreshHoleView(hole);
            this.showScratchDirtFx(hole);
          }
          const holeMessage = hole ? this.state.message : '';
          const canFindWorm = hole && hole.depth === 1 && Math.random() < 0.38;
          if (canFindWorm) {
            const worm = spawnScratchWorm(this.state, {
              x: this.state.chicken.x + (this.chicken.scaleX >= 0 ? 24 : -24),
              y: this.state.chicken.y + 10,
            });
            if (holeMessage) this.state.message = `${holeMessage} 旁边还翻出了一条蚯蚓。`;
            this.foodViews.set(worm.id, this.createFoodView(worm));
          }
        }
        this.scratchProgress = 0;
        this.digCooldown = 2.2;
        this.playSfx(SFX_DIG_KEY, 0.54);
        this.cameras.main.shake(70, 0.002);
        if (scratchTutorial && dugHole) {
          this.state.message = '坑刨好了。站在坑边按住 E，鸡会趴进去休息、降温。';
        }
      }
      return {
        actionSeconds,
        diggingSeconds,
        huntingSeconds,
        pausedOtherMovementSeconds,
        heatFreeActionSeconds,
      };
    }
    if (!actions.scratchHeld) this.scratchProgress = 0;

    if (actions.flutterPressed) {
      const target = this.nearestFlutterTarget(72);
      const isTutorialTarget =
        this.state.activeAbilityTutorial === 'flutter' &&
        !!target &&
        distance(target, tutorialForAbility('flutter')!.position!) < 2;
      if (target && (canUseAbility(this.state.profile, 'flutter') || isTutorialTarget)) {
        this.performFlutter(target);
        if (isTutorialTarget && completeAbilityTutorial(this.state, 'flutter')) {
          this.playSfx(SFX_UPGRADE_KEY, 0.62);
          this.saveGame(true);
        }
        return {
          actionSeconds: 2.2,
          diggingSeconds,
          huntingSeconds,
          pausedOtherMovementSeconds,
          heatFreeActionSeconds,
        };
      }
      this.state.message = canUseAbility(this.state.profile, 'flutter')
        ? '这里没有适合扑翅跳上的矮桩。'
        : '翅膀还没找到发力的感觉。';
    }

    if (actions.peckPressed && this.peckCooldown <= 0) {
      const food = this.nearestFood(40);
      if (food) {
        const result = peckFood(this.state, food);
        if (result === 'eaten') {
          this.foodViews.get(food.id)?.destroy();
          this.foodViews.delete(food.id);
          this.playSfx(SFX_PECK_KEY, 0.4);
          this.showPeckFx(food);
          const peckSeconds = foodPeckSeconds(food.type, result);
          actionSeconds += peckSeconds;
          pausedOtherMovementSeconds += peckSeconds;
          if (isHuntingFood(food.type)) huntingSeconds += peckSeconds;
          if (isHeatFreeFood(food.type)) heatFreeActionSeconds += peckSeconds;
        } else if (result === 'pecked') {
          this.refreshFoodView(food);
          this.playSfx(SFX_PECK_KEY, 0.36);
          this.showPeckFx(food);
          const peckSeconds = foodPeckSeconds(food.type, result);
          actionSeconds += peckSeconds;
          pausedOtherMovementSeconds += peckSeconds;
          if (isHuntingFood(food.type)) huntingSeconds += peckSeconds;
          if (isHeatFreeFood(food.type)) heatFreeActionSeconds += peckSeconds;
        } else {
          this.showGroundPeck();
          actionSeconds += 0.9;
        }
        this.peckCooldown = food.type === 'sunflower' ? 0.18 : 0.26;
      } else {
        const result = cluckAt(this.state, this.state.chicken);
        for (const droppedFood of result.droppedFoods) {
          this.foodViews.set(droppedFood.id, this.createFoodView(droppedFood));
          this.showScatterFx(droppedFood);
        }
        this.showCluckFx(this.state.chicken, result.scaredIds.length);
        this.scareAnimalViews(result.scaredIds);
        this.peckCooldown = 0.32;
        actionSeconds += 0.85;
        pausedOtherMovementSeconds += 0.85;
        heatFreeActionSeconds += 0.85;
      }
    }

    return {
      actionSeconds,
      diggingSeconds,
      huntingSeconds,
      pausedOtherMovementSeconds,
      heatFreeActionSeconds,
    };
  }

  private advanceChickenWorld(actionSeconds: number) {
    if (actionSeconds <= 0) return;
    const previousCheckpoint = this.state.finaleCheckpointJson;
    applyFlowEvent(this.state, {
      type: 'tick',
      amount: actionSeconds / DAY_ACTIVE_SECONDS,
    });
    if (!previousCheckpoint && this.state.finaleCheckpointJson) this.saveGame(true);
    const foodUpdate = expireFoods(this.state);
    for (const expiredId of foodUpdate.expiredIds) {
      this.foodViews.get(expiredId)?.destroy();
      this.foodViews.delete(expiredId);
    }
    for (const spawnedFood of foodUpdate.spawnedFoods) {
      this.foodViews.set(spawnedFood.id, this.createFoodView(spawnedFood));
    }
    this.refillFoodOutsideView();
    this.syncFoodViews();
  }

  private updateWeaselApproach(actionSeconds: number, sprinting: boolean, noisySeconds: number) {
    if (actionSeconds <= 0 || this.state.weaselEncounter || this.state.weaselEncounterDoneToday) return;
    if (
      this.state.flow.phase !== 'chicken-dusk' &&
      this.state.flow.phase !== 'chicken-night'
    ) {
      return;
    }
    const duskSpan = Math.max(0.1, (NIGHT_AT - DUSK_AT) * DAY_ACTIVE_SECONDS);
    const baseRate = (100 / duskSpan) * 0.62;
    const multiplier = this.weaselApproachMultiplier(sprinting);
    const noiseBonus = noisySeconds > 0 ? Math.min(5, noisySeconds * 1.9) : 0;
    this.state.weaselApproach = Phaser.Math.Clamp(
      this.state.weaselApproach + baseRate * actionSeconds * multiplier + noiseBonus,
      0,
      100,
    );
    if (this.state.weaselApproach >= 100) this.spawnWeasel();
  }

  private weaselApproachMultiplier(sprinting: boolean) {
    const houseCenter = { x: HOUSE.x + HOUSE.width * 0.5, y: HOUSE.y + HOUSE.height * 0.5 };
    const safetyDistance = Math.min(
      distance(this.state.chicken, COOP_DOOR),
      distance(this.state.chicken, houseCenter),
      this.state.yard.owned.includes('yard-lamp')
        ? distance(this.state.chicken, YARD_LAMP_POSITION) + 80
        : Infinity,
    );
    const farRatio = Phaser.Math.Clamp((safetyDistance - 220) / 620, 0, 1);
    const edgeDistance = Math.min(
      this.state.chicken.x,
      WORLD_WIDTH - this.state.chicken.x,
      this.state.chicken.y,
      WORLD_HEIGHT - this.state.chicken.y,
    );
    const edgeBonus = edgeDistance < 210 ? 0.32 : 0;
    const sprintBonus = sprinting ? 0.15 : 0;
    return 1 + farRatio * 1.1 + edgeBonus + sprintBonus;
  }

  private updateRealtimeThreats(dt: number) {
    this.spawnWeasel();
    const encounter = this.state.weaselEncounter;
    if (!encounter) return false;

    const result = advanceWeaselEncounter(encounter, {
      dt,
      chicken: this.state.chicken,
      chickenInCoop: isInCoop(this.state.chicken),
      coopDoorClosed: false,
      illuminated: false,
      humanBlocking: false,
      contactEnabled: this.caughtCooldown <= 0,
      speedScale: this.state.day <= 3 ? 0.92 : 1,
    });
    this.state.weaselEncounter = result.state;

    const threatDistance = distance(result.state.position, this.state.chicken);
    this.rustleSfxCooldown = Math.max(0, this.rustleSfxCooldown - dt);
    if (this.rustleSfxCooldown === 0) {
      this.showWeaselRustleFx(result.state.position);
      this.playSfx(SFX_NIGHT_RUSTLE_KEY, result.state.warningSeconds > 0 ? 0.32 : 0.46);
      const closeness = Phaser.Math.Clamp(1 - threatDistance / 720, 0, 1);
      this.rustleSfxCooldown = Phaser.Math.Linear(2.4, 0.55, closeness);
    }

    if (result.outcome === 'active') return false;
    resolveWeaselOutcome(this.state, result.outcome);
    if (result.outcome === 'caught') {
      this.caughtCooldown = 1.8;
      this.playSfx(SFX_CLUCK_KEYS[0], 0.72);
      this.cameras.main.shake(90, 0.005);
      this.state.message = '黄鼠狼擦着羽毛扑过，鸡还能继续逃；今晚的夜压压上来了一截。';
      this.emitHud(true, true);
      return false;
    }
    this.weasel.setVisible(false);
    if (result.outcome === 'repelled') {
      this.playCloseMoment();
      this.state.message = '灯光稳稳照住黄鼠狼，它转身钻回了院墙外。';
      return false;
    }
    if (result.outcome === 'safe') return false;
    return false;
  }

  private isAtCoopDoor() {
    return distance(this.state.chicken, COOP_DOOR) < 72;
  }

  private handLanternCenter() {
    return {
      x: this.state.human.x + this.humanFacingDirection.x * 150,
      y: this.state.human.y + this.humanFacingDirection.y * 150,
    };
  }

  private updateHuman(dt: number, actions: InputActions) {
    const direction = normalize(actions.x, actions.y);
    if (direction.x || direction.y) {
      this.humanFacingDirection = direction;
      const target = {
        x: this.state.human.x + direction.x * 175 * dt,
        y: this.state.human.y + direction.y * 175 * dt,
      };
      if (!isBlocked(target, 20)) {
        this.state.human = target;
      }
      this.human.scaleX = direction.x < -0.05 ? -1 : direction.x > 0.05 ? 1 : this.human.scaleX;
    }

    const nearCoop = distance(this.state.human, COOP_DOOR) < 94;
    const houseDoor = { x: HOUSE.x + HOUSE.width * 0.5, y: HOUSE.y + HOUSE.height + 24 };
    const nearHouseDoor = distance(this.state.human, houseDoor) < 112;
    if (this.state.flow.phase === 'dusk-human') {
      this.state.flow.phase = 'chicken-dusk';
      this.state.mode = 'chicken';
      this.state.phase = 'dusk';
      this.state.message = '黄昏仍由鸡自己行动；鸡窝门前按 E 可以休息。';
      this.switchToChicken();
      return;
    }

    if (this.state.flow.phase === 'epilogue-human') {
      if (this.state.egg && !this.state.egg.found) {
        this.state.eggSearch = advanceEggSearch(this.state.eggSearch, dt);
      }
      this.updateEggGuidance(dt);
      if (this.state.egg && !this.state.egg.found && actions.searchPressed) {
        if (distance(this.state.human, this.state.egg) < EGG_PICKUP_RANGE) {
          if (collectKeepsakeEgg(this.state)) {
            this.playSfx(SFX_REWARD_KEY, 0.64);
            this.revealEgg();
            this.clearEggClueView();
            this.emitHud(true, true);
            window.dispatchEvent(new CustomEvent('chicken-life:ending-ready'));
          }
        } else {
          this.state.message = `这里没有蛋；${this.state.profile.name}在鸡舍里朝远端草丛叫了两声。`;
          this.showEggDirectionClue();
        }
      }
      return;
    }

    if (this.state.egg && !this.state.egg.found) {
      this.state.eggSearch = advanceEggSearch(this.state.eggSearch, dt);
    }
    updateIdleChickenWander(this.state, dt);
    this.updateEggGuidance(dt);

    if (
      actions.interactPressed &&
      this.state.yard.owned.includes('water-basin') &&
      distance(this.state.human, WATER_BASIN_POSITION) < 82
    ) {
      refillWaterBasin(this.state);
      this.playSfx(SFX_DRINK_KEY, 0.38);
      this.drawOwnedYardUpgrades();
      return;
    }

    if (
      actions.interactPressed &&
      this.state.yard.owned.includes('premium-feed') &&
      distance(this.state.human, PREMIUM_FEED_POSITION) < 82
    ) {
      const served = servePremiumFeed(this.state);
      if (served.length > 0) {
        this.playSfx(SFX_PECK_KEY, 0.32);
      } else {
        this.state.message = '今天已经舀过一勺优质饲料了。';
      }
      return;
    }

    if (actions.interactPressed && nearHouseDoor) {
      if (!this.state.flow.morningEggFound) {
        this.state.message = '先在院子里找到今天的蛋，再回屋结束清晨。';
        return;
      }
      applyFlowEvent(this.state, { type: 'return-home' });
      this.state.message = '你把蛋放好，回屋收拾了一下。今天的院子生活开始。';
      this.switchToChicken();
      return;
    }

    if (this.state.egg && !this.state.egg.found) {
      const eggDistance = distance(this.state.human, this.state.egg);
      if (actions.searchPressed) {
        if (eggDistance < EGG_PICKUP_RANGE) {
          collectEgg(this.state);
          applyFlowEvent(this.state, { type: 'egg-found' });
          this.playSfx(SFX_REWARD_KEY, 0.64);
          this.revealEgg();
          this.clearEggClueView();
        } else {
          this.state.message = `这里没有蛋；${this.state.profile.name}抬起头，朝藏蛋的方向叫了两声。`;
          this.showEggDirectionClue();
        }
      }
    }

    if (actions.interactPressed) {
      if (distance(this.state.human, this.state.chicken) < CLOSE_INTERACTION_RANGE) {
        if (dryRainSoakedChicken(this.state)) {
          this.playSfx(SFX_REWARD_KEY, 0.58);
        } else {
          this.openCloseInteraction();
        }
      } else if (nearCoop) {
        if (repairCoop(this.state)) {
          this.playSfx(SFX_REWARD_KEY, 0.58);
          this.showRepairFx(COOP_DOOR);
          this.playCloseMoment();
        }
      } else {
        this.state.message = '靠近鸡可以手喂和陪伴；靠近鸡窝可以用木料修缮。';
      }
    }

  }

  private openCloseInteraction() {
    this.closeInteractionOpen = true;
    this.closeInteractionAnimating = false;
    this.resetGameplayKeys();
    window.dispatchEvent(
      new CustomEvent('chicken-life:close-open', {
        detail: {
          chickenName: this.state.profile.name,
          foods: [...this.state.foraging.discoveredFoods],
          touchOptions: touchOptionsFor(currentRelationshipStage(this.state)),
        },
      }),
    );
  }

  private scheduleCloseInteractionPecks(reducedMotion: boolean) {
    const beats = reducedMotion ? [180, 330, 480] : [1680, 2240, 2800];
    for (const delay of beats) {
      this.time.delayedCall(delay, () => this.playSfx(SFX_PECK_KEY, 0.5));
    }
  }

  private switchToHuman() {
    this.duskCollection = createDuskCollectionState();
    this.eggClueSoundCooldown = 0;
    this.eggDirectionTimer = 0;
    this.state.handLanternActive = false;
    this.state.chickenWander.target = null;
    this.state.chickenWander.wait = 0.4;
    this.state.chickenWander.pause = 0.2;
    this.clearDuskSeedViews();
    this.clearHouseResponseLight();
    this.chicken.setVisible(true);
    this.human.setVisible(true);
    this.keeper.setVisible(false);
    this.weasel.setVisible(false);
    this.clearAnimalViews();
    this.createEggView(false);
    this.cameras.main.startFollow(this.human, true, 0.12, 0.12);
    this.syncCoopDoorView();
    this.emitHud(true, true);
  }

  private switchToChicken() {
    this.duskCollection = createDuskCollectionState();
    this.state.handLanternActive = false;
    this.clearEggClueView();
    this.clearDuskSeedViews();
    this.clearHouseResponseLight();
    this.chicken.setVisible(true);
    this.human.setVisible(false);
    this.keeper.setVisible(false);
    this.weasel.setVisible(false);
    this.eggView?.destroy();
    this.eggView = null;
    this.clearAnimalViews();
    this.createFoodViews();
    this.syncHoleViews();
    this.syncAnimalViews();
    this.cameras.main.startFollow(this.chicken, true, 0.12, 0.12);
    this.syncCoopDoorView();
    this.emitHud(true, true);
  }

  private rebuildWorldFromState() {
    this.clearAnimalViews();
    this.clearEggClueView();
    for (const view of this.holeViews.values()) view.destroy();
    this.holeViews.clear();
    this.eggView?.destroy();
    this.eggView = null;
    this.createFoodViews();
    this.createHoleViews();
    this.drawOwnedYardUpgrades();
    this.applySceneViewFromState();
  }

  private showFinaleRetry() {
    this.finaleRetryOpen = true;
    this.resetGameplayKeys();
    window.dispatchEvent(new CustomEvent('chicken-life:finale-failed'));
  }

  private applySceneViewFromState() {
    this.chicken.setVisible(true);
    this.human.setVisible(this.state.mode === 'human');
    this.updateSprites();

    if (this.state.mode === 'human') {
      this.keeper.setVisible(false);
      this.weasel.setVisible(false);
      this.clearAnimalViews();
      if (this.state.egg && !this.state.egg.found) {
        this.createEggView(false);
      } else {
        this.eggView?.destroy();
        this.eggView = null;
      }
      this.cameras.main.startFollow(this.human, true, 0.12, 0.12);
      this.syncCoopDoorView();
      this.updateMusic(true);
      return;
    }

    this.syncCoopDoorView();
    this.eggView?.destroy();
    this.eggView = null;
    this.syncAnimalViews();
    this.cameras.main.startFollow(this.chicken, true, 0.12, 0.12);
    this.updateMusic(true);
  }

  private setupMusic() {
    if (this.cache.audio.exists(DAY_BGM_KEY)) {
      this.dayMusic = this.sound.add(DAY_BGM_KEY, { loop: true, volume: DAY_BGM_VOLUME });
    }
    if (this.cache.audio.exists(NIGHT_BGM_KEY)) {
      this.nightMusic = this.sound.add(NIGHT_BGM_KEY, { loop: true, volume: NIGHT_BGM_VOLUME });
    }
    this.applyMasterVolume();
    window.addEventListener('keydown', this.handleMusicUnlock, { once: true });
    this.input.once('pointerdown', this.handleMusicUnlock);
  }

  private applyMasterVolume() {
    this.sound.volume = this.masterVolume;
  }

  private handleMusicUnlock = () => {
    if (this.musicUnlocked) return;
    this.musicUnlocked = true;
    this.sound.unlock();
    this.updateMusic(true);
  };

  private updateMusic(force = false) {
    if (!this.musicUnlocked) return;
    const desired = this.state.phase === 'dusk' || this.state.phase === 'night' ? 'night' : 'day';
    if (!force && this.activeMusic === desired) return;

    const nextTrack = desired === 'night' ? this.nightMusic : this.dayMusic;
    const previousTrack = desired === 'night' ? this.dayMusic : this.nightMusic;
    previousTrack?.stop();
    if (nextTrack && !nextTrack.isPlaying) nextTrack.play();
    this.activeMusic = nextTrack?.isPlaying ? desired : null;
  }

  private playSfx(key: string, volume = 0.5) {
    if (!this.cache.audio.exists(key)) return;
    this.sound.play(key, { volume });
  }

  private playCluckSfx(scaredCount: number) {
    const blocked = new Set(this.recentCluckSfx);
    let candidates = SFX_CLUCK_KEYS.filter((key) => !blocked.has(key));
    if (candidates.length === 0) {
      candidates = SFX_CLUCK_KEYS.filter((key) => key !== this.recentCluckSfx[0]);
    }
    const key = candidates[Phaser.Math.Between(0, candidates.length - 1)];
    this.recentCluckSfx.unshift(key);
    this.recentCluckSfx = this.recentCluckSfx.slice(0, 2);
    this.playSfx(key, scaredCount > 0 ? 0.58 : 0.5);
  }

  private spawnWeasel(force = false) {
    if (this.state.weaselEncounter) return;
    if (force) this.state.weaselEncounterDoneToday = false;
    if (this.state.weaselEncounterDoneToday) return;
    const weaselPhase =
      this.state.flow.phase === 'chicken-dusk' || this.state.flow.phase === 'chicken-night';
    if (!force && (!weaselPhase || this.state.weaselApproach < 100)) {
      return;
    }
    const point = this.pickWeaselSpawnPoint();
    const position = {
      x: Phaser.Math.Clamp(point.x, 30, WORLD_WIDTH - 30),
      y: Phaser.Math.Clamp(point.y, 30, WORLD_HEIGHT - 30),
    };
    this.state.weaselApproach = 100;
    this.state.weaselEncounter = createWeaselEncounter(position, force ? 0.18 : 0.42);
    this.rustleSfxCooldown = 0;
    this.weasel.setVisible(false);
    this.showWeaselRustleFx(position);
    if (force) {
      this.playSfx(SFX_NIGHT_RUSTLE_KEY, 0.34);
      this.state.message = '调试：附近草丛里钻出了一只黄鼠狼。';
    }
  }

  private pickWeaselSpawnPoint(): Vec2 {
    let best: Vec2 | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let fallback: Vec2 | null = null;
    let fallbackDistance = Number.POSITIVE_INFINITY;
    for (const area of EGG_HIDE_AREAS) {
      for (let i = 0; i < 4; i += 1) {
        const point = {
          x: Phaser.Math.Clamp(
            area.x + area.width * Phaser.Math.FloatBetween(0.28, 0.72),
            30,
            WORLD_WIDTH - 30,
          ),
          y: Phaser.Math.Clamp(
            area.y + area.height * Phaser.Math.FloatBetween(0.28, 0.72),
            30,
            WORLD_HEIGHT - 30,
          ),
        };
        if (isBlocked(point, 18) || isOnPath(point)) continue;
        const d = distance(point, this.state.chicken);
        if (d < fallbackDistance) {
          fallback = point;
          fallbackDistance = d;
        }
        if (d < 165 || d > 380) continue;
        const score = d + Phaser.Math.FloatBetween(0, 24);
        if (score < bestScore) {
          best = point;
          bestScore = score;
        }
      }
    }
    return best ?? fallback ?? this.farthestWeaselSpawnPoint();
  }

  private randomEdgePoint(): Vec2 {
    const side = Phaser.Math.Between(0, 3);
    if (side === 0) return { x: 30, y: Phaser.Math.Between(60, WORLD_HEIGHT - 60) };
    if (side === 1) return { x: WORLD_WIDTH - 30, y: Phaser.Math.Between(60, WORLD_HEIGHT - 60) };
    if (side === 2) return { x: Phaser.Math.Between(60, WORLD_WIDTH - 60), y: 30 };
    return { x: Phaser.Math.Between(60, WORLD_WIDTH - 60), y: WORLD_HEIGHT - 30 };
  }

  private farthestWeaselSpawnPoint(): Vec2 {
    const points = [
      { x: 30, y: 30 },
      { x: WORLD_WIDTH - 30, y: 30 },
      { x: 30, y: WORLD_HEIGHT - 30 },
      { x: WORLD_WIDTH - 30, y: WORLD_HEIGHT - 30 },
    ];
    return points.reduce((best, point) =>
      distance(point, this.state.chicken) > distance(best, this.state.chicken) ? point : best,
    );
  }

  private nearestFood(radius: number) {
    let best: FoodEntity | null = null;
    let bestDistance = radius;
    for (const food of visibleFoods(this.state)) {
      if (food.buried) continue;
      if (isFoodLockedByAnimal(this.state, food)) continue;
      const d = distance(food, this.state.chicken);
      if (d < bestDistance) {
        best = food;
        bestDistance = d;
      }
    }
    return best;
  }

  private isScratchableGround(point: Vec2) {
    return !isOnPath(point) && !isBlocked(point, 18);
  }

  private nearestBuriedNightBug(radius: number) {
    let best: FoodEntity | null = null;
    let bestDistance = radius;
    for (const food of visibleFoods(this.state)) {
      if (food.type !== 'nightBug' || !food.buried) continue;
      const foodDistance = distance(food, this.state.chicken);
      if (foodDistance < bestDistance) {
        best = food;
        bestDistance = foodDistance;
      }
    }
    return best;
  }

  private nearestFlutterTarget(radius: number) {
    let best: Vec2 | null = null;
    let bestDistance = radius;
    const lowPerch = YARD_UPGRADES.find((upgrade) => upgrade.id === 'low-perch')!.position;
    const targets = this.state.yard.owned.includes('low-perch')
      ? [...FLUTTER_TARGETS, lowPerch]
      : FLUTTER_TARGETS;
    for (const target of targets) {
      const targetDistance = distance(target, this.state.chicken);
      if (targetDistance < bestDistance) {
        best = target;
        bestDistance = targetDistance;
      }
    }
    return best;
  }

  private updateFacilityIdle(dt: number, moving: boolean) {
    const facility = ownedFacilityAt(this.state.yard, this.state.chicken);
    if (moving || !facility || this.state.facilityLife.needsMovement) {
      this.state.facilityLife.idleSeconds = 0;
      return;
    }

    const activity =
      facility === 'shade-shelter'
        ? 'shade-rest'
        : facility === 'low-perch' &&
            distance(
              this.state.chicken,
              YARD_UPGRADES.find((upgrade) => upgrade.id === 'low-perch')!.position,
            ) < 24
          ? 'perch-idle'
          : null;
    if (!activity) {
      this.state.facilityLife.idleSeconds = 0;
      return;
    }

    this.state.facilityLife.idleSeconds += dt;
    if (
      this.state.facilityLife.idleSeconds >= FACILITY_IDLE_SECONDS &&
      startFacilityActivity(this.state.facilityLife, activity)
    ) {
      this.state.message =
        activity === 'shade-rest'
          ? '鸡在棚下安静下来，开始打盹和梳理羽毛。'
          : '鸡在低栖木上站稳，慢慢看看院子。';
    }
  }

  private performFlutter(target: Vec2) {
    this.state.body.fluttering = true;
    this.state.chicken = { ...target };
    this.chickenLiftTimer = 0.75;
    this.showCluckFx(target, 1);
    this.time.delayedCall(460, () => {
      this.state.body.fluttering = false;
    });
  }

  private updateMovingFoods(dt: number) {
    for (const food of visibleFoods(this.state)) {
      if (!['cricket', 'beetle', 'nightBug'].includes(food.type)) continue;
      const chickenDistance = distance(food, this.state.chicken);
      if (chickenDistance >= 180 || chickenDistance < 1) continue;
      const away = normalize(food.x - this.state.chicken.x, food.y - this.state.chicken.y);
      const fleeSpeed = food.type === 'nightBug' ? 92 : 72;
      const target = {
        x: Phaser.Math.Clamp(food.x + away.x * fleeSpeed * dt, 40, WORLD_WIDTH - 40),
        y: Phaser.Math.Clamp(food.y + away.y * fleeSpeed * dt, 40, WORLD_HEIGHT - 40),
      };
      if (!isBlocked(target, 12) && !isOnPath(target)) {
        food.x = target.x;
        food.y = target.y;
        food.velocity = { x: away.x * fleeSpeed, y: away.y * fleeSpeed };
        this.foodViews.get(food.id)?.setPosition(food.x, food.y);
      }
    }
  }

  private refillFoodOutsideView() {
    const worldView = this.cameras.main.worldView;
    const offscreenMudPoints = FOOD_SPAWN_POINTS.filter(
      (point) =>
        !isOnPath(point) &&
        !Phaser.Geom.Rectangle.Contains(worldView, point.x, point.y),
    );
    for (const food of refillForagingFoods(this.state, offscreenMudPoints)) {
      this.foodViews.set(food.id, this.createFoodView(food));
    }
  }

  private nearestHole(radius: number) {
    let best: HoleEntity | null = null;
    let bestDistance = radius;
    for (const hole of this.state.holes) {
      const d = distance(hole, this.state.chicken);
      if (d < bestDistance) {
        best = hole;
        bestDistance = d;
      }
    }
    return best;
  }

  private createHomecomingViews() {
    const doorCenter = { x: COOP.x + 50, y: COOP.y + 107 };
    this.coopDoorInterior = this.add
      .rectangle(doorCenter.x, doorCenter.y, 48, 58, 0x241d1a, 0.94)
      .setDepth(43);
    this.coopDoorPanel = this.add
      .rectangle(doorCenter.x, doorCenter.y, 46, 56, 0x8a5435, 1)
      .setDepth(44);
    this.humanLanternGlow = this.add
      .circle(this.state.human.x, this.state.human.y, 118, 0xffdf8a, 0.13)
      .setDepth(96)
      .setVisible(false);
    this.handLanternAim = this.add
      .circle(this.state.human.x, this.state.human.y, 150, 0xffd978, 0.11)
      .setStrokeStyle(2, 0xffe7a8, 0.28)
      .setDepth(96)
      .setVisible(false);
    this.duskVisionRing = this.add
      .circle(this.state.chicken.x, this.state.chicken.y, visionRadiusFor(this.state.affection), 0xffdf8a, 0.035)
      .setStrokeStyle(2, 0xffdf8a, 0.3)
      .setDepth(38)
      .setVisible(false);
    this.yardLampGlow = this.add
      .circle(YARD_LAMP_POSITION.x, YARD_LAMP_POSITION.y, 138, 0xffd98a, 0.12)
      .setDepth(96)
      .setVisible(false);
    this.syncCoopDoorView();
  }

  private syncCoopDoorView() {
    if (!this.coopDoorInterior || !this.coopDoorPanel) return;
    const doorCenter = { x: COOP.x + 50, y: COOP.y + 107 };
    const storyPhase = this.state.flow.phase;
    const open =
      storyPhase === 'chicken-day' ||
      storyPhase === 'chicken-dusk' ||
      storyPhase === 'chicken-night';
    const warmOpen = storyPhase === 'chicken-dusk' || storyPhase === 'chicken-night';
    this.coopDoorInterior.setVisible(open);
    this.coopDoorInterior.setFillStyle(warmOpen ? 0x3f2a1d : 0x241d1a, warmOpen ? 0.98 : 0.94);
    this.coopDoorPanel.setPosition(open ? doorCenter.x - 48 : doorCenter.x, doorCenter.y);
    this.coopDoorPanel.setFillStyle(open ? 0x6f422d : 0x8a5435, 1);
  }

  private clearDuskSeedViews() {
    for (const view of this.duskSeedViews.values()) view.destroy();
    this.duskSeedViews.clear();
  }

  private showWeaselRustleFx(position: Vec2) {
    const rustle = this.add
      .circle(position.x, position.y, 18, 0x71805a, 0.08)
      .setStrokeStyle(3, 0xb5c48b, 0.42)
      .setDepth(61);
    this.tweens.add({
      targets: rustle,
      scale: 1.9,
      alpha: 0,
      duration: 520,
      ease: 'Sine.easeOut',
      onComplete: () => rustle.destroy(),
    });
  }

  private showNightAmbienceFx(position: Vec2) {
    const ripple = this.add
      .circle(position.x, position.y, 10, 0x8fb7ff, 0.05)
      .setStrokeStyle(2, 0xa9caff, 0.24)
      .setDepth(62);
    const glint = this.add
      .circle(position.x + Phaser.Math.Between(-8, 8), position.y - 6, 3, 0xc8ddff, 0.38)
      .setDepth(63);
    this.tweens.add({
      targets: ripple,
      scale: 1.8,
      alpha: 0,
      duration: 820,
      ease: 'Sine.easeOut',
      onComplete: () => ripple.destroy(),
    });
    this.tweens.add({
      targets: glint,
      y: glint.y - 9,
      alpha: 0,
      duration: 620,
      ease: 'Sine.easeOut',
      onComplete: () => glint.destroy(),
    });
  }

  private showHouseResponseFx(stage: 'heard' | 'door-open') {
    if (stage === 'heard') {
      this.clearHouseResponseLight();
      this.houseResponseLight = this.add
        .circle(HOUSE.x + 390, HOUSE.y + 157, 62, 0xffdc85, 0.24)
        .setDepth(96);
    }

    const at = stage === 'heard'
      ? { x: HOUSE.x + 390, y: HOUSE.y + 115 }
      : { x: HOUSE.x + HOUSE.width * 0.5, y: HOUSE.y + HOUSE.height + 14 };
    const label = stage === 'heard' ? '屋里：听见了——' : '房门打开了';
    const color = stage === 'heard' ? '#ffe5a2' : '#fff1bd';
    const text = this.add.text(at.x, at.y, label, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: stage === 'heard' ? '18px' : '20px',
      fontStyle: '700',
      color,
      stroke: '#3c2a1c',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(98);

    const glow = this.add
      .circle(at.x, at.y + 16, stage === 'heard' ? 40 : 56, 0xffdf8a, 0.2)
      .setDepth(97);
    this.tweens.add({
      targets: [text, glow],
      y: `-=18`,
      alpha: 0,
      duration: 1050,
      ease: 'Sine.easeOut',
      onComplete: () => {
        text.destroy();
        glow.destroy();
      },
    });
  }

  private clearHouseResponseLight() {
    this.houseResponseLight?.destroy();
    this.houseResponseLight = null;
  }

  private createGeneratedTextures() {
    this.generateTexture('sprite-chicken', 72, 58, (g) => {
      g.fillStyle(0xfff0c4, 1).fillEllipse(34, 30, 34, 28);
      g.fillStyle(0xd8b26b, 0.9).fillEllipse(31, 34, 18, 13);
      g.fillStyle(0xd75437, 1).fillCircle(26, 15, 5);
      g.fillStyle(0xe7a72d, 1).fillTriangle(54, 30, 41, 24, 41, 36);
      g.fillStyle(0x1e1b16, 1).fillCircle(42, 24, 2.4);
    });
    this.generateTexture('sprite-human', 72, 100, (g) => {
      g.fillStyle(0x0f140f, 0.26).fillEllipse(36, 78, 34, 12);
      g.fillStyle(0x37425d, 1).fillRect(27, 61, 18, 22);
      g.fillStyle(0x6b8db7, 1).fillRect(21, 20, 30, 38);
      g.fillStyle(0xe6bd88, 1).fillCircle(36, 13, 13);
      g.fillStyle(0xc0793c, 1).fillRect(21, 0, 30, 8);
    });
    this.generateTexture('sprite-keeper', 82, 102, (g) => {
      g.fillStyle(0x0f140f, 0.24).fillEllipse(36, 80, 38, 13);
      g.fillStyle(0x3d4f42, 1).fillRect(27, 62, 18, 22);
      g.fillStyle(0x8fb46a, 1).fillRect(20, 21, 32, 38);
      g.fillStyle(0xe0b780, 1).fillCircle(36, 14, 13);
      g.fillStyle(0xb16b35, 1).fillRect(20, 0, 32, 8);
      g.fillStyle(0xb87539, 1).fillEllipse(60, 25, 18, 24);
      g.fillStyle(0xffd66e, 1).fillCircle(60, 16, 5);
    });
    this.generateTexture('sprite-weasel', 104, 56, (g) => {
      g.fillStyle(0x472718, 1).fillEllipse(20, 32, 34, 12);
      g.fillStyle(0x6f3a25, 1).fillEllipse(54, 30, 54, 20);
      g.fillStyle(0x7f472b, 1).fillEllipse(80, 28, 22, 18);
      g.fillStyle(0xffe3a2, 1).fillCircle(86, 23, 2.5);
    });
    this.generateTexture('hole', 64, 44, (g) => {
      g.fillStyle(0x9b7048, 0.42).fillEllipse(32, 20, 54, 30);
      g.fillStyle(0x2f2119, 0.72).fillEllipse(32, 22, 46, 28);
    });
    this.generateTexture('animal-cat', 108, 70, (g) => {
      g.fillStyle(0x0f140f, 0.22).fillEllipse(50, 50, 62, 14);
      g.fillStyle(0x6f665a, 1).fillEllipse(16, 39, 34, 10);
      g.fillStyle(0x887b69, 1).fillEllipse(50, 36, 58, 24);
      g.fillStyle(0x9a8a75, 1).fillCircle(80, 31, 15);
      g.fillStyle(0x756b60, 1).fillTriangle(71, 18, 78, 0, 85, 18);
      g.fillTriangle(85, 18, 92, 0, 99, 18);
      g.fillStyle(0x5f574e, 0.5).fillRect(55, 27, 28, 3);
    });
    this.generateTexture('animal-sparrow', 56, 44, (g) => {
      g.fillStyle(0x0f140f, 0.18).fillEllipse(28, 34, 28, 8);
      g.fillStyle(0xffe4a3, 0.1).fillCircle(28, 22, 24);
      g.fillStyle(0x6a4c32, 0.9).fillTriangle(24, 22, 10, 15, 11, 32);
      g.fillStyle(0x8b6540, 1).fillEllipse(28, 22, 23, 14);
      g.fillStyle(0x5e432f, 1).fillEllipse(24, 24, 14, 8);
      g.fillStyle(0x9a7549, 1).fillCircle(38, 18, 7);
      g.fillStyle(0xe2a13f, 1).fillTriangle(45, 18, 52, 22, 45, 26);
      g.fillStyle(0x17120d, 1).fillCircle(40, 15, 1.5);
    });
    this.generateTexture('food-grain', 32, 32, (g) => g.fillStyle(0xffd86a, 1).fillEllipse(16, 16, 10, 6));
    this.generateTexture('food-premium-grain', 42, 36, (g) => {
      g.fillStyle(0xfff0a8, 0.18).fillCircle(21, 18, 15);
      g.fillStyle(0xf0b84e, 1).fillEllipse(16, 18, 12, 7);
      g.fillStyle(0xffdc73, 1).fillEllipse(25, 16, 11, 7);
      g.fillStyle(0xfff2a5, 1).fillEllipse(23, 23, 9, 5);
    });
    this.generateTexture('food-grass', 44, 40, (g) => {
      g.fillStyle(0x87c358, 1).fillTriangle(14, 28, 22, 10, 30, 28);
      g.fillStyle(0x5fa242, 1).fillTriangle(25, 31, 32, 12, 39, 31);
    });
    this.generateTexture('food-bug', 36, 32, (g) => {
      g.fillStyle(0x312418, 1).fillEllipse(17, 17, 14, 8);
      g.fillStyle(0x0f0c09, 1).fillCircle(24, 15, 2);
    });
    this.generateTexture('food-worm', 38, 30, (g) => {
      g.lineStyle(5, 0xc77b72, 1);
      g.beginPath();
      g.moveTo(7, 20);
      g.lineTo(15, 11);
      g.lineTo(24, 19);
      g.lineTo(32, 10);
      g.strokePath();
    });
    this.generateTexture('food-cricket', 38, 34, (g) => {
      g.fillStyle(0x594026, 1).fillEllipse(18, 18, 16, 9);
      g.lineStyle(2, 0x2d2217, 1);
      g.lineBetween(12, 22, 5, 30);
      g.lineBetween(24, 21, 33, 29);
      g.fillStyle(0x16130e, 1).fillCircle(27, 15, 2);
    });
    for (let progress = 0; progress <= 2; progress += 1) {
      this.generateTexture(`food-cricket-${progress}`, 42, 36, (g) => {
        g.fillStyle(0x594026, 1).fillEllipse(19, 18, 16, 9);
        g.lineStyle(2, 0x2d2217, 1);
        g.lineBetween(12, 22, progress >= 1 ? 3 : 5, progress >= 1 ? 26 : 30);
        g.lineBetween(25, 21, progress >= 1 ? 35 : 33, progress >= 1 ? 24 : 29);
        g.fillStyle(0x16130e, 1).fillCircle(28, 15, 2);
        if (progress >= 1) g.fillStyle(0xffe0a0, 0.86).fillCircle(12, 10, 2.2);
      });
    }
    this.generateTexture('food-beetle', 38, 34, (g) => {
      g.fillStyle(0x37665c, 1).fillEllipse(19, 18, 17, 12);
      g.lineStyle(2, 0xb1d294, 0.8);
      g.lineBetween(19, 8, 19, 28);
      g.fillStyle(0x1c2b24, 1).fillCircle(28, 17, 3);
    });
    for (let progress = 0; progress <= 3; progress += 1) {
      this.generateTexture(`food-beetle-${progress}`, 42, 38, (g) => {
        g.fillStyle(0x37665c, 1).fillEllipse(21, 19, 18, 13);
        g.lineStyle(2, 0xb1d294, 0.8);
        g.lineBetween(21, 8, 21, 30);
        if (progress >= 1) g.lineBetween(14, 16, 21, 20);
        if (progress >= 2) g.lineBetween(22, 18, 30, 12);
        g.fillStyle(0x1c2b24, 1).fillCircle(30, 18, 3);
        for (let i = 0; i < 3; i += 1) {
          g.fillStyle(0xd6f6b4, i < progress ? 0.18 : 0.7).fillCircle(12 + i * 8, 33, 2);
        }
      });
    }
    this.generateTexture('food-berry', 38, 38, (g) => {
      g.fillStyle(0xb4475d, 1).fillCircle(16, 21, 7);
      g.fillCircle(23, 18, 7);
      g.fillCircle(22, 26, 7);
      g.fillStyle(0x5e8b47, 1).fillTriangle(18, 14, 25, 5, 29, 15);
    });
    this.generateTexture('food-nightBug', 36, 36, (g) => {
      g.fillStyle(0x7aa7ff, 0.45).fillCircle(18, 18, 8);
      g.fillStyle(0x9fc7ff, 1).fillEllipse(18, 18, 12, 8);
    });
    for (let progress = 0; progress <= 2; progress += 1) {
      this.generateTexture(`food-nightBug-${progress}`, 42, 42, (g) => {
        g.fillStyle(0x7aa7ff, progress >= 1 ? 0.28 : 0.45).fillCircle(21, 21, 9);
        g.fillStyle(0x9fc7ff, progress >= 1 ? 0.78 : 1).fillEllipse(21, 21, 13, 8);
        if (progress >= 1) g.fillStyle(0xeaf3ff, 0.82).fillCircle(13, 15, 2.4);
      });
    }
    this.generateTexture('food-nightBug-buried', 52, 34, (g) => {
      g.fillStyle(0x2a2133, 0.26).fillEllipse(26, 24, 42, 14);
      g.fillStyle(0x806245, 0.92).fillEllipse(26, 21, 34, 12);
      g.fillStyle(0x9fc7ff, 0.46).fillCircle(29, 16, 3);
    });
    for (let progress = 0; progress <= 3; progress += 1) {
      this.generateTexture(`food-meat-${progress}`, 54, 46, (g) => {
        g.fillStyle(0xffc0a2, 0.16).fillCircle(27, 18, 18);
        g.fillStyle(0x7d2f27, 1).fillEllipse(27, 18, 24, 15);
        g.fillStyle(0xb84d3a, 1).fillEllipse(30, 16, 16, 9);
        g.fillStyle(0xf0d8b7, 1).fillCircle(16, 17, 4);
        for (let i = 0; i < 3; i += 1) {
          g.fillStyle(0xffdac4, i < progress ? 0.18 : 0.82).fillCircle(17 + i * 10, 33, 2.6);
        }
      });
    }
    for (let progress = 0; progress <= 2; progress += 1) {
      this.generateTexture(`food-sunflower-${progress}`, 50, 44, (g) => {
        g.fillStyle(0xffdc7a, 0.2).fillCircle(25, 18, 17);
        g.fillStyle(0x5a3420, 1).fillEllipse(25, 18, 16, 10);
        g.fillStyle(0xffc64f, 1).fillEllipse(26, 17, 10, 6);
        for (let i = 0; i < 2; i += 1) {
          g.fillStyle(0xffecad, i < progress ? 0.18 : 0.78).fillCircle(16 + i * 10, 30, 2.5);
        }
      });
    }
  }

  private generateTexture(key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  private drawYard() {
    const key = 'yard-bg';
    if (this.textures.exists(key)) {
      this.add.image(0, 0, key).setOrigin(0).setDepth(0);
      return;
    }

    const g = this.add.graphics();
    g.fillStyle(0x6c4c31, 1);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (let y = 0; y < WORLD_HEIGHT; y += 52) {
      for (let x = 0; x < WORLD_WIDTH; x += 52) {
        const tone = (x * 17 + y * 31) % 5;
        g.fillStyle(tone > 2 ? 0x755438 : 0x60442f, 0.16);
        g.fillCircle(x + 18, y + 23, 18 + tone * 2);
      }
    }

    this.drawRect(g, MAIN_PATH, 0xb88e5e, 1);
    this.drawRect(g, HOUSE_PATH, 0xb88e5e, 1);
    this.drawPathPebbles(g);
    this.drawPond(g);

    for (const patch of PLANT_PATCHES) {
      this.drawPlantPatch(g, patch);
    }

    for (const tree of TREE_POSITIONS) {
      this.drawTree(g, tree);
    }

    this.drawHouse(g);
    this.drawCoop(g);
    this.drawFence(g);
    this.drawLights(g);
    g.generateTexture(key, WORLD_WIDTH, WORLD_HEIGHT);
    g.destroy();
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
  }

  private drawOwnedYardUpgrades() {
    if (!this.yardUpgradeGraphics) return;
    const g = this.yardUpgradeGraphics;
    g.clear();

    for (const id of this.state.yard.owned) {
      const upgrade = YARD_UPGRADES.find((item) => item.id === id);
      if (!upgrade) continue;
      const { x, y } = upgrade.position;

      if (id === 'shade-shelter') {
        g.lineStyle(7, 0x694228, 1);
        g.lineBetween(x - 54, y - 28, x - 54, y + 38);
        g.lineBetween(x + 54, y - 28, x + 54, y + 38);
        g.fillStyle(0x6d7451, 0.96).fillRoundedRect(x - 70, y - 44, 140, 30, 8);
      } else if (id === 'low-perch') {
        g.lineStyle(8, 0x5c3924, 1);
        g.lineBetween(x - 54, y + 24, x - 38, y - 18);
        g.lineBetween(x + 54, y + 24, x + 38, y - 18);
        g.lineStyle(11, 0x80522f, 1);
        g.lineBetween(x - 60, y - 18, x + 60, y - 18);
      } else if (id === 'water-basin') {
        g.fillStyle(0x6f7f89, 1).fillEllipse(x, y, 76, 42);
        g.fillStyle(0x8fc9d7, 0.92).fillEllipse(x, y - 3, 58, 25);
        const waterRatio = this.state.waterBasinLevel / 100;
        g.fillStyle(0xd7f4f2, 0.58).fillEllipse(x, y - 4, 48 * waterRatio, 17);
      } else if (id === 'premium-feed') {
        g.fillStyle(0x9a6539, 1).fillRoundedRect(x - 30, y - 38, 60, 76, 10);
        g.fillStyle(0xc99755, 1).fillRoundedRect(x - 34, y - 42, 68, 13, 5);
        g.fillStyle(0xffd66e, 0.9).fillCircle(x, y + 2, 9);
      } else if (id === 'coop-roof') {
        g.fillStyle(0x744733, 1).fillTriangle(x - 92, y + 22, x, y - 42, x + 92, y + 22);
        g.lineStyle(4, 0xb8784c, 0.9);
        for (let offset = -60; offset <= 60; offset += 30) {
          g.lineBetween(x + offset, y + 12, x + offset + 18, y - 6);
        }
      } else if (id === 'coop-ramp') {
        g.fillStyle(0x8a5938, 1).fillRoundedRect(x - 52, y - 15, 104, 38, 5);
        g.lineStyle(3, 0xc48a55, 0.9);
        for (let offset = -34; offset <= 34; offset += 17) {
          g.lineBetween(x + offset, y - 13, x + offset, y + 21);
        }
      } else if (id === 'yard-lamp') {
        g.lineStyle(7, 0x49382d, 1).lineBetween(x, y + 52, x, y - 38);
        g.fillStyle(0xe7b85f, 1).fillCircle(x, y - 45, 13);
        g.fillStyle(0xffe6a4, 0.85).fillCircle(x, y - 47, 7);
      } else if (id === 'door-latch') {
        g.fillStyle(0xb9ad92, 1).fillRoundedRect(x - 22, y - 5, 44, 10, 3);
        g.fillStyle(0x665e51, 1).fillCircle(x - 24, y, 7);
      }
    }
  }

  private drawRect(g: Phaser.GameObjects.Graphics, rect: { x: number; y: number; width: number; height: number }, color: number, alpha: number) {
    g.fillStyle(color, alpha);
    g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 20);
  }

  private drawPathPebbles(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0xe1bf84, 0.42);
    for (let i = 0; i < 120; i += 1) {
      const onMain = Math.random() > 0.38;
      const rect = onMain ? MAIN_PATH : HOUSE_PATH;
      g.fillEllipse(
        rect.x + 16 + Math.random() * (rect.width - 32),
        rect.y + 16 + Math.random() * (rect.height - 32),
        7 + Math.random() * 10,
        4 + Math.random() * 8,
      );
    }
  }

  private drawPond(g: Phaser.GameObjects.Graphics) {
    const cx = POND.x + POND.width * 0.5;
    const cy = POND.y + POND.height * 0.5;
    g.fillStyle(0x314a3b, 0.92);
    g.fillEllipse(cx, cy + 3, POND.width + 26, POND.height + 20);
    g.fillStyle(0x3d766f, 1);
    g.fillEllipse(cx, cy, POND.width, POND.height);
    g.fillStyle(0x79b7aa, 0.34);
    g.fillEllipse(cx - POND.width * 0.18, cy - POND.height * 0.15, POND.width * 0.42, POND.height * 0.22);
    g.fillStyle(0x20372f, 0.24);
    g.fillEllipse(cx + POND.width * 0.24, cy + POND.height * 0.18, POND.width * 0.52, POND.height * 0.26);
    g.fillStyle(0xb4d289, 0.58);
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      g.fillEllipse(cx + Math.cos(angle) * (POND.width * 0.58), cy + Math.sin(angle) * (POND.height * 0.6), 10, 5);
    }
  }

  private drawPlantPatch(g: Phaser.GameObjects.Graphics, rect: { x: number; y: number; width: number; height: number }) {
    g.fillStyle(0x496f39, 0.58);
    g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 18);
    for (let i = 0; i < 32; i += 1) {
      g.fillStyle(i % 3 === 0 ? 0x85a84e : 0x5c873f, 0.82);
      const x = rect.x + Math.random() * rect.width;
      const y = rect.y + Math.random() * rect.height;
      g.fillTriangle(x, y + 11, x + 5, y - 10, x + 12, y + 11);
    }
  }

  private drawTree(g: Phaser.GameObjects.Graphics, point: Vec2) {
    g.fillStyle(0x5d3b24, 1);
    g.fillRoundedRect(point.x - 12, point.y + 18, 24, 42, 8);
    g.fillStyle(0x284a2d, 1);
    g.fillCircle(point.x, point.y, 56);
    g.fillStyle(0x3f7238, 0.95);
    g.fillCircle(point.x - 30, point.y + 12, 40);
    g.fillCircle(point.x + 31, point.y + 8, 42);
    g.fillStyle(0x668d43, 0.45);
    g.fillCircle(point.x - 10, point.y - 24, 26);
  }

  private drawHouse(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0x8c6040, 1);
    g.fillRoundedRect(HOUSE.x, HOUSE.y + 55, HOUSE.width, HOUSE.height - 55, 14);
    g.fillStyle(0x4e2e28, 1);
    g.fillTriangle(HOUSE.x - 28, HOUSE.y + 72, HOUSE.x + HOUSE.width / 2, HOUSE.y - 18, HOUSE.x + HOUSE.width + 28, HOUSE.y + 72);
    g.fillStyle(0xf3d38c, 1);
    g.fillRoundedRect(HOUSE.x + 214, HOUSE.y + 164, 68, 116, 8);
    g.fillStyle(0xffdf8a, 0.9);
    g.fillRoundedRect(HOUSE.x + 70, HOUSE.y + 128, 72, 58, 8);
    g.fillRoundedRect(HOUSE.x + 354, HOUSE.y + 128, 72, 58, 8);
  }

  private drawCoop(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0x72412e, 1);
    g.fillRoundedRect(COOP.x, COOP.y + 28, COOP.width, COOP.height - 28, 12);
    g.fillStyle(0x3c2621, 1);
    g.fillTriangle(COOP.x - 14, COOP.y + 44, COOP.x + COOP.width / 2, COOP.y - 14, COOP.x + COOP.width + 14, COOP.y + 44);
    g.fillStyle(0xffce76, 1);
    g.fillRoundedRect(COOP.x + 26, COOP.y + 78, 48, 58, 6);
    g.fillStyle(0xffeead, 0.7);
    g.fillCircle(COOP_DOOR.x, COOP_DOOR.y, 74);
  }

  private drawFence(g: Phaser.GameObjects.Graphics) {
    g.lineStyle(8, 0x56351f, 1);
    g.strokeRoundedRect(16, 16, WORLD_WIDTH - 32, WORLD_HEIGHT - 32, 18);
    g.lineStyle(2, 0xc79a66, 0.5);
    for (let x = 32; x < WORLD_WIDTH; x += 58) {
      g.lineBetween(x, 16, x + 18, 42);
      g.lineBetween(x, WORLD_HEIGHT - 16, x + 18, WORLD_HEIGHT - 42);
    }
    for (let y = 32; y < WORLD_HEIGHT; y += 58) {
      g.lineBetween(16, y, 42, y + 18);
      g.lineBetween(WORLD_WIDTH - 16, y, WORLD_WIDTH - 42, y + 18);
    }
  }

  private drawLights(g: Phaser.GameObjects.Graphics) {
    for (const light of SAFE_LIGHTS) {
      g.fillStyle(0xffdf8a, 0.18);
      g.fillCircle(light.x, light.y, 116);
      g.fillStyle(0xffe9aa, 0.9);
      g.fillCircle(light.x, light.y, 8);
    }
  }

  private createChickenSprite(position: Vec2) {
    return this.add.image(position.x, position.y, 'sprite-chicken').setDepth(60);
  }

  private createHumanSprite(position: Vec2) {
    return this.add.image(position.x, position.y, 'sprite-human').setDepth(60);
  }

  private createKeeperSprite(position: Vec2) {
    return this.add.image(position.x, position.y, 'sprite-keeper').setDepth(58);
  }

  private createWeaselSprite(position: Vec2) {
    const view = this.add.image(position.x, position.y, 'sprite-weasel').setDepth(62);
    view.setVisible(false);
    return view;
  }

  private createFoodViews() {
    for (const view of this.foodViews.values()) view.destroy();
    this.foodViews.clear();
    for (const food of this.state.foods) {
      const view = this.createFoodView(food);
      this.foodViews.set(food.id, view);
    }
    this.syncFoodViews();
  }

  private refreshFoodView(food: FoodEntity) {
    this.foodViews.get(food.id)?.destroy();
    const view = this.createFoodView(food);
    view.setVisible(this.state.time >= food.visibleAt);
    this.foodViews.set(food.id, view);
  }

  private createFoodView(food: FoodEntity): FoodView {
    const key =
      food.type === 'grain' && food.fromKeeper
        ? 'food-premium-grain'
        : food.type === 'nightBug' && food.buried
        ? 'food-nightBug-buried'
        : food.type === 'meat'
        ? `food-meat-${Math.min(food.progress ?? 0, food.hardness ?? 3)}`
        : food.type === 'sunflower'
          ? `food-sunflower-${Math.min(food.progress ?? 0, food.hardness ?? 2)}`
          : isHuntingFood(food.type)
            ? `food-${food.type}-${Math.min(
                food.progress ?? 0,
                food.hardness ?? huntingFoodTextureSteps(food.type),
              )}`
          : `food-${food.type}`;
    const view = this.add.image(food.x, food.y, key).setDepth(35) as FoodView;
    view.foodId = food.id;
    return view;
  }

  private syncFoodViews() {
    const visibleIds = new Set(visibleFoods(this.state).map((food) => food.id));
    for (const [id, view] of this.foodViews) {
      view.setVisible(visibleIds.has(id));
    }
  }

  private syncAnimalViews() {
    const activeAnimals = this.state.mode === 'chicken' ? this.state.animals.filter((animal) => animal.active) : [];
    const activeIds = new Set(activeAnimals.map((animal) => animal.id));

    for (const [id, view] of this.animalViews) {
      if (!activeIds.has(id)) {
        view.destroy();
        this.animalViews.delete(id);
      }
    }

    for (const animal of activeAnimals) {
      let view = this.animalViews.get(animal.id);
      if (!view) {
        view = this.createAnimalView(animal);
        this.animalViews.set(animal.id, view);
      }
      view.setPosition(animal.x, animal.y);
      view.setVisible(true);
      view.scaleX = animal.facing;
    }
  }

  private clearAnimalViews() {
    for (const view of this.animalViews.values()) view.destroy();
    this.animalViews.clear();
  }

  private createAnimalView(animal: YardAnimal): AnimalView {
    const key = animal.type === 'cat' ? 'animal-cat' : 'animal-sparrow';
    const view = this.add.image(animal.x, animal.y, key).setDepth(animal.type === 'cat' ? 52 : 64) as AnimalView;
    view.animalId = animal.id;
    view.animalType = animal.type;
    return view;
  }

  private scareAnimalViews(ids: number[]) {
    for (const id of ids) {
      const view = this.animalViews.get(id);
      if (!view) continue;
      this.animalViews.delete(id);
      const mark = this.add.text(view.x, view.y - 34, '!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: '700',
        color: '#fff0b9',
      }).setOrigin(0.5).setDepth(82);
      this.tweens.add({
        targets: mark,
        y: mark.y - 24,
        alpha: 0,
        duration: 520,
        onComplete: () => mark.destroy(),
      });
      this.tweens.add({
        targets: view,
        y: view.y - 42,
        x: view.x + (view.scaleX >= 0 ? 52 : -52),
        alpha: 0,
        scale: 1.18,
        duration: 480,
        ease: 'Sine.easeOut',
        onComplete: () => view.destroy(),
      });
    }
  }

  private createHoleViews() {
    for (const hole of this.state.holes) this.addHoleView(hole);
  }

  private syncHoleViews() {
    for (const [id, view] of this.holeViews) {
      if (!this.state.holes.some((hole) => hole.id === id)) {
        view.destroy();
        this.holeViews.delete(id);
      }
    }
    for (const hole of this.state.holes) {
      if (!this.holeViews.has(hole.id)) {
        this.addHoleView(hole);
      } else {
        this.refreshHoleView(hole);
      }
    }
  }

  private addHoleView(hole: HoleEntity) {
    const view = this.add.graphics().setPosition(hole.x, hole.y).setDepth(34);
    this.holeViews.set(hole.id, view);
    this.drawHoleView(view, hole);
  }

  private refreshHoleView(hole: HoleEntity) {
    const view = this.holeViews.get(hole.id);
    if (!view) {
      this.addHoleView(hole);
      return;
    }
    view.setPosition(hole.x, hole.y);
    this.drawHoleView(view, hole);
  }

  private drawHoleView(view: Phaser.GameObjects.Graphics, hole: HoleEntity) {
    view.clear();
    const depth = Phaser.Math.Clamp(hole.depth ?? 1, 1, 6);
    const moisture = Phaser.Math.Clamp(hole.moisture ?? 0, 0, 1);
    const width = 46 + depth * 12;
    const height = 26 + depth * 6;
    const rimColor =
      hole.kind === 'dust-bath'
        ? 0xb88a56
        : hole.kind === 'cool-pit'
          ? 0x6c6f53
          : hole.kind === 'safe-rest'
            ? 0x5b4a3b
            : 0x9b7048;
    const centerColor = moisture > 0.58 ? 0x45544f : 0x2f2119;

    view.fillStyle(rimColor, 0.36 + depth * 0.08).fillEllipse(0, 0, width + 12, height + 8);
    view.fillStyle(centerColor, 0.68).fillEllipse(0, 2, width, height);
    if (hole.kind === 'cool-pit') {
      view.fillStyle(0xa6d3cb, 0.2 + moisture * 0.18).fillEllipse(-4, -2, width * 0.65, height * 0.42);
    } else if (hole.kind === 'dust-bath') {
      view.lineStyle(2, 0xe0bd82, 0.62);
      for (let offset = -width * 0.32; offset <= width * 0.32; offset += 15) {
        view.lineBetween(offset - 7, -height * 0.22, offset + 8, height * 0.18);
      }
    } else if (hole.kind === 'safe-rest') {
      view.fillStyle(0xf1dfbb, 0.62).fillEllipse(width * 0.22, -height * 0.15, 16, 6);
    }
  }

  private createEggView(visible: boolean) {
    this.eggView?.destroy();
    if (!this.state.egg) return;
    const golden = this.state.egg.quality === 'excellent';
    const glow = this.add.circle(0, 0, golden ? 30 : 26, golden ? 0xffd75a : 0xfff1b8, golden ? 0.36 : 0.22);
    const egg = this.add.ellipse(0, 0, 22, 30, golden ? 0xffc928 : 0xfff2c7);
    const mark = this.add.ellipse(4, -6, 6, 9, golden ? 0xffef92 : 0xe8c982, 0.72);
    this.eggView = this.add.container(this.state.egg.x, this.state.egg.y, [glow, egg, mark]).setDepth(45);
    this.eggView.setVisible(visible);
  }

  private updateKeeperFeeding(dt: number) {
    if (dt <= 0) return;
    const seed = updateKeeper(this.state, dt, dt);
    if (!seed) return;
    this.foodViews.set(seed.id, this.createFoodView(seed));
    this.showScatterFx(seed);
    this.playSfx(SFX_PECK_KEY, 0.28);
  }

  private expireAndSyncFoods() {
    const foodUpdate = expireFoods(this.state);
    if (foodUpdate.expiredIds.length === 0 && foodUpdate.spawnedFoods.length === 0) return;
    for (const expiredId of foodUpdate.expiredIds) {
      this.foodViews.get(expiredId)?.destroy();
      this.foodViews.delete(expiredId);
    }
    for (const spawnedFood of foodUpdate.spawnedFoods) {
      this.foodViews.set(spawnedFood.id, this.createFoodView(spawnedFood));
    }
    this.syncFoodViews();
  }

  private revealEgg() {
    if (!this.eggView) this.createEggView(true);
    this.eggView?.setVisible(true).setAlpha(1);
    this.tweens.add({
      targets: this.eggView,
      y: this.eggView!.y - 12,
      yoyo: true,
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  private currentEggSpot(): EggSpot | null {
    return EGG_SPOTS.find((spot) => spot.id === this.state.eggSearch.spotId) ?? null;
  }

  private updateEggGuidance(dt: number) {
    this.eggClueSoundCooldown = Math.max(0, this.eggClueSoundCooldown - dt);
    this.eggDirectionTimer = Math.max(0, this.eggDirectionTimer - dt);
    if (!this.state.egg || this.state.egg.found) return;

    const showEggShape = distance(this.state.human, this.state.egg) < EGG_SHAPE_REVEAL_RANGE;
    this.eggView?.setVisible(showEggShape).setAlpha(showEggShape ? EGG_SHAPE_ALPHA : 1);

    if (
      this.state.eggSearch.clueLevel >= 1 &&
      distance(this.state.human, this.state.egg) < 360 &&
      this.eggClueSoundCooldown === 0
    ) {
      this.playSfx(SFX_NIGHT_RUSTLE_KEY, 0.14);
      this.eggClueSoundCooldown = 6;
    }

    if (this.eggDirectionTimer === 0) {
      this.showEggDirectionClue();
      this.eggDirectionTimer = 7.5;
    }
  }

  private syncEggClueView() {
    const spot = this.currentEggSpot();
    const visible =
      (this.state.flow.phase === 'morning-human' ||
        this.state.flow.phase === 'epilogue-human') &&
      Boolean(this.state.egg && !this.state.egg.found && spot);
    if (!visible || !spot) {
      this.clearEggClueView();
      return;
    }

    if (this.eggClueSpotId !== spot.id) {
      this.clearEggClueView();
      const g = this.add.graphics().setPosition(spot.cluePosition.x, spot.cluePosition.y).setDepth(42);
      if (spot.clueKind === 'feather') {
        g.fillStyle(0xf4e7c9, 0.9).fillEllipse(0, 0, 22, 9);
        g.lineStyle(2, 0xb99d76, 0.8).lineBetween(-10, 5, 12, -7);
      } else if (spot.clueKind === 'bent-grass') {
        g.lineStyle(3, 0x70854e, 0.9);
        g.lineBetween(-13, 10, -5, -11);
        g.lineBetween(-5, -11, 9, 2);
        g.lineBetween(3, 11, 13, -8);
      } else if (spot.clueKind === 'scratched-soil') {
        g.fillStyle(0x704a31, 0.54).fillEllipse(0, 3, 50, 24);
        g.lineStyle(2, 0x3f2b20, 0.85);
        g.lineBetween(-17, -5, 4, 8);
        g.lineBetween(-5, -9, 15, 5);
        g.lineBetween(6, -8, 22, 3);
      } else {
        g.fillStyle(0xf3e6c5, 0.88);
        g.fillTriangle(-12, 4, -5, -7, 1, 5);
        g.fillTriangle(4, 6, 10, -5, 16, 7);
      }
      this.eggClueView = g;
      this.eggClueSpotId = spot.id;
    }

    const level = this.state.eggSearch.clueLevel;
    const pulse = level === 2 ? 0.08 * Math.sin(this.time.now / 280) : 0;
    this.eggClueView?.setAlpha(level === 0 ? 0.28 : level === 1 ? 0.5 : 0.72 + pulse);
    this.eggClueView?.setScale(level === 2 ? 1.08 : 1);
  }

  private clearEggClueView() {
    this.eggClueView?.destroy();
    this.eggClueView = null;
    this.eggClueSpotId = null;
  }

  private showEggDirectionClue() {
    if (!this.state.egg || this.state.egg.found) return;
    const dx = this.state.egg.x - this.state.chicken.x;
    this.state.chickenWander.target = null;
    this.state.chickenWander.pause = 1.2;
    if (Math.abs(dx) > 2) this.state.chickenWander.facing = dx > 0 ? 1 : -1;
    this.showCluckFx(this.state.chicken, 0);
    this.time.delayedCall(260, () => {
      if (
        this.state.flow.phase === 'morning-human' ||
        this.state.flow.phase === 'epilogue-human'
      ) {
        this.showCluckFx(this.state.chicken, 0);
      }
    });
  }

  private updateSprites(dt = 1 / 60) {
    const lift = this.chickenLiftTimer > 0 ? -Math.sin((this.chickenLiftTimer / 0.85) * Math.PI) * 24 : 0;
    const movedDistance = this.lastChickenPosition ? distance(this.state.chicken, this.lastChickenPosition) : 0;
    const isWalking =
      movedDistance > CHICKEN_WALK_MOVE_EPSILON && movedDistance < CHICKEN_WALK_TELEPORT_DISTANCE;

    if (movedDistance >= CHICKEN_WALK_TELEPORT_DISTANCE) {
      this.chickenWalkPhase = 0;
      this.chickenWalkBlend = 0;
    } else {
      const targetBlend = isWalking ? 1 : 0;
      const blendSpeed = isWalking ? 12 : 9;
      this.chickenWalkBlend +=
        (targetBlend - this.chickenWalkBlend) * Math.min(1, Math.max(dt, 0) * blendSpeed);
      if (isWalking) {
        const walkSpeed = movedDistance / Math.max(dt, 1 / 60);
        const phaseSpeed = Phaser.Math.Clamp(8.5 + walkSpeed * 0.035, 8.5, 14.5);
        this.chickenWalkPhase += phaseSpeed * dt;
      }
    }

    const facing =
      this.state.mode === 'human'
        ? this.state.chickenWander.facing
        : this.chicken.scaleX >= 0
          ? 1
          : -1;
    const stride = Math.sin(this.chickenWalkPhase);
    const step = Math.abs(stride) * this.chickenWalkBlend;
    const bob = step * 3.8;
    const squash = step * 0.045;

    this.chicken.setPosition(this.state.chicken.x, this.state.chicken.y + lift - bob);
    this.chicken.setScale(facing * (1 + squash * 0.55), 1 - squash);
    this.chicken.rotation = stride * 0.055 * this.chickenWalkBlend * facing;
    const facilityActivity = this.state.facilityLife.activity;
    if (facilityActivity === 'dust-bath') {
      this.chicken.rotation = Math.sin(this.time.now / 85) * 0.18;
      this.chicken.setScale(facing * 1.06, 0.78);
    } else if (facilityActivity === 'shade-rest') {
      this.chicken.rotation = -0.08;
      this.chicken.setScale(facing * 1.04, 0.84);
    } else if (facilityActivity === 'perch-idle') {
      const look = Math.sin(this.time.now / 520) >= 0 ? 1 : -1;
      this.chicken.setScale(look, 1);
      this.chicken.setPosition(this.state.chicken.x, this.state.chicken.y - 8);
    }
    const encounter = this.state.weaselEncounter;
    if (
      !facilityActivity &&
      encounter &&
      encounter.phase !== 'lurking' &&
      distance(encounter.position, this.state.chicken) < 260
    ) {
      this.chicken.setScale(facing * 1.06, 0.82);
      this.chicken.rotation = Math.sin(this.time.now / 170) * 0.045;
    }
    if (!facilityActivity && (!encounter || encounter.warningSeconds > 0)) {
      if (this.state.heat >= 78) {
        this.chicken.setScale(facing * 1.08, 0.88);
        this.chicken.rotation += Math.sin(this.time.now / 140) * 0.025;
      } else if (this.isChickenVisiblyWet()) {
        this.chicken.setScale(facing * 0.98, 0.92);
      }
    }
    this.updateChickenBodyVisual(facilityActivity);
    this.lastChickenPosition = { ...this.state.chicken };
    this.human.setPosition(this.state.human.x, this.state.human.y);
    const showEscortLantern =
      this.state.mode === 'human' && this.state.flow.phase === 'dusk-human';
    this.humanLanternGlow
      ?.setVisible(showEscortLantern)
      .setPosition(this.state.human.x, this.state.human.y - 10);
    const lanternCenter = this.handLanternCenter();
    this.handLanternAim
      ?.setVisible(showEscortLantern && this.state.handLanternActive)
      .setPosition(lanternCenter.x, lanternCenter.y);
    this.duskVisionRing
      ?.setVisible(showEscortLantern && this.duskCollection.phase !== 'inside')
      .setPosition(this.state.chicken.x, this.state.chicken.y)
      .setRadius(visionRadiusFor(this.state.affection));
    const showYardLamp =
      this.state.yard.owned.includes('yard-lamp') &&
      (this.state.flow.phase === 'chicken-dusk' ||
        this.state.flow.phase === 'chicken-night' ||
        this.state.flow.phase === 'dusk-human' ||
        this.state.flow.phase === 'night-result');
    this.yardLampGlow?.setVisible(showYardLamp);
    this.syncEggClueView();
    this.keeper.setPosition(this.state.keeper.x, this.state.keeper.y);
    this.keeper.setVisible(this.state.mode === 'chicken' && this.state.keeper.active);
    this.keeper.scaleX = this.state.keeper.facing;
    if (encounter) {
      this.weasel.setPosition(encounter.position.x, encounter.position.y);
      this.weasel.setVisible(encounter.phase !== 'lurking');
      this.weasel.scaleX = encounter.position.x > this.state.chicken.x ? -1 : 1;
    } else {
      this.weasel.setVisible(false);
    }
  }

  private isChickenVisiblyWet() {
    return (
      this.state.mode === 'chicken' &&
      (this.state.weather === 'rain' || this.state.stormActive) &&
      !isInCoop(this.state.chicken) &&
      (this.state.muddyToday || this.state.flow.phase !== 'night-result')
    );
  }

  private updateChickenBodyVisual(facilityActivity: string | null) {
    if (!this.chickenBodyFx) return;
    this.chickenBodyFx.clear();
    this.chicken.clearTint();

    const wet = this.isChickenVisiblyWet();
    const hot = this.state.heat;
    if (wet) {
      this.chicken.setTint(0xbfd7d9);
    } else if (hot >= 78) {
      this.chicken.setTint(0xffc08a);
    } else if (hot >= 56) {
      this.chicken.setTint(0xffd9a3);
    } else if (this.state.waterBoost >= 70) {
      this.chicken.setTint(0xe8fff4);
    }

    const x = this.state.chicken.x;
    const y = this.state.chicken.y;
    const now = this.time.now;
    if (hot >= 62 && !wet) {
      const alpha = Phaser.Math.Clamp((hot - 55) / 45, 0.18, 0.58);
      this.chickenBodyFx.lineStyle(2, 0xffba6e, alpha);
      for (let i = 0; i < 3; i += 1) {
        const offset = -18 + i * 18;
        const wave = Math.sin(now / 180 + i) * 4;
        this.chickenBodyFx.beginPath();
        this.chickenBodyFx.moveTo(x + offset, y - 42);
        this.chickenBodyFx.lineTo(x + offset + wave, y - 52);
        this.chickenBodyFx.lineTo(x + offset - wave, y - 62);
        this.chickenBodyFx.strokePath();
      }
    }

    if (wet) {
      this.chickenBodyFx.fillStyle(0xbde2e8, 0.62);
      for (let i = 0; i < 4; i += 1) {
        const dx = -20 + i * 13;
        const drop = (now / 180 + i * 9) % 16;
        this.chickenBodyFx.fillEllipse(x + dx, y - 22 + drop, 4, 8);
      }
    }

    if (facilityActivity === 'dust-bath') {
      this.chickenBodyFx.fillStyle(0xd0a16b, 0.3);
      for (let i = 0; i < 5; i += 1) {
        this.chickenBodyFx.fillCircle(
          x + Math.sin(now / 90 + i) * 28,
          y + 10 + Math.cos(now / 120 + i) * 8,
          4,
        );
      }
    } else if (facilityActivity === 'shade-rest' || facilityActivity === 'hole-rest') {
      this.chickenBodyFx.fillStyle(0xffe7b0, 0.24).fillEllipse(x, y - 10, 84, 34);
    }
  }

  private updateNightVeil(time: number) {
    const storyPhase = this.state.flow.phase;
    const duskStarted =
      this.state.flow.clock >= DUSK_AT &&
      storyPhase !== 'morning-human' &&
      storyPhase !== 'epilogue-human' &&
      storyPhase !== 'ending';
    const darkness =
      storyPhase === 'night-result'
        ? 0.64
        : storyPhase === 'chicken-night'
          ? 0.64
        : storyPhase === 'chicken-dusk' || storyPhase === 'dusk-human' || duskStarted
          ? 0.38
          : 0;
    if (darkness <= 0) {
      if (this.nightVeil.visible) {
        this.nightVeil.clear();
        this.nightVeil.setVisible(false);
      }
      return;
    }
    if (this.nightVeil.visible && time - this.lastNightVeilAt < 80) return;
    this.lastNightVeilAt = time;
    this.nightVeil.setVisible(true);
    const camera = this.cameras.main;
    const view = camera.worldView;
    this.nightVeil.clear();
    this.nightVeil.fillStyle(0x08090d, darkness);
    this.nightVeil.fillRect(view.x - 4, view.y - 4, view.width + 8, view.height + 8);

    const encounter = this.state.weaselEncounter;
    const approachRatio = Phaser.Math.Clamp(this.state.weaselApproach / 100, 0, 1);
    const ambushRatio = encounter
      ? encounter.phase === 'lurking'
        ? 0.9
        : 1
      : approachRatio;
    if (
      this.state.mode === 'chicken' &&
      (storyPhase === 'chicken-dusk' || storyPhase === 'chicken-night') &&
      ambushRatio > 0.08
    ) {
      const edge = Phaser.Math.Linear(10, 96, ambushRatio) / camera.zoom;
      const alpha = Phaser.Math.Linear(0.04, 0.28, ambushRatio);
      this.nightVeil.fillStyle(0x16081f, alpha);
      this.nightVeil.fillRect(view.x - 4, view.y - 4, view.width + 8, edge);
      this.nightVeil.fillRect(view.x - 4, view.y + view.height - edge + 4, view.width + 8, edge);
      this.nightVeil.fillRect(view.x - 4, view.y - 4, edge, view.height + 8);
      this.nightVeil.fillRect(view.x + view.width - edge + 4, view.y - 4, edge, view.height + 8);
    }

    if (storyPhase === 'chicken-dusk' || storyPhase === 'chicken-night') {
      const pulse = 0.5 + Math.sin(time / 620) * 0.5;
      const wideRadius = (storyPhase === 'chicken-night' ? 178 : 140) / camera.zoom;
      const coreRadius = (storyPhase === 'chicken-night' ? 62 : 48) / camera.zoom;
      this.nightVeil.fillStyle(0xffc974, 0.1 + pulse * 0.035);
      this.nightVeil.fillCircle(COOP_DOOR.x, COOP_DOOR.y + 4, wideRadius);
      this.nightVeil.fillStyle(0xffefbd, 0.13 + pulse * 0.045);
      this.nightVeil.fillCircle(COOP_DOOR.x, COOP_DOOR.y + 6, coreRadius);
    }

    if (this.state.mode === 'chicken' && darkness > 0) {
      const radius = (220 + this.state.stats.lamp * 12) / camera.zoom;
      this.nightVeil.fillStyle(0xffe4a3, 0.08);
      this.nightVeil.fillCircle(this.state.chicken.x, this.state.chicken.y, radius);
    }
  }

  private showPeckFx(food: FoodEntity) {
    const color = food.type === 'nightBug' ? 0xa9caff : food.type === 'meat' ? 0xffb19c : 0xffdfa0;
    const spark = this.add.circle(food.x, food.y, 6, color, 0.86).setDepth(70);
    this.tweens.add({
      targets: spark,
      y: food.y - 22,
      alpha: 0,
      scale: 1.8,
      duration: 360,
      onComplete: () => spark.destroy(),
    });
  }

  private showScatterFx(food: FoodEntity) {
    const color = food.type === 'meat' ? 0xffb19c : 0xffd66e;
    for (let i = 0; i < 4; i += 1) {
      const seed = this.add.circle(
        food.x + Phaser.Math.Between(-16, 16),
        food.y + Phaser.Math.Between(-8, 8),
        3,
        color,
        0.82,
      ).setDepth(66);
      this.tweens.add({
        targets: seed,
        y: seed.y + Phaser.Math.Between(8, 20),
        alpha: 0,
        duration: 520,
        delay: i * 45,
        onComplete: () => seed.destroy(),
      });
    }
  }

  private updateWeatherView(time: number) {
    this.weatherOverlay.clear();
    this.rainView.clear();
    const weather = this.state.stormActive ? 'rain' : this.state.weather;
    if (weather === 'sunny') return;

    this.weatherOverlay.fillStyle(
      weather === 'rain' ? 0x4c6470 : 0x52605d,
      this.state.stormActive
        ? 0.24 + Math.max(0, Math.sin(time / 280)) * 0.08
        : weather === 'rain'
          ? 0.16
          : 0.09,
    );
    this.weatherOverlay.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    if (weather !== 'rain') return;

    this.rainView.lineStyle(2, 0xb8d8df, this.state.stormActive ? 0.58 : 0.42);
    const rainCount = this.state.stormActive ? 54 : 34;
    for (let index = 0; index < rainCount; index += 1) {
      const x = (index * 173 + time * (this.state.stormActive ? 0.56 : 0.38)) % WORLD_WIDTH;
      const y = (index * 97 + time * (this.state.stormActive ? 0.82 : 0.62)) % WORLD_HEIGHT;
      this.rainView.lineBetween(x, y, x - 9, y + (this.state.stormActive ? 31 : 25));
    }
  }

  private showHandFeedFx(position: Vec2) {
    for (let i = 0; i < 9; i += 1) {
      const grain = this.add.ellipse(
        position.x + Phaser.Math.Between(-22, 22),
        position.y + Phaser.Math.Between(-10, 12),
        6,
        3,
        0xffd86a,
        0.9,
      ).setDepth(66);
      this.tweens.add({
        targets: grain,
        y: grain.y + Phaser.Math.Between(8, 18),
        alpha: 0.35,
        duration: 420,
        delay: i * 24,
        ease: 'Quad.easeOut',
        onComplete: () => grain.destroy(),
      });
    }
  }

  private showHeartFx(position: Vec2) {
    for (let i = 0; i < 5; i += 1) {
      const heart = this.add.text(
        position.x + Phaser.Math.Between(-22, 22),
        position.y - 34 + Phaser.Math.Between(-10, 10),
        '♥',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: `${18 + i * 2}px`,
          color: i % 2 ? '#ffd98a' : '#ff9f8f',
        },
      ).setOrigin(0.5).setDepth(80);
      this.tweens.add({
        targets: heart,
        y: heart.y - Phaser.Math.Between(28, 46),
        alpha: 0,
        duration: 900,
        delay: i * 80,
        ease: 'Sine.easeOut',
        onComplete: () => heart.destroy(),
      });
    }
  }

  private showRepairFx(position: Vec2) {
    const glow = this.add.circle(position.x, position.y, 54, 0xffe29a, 0.22).setDepth(50);
    this.tweens.add({
      targets: glow,
      scale: 1.5,
      alpha: 0,
      duration: 720,
      onComplete: () => glow.destroy(),
    });

    for (let i = 0; i < 7; i += 1) {
      const chip = this.add.rectangle(
        position.x + Phaser.Math.Between(-34, 34),
        position.y + Phaser.Math.Between(-18, 24),
        10,
        4,
        0xd6a45e,
        0.82,
      ).setDepth(78);
      chip.rotation = Phaser.Math.FloatBetween(-0.8, 0.8);
      this.tweens.add({
        targets: chip,
        y: chip.y + Phaser.Math.Between(12, 26),
        alpha: 0,
        duration: 680,
        delay: i * 34,
        onComplete: () => chip.destroy(),
      });
    }
  }

  private showKeeperRescueFx() {
    const from = {
      x: HOUSE.x + HOUSE.width * 0.5,
      y: HOUSE.y + HOUSE.height + 24,
    };
    const target = { x: this.state.weasel.x, y: this.state.weasel.y };
    const beam = this.add.graphics().setDepth(81);
    beam.lineStyle(8, 0xffe29a, 0.28);
    beam.lineBetween(from.x, from.y, target.x, target.y);
    beam.fillStyle(0xffe29a, 0.26);
    beam.fillCircle(target.x, target.y, 74);

    const call = this.add.text(from.x, from.y - 42, '提灯', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '20px',
      fontStyle: '700',
      color: '#fff4bd',
      stroke: '#3c2a1c',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(82);

    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 780,
      ease: 'Sine.easeOut',
      onComplete: () => beam.destroy(),
    });
    this.tweens.add({
      targets: call,
      y: call.y - 26,
      alpha: 0,
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => call.destroy(),
    });
  }

  private playCloseMoment() {
    const camera = this.cameras.main;
    this.tweens.killTweensOf(camera);
    this.tweens.add({
      targets: camera,
      zoom: BASE_CAMERA_ZOOM * 1.08,
      duration: 180,
      yoyo: true,
      hold: 420,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        camera.setZoom(BASE_CAMERA_ZOOM);
      },
    });
  }

  private showGroundPeck() {
    const dust = this.add.ellipse(this.state.chicken.x + 16, this.state.chicken.y + 8, 18, 8, 0xd0a16b, 0.54).setDepth(55);
    this.tweens.add({
      targets: dust,
      alpha: 0,
      scaleX: 1.7,
      duration: 220,
      onComplete: () => dust.destroy(),
    });
  }

  private showScratchDirtFx(hole: HoleEntity) {
    for (let i = 0; i < 6; i += 1) {
      const clod = this.add.ellipse(
        hole.x + Phaser.Math.Between(-18, 18),
        hole.y + Phaser.Math.Between(-10, 8),
        Phaser.Math.Between(6, 10),
        Phaser.Math.Between(3, 6),
        hole.moisture > 0.55 ? 0x5b4f3f : 0xb88a56,
        0.68,
      ).setDepth(58);
      this.tweens.add({
        targets: clod,
        x: clod.x + Phaser.Math.Between(-22, 22),
        y: clod.y + Phaser.Math.Between(10, 24),
        alpha: 0,
        duration: 420,
        delay: i * 24,
        ease: 'Quad.easeOut',
        onComplete: () => clod.destroy(),
      });
    }
  }

  private showCluckFx(position: Vec2, scaredCount: number) {
    this.playCluckSfx(scaredCount);
    const ringColor = scaredCount > 0 ? 0xfff0a8 : 0xf7cf85;
    const ring = this.add.circle(position.x, position.y, scaredCount > 0 ? 30 : 20, ringColor, 0.18).setDepth(68);
    const call = this.add.text(position.x, position.y - 34, '咯咯', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: scaredCount > 0 ? '21px' : '17px',
      fontStyle: '700',
      color: scaredCount > 0 ? '#fff4bd' : '#f8ddb2',
      stroke: '#3c2a1c',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(82);
    this.tweens.add({
      targets: ring,
      scale: scaredCount > 0 ? 3.2 : 2.2,
      alpha: 0,
      duration: scaredCount > 0 ? 520 : 360,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: call,
      y: call.y - 18,
      alpha: 0,
      duration: 620,
      ease: 'Sine.easeOut',
      onComplete: () => call.destroy(),
    });
  }

  private showStolenFoodFx(position: Vec2) {
    const text = this.add.text(position.x, position.y - 18, '被偷吃', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '15px',
      color: '#ffe0a0',
      stroke: '#3c2a1c',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(82);
    this.tweens.add({
      targets: text,
      y: text.y - 28,
      alpha: 0,
      duration: 720,
      ease: 'Sine.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private showRestPuffs(hole: HoleEntity) {
    if (Math.random() > 0.08) return;
    const puff = this.add.circle(hole.x + Phaser.Math.Between(-12, 12), hole.y - 8, 5, 0xffe2aa, 0.28).setDepth(58);
    this.tweens.add({
      targets: puff,
      y: puff.y - 24,
      alpha: 0,
      duration: 700,
      onComplete: () => puff.destroy(),
    });
  }

  private showDrinkRipples(position: Vec2) {
    if (Math.random() > 0.1) return;
    const ripple = this.add.ellipse(position.x, position.y + 10, 18, 7, 0xb9ece2, 0.22).setDepth(57);
    this.tweens.add({
      targets: ripple,
      scaleX: 2.6,
      scaleY: 1.7,
      alpha: 0,
      duration: 520,
      onComplete: () => ripple.destroy(),
    });
  }

  private emitHud(consumeTransient = true, forceSave = false) {
    this.saveGame(forceSave || !consumeTransient);
    window.dispatchEvent(
      new CustomEvent('chicken-life:hud', {
        detail: buildHudSnapshot(this.state, consumeTransient),
      }),
    );
  }

  private saveGame(force = false) {
    if (!force && this.time.now - this.lastSavedAt < 2600) return;
    this.lastSavedAt = this.time.now;
    this.state.saveAvailable = writeSaveEnvelope(window.localStorage, this.state);
  }
}

function isTextEntryTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isTouchOptionOrNull(value: unknown): value is TouchOption | null {
  return value === null || value === 'head' || value === 'back' || value === 'hold';
}

function isHuntingFood(type: FoodEntity['type']) {
  return type === 'cricket' || type === 'beetle' || type === 'nightBug';
}

function isHeatFreeFood(type: FoodEntity['type']) {
  return type === 'grain' || type === 'grass' || type === 'sunflower';
}

function huntingFoodTextureSteps(type: FoodEntity['type']) {
  return type === 'beetle' ? 3 : 2;
}

function foodPeckSeconds(type: FoodEntity['type'], result: 'eaten' | 'pecked') {
  if (type === 'sunflower') return 2.2;
  if (type === 'nightBug') return result === 'eaten' ? 2 : 1.55;
  if (type === 'beetle') return result === 'eaten' ? 1.8 : 1.35;
  if (type === 'cricket') return result === 'eaten' ? 1.45 : 1.15;
  if (type === 'worm' || type === 'bug') return 1.15;
  return 0.9;
}

function normalize(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  if (!length) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}
