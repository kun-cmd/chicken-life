import Phaser from 'phaser';
import './style.css';
import { GameScene } from './phaser/scenes/GameScene';
import type { EggType, FoodType, HudSnapshot } from './game/simulation/state';

const config: Phaser.Types.Core.GameConfig = {
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
};

new Phaser.Game(config);

const VOLUME_STORAGE_KEY = 'chicken-life-master-volume';
const DEFAULT_MASTER_VOLUME = 70;
const appRoot = document.querySelector<HTMLElement>('#app')!;

appRoot.tabIndex = 0;
appRoot.addEventListener('pointerdown', () => {
  appRoot.focus({ preventScroll: true });
  window.focus();
});

const hud = {
  dayLabel: document.querySelector<HTMLSpanElement>('#dayLabel')!,
  phaseLabel: document.querySelector<HTMLElement>('#phaseLabel')!,
  staminaMeter: document.querySelector<HTMLElement>('#staminaMeter')!,
  fullnessMeter: document.querySelector<HTMLElement>('#fullnessMeter')!,
  nutritionMeter: document.querySelector<HTMLElement>('#nutritionMeter')!,
  pressureMeter: document.querySelector<HTMLElement>('#pressureMeter')!,
  waterBoostMeter: document.querySelector<HTMLElement>('#waterBoostMeter')!,
  staminaLabel: document.querySelector<HTMLElement>('#staminaLabel')!,
  fullnessLabel: document.querySelector<HTMLElement>('#fullnessLabel')!,
  nutritionLabel: document.querySelector<HTMLElement>('#nutritionLabel')!,
  pressureLabel: document.querySelector<HTMLElement>('#pressureLabel')!,
  waterBoostLabel: document.querySelector<HTMLElement>('#waterBoostLabel')!,
  goalTip: document.querySelector<HTMLElement>('#goalTip')!,
  timeLabel: document.querySelector<HTMLElement>('#timeLabel')!,
  clockNeedle: document.querySelector<HTMLElement>('#clockNeedle')!,
  todayPlateList: document.querySelector<HTMLElement>('#todayPlateList')!,
  toast: document.querySelector<HTMLElement>('#toast')!,
  rewardPanel: document.querySelector<HTMLElement>('#rewardPanel')!,
  rewardTitle: document.querySelector<HTMLElement>('#rewardTitle')!,
  rewardName: document.querySelector<HTMLElement>('#rewardName')!,
  rewardEffect: document.querySelector<HTMLElement>('#rewardEffect')!,
  daySummaryPanel: document.querySelector<HTMLElement>('#daySummaryPanel')!,
  summaryClose: document.querySelector<HTMLButtonElement>('#summaryClose')!,
  summaryEggName: document.querySelector<HTMLElement>('#summaryEggName')!,
  summaryStats: document.querySelector<HTMLElement>('#summaryStats')!,
  summaryReason: document.querySelector<HTMLElement>('#summaryReason')!,
  summaryNearMiss: document.querySelector<HTMLElement>('#summaryNearMiss')!,
  inventoryPanel: document.querySelector<HTMLElement>('#inventoryPanel')!,
  inventoryClose: document.querySelector<HTMLButtonElement>('#inventoryClose')!,
  inventoryFoodList: document.querySelector<HTMLElement>('#inventoryFoodList')!,
  inventoryMaterialList: document.querySelector<HTMLElement>('#inventoryMaterialList')!,
  inventoryEggList: document.querySelector<HTMLElement>('#inventoryEggList')!,
  inventoryUpgradeList: document.querySelector<HTMLElement>('#inventoryUpgradeList')!,
  debugPanel: document.querySelector<HTMLElement>('#debugPanel')!,
  debugClose: document.querySelector<HTMLButtonElement>('#debugClose')!,
  debugEggType: document.querySelector<HTMLSelectElement>('#debugEggType')!,
  forceEggButton: document.querySelector<HTMLButtonElement>('#forceEggButton')!,
  masterVolume: document.querySelector<HTMLInputElement>('#masterVolume')!,
  masterVolumeLabel: document.querySelector<HTMLElement>('#masterVolumeLabel')!,
};

let toastTimer = 0;
let rewardTimer = 0;
let latestSnapshot: HudSnapshot | null = null;
let inventoryOpen = false;
let debugOpen = false;
let dismissedSummaryDay = 0;

const foodTypes: FoodType[] = ['grain', 'grass', 'bug', 'sunflower', 'nightBug', 'meat'];
const foodLabels: Record<FoodType, string> = {
  grain: '米粒',
  grass: '嫩草',
  bug: '蚯蚓',
  sunflower: '瓜子',
  nightBug: '夜虫',
  meat: '肉块',
};
const foodShortLabels: Record<FoodType, string> = {
  grain: '米',
  grass: '草',
  bug: '蚓',
  sunflower: '瓜',
  nightBug: '夜',
  meat: '肉',
};

window.addEventListener('chicken-life:hud', (event) => {
  const snapshot = (event as CustomEvent<HudSnapshot>).detail;
  renderHud(snapshot);
});

