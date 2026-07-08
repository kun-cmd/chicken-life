import Phaser from 'phaser';
import './style.css';
import { GameScene } from './phaser/scenes/GameScene';
import type { HudSnapshot } from './game/simulation/state';
import { YARD_UPGRADES } from './game/content/yardUpgrades';
import { foodDisplayName, type ForagingFoodType } from './game/systems/foraging';
import type { TouchOption } from './game/systems/closeInteraction';
import { EGG_QUALITY_THRESHOLDS, eggQualityLabel } from './game/systems/eggEconomy';

interface CloseInteractionOpenDetail {
  chickenName: string;
  foods: ForagingFoodType[];
  touchOptions: TouchOption[];
}

interface CloseInteractionPlayDetail {
  accepted: boolean;
  touch: TouchOption | null;
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#1d2518',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: 60,
    min: 30,
  },
  render: {
    pixelArt: false,
    antialias: false,
    antialiasGL: false,
    powerPreference: 'low-power',
    roundPixels: true,
  },
});

const VOLUME_STORAGE_KEY = 'chicken-life-master-volume';
const DEFAULT_MASTER_VOLUME = 70;
const appRoot = document.querySelector<HTMLElement>('#app')!;
const hud = {
  namingPanel: document.querySelector<HTMLElement>('#namingPanel')!,
  namingForm: document.querySelector<HTMLFormElement>('#namingForm')!,
  chickenNameInput: document.querySelector<HTMLInputElement>('#chickenNameInput')!,
  finaleRetryPanel: document.querySelector<HTMLElement>('#finaleRetryPanel')!,
  finaleRetryButton: document.querySelector<HTMLButtonElement>('#finaleRetryButton')!,
  endingPanel: document.querySelector<HTMLElement>('#endingPanel')!,
  endingMontage: document.querySelector<HTMLElement>('#endingMontage')!,
  endingCard: document.querySelector<HTMLElement>('#endingCard')!,
  endingChickenName: document.querySelector<HTMLElement>('#endingChickenName')!,
  continueFreePlay: document.querySelector<HTMLButtonElement>('#continueFreePlay')!,
  closeInteractionPanel: document.querySelector<HTMLElement>('#closeInteractionPanel')!,
  closeChicken: document.querySelector<HTMLElement>('#closeChicken')!,
  closeInteractionTitle: document.querySelector<HTMLElement>('#closeInteractionTitle')!,
  closeInteractionPrompt: document.querySelector<HTMLElement>('#closeInteractionPrompt')!,
  closeFoodChoices: document.querySelector<HTMLElement>('#closeFoodChoices')!,
  closeTouchChoices: document.querySelector<HTMLElement>('#closeTouchChoices')!,
  closeInteractionDone: document.querySelector<HTMLButtonElement>('#closeInteractionDone')!,
  yardPanel: document.querySelector<HTMLElement>('#yardPanel')!,
  yardPanelClose: document.querySelector<HTMLButtonElement>('#yardPanelClose')!,
  yardWoodSummary: document.querySelector<HTMLElement>('#yardWoodSummary')!,
  eggAlbumList: document.querySelector<HTMLElement>('#eggAlbumList')!,
  upgradeChoices: document.querySelector<HTMLElement>('#upgradeChoices')!,
  saveWarning: document.querySelector<HTMLElement>('#saveWarning')!,
  dayLabel: document.querySelector<HTMLElement>('#dayLabel')!,
  phaseLabel: document.querySelector<HTMLElement>('#phaseLabel')!,
  timeLabel: document.querySelector<HTMLElement>('#timeLabel')!,
  clockNeedle: document.querySelector<HTMLElement>('#clockNeedle')!,
  woodLabel: document.querySelector<HTMLElement>('#woodLabel')!,
  sprintWrap: document.querySelector<HTMLElement>('#sprintWrap')!,
  staminaMeter: document.querySelector<HTMLElement>('#staminaMeter')!,
  heatWrap: document.querySelector<HTMLElement>('#heatWrap')!,
  heatMeter: document.querySelector<HTMLElement>('#heatMeter')!,
  pressureWrap: document.querySelector<HTMLElement>('#pressureWrap')!,
  nutritionMeter: document.querySelector<HTMLElement>('#nutritionMeter')!,
  pressureMeter: document.querySelector<HTMLElement>('#pressureMeter')!,
  eggPressureCurrent: document.querySelector<HTMLElement>('#eggPressureCurrent')!,
  contextPrompt: document.querySelector<HTMLElement>('#contextPrompt')!,
  toast: document.querySelector<HTMLElement>('#toast')!,
  rewardPanel: document.querySelector<HTMLElement>('#rewardPanel')!,
  rewardTitle: document.querySelector<HTMLElement>('#rewardTitle')!,
  rewardName: document.querySelector<HTMLElement>('#rewardName')!,
  rewardEffect: document.querySelector<HTMLElement>('#rewardEffect')!,
  debugPanel: document.querySelector<HTMLElement>('#debugPanel')!,
  debugClose: document.querySelector<HTMLButtonElement>('#debugClose')!,
  debugDay: document.querySelector<HTMLInputElement>('#debugDay')!,
  debugSetDay: document.querySelector<HTMLButtonElement>('#debugSetDay')!,
  debugAffection: document.querySelector<HTMLInputElement>('#debugAffection')!,
  debugAffectionLabel: document.querySelector<HTMLElement>('#debugAffectionLabel')!,
  debugFamiliarity: document.querySelector<HTMLElement>('#debugFamiliarity')!,
  masterVolume: document.querySelector<HTMLInputElement>('#masterVolume')!,
  masterVolumeLabel: document.querySelector<HTMLElement>('#masterVolumeLabel')!,
};

