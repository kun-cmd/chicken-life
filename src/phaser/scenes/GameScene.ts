import Phaser from 'phaser';
import {
  BLOCKERS,
  COOP,
  COOP_DOOR,
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
  isNearPond,
  isOnPath,
} from '../../game/content/yard';
import {
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  loadSaveEnvelope,
  writeSaveEnvelope,
} from '../../game/persistence/saveGame';
import {
  advanceChickenTime,
  buildHudSnapshot,
  callKeeperForWeasel,
  cluckAt,
  collectEgg,
  createGameState,
  debugAddAffection,
  debugAddMaterials,
  debugJumpToDusk,
  debugSetEggType,
  digHole,
  drinkAtPond,
  expireFoods,
  finishChickenRun,
  hugChicken,
  improveCoopAbility,
  isFoodLockedByAnimal,
  isNearLight,
  isShadowy,
  peckFood,
  repairCoop,
  recoverStamina,
  restockEdibleFoods,
  restInHole,
  restoreGameState,
  setChickenName,
  overstuffRatioFor,
  spendStamina,
  startNextDay,
  updateAnimals,
  updateKeeper,
  updateKeeperRescue,
  updateWaterBoost,
  updateMorningChickenWander,
  updateNightPressure,
  visibleFoods,
} from '../../game/simulation/state';
import type { EggType, FoodEntity, HoleEntity, Vec2, YardAnimal } from '../../game/simulation/state';
import type { InputActions } from '../../game/input/actions';
import { KeyboardState } from '../../game/input/keyboardState';

