import Phaser from 'phaser';
import './style.css';
import { GameScene } from './phaser/scenes/GameScene';
import type { EggType, HudSnapshot } from './game/simulation/state';
import { foodDisplayName, type ForagingFoodType } from './game/systems/foraging';
import type { TouchOption } from './game/systems/closeInteraction';

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
  closeInteractionPanel: document.querySelector<HTMLElement>('#closeInteractionPanel')!,
  closeChicken: document.querySelector<HTMLElement>('#closeChicken')!,
  closeInteractionTitle: document.querySelector<HTMLElement>('#closeInteractionTitle')!,
  closeInteractionPrompt: document.querySelector<HTMLElement>('#closeInteractionPrompt')!,
  closeFoodChoices: document.querySelector<HTMLElement>('#closeFoodChoices')!,
  closeTouchChoices: document.querySelector<HTMLElement>('#closeTouchChoices')!,
  closeInteractionDone: document.querySelector<HTMLButtonElement>('#closeInteractionDone')!,
  saveWarning: document.querySelector<HTMLElement>('#saveWarning')!,
  dayLabel: document.querySelector<HTMLElement>('#dayLabel')!,
  phaseLabel: document.querySelector<HTMLElement>('#phaseLabel')!,
  timeLabel: document.querySelector<HTMLElement>('#timeLabel')!,
  clockNeedle: document.querySelector<HTMLElement>('#clockNeedle')!,
  woodLabel: document.querySelector<HTMLElement>('#woodLabel')!,
  sprintWrap: document.querySelector<HTMLElement>('#sprintWrap')!,
  staminaMeter: document.querySelector<HTMLElement>('#staminaMeter')!,
  contextPrompt: document.querySelector<HTMLElement>('#contextPrompt')!,
  toast: document.querySelector<HTMLElement>('#toast')!,
  rewardPanel: document.querySelector<HTMLElement>('#rewardPanel')!,
  rewardTitle: document.querySelector<HTMLElement>('#rewardTitle')!,
  rewardName: document.querySelector<HTMLElement>('#rewardName')!,
  rewardEffect: document.querySelector<HTMLElement>('#rewardEffect')!,
  debugPanel: document.querySelector<HTMLElement>('#debugPanel')!,
  debugClose: document.querySelector<HTMLButtonElement>('#debugClose')!,
  debugEggType: document.querySelector<HTMLSelectElement>('#debugEggType')!,
  forceEggButton: document.querySelector<HTMLButtonElement>('#forceEggButton')!,
  masterVolume: document.querySelector<HTMLInputElement>('#masterVolume')!,
  masterVolumeLabel: document.querySelector<HTMLElement>('#masterVolumeLabel')!,
};

let toastTimer = 0;
let rewardTimer = 0;
let debugOpen = false;
let closeSelectedFood: ForagingFoodType | null = null;
let closeSelectedTouch: TouchOption | null = null;

const touchLabels: Record<TouchOption, string> = {
  head: '摸摸头',
  back: '顺顺背',
  hold: '轻轻抱起',
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

function renderHud(snapshot: HudSnapshot) {
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
  hud.contextPrompt.textContent = snapshot.contextPrompt;

  document.body.dataset.phase = snapshot.phase;
  document.body.dataset.mode = snapshot.mode;
  document.body.dataset.lowStamina = snapshot.staminaPct <= 28 ? 'true' : 'false';

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

hud.debugClose.addEventListener('click', () => setDebugOpen(false));
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-debug]')) {
  button.addEventListener('click', () => dispatchDebug(button.dataset.debug ?? ''));
}
hud.forceEggButton.addEventListener('click', () => {
  dispatchDebug('forceEgg', hud.debugEggType.value as EggType);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'F1') {
    event.preventDefault();
    setDebugOpen(!debugOpen);
  }
  if (event.key === 'F2') dispatchDebug('addAffection');
  if (event.key === 'F3') dispatchDebug('addMaterials');
  if (event.key === 'F4') dispatchDebug('jumpDusk');
  if (event.key === 'F5') dispatchDebug('spawnWeasel');
});

function setDebugOpen(open: boolean) {
  debugOpen = open;
  hud.debugPanel.hidden = !open;
}

function dispatchDebug(action: string, eggType?: EggType) {
  const detail = action === 'forceEgg' ? { action, eggType } : { action };
  window.dispatchEvent(new CustomEvent('chicken-life:debug', { detail }));
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