let toastTimer = 0;
let rewardTimer = 0;
let debugOpen = false;
let yardPanelOpen = false;
let latestSnapshot: HudSnapshot | null = null;
let endingSequenceStarted = false;
let endingTimer = 0;
let closeSelectedFood: ForagingFoodType | null = null;
let closeSelectedTouch: TouchOption | null = null;

const touchLabels: Record<TouchOption, string> = {
  head: '摸摸头',
  back: '顺顺背',
  hold: '轻轻抱起',
};

const yardRegionLabels: Record<string, string> = {
  'house-yard': '屋边',
  'main-path': '主路',
  'pond-bank': '池塘边',
  'tree-shade': '树荫',
  'coop-yard': '鸡舍边',
  'outer-growth': '外围草丛',
};

appRoot.tabIndex = 0;
appRoot.addEventListener('pointerdown', () => {
  appRoot.focus({ preventScroll: true });
  window.focus();
});

window.addEventListener('chicken-life:hud', (event) => {
  renderHud((event as CustomEvent<HudSnapshot>).detail);
});

window.addEventListener('chicken-life:close-open', (event) => {
  openCloseInteraction((event as CustomEvent<CloseInteractionOpenDetail>).detail);
});

window.addEventListener('chicken-life:close-play', (event) => {
  const detail = (event as CustomEvent<CloseInteractionPlayDetail>).detail;
  hud.closeInteractionPanel.classList.add('close-interaction--playing');
  hud.closeInteractionPanel.dataset.accepted = detail.accepted ? 'true' : 'false';
  hud.closeChicken.dataset.touch = detail.touch ?? 'none';
  hud.closeInteractionDone.disabled = true;
  hud.closeInteractionDone.textContent = detail.accepted ? '先别动…' : '慢慢收回手…';
  hud.closeInteractionPrompt.textContent = detail.accepted
    ? '它歪了歪头，靠近手心，一口一口啄了起来。'
    : '它闻了闻，往后退了一小步。';
});

window.addEventListener('chicken-life:close-close', () => {
  hud.closeInteractionPanel.hidden = true;
  hud.closeInteractionPanel.classList.remove('close-interaction--playing');
  delete hud.closeInteractionPanel.dataset.accepted;
  hud.closeChicken.dataset.touch = 'none';
});

