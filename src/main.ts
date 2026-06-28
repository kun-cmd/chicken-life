import Phaser from 'phaser';
import './style.css';
import { GameScene } from './phaser/scenes/GameScene';
import type { EggType, HudSnapshot } from './game/simulation/state';

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

appRoot.tabIndex = 0;
appRoot.addEventListener('pointerdown', () => {
  appRoot.focus({ preventScroll: true });
  window.focus();
});

window.addEventListener('chicken-life:hud', (event) => {
  renderHud((event as CustomEvent<HudSnapshot>).detail);
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