function renderHud(snapshot: HudSnapshot) {
  latestSnapshot = snapshot;
  hud.dayLabel.textContent = `第 ${snapshot.day} 天`;
  hud.phaseLabel.textContent = snapshot.phaseLabel;
  hud.timeLabel.textContent = snapshot.timeLabel;
  hud.staminaMeter.style.width = `${snapshot.staminaPct}%`;
  hud.fullnessMeter.style.width = `${snapshot.fullnessPct}%`;
  hud.nutritionMeter.style.width = `${snapshot.nutritionPct}%`;
  hud.pressureMeter.style.width = `${snapshot.pressurePct}%`;
  hud.waterBoostMeter.style.width = `${snapshot.waterBoostPct}%`;
  hud.staminaLabel.textContent = String(snapshot.stamina);
  hud.fullnessLabel.textContent = String(snapshot.fullness);
  hud.nutritionLabel.textContent = String(snapshot.nutrition);
  hud.pressureLabel.textContent = String(snapshot.pressure);
  hud.waterBoostLabel.textContent = String(snapshot.waterBoost);
  hud.goalTip.textContent = snapshot.goalTip;
  hud.clockNeedle.style.transform = `rotate(${snapshot.clockDeg}deg)`;
  hud.todayPlateList.innerHTML = renderTodayPlate(snapshot);

  document.body.dataset.phase = snapshot.phase;
  document.body.dataset.mode = snapshot.mode;
  document.body.dataset.inventoryOpen = inventoryOpen ? 'true' : 'false';
  document.body.dataset.debugOpen = debugOpen ? 'true' : 'false';
  document.body.dataset.stuffed = snapshot.stuffedness > 0 ? 'true' : 'false';
  document.body.dataset.waterBoosted = snapshot.waterBoost > 0 ? 'true' : 'false';
  document.body.dataset.pressureHigh = snapshot.pressure >= 45 ? 'true' : 'false';
  document.body.dataset.lowStamina = snapshot.staminaPct <= 28 ? 'true' : 'false';

  renderDaySummary(snapshot);
  renderInventoryPanel(snapshot);

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

hud.summaryClose.addEventListener('click', () => {
  dismissedSummaryDay = latestSnapshot?.daySummary?.day ?? dismissedSummaryDay;
  hud.daySummaryPanel.hidden = true;
});

hud.inventoryClose.addEventListener('click', () => {
  inventoryOpen = false;
  hud.inventoryPanel.hidden = true;
  document.body.dataset.inventoryOpen = 'false';
});

hud.debugClose.addEventListener('click', () => {
  debugOpen = false;
  hud.debugPanel.hidden = true;
  document.body.dataset.debugOpen = 'false';
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-debug]')) {
  button.addEventListener('click', () => dispatchDebug(button.dataset.debug ?? ''));
}

hud.forceEggButton.addEventListener('click', () => {
  dispatchDebug('forceEgg', hud.debugEggType.value as EggType);
});

setupVolumeControl();

window.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
    event.preventDefault();
    inventoryOpen = !inventoryOpen;
    hud.inventoryPanel.hidden = !inventoryOpen;
    document.body.dataset.inventoryOpen = inventoryOpen ? 'true' : 'false';
    if (latestSnapshot) renderInventoryPanel(latestSnapshot);
  }

  if (event.key === 'F1') {
    event.preventDefault();
    debugOpen = !debugOpen;
    hud.debugPanel.hidden = !debugOpen;
    document.body.dataset.debugOpen = debugOpen ? 'true' : 'false';
  }

  if (event.key === 'F2') {
    event.preventDefault();
    dispatchDebug('addAffection');
  }
  if (event.key === 'F3') {
    event.preventDefault();
    dispatchDebug('addMaterials');
  }
  if (event.key === 'F4') {
    event.preventDefault();
    dispatchDebug('jumpDusk');
  }
  if (event.key === 'F5') {
    event.preventDefault();
    dispatchDebug('spawnWeasel');
  }
});

function renderDaySummary(snapshot: HudSnapshot) {
  const summary = snapshot.daySummary;
  if (!summary || dismissedSummaryDay === summary.day) {
    hud.daySummaryPanel.hidden = true;
    return;
  }

  hud.daySummaryPanel.hidden = false;
  hud.summaryEggName.textContent = summary.eggName;
  hud.summaryStats.innerHTML = [
    ['窝材', `+${summary.gainedMaterials}`],
    ['总窝材', String(summary.materialsTotal)],
    ['饱食/有效营养', `${summary.fullness} / ${summary.effectiveFullness}`],
    ...(summary.stuffedness > 0 ? ([['吃撑', String(summary.stuffedness)]] as const) : []),
    ['润喉', summary.drankToday ? `${summary.waterBoost} / 已喝水` : '未喝水'],
    ['夜压', String(summary.nightPressure)],
    ...foodTypes.map((type) => [foodLabels[type], String(summary.eaten[type])]),
  ]
    .map(([label, value]) => `<span><b>${label}</b>${value}</span>`)
    .join('');
  hud.summaryReason.textContent = summary.eggReason;
  hud.summaryNearMiss.textContent = summary.nearMiss;
}