window.addEventListener('chicken-life:finale-failed', () => {
  hud.finaleRetryPanel.hidden = false;
  hud.finaleRetryButton.focus();
});

function renderHud(snapshot: HudSnapshot) {
  latestSnapshot = snapshot;
  hud.namingPanel.hidden = !snapshot.requiresNaming;
  hud.saveWarning.hidden = snapshot.saveAvailable;
  if (snapshot.requiresNaming && document.activeElement !== hud.chickenNameInput) {
    hud.chickenNameInput.focus();
  }

  hud.dayLabel.textContent = `第 ${snapshot.day} 天`;
  hud.phaseLabel.textContent = snapshot.phaseLabel;
  hud.timeLabel.textContent = snapshot.timeLabel;
  hud.clockNeedle.style.transform = `rotate(${snapshot.clockDeg}deg)`;
  hud.woodLabel.textContent = String(snapshot.wood);
  hud.sprintWrap.hidden = !snapshot.showSprint;
  hud.staminaMeter.style.width = `${snapshot.staminaPct}%`;
  hud.heatWrap.hidden = !snapshot.showHeat;
  hud.heatMeter.style.width = `${snapshot.heatPct}%`;
  hud.pressureWrap.hidden = !snapshot.showPressure;
  hud.nutritionMeter.style.width = `${snapshot.nutritionPct}%`;
  hud.pressureMeter.style.width = `${snapshot.pressurePct}%`;
  hud.pressureWrap.dataset.quality = snapshot.projectedEggQuality;
  hud.pressureWrap.dataset.score = String(snapshot.eggQualityScore);
  hud.eggPressureCurrent.textContent = eggPressureText(snapshot);
  hud.pressureWrap.title = `当前 ${eggQualityLabel(snapshot.projectedEggQuality)}：蛋势 ${snapshot.eggQualityScore}；有效营养 ${snapshot.effectiveNutrition} / 原始营养 ${snapshot.nutrition}，夜压 ${snapshot.pressure}`;
  hud.contextPrompt.textContent = snapshot.contextPrompt;
  if (document.activeElement !== hud.debugAffection) {
    hud.debugAffection.value = String(snapshot.affection);
  }
  hud.debugAffectionLabel.textContent = String(snapshot.affection);
  renderDebugFamiliarity(snapshot);
  if (yardPanelOpen) renderYardPanel(snapshot);
  renderEnding(snapshot);

  document.body.dataset.phase = snapshot.phase;
  document.body.dataset.mode = snapshot.mode;
  document.body.dataset.lowStamina = snapshot.staminaPct <= 28 ? 'true' : 'false';
  document.body.dataset.pressureHigh = snapshot.pressurePct >= 60 ? 'true' : 'false';

  if (snapshot.toast) {
    hud.toast.textContent = snapshot.toast;
    hud.toast.classList.add('toast--show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => hud.toast.classList.remove('toast--show'), 2600);
  }

  if (snapshot.reward) {
    hud.rewardTitle.textContent = snapshot.reward.title;
    hud.rewardName.textContent = snapshot.reward.name;
    hud.rewardEffect.textContent = snapshot.reward.effect;
    hud.rewardPanel.hidden = false;
    hud.rewardPanel.classList.add('reward-panel--show');
    window.clearTimeout(rewardTimer);
    rewardTimer = window.setTimeout(() => {
      hud.rewardPanel.classList.remove('reward-panel--show');
      hud.rewardPanel.hidden = true;
    }, 3600);
  }
}

function renderDebugFamiliarity(snapshot: HudSnapshot) {
  hud.debugFamiliarity.replaceChildren();

  const title = document.createElement('strong');
  title.textContent = '区域熟悉度';
  hud.debugFamiliarity.append(title);

  const list = document.createElement('dl');
  for (const [region, entry] of Object.entries(snapshot.yardFamiliarity.regions)) {
    const label = document.createElement('dt');
    label.textContent = yardRegionLabels[region] ?? region;

    const value = document.createElement('dd');
    const firstSeen = entry.firstSeenDay > 0 ? ` 第${entry.firstSeenDay}天初访` : ' 未初访';
    value.textContent = `${Math.round(entry.familiarity)} / 100 ·${firstSeen}`;

    list.append(label, value);
  }
  hud.debugFamiliarity.append(list);
}

function eggPressureText(snapshot: HudSnapshot) {
  const quality = eggQualityLabel(snapshot.projectedEggQuality);
  const score = snapshot.eggQualityScore;
  const nextThreshold =
    score < EGG_QUALITY_THRESHOLDS.ordinary
      ? `${EGG_QUALITY_THRESHOLDS.ordinary}=普通蛋`
      : score < EGG_QUALITY_THRESHOLDS.good
        ? `${EGG_QUALITY_THRESHOLDS.good}=较好蛋`
        : score < EGG_QUALITY_THRESHOLDS.excellent
          ? `${EGG_QUALITY_THRESHOLDS.excellent}=好蛋`
          : '已到好蛋';
  const facts = [
    score < EGG_QUALITY_THRESHOLDS.ordinary
      ? `差${EGG_QUALITY_THRESHOLDS.ordinary - score}到普通蛋`
      : score < EGG_QUALITY_THRESHOLDS.good
        ? `差${EGG_QUALITY_THRESHOLDS.good - score}到较好蛋`
        : score < EGG_QUALITY_THRESHOLDS.excellent
          ? `差${EGG_QUALITY_THRESHOLDS.excellent - score}到好蛋`
          : '蛋势够好蛋',
    snapshot.eggWildKinds > 0 ? '野味已并入蛋势' : '野味可补蛋势',
    snapshot.eggDryRest ? '干燥不降段' : '潮湿降一段',
  ];
  return `当前 ${quality} · 蛋势 ${score} · ${facts.join(' / ')} · ${nextThreshold}`;
}

function renderEnding(snapshot: HudSnapshot) {
  if (snapshot.storyPhase !== 'ending') {
    hud.endingPanel.hidden = true;
    hud.endingCard.hidden = true;
    hud.endingMontage.replaceChildren();
    endingSequenceStarted = false;
    window.clearTimeout(endingTimer);
    return;
  }

  hud.endingPanel.hidden = false;
  hud.endingChickenName.textContent = snapshot.chickenName;
  if (endingSequenceStarted) return;
  endingSequenceStarted = true;
  hud.endingCard.hidden = true;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  const showNextMemory = () => {
    if (index >= snapshot.endingMemories.length) {
      hud.endingMontage.replaceChildren();
      hud.endingCard.hidden = false;
      hud.continueFreePlay.focus();
      return;
    }
    const memory = document.createElement('p');
    memory.className = 'ending-memory';
    memory.textContent = snapshot.endingMemories[index];
    hud.endingMontage.replaceChildren(memory);
    index += 1;
    endingTimer = window.setTimeout(showNextMemory, reducedMotion ? 500 : 2000);
  };
  showNextMemory();
}

function renderYardPanel(snapshot: HudSnapshot) {
  const pending = snapshot.yard.pendingWood;
  hud.yardWoodSummary.textContent =
    pending > 0
      ? `院子预算 ${snapshot.yard.wood} · 待结算 ${pending}`
      : `院子预算 ${snapshot.yard.wood}`;

  hud.eggAlbumList.replaceChildren();
  if (snapshot.eggArchive.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-empty';
    empty.textContent = '找到第一枚蛋后，相册会记在这里。';
    hud.eggAlbumList.append(empty);
  } else {
    for (const egg of snapshot.eggArchive) {
      const row = document.createElement('article');
      row.className = 'album-entry';
      const name = document.createElement('strong');
      name.textContent = `${egg.name} ×${egg.count}`;
      const effect = document.createElement('span');
      effect.textContent = egg.effect;
      row.append(name, effect);
      hud.eggAlbumList.append(row);
    }
  }

  hud.upgradeChoices.replaceChildren();
  for (const upgrade of YARD_UPGRADES) {
    const owned = snapshot.yard.owned.includes(upgrade.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgrade-choice';
    button.disabled =
      owned ||
      snapshot.yard.wood < upgrade.cost ||
      snapshot.storyPhase !== 'morning-human';
    button.dataset.owned = owned ? 'true' : 'false';

    const heading = document.createElement('strong');
    heading.textContent = owned
      ? `${upgrade.name} · 已拥有`
      : `${upgrade.name} · ${upgrade.cost} 预算`;
    const effect = document.createElement('span');
    effect.textContent = upgrade.effect;
    button.append(heading, effect);
    button.addEventListener('click', () => {
      window.dispatchEvent(
        new CustomEvent('chicken-life:buy-upgrade', { detail: { id: upgrade.id } }),
      );
    });
    hud.upgradeChoices.append(button);
  }
}

function setYardPanelOpen(open: boolean) {
  if (open && (!latestSnapshot || latestSnapshot.requiresNaming || !hud.closeInteractionPanel.hidden)) {
    return;
  }
  yardPanelOpen = open;
  hud.yardPanel.hidden = !open;
  window.dispatchEvent(new CustomEvent(open ? 'chicken-life:yard-panel-open' : 'chicken-life:yard-panel-close'));
  if (open && latestSnapshot) {
    renderYardPanel(latestSnapshot);
    hud.yardPanelClose.focus();
  } else {
    appRoot.focus({ preventScroll: true });
  }
}

function openCloseInteraction(detail: CloseInteractionOpenDetail) {
  closeSelectedFood = null;
  closeSelectedTouch = null;
  hud.closeInteractionPanel.hidden = false;
  hud.closeInteractionPanel.classList.remove('close-interaction--playing');
  delete hud.closeInteractionPanel.dataset.accepted;
  hud.closeChicken.dataset.touch = 'none';
  hud.closeInteractionTitle.textContent = `和${detail.chickenName}靠近一点`;
  hud.closeInteractionPrompt.textContent = '先选一口放在手心里，它会自己决定要不要靠近。';
  hud.closeInteractionDone.disabled = true;
  hud.closeInteractionDone.textContent = '把手慢慢递过去';
  renderFoodChoices(detail.foods);
  renderTouchChoices(detail.touchOptions);
  hud.closeFoodChoices.querySelector<HTMLButtonElement>('button')?.focus();
}

function renderFoodChoices(foods: ForagingFoodType[]) {
  hud.closeFoodChoices.replaceChildren();
  for (const food of foods) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = foodDisplayName(food);
    button.addEventListener('click', () => {
      closeSelectedFood = food;
      setSelectedChoice(hud.closeFoodChoices, button);
      hud.closeInteractionDone.disabled = false;
      hud.closeInteractionPrompt.textContent = `把${foodDisplayName(food)}放在掌心，手保持不动。`;
    });
    hud.closeFoodChoices.append(button);
  }
}

function renderTouchChoices(touchOptions: TouchOption[]) {
  hud.closeTouchChoices.replaceChildren();
  const noTouch = document.createElement('button');
  noTouch.type = 'button';
  noTouch.textContent = '只喂食';
  noTouch.dataset.selected = 'true';
  noTouch.addEventListener('click', () => {
    closeSelectedTouch = null;
    setSelectedChoice(hud.closeTouchChoices, noTouch);
  });
  hud.closeTouchChoices.append(noTouch);

  for (const touch of touchOptions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = touchLabels[touch];
    button.addEventListener('click', () => {
      closeSelectedTouch = touch;
      setSelectedChoice(hud.closeTouchChoices, button);
    });
    hud.closeTouchChoices.append(button);
  }
}

function setSelectedChoice(container: HTMLElement, selected: HTMLButtonElement) {
  for (const button of container.querySelectorAll<HTMLButtonElement>('button')) {
    button.dataset.selected = button === selected ? 'true' : 'false';
  }
}

hud.closeInteractionDone.addEventListener('click', () => {
  if (!closeSelectedFood) return;
  window.dispatchEvent(
    new CustomEvent('chicken-life:close-complete', {
      detail: { food: closeSelectedFood, touch: closeSelectedTouch },
    }),
  );
});

hud.namingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  window.dispatchEvent(
    new CustomEvent('chicken-life:name-confirmed', {
      detail: { name: hud.chickenNameInput.value },
    }),
  );
});