type FoodView = Phaser.GameObjects.Image & { foodId: number };
type AnimalView = Phaser.GameObjects.Image & { animalId: number; animalType: YardAnimal['type'] };
type DebugAction =
  | { action: 'addAffection' }
  | { action: 'addMaterials' }
  | { action: 'jumpDusk' }
  | { action: 'spawnWeasel' }
  | { action: 'forceEgg'; eggType: EggType }
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
  'KeyQ',
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
  private foodViews = new Map<number, FoodView>();
  private holeViews = new Map<number, Phaser.GameObjects.Image>();
  private animalViews = new Map<number, AnimalView>();
  private eggView: Phaser.GameObjects.Container | null = null;
  private lastHudAt = 0;
  private nextDayTimer = 0;
  private peckCooldown = 0;
  private digCooldown = 0;
  private drinkSfxCooldown = 0;
  private caughtCooldown = 0;
  private chickenLiftTimer = 0;
  private chickenWalkPhase = 0;
  private chickenWalkBlend = 0;
  private lastChickenPosition: Vec2 | null = null;
  private lastSavedAt = 0;
  private lastNightVeilAt = 0;
  private dayMusic: Phaser.Sound.BaseSound | null = null;
  private nightMusic: Phaser.Sound.BaseSound | null = null;
  private activeMusic: 'day' | 'night' | null = null;
  private musicUnlocked = false;
  private masterVolume = loadSavedMasterVolume();
  private recentCluckSfx: string[] = [];

  private handleGameplayKeyDown = (event: KeyboardEvent) => {
    if (!this.state.profile.named || isTextEntryTarget(event.target)) return;
    if (!GAMEPLAY_KEY_CODES.has(event.code)) return;
    this.keyboardState.keyDown(event.code, event.repeat);
    event.preventDefault();
  };

  private handleGameplayKeyUp = (event: KeyboardEvent) => {
    if (!this.state.profile.named || isTextEntryTarget(event.target)) return;
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

    if (detail.action === 'addAffection') {
      debugAddAffection(this.state);
      this.showHeartFx(this.state.chicken);
    }
    if (detail.action === 'addMaterials') debugAddMaterials(this.state);
    if (detail.action === 'jumpDusk') debugJumpToDusk(this.state);
    if (detail.action === 'spawnWeasel') {
      if (this.state.mode === 'chicken') {
        this.spawnWeasel();
        this.state.message = '调试：黄鼠狼从院墙边钻了进来。';
      } else {
        this.state.message = '调试：只有母鸡行动时才能生成黄鼠狼。';
      }
    }
    if (detail.action === 'forceEgg') debugSetEggType(this.state, detail.eggType);
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
    this.createFoodViews();
    this.createHoleViews();
    this.chicken = this.createChickenSprite(this.state.chicken);
    this.human = this.createHumanSprite(this.state.human);
    this.human.setVisible(false);
    this.keeper = this.createKeeperSprite(this.state.keeper);
    this.weasel = this.createWeaselSprite(this.state.weasel);
    this.nightVeil = this.add.graphics().setDepth(95);
    this.setupMusic();
    window.addEventListener('chicken-life:debug', this.handleDebugEvent);
    window.addEventListener('chicken-life:volume', this.handleVolumeEvent);
    window.addEventListener('chicken-life:name-confirmed', this.handleNameConfirmed);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('chicken-life:debug', this.handleDebugEvent);
      window.removeEventListener('chicken-life:volume', this.handleVolumeEvent);
      window.removeEventListener('chicken-life:name-confirmed', this.handleNameConfirmed);
      window.removeEventListener('keydown', this.handleMusicUnlock);
      window.removeEventListener('keydown', this.handleGameplayKeyDown, { capture: true });
      window.removeEventListener('keyup', this.handleGameplayKeyUp, { capture: true });
      window.removeEventListener('blur', this.resetGameplayKeys);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.input.off('pointerdown', this.handleMusicUnlock);
      this.dayMusic?.stop();
      this.nightMusic?.stop();
    });
    this.applySceneViewFromState();
    this.emitHud(true);
  }

  update(time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (!this.state.profile.named) {
      this.updateSprites(dt);
      return;
    }
    const actions = this.readActions();
    this.peckCooldown = Math.max(0, this.peckCooldown - dt);
    this.digCooldown = Math.max(0, this.digCooldown - dt);
    this.drinkSfxCooldown = Math.max(0, this.drinkSfxCooldown - dt);
    this.caughtCooldown = Math.max(0, this.caughtCooldown - dt);
    this.chickenLiftTimer = Math.max(0, this.chickenLiftTimer - dt);

    if (this.state.mode === 'chicken') {
      this.updateChicken(dt, actions);
    } else {
      this.updateHuman(dt, actions);
    }

    this.updateSprites(dt);
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
      sprint: this.keyboardState.isDown('ShiftLeft') || this.keyboardState.isDown('ShiftRight'),
      peck: spacePressed,
      digOrRest: this.keyboardState.isDown('KeyE'),
      interact: interactPressed,
      search: spacePressed || enterPressed,
      call: this.keyboardState.consumePress('KeyQ'),
    };
  }

  private updateChicken(dt: number, actions: InputActions) {
    let actionSeconds = 0;
    const direction = normalize(actions.x, actions.y);
    const hasMove = direction.x !== 0 || direction.y !== 0;
    const stuffedDrag = 1 - overstuffRatioFor(this.state) * 0.2;
    const canSprint = actions.sprint && this.state.stats.stamina > 6 && hasMove;
    const speed =
      this.state.stats.speed * stuffedDrag * (canSprint ? 1.52 : 1) * (isOnPath(this.state.chicken) ? 1.06 : 1);

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
    }
    if (canSprint) {
      spendStamina(this.state, 26 * dt);
    } else {
      recoverStamina(this.state, (hasMove ? 18 : 34) * dt);
    }

    if (this.handleCoopEntry(actions)) return;
    actionSeconds += this.handleChickenActions(dt, actions);
    this.advanceChickenWorld(actionSeconds);
    if (this.updateRealtimeThreats(dt)) return;
    if (this.handleCoopEntry(actions)) return;

    if (this.state.time >= 0.995 && this.caughtCooldown <= 0) {
      finishChickenRun(this.state, true);
      this.switchToHuman();
    }
  }

  private handleCoopEntry(actions: InputActions) {
    if ((this.state.phase !== 'dusk' && this.state.phase !== 'night') || !this.isAtCoopDoor()) return false;

    if (actions.search) {
      finishChickenRun(this.state, false);
      this.switchToHuman();
      return true;
    }

    if (!this.state.message) {
      this.state.message = '天黑了，鸡窝门就在旁边。按空格键进屋。';
    }
    return false;
  }

  private handleChickenActions(dt: number, actions: InputActions) {
    let actionSeconds = 0;
    if (actions.digOrRest && isNearPond(this.state.chicken)) {
      if (drinkAtPond(this.state, dt * 1.25)) {
        actionSeconds += dt * 2.4;
        if (this.drinkSfxCooldown <= 0) {
          this.playSfx(SFX_DRINK_KEY, 0.46);
          this.drinkSfxCooldown = 0.85;
        }
        this.showDrinkRipples(this.state.chicken);
        return actionSeconds;
      }
    }

    const nearestHole = this.nearestHole(34);
    if (actions.digOrRest && nearestHole) {
      restInHole(this.state, nearestHole, dt * 1.35);
      actionSeconds += dt * 3.2;
      this.showRestPuffs(nearestHole);
      return actionSeconds;
    }

    if (actions.digOrRest && this.digCooldown <= 0 && !isOnPath(this.state.chicken)) {
      const hole = digHole(this.state, this.state.chicken);
      if (hole) {
        this.addHoleView(hole);
        this.digCooldown = 0.65;
        this.playSfx(SFX_DIG_KEY, 0.54);
        this.cameras.main.shake(70, 0.002);
        actionSeconds += 11;
      }
      return actionSeconds;
    }

    if (actions.peck && this.peckCooldown <= 0) {
      const food = this.nearestFood(40);
      if (food) {
        const result = peckFood(this.state, food);
        if (result === 'eaten') {
          this.foodViews.get(food.id)?.destroy();
          this.foodViews.delete(food.id);
          this.playSfx(SFX_PECK_KEY, 0.4);
          this.showPeckFx(food);
          actionSeconds += food.type === 'sunflower' ? 2.2 : 1.4;
        } else if (result === 'pecked') {
          this.refreshFoodView(food);
          this.playSfx(SFX_PECK_KEY, 0.36);
          this.showPeckFx(food);
          actionSeconds += 1.1;
        } else {
          this.showGroundPeck();
          actionSeconds += 0.9;
        }
        this.peckCooldown = food.type === 'sunflower' ? 0.18 : food.type === 'meat' ? 0.22 : 0.26;
      } else {
        if ((this.state.phase === 'dusk' || this.state.phase === 'night') && this.state.weasel.active) {
          const called = callKeeperForWeasel(this.state);
          this.showCluckFx(this.state.chicken, called ? 1 : 0);
          if (called) {
            this.playCloseMoment();
          }
          actionSeconds += 0.85;
          this.peckCooldown = 0.32;
          return actionSeconds;
        }

        const result = cluckAt(this.state, this.state.chicken);
        for (const droppedFood of result.droppedFoods) {
          this.foodViews.set(droppedFood.id, this.createFoodView(droppedFood));
          this.showScatterFx(droppedFood);
        }
        this.showCluckFx(this.state.chicken, result.scaredIds.length);
        this.scareAnimalViews(result.scaredIds);
        actionSeconds += 0.85;
        this.peckCooldown = 0.32;
      }
    }

    return actionSeconds;
  }

  private advanceChickenWorld(actionSeconds: number) {
    if (actionSeconds <= 0) return;
    advanceChickenTime(this.state, actionSeconds);
    updateWaterBoost(this.state, actionSeconds);
    const actorSeconds = Math.min(actionSeconds, 0.08);
    const newSeed = updateKeeper(this.state, actorSeconds, actionSeconds);
    if (newSeed) {
      this.foodViews.set(newSeed.id, this.createFoodView(newSeed));
      this.showScatterFx(newSeed);
    }
    const foodUpdate = expireFoods(this.state);
    for (const expiredId of foodUpdate.expiredIds) {
      this.foodViews.get(expiredId)?.destroy();
      this.foodViews.delete(expiredId);
    }
    for (const spawnedFood of foodUpdate.spawnedFoods) {
      this.foodViews.set(spawnedFood.id, this.createFoodView(spawnedFood));
    }
    const animalUpdate = updateAnimals(this.state, actionSeconds);
    for (const stolenId of animalUpdate.stolenFoodIds) {
      const view = this.foodViews.get(stolenId);
      if (view) this.showStolenFoodFx({ x: view.x, y: view.y });
      view?.destroy();
      this.foodViews.delete(stolenId);
    }
    for (const spawnedFood of restockEdibleFoods(this.state)) {
      this.foodViews.set(spawnedFood.id, this.createFoodView(spawnedFood));
    }
    this.syncFoodViews();
    this.syncAnimalViews();
    this.updatePressure(actionSeconds);
  }

  private updateRealtimeThreats(dt: number) {
    if (updateKeeperRescue(this.state, dt)) {
      this.weasel.setVisible(false);
      this.showKeeperRescueFx();
      this.playCloseMoment();
      return false;
    }
    return this.updateWeasel(dt);
  }

  private updatePressure(dt: number) {
    const position = this.state.chicken;
    updateNightPressure(this.state, {
      dt,
      position,
      staminaRatio: this.state.stats.stamina / this.state.stats.maxStamina,
      inShadow: isShadowy(position),
      onPath: isOnPath(position),
      nearCoop: distance(position, COOP_DOOR) < 150,
      nearLight: isNearLight(position, this.state.stats.lamp),
    });
  }

  private isAtCoopDoor() {
    return distance(this.state.chicken, COOP_DOOR) < 72;
  }

  private updateWeasel(dt: number) {
    if (this.state.keeperRescueUsedToday && !this.state.weasel.active && !this.state.keeper.rescuing) return false;

    const shouldWake =
      this.state.phase === 'night' ||
      (this.state.phase === 'dusk' && (this.state.nightPressure > 48 || this.state.eaten.nightBug > 0));

    if (shouldWake && !this.state.weasel.active) {
      this.spawnWeasel();
      this.state.message = '院墙外有细长的影子钻了进来。';
    }

    if (!this.state.weasel.active) return false;

    this.state.weasel.stunned = Math.max(0, this.state.weasel.stunned - dt);
    const toChicken = {
      x: this.state.chicken.x - this.state.weasel.x,
      y: this.state.chicken.y - this.state.weasel.y,
    };
    const dist = Math.hypot(toChicken.x, toChicken.y);
    const highPressure = this.state.nightPressure > 72;
    this.state.weasel.chasing = highPressure || dist < 230;

    const driftTarget = this.state.weasel.chasing ? this.state.chicken : this.pickWeaselPatrolTarget();
    const vector = normalize(driftTarget.x - this.state.weasel.x, driftTarget.y - this.state.weasel.y);
    const speed = (this.state.weasel.chasing ? 112 : 68) + this.state.nightPressure * 0.36;

    if (this.state.weasel.stunned <= 0) {
      this.state.weasel.x += vector.x * speed * dt;
      this.state.weasel.y += vector.y * speed * dt;
    }

    if (dist < 34 && this.caughtCooldown <= 0) {
      this.caughtCooldown = 2;
      finishChickenRun(this.state, true);
      this.switchToHuman();
      return true;
    }
    return false;
  }

  private updateHuman(dt: number, actions: InputActions) {
    const direction = normalize(actions.x, actions.y);
    if (direction.x || direction.y) {
      const target = {
        x: this.state.human.x + direction.x * 175 * dt,
        y: this.state.human.y + direction.y * 175 * dt,
      };
      if (!isBlocked(target, 20)) {
        this.state.human = target;
      }
      this.human.scaleX = direction.x < -0.05 ? -1 : direction.x > 0.05 ? 1 : this.human.scaleX;
    }

    updateMorningChickenWander(this.state, dt);

    const nearCoop = distance(this.state.human, COOP_DOOR) < 94;

    if (actions.interact) {
      if (distance(this.state.human, this.state.chicken) < 74) {
        if (hugChicken(this.state)) {
          this.chickenLiftTimer = 0.85;
          this.showHeartFx(this.state.chicken);
          this.playCloseMoment();
        }
      } else if (nearCoop) {
        if (repairCoop(this.state)) {
          this.playSfx(SFX_REWARD_KEY, 0.58);
          this.showRepairFx(COOP_DOOR);
          this.playCloseMoment();
        }
      } else {
        this.state.message = '靠近鸡或鸡窝时按 E 可以互动。';
      }
    }

    const usedCoopTraining = actions.search && nearCoop;
    if (usedCoopTraining) {
      if (improveCoopAbility(this.state)) {
        this.playSfx(SFX_UPGRADE_KEY, 0.62);
        this.showRepairFx(COOP_DOOR);
        this.playCloseMoment();
      }
    }

    if (!usedCoopTraining && this.state.egg && !this.state.egg.found) {
      const eggDistance = distance(this.state.human, this.state.egg);
      if (eggDistance < 132) this.showEggClue();
      if (actions.search && eggDistance < 76) {
        collectEgg(this.state);
        this.playSfx(SFX_REWARD_KEY, 0.64);
        this.revealEgg();
        this.nextDayTimer = 3.2;
      } else if (actions.search && eggDistance >= 76) {
        this.state.message = '这里没有蛋，鸡刚才不是朝这个方向叫。';
      }
    }

    if (this.nextDayTimer > 0) {
      this.nextDayTimer -= dt;
      if (this.nextDayTimer <= 0) {
        startNextDay(this.state);
        this.switchToChicken();
      }
    }
  }

  private switchToHuman() {
    this.chicken.setVisible(true);
    this.human.setVisible(true);
    this.keeper.setVisible(false);
    this.weasel.setVisible(false);
    this.clearAnimalViews();
    this.createEggView(false);
    this.cameras.main.startFollow(this.human, true, 0.12, 0.12);
    this.emitHud(true, true);
  }

  private switchToChicken() {
    this.chicken.setVisible(true);
    this.human.setVisible(false);
    this.keeper.setVisible(this.state.keeper.active);
    this.weasel.setVisible(false);
    this.eggView?.destroy();
    this.eggView = null;
    this.clearAnimalViews();
    this.createFoodViews();
    this.syncHoleViews();
    this.syncAnimalViews();
    this.cameras.main.startFollow(this.chicken, true, 0.12, 0.12);
    this.emitHud(true, true);
  }

  private rebuildWorldFromState() {
    this.clearAnimalViews();
    for (const view of this.holeViews.values()) view.destroy();
    this.holeViews.clear();
    this.eggView?.destroy();
    this.eggView = null;
    this.createFoodViews();
    this.createHoleViews();
    this.applySceneViewFromState();
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
      this.updateMusic(true);
      return;
    }

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

  private spawnWeasel() {
    const point = this.pickWeaselSpawnPoint();
    this.state.weasel.x = Phaser.Math.Clamp(point.x, 30, WORLD_WIDTH - 30);
    this.state.weasel.y = Phaser.Math.Clamp(point.y, 30, WORLD_HEIGHT - 30);
    this.state.weasel.active = true;
    this.state.weasel.chasing = false;
    this.state.weasel.stunned = 0;
    this.weasel.setVisible(true);
    this.playSfx(SFX_NIGHT_RUSTLE_KEY, 0.48);
  }

  private pickWeaselSpawnPoint(): Vec2 {
    let best = { x: 30, y: WORLD_HEIGHT - 30 };
    let bestDistance = 0;
    for (let i = 0; i < 36; i += 1) {
      const point = this.randomEdgePoint();
      const d = distance(point, this.state.chicken);
      if (this.isBadWeaselSpawn(point)) continue;
      if (d > bestDistance) {
        best = point;
        bestDistance = d;
      }
    }
    return bestDistance > 0 ? best : this.farthestWeaselSpawnPoint();
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

  private isBadWeaselSpawn(point: Vec2) {
    const toPoint = { x: point.x - this.state.chicken.x, y: point.y - this.state.chicken.y };
    const d = Math.hypot(toPoint.x, toPoint.y);
    const facing = this.chicken.scaleX >= 0 ? 1 : -1;
    const inFront = toPoint.x * facing > 0 && Math.abs(toPoint.y) < 230 && d < 540;
    return d < 430 || inFront;
  }

  private pickWeaselPatrolTarget(): Vec2 {
    const shadow = TREE_POSITIONS[Math.floor(Math.random() * TREE_POSITIONS.length)];
    if (Math.random() < 0.04 && shadow) return shadow;
    return {
      x: this.state.chicken.x + Math.sin(this.time.now / 900) * 160,
      y: this.state.chicken.y + Math.cos(this.time.now / 1100) * 130,
    };
  }

  private nearestFood(radius: number) {
    let best: FoodEntity | null = null;
    let bestDistance = radius;
    for (const food of visibleFoods(this.state)) {
      if (isFoodLockedByAnimal(this.state, food)) continue;
      const d = distance(food, this.state.chicken);
      if (d < bestDistance) {
        best = food;
        bestDistance = d;
      }
    }
    return best;
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
    this.generateTexture('food-grass', 44, 40, (g) => {
      g.fillStyle(0x87c358, 1).fillTriangle(14, 28, 22, 10, 30, 28);
      g.fillStyle(0x5fa242, 1).fillTriangle(25, 31, 32, 12, 39, 31);
    });
    this.generateTexture('food-bug', 36, 32, (g) => {
      g.fillStyle(0x312418, 1).fillEllipse(17, 17, 14, 8);
      g.fillStyle(0x0f0c09, 1).fillCircle(24, 15, 2);
    });
    this.generateTexture('food-nightBug', 36, 36, (g) => {
      g.fillStyle(0x7aa7ff, 0.45).fillCircle(18, 18, 8);
      g.fillStyle(0x9fc7ff, 1).fillEllipse(18, 18, 12, 8);
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
      food.type === 'meat'
        ? `food-meat-${Math.min(food.progress ?? 0, food.hardness ?? 3)}`
        : food.type === 'sunflower'
          ? `food-sunflower-${Math.min(food.progress ?? 0, food.hardness ?? 2)}`
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
      if (!this.holeViews.has(hole.id)) this.addHoleView(hole);
    }
  }

  private addHoleView(hole: HoleEntity) {
    const view = this.add.image(hole.x, hole.y, 'hole').setDepth(34);
    this.holeViews.set(hole.id, view);
  }

  private createEggView(visible: boolean) {
    this.eggView?.destroy();
    if (!this.state.egg) return;
    const glow = this.add.circle(0, 0, 26, 0xfff1b8, 0.22);
    const egg = this.add.ellipse(0, 0, 22, 30, 0xfff2c7);
    const mark = this.add.ellipse(4, -6, 6, 9, 0xe8c982, 0.72);
    this.eggView = this.add.container(this.state.egg.x, this.state.egg.y, [glow, egg, mark]).setDepth(45);
    this.eggView.setVisible(visible);
  }

  private revealEgg() {
    if (!this.eggView) this.createEggView(true);
    this.eggView?.setVisible(true);
    this.tweens.add({
      targets: this.eggView,
      y: this.eggView!.y - 12,
      yoyo: true,
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  private showEggClue() {
    if (!this.state.egg || this.state.egg.found || !this.eggView) return;
    const distanceToEgg = distance(this.state.human, this.state.egg);
    if (distanceToEgg < 92) {
      this.eggView.setVisible(true);
      this.eggView.setAlpha(Phaser.Math.Clamp(1 - distanceToEgg / 110, 0.18, 0.72));
    }
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
    this.lastChickenPosition = { ...this.state.chicken };
    this.human.setPosition(this.state.human.x, this.state.human.y);
    this.keeper.setPosition(this.state.keeper.x, this.state.keeper.y);
    this.keeper.setVisible(this.state.mode === 'chicken' && this.state.keeper.active);
    this.keeper.scaleX = this.state.keeper.facing;
    this.weasel.setPosition(this.state.weasel.x, this.state.weasel.y);
    if (this.state.weasel.active) {
      this.weasel.setVisible(this.state.mode === 'chicken');
      this.weasel.scaleX = this.state.weasel.x > this.state.chicken.x ? -1 : 1;
    } else {
      this.weasel.setVisible(false);
    }
  }

  private updateNightVeil(time: number) {
    const darkness = this.state.phase === 'night' ? 0.62 : this.state.phase === 'dusk' ? 0.32 : 0;
    if (darkness <= 0 && this.state.nightPressure < 1) {
      if (this.nightVeil.visible) {
        this.nightVeil.clear();
        this.nightVeil.setVisible(false);
      }
      return;
    }
    if (time - this.lastNightVeilAt < 80) return;
    this.lastNightVeilAt = time;
    this.nightVeil.setVisible(true);
    const camera = this.cameras.main;
    const view = camera.worldView;
    const pressure = this.state.nightPressure / 100;
    this.nightVeil.clear();
    this.nightVeil.fillStyle(0x15213a, darkness + pressure * 0.22);
    this.nightVeil.fillRect(view.x - 4, view.y - 4, view.width + 8, view.height + 8);

    if (this.state.mode === 'chicken' && darkness > 0) {
      const radius = (220 - pressure * 72 + this.state.stats.lamp * 12) / camera.zoom;
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

function normalize(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  if (!length) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}