function renderInventoryPanel(snapshot: HudSnapshot) {
  if (!inventoryOpen) {
    hud.inventoryPanel.hidden = true;
    return;
  }

  hud.inventoryPanel.hidden = false;
  hud.inventoryFoodList.innerHTML = renderFoodDetails(snapshot);
  hud.inventoryMaterialList.innerHTML = [
    ['窝材', snapshot.materials],
    ['营养', snapshot.nutrition],
    ['鸡窝安全', snapshot.coopSafety],
    ['修夜压', snapshot.repairCost],
    ['训练', snapshot.trainingCost],
    ['润喉', snapshot.waterBoost > 0 ? snapshot.waterBoost : 0],
    ['喝水', snapshot.drankToday ? '已喝' : '未喝'],
    ['挖坑', `${snapshot.holesDugToday}/${snapshot.digLimit}`],
    ['亲密', snapshot.affection],
    ['养鸡人', snapshot.keeperLabel],
  ]
    .map(([label, value]) => `<span><b>${label}</b>${value}</span>`)
    .join('');
  hud.inventoryEggList.innerHTML = snapshot.eggArchive.length
    ? snapshot.eggArchive
        .map(
          (egg) => `
            <article>
              <strong>${escapeHtml(egg.name)} x${egg.count}</strong>
              <span>${escapeHtml(egg.upgrade)}</span>
              <p>${escapeHtml(egg.effect)}</p>
            </article>
          `,
        )
        .join('')
    : '<p>还没有收集到蛋。</p>';
  hud.inventoryUpgradeList.innerHTML = `
    <article>
      <strong>能力</strong>
      <p>冲刺 ${snapshot.stats.maxStamina} / 速度 ${Math.round(snapshot.stats.speed)} / 啄食 ${snapshot.stats.peck} / 挖坑 ${snapshot.stats.dig} / 胆量 ${snapshot.stats.courage} / 灯 ${snapshot.stats.lamp}</p>
    </article>
    ${
      snapshot.upgrades.length
        ? snapshot.upgrades.map((upgrade) => `<article><strong>${escapeHtml(upgrade)}</strong></article>`).join('')
        : '<p>还没有永久增益。</p>'
    }
  `;
}

function dispatchDebug(action: string, eggType?: EggType) {
  const detail = action === 'forceEgg' ? { action, eggType } : { action };
  window.dispatchEvent(new CustomEvent('chicken-life:debug', { detail }));
}

function setupVolumeControl() {
  const savedVolume = readMasterVolume();
  hud.masterVolume.value = String(savedVolume);
  renderMasterVolume(savedVolume);
  dispatchMasterVolume(savedVolume);

  hud.masterVolume.addEventListener('input', () => {
    const value = clampVolume(Number(hud.masterVolume.value));
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(value));
    } catch {
      // Audio still works even when localStorage is blocked.
    }
    renderMasterVolume(value);
    dispatchMasterVolume(value);
  });
}

function readMasterVolume() {
  try {
    const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw === null || raw.trim() === '') return DEFAULT_MASTER_VOLUME;
    const saved = Number(raw);
    return Number.isFinite(saved) ? clampVolume(saved) : DEFAULT_MASTER_VOLUME;
  } catch {
    return DEFAULT_MASTER_VOLUME;
  }
}

function renderMasterVolume(value: number) {
  hud.masterVolumeLabel.textContent = `${value}%`;
}

function dispatchMasterVolume(value: number) {
  window.dispatchEvent(new CustomEvent('chicken-life:volume', { detail: { volume: value / 100 } }));
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MASTER_VOLUME;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function renderTodayPlate(snapshot: HudSnapshot) {
  const visibleTypes = foodTypes.filter((type) => snapshot.unlockedFoods[type] || snapshot.eaten[type] > 0);
  const types = visibleTypes.length ? visibleTypes : (['grain'] as FoodType[]);
  return types
    .map((type) => {
      const count = snapshot.eaten[type];
      const state = count > 0 ? 'eaten' : 'empty';
      return `
        <span class="food-chip food-chip--${type} food-chip--${state}">
          <i>${foodShortLabels[type]}</i>
          <b>${foodLabels[type]}</b>
          <strong>${count}</strong>
        </span>
      `;
    })
    .join('');
}

function renderFoodDetails(snapshot: HudSnapshot) {
  return foodTypes
    .map((type) => {
      const count = snapshot.eaten[type];
      const unlocked = snapshot.unlockedFoods[type] || count > 0;
      return `
        <article class="food-card food-card--${type} ${unlocked ? 'food-card--open' : 'food-card--locked'}">
          <i>${foodShortLabels[type]}</i>
          <span>
            <strong>${foodLabels[type]}</strong>
            <small>${unlocked ? '已进入今日循环' : '尚未解锁'}</small>
          </span>
          <b>${count}</b>
        </article>
      `;
    })
    .join('');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}