hud.finaleRetryButton.addEventListener('click', () => {
  hud.finaleRetryPanel.hidden = true;
  window.dispatchEvent(new CustomEvent('chicken-life:finale-retry'));
  appRoot.focus({ preventScroll: true });
});

hud.continueFreePlay.addEventListener('click', () => {
  window.clearTimeout(endingTimer);
  hud.endingPanel.hidden = true;
  endingSequenceStarted = false;
  window.dispatchEvent(new CustomEvent('chicken-life:ending-continue'));
  appRoot.focus({ preventScroll: true });
});

hud.debugClose.addEventListener('click', () => setDebugOpen(false));
hud.yardPanelClose.addEventListener('click', () => setYardPanelOpen(false));
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-debug]')) {
  button.addEventListener('click', () => dispatchDebug(button.dataset.debug ?? ''));
}
hud.debugSetDay.addEventListener('click', () => {
  dispatchDebug('setDay', { day: Number(hud.debugDay.value) });
});
hud.debugAffection.addEventListener('input', () => {
  const affection = Math.max(0, Math.min(100, Math.round(Number(hud.debugAffection.value))));
  hud.debugAffectionLabel.textContent = String(affection);
  dispatchDebug('setAffection', { affection });
});

window.addEventListener('keydown', (event) => {
  if (
    event.key === 'Tab' &&
    !yardPanelOpen &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  ) {
    event.preventDefault();
    setYardPanelOpen(true);
    return;
  }
  if (event.key === 'Escape' && yardPanelOpen) {
    event.preventDefault();
    setYardPanelOpen(false);
    return;
  }
  if (event.key === 'F1') {
    event.preventDefault();
    setDebugOpen(!debugOpen);
  }
  if (event.key === 'F2') dispatchDebug('addMaterials');
  if (event.key === 'F3') dispatchDebug('jumpDusk');
  if (event.key === 'F4') dispatchDebug('spawnWeasel');
});

function setDebugOpen(open: boolean) {
  debugOpen = open;
  hud.debugPanel.hidden = !open;
  if (open && latestSnapshot) {
    hud.debugDay.value = String(latestSnapshot.day);
    hud.debugAffection.value = String(latestSnapshot.affection);
    hud.debugAffectionLabel.textContent = String(latestSnapshot.affection);
  }
}

function dispatchDebug(action: string, detail: Record<string, unknown> = {}) {
  window.dispatchEvent(
    new CustomEvent('chicken-life:debug', { detail: { action, ...detail } }),
  );
}

function setupVolumeControl() {
  let saved = DEFAULT_MASTER_VOLUME;
  try {
    const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw !== null && raw.trim() !== '') saved = clampVolume(Number(raw));
  } catch {
    // Audio still works when storage is unavailable.
  }
  hud.masterVolume.value = String(saved);
  renderVolume(saved);
  dispatchVolume(saved);

  hud.masterVolume.addEventListener('input', () => {
    const value = clampVolume(Number(hud.masterVolume.value));
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(value));
    } catch {
      // Audio still works when storage is unavailable.
    }
    renderVolume(value);
    dispatchVolume(value);
  });
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MASTER_VOLUME;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function renderVolume(value: number) {
  hud.masterVolumeLabel.textContent = `${value}%`;
}

function dispatchVolume(value: number) {
  window.dispatchEvent(new CustomEvent('chicken-life:volume', { detail: { volume: value / 100 } }));
}

setupVolumeControl();
