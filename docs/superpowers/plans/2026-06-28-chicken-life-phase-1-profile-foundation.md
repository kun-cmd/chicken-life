# Chicken Life Phase 1: Profile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a tracked prototype baseline, a repeatable TypeScript test runner, chicken naming, and version-3 save persistence without changing the existing gameplay loop.

**Architecture:** Keep the current `GameState` and `GameScene` running while extracting name normalization and storage access into pure modules. The DOM owns the naming form; `GameScene` owns the authoritative profile state and receives a typed custom event. Save encoding is storage-agnostic so it can be tested without a browser.

**Tech Stack:** TypeScript 5.8, Phaser 3.90, Vite 6, Node test runner, esbuild 0.25.

---

### Task 1: Track the prototype baseline safely

**Files:**
- Modify: `.gitignore`
- Track without editing: `.npmrc`, `AGENTS.md`, `index.html`, `package.json`, `package-lock.json`, `public/**`, `rules.md`, `scripts/**`, `src/**`, `tests/**`, `tsconfig.json`, `vite.config.ts`

- [ ] **Step 1: Expand generated-file ignores**

Replace `.gitignore` with:

```gitignore
node_modules/
dist/
dist-itch/
.npm-cache/
.test-dist/
coverage/
*.zip
dev-server*.log
vite-dev*.log
```

- [ ] **Step 2: Verify generated artifacts are excluded**

Run:

```powershell
git status --short
```

Expected: source/config/audio files remain untracked; ZIP files, `dist-itch/`, `vite-dev.log`, `vite-dev.err.log`, `node_modules/`, and `dist/` do not appear.

- [ ] **Step 3: Run the untouched prototype build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite complete successfully and emit `dist/`.

- [ ] **Step 4: Commit the baseline**

Run:

```powershell
git add .gitignore .npmrc AGENTS.md index.html package.json package-lock.json public rules.md scripts src tests tsconfig.json vite.config.ts
git commit -m "chore: track chicken life prototype"
```

Expected: the commit contains the prototype and no generated archives or logs.

### Task 2: Add a TypeScript unit-test runner

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/run-tests.mjs`
- Create: `tests/keyboardState.test.ts`
- Delete: `tests/keyboardState.test.mjs`

- [ ] **Step 1: Add esbuild as a direct test dependency**

Run:

```powershell
npm install --save-dev esbuild@0.25.12
```

Expected: `package.json` and `package-lock.json` list `esbuild` directly.

- [ ] **Step 2: Add the test script**

Set the `scripts` object in `package.json` to:

```json
{
  "dev": "vite --host 127.0.0.1",
  "build": "tsc && vite build",
  "test": "node tests/run-tests.mjs",
  "package:itch": "npm run build && powershell -ExecutionPolicy Bypass -File scripts/package-itch.ps1",
  "preview": "vite preview --host 127.0.0.1"
}
```

- [ ] **Step 3: Create the test bundler**

Create `tests/run-tests.mjs`:

```js
import { spawnSync } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDir, '..');
const outputDir = path.join(rootDir, '.test-dist');
const entries = (await readdir(testsDir))
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => path.join(testsDir, name));

await rm(outputDir, { recursive: true, force: true });

await build({
  entryPoints: entries,
  outdir: outputDir,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: 'inline',
  logLevel: 'warning',
});

const compiledTests = entries.map((entry) =>
  path.join(outputDir, path.basename(entry).replace(/\.ts$/, '.js')),
);
const result = spawnSync(process.execPath, ['--test', ...compiledTests], {
  cwd: rootDir,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
```

- [ ] **Step 4: Migrate the keyboard test**

Create `tests/keyboardState.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { KeyboardState } from '../src/game/input/keyboardState';

test('tracks held movement keys until they are released', () => {
  const keyboard = new KeyboardState();
  keyboard.keyDown('KeyD', false);
  assert.equal(keyboard.isDown('KeyD'), true);
  keyboard.keyUp('KeyD');
  assert.equal(keyboard.isDown('KeyD'), false);
});

test('consumes an action press only once and ignores key repeat', () => {
  const keyboard = new KeyboardState();
  keyboard.keyDown('KeyE', false);
  keyboard.keyDown('KeyE', true);
  assert.equal(keyboard.consumePress('KeyE'), true);
  assert.equal(keyboard.consumePress('KeyE'), false);
});

test('reset releases held keys and pending presses', () => {
  const keyboard = new KeyboardState();
  keyboard.keyDown('ShiftLeft', false);
  keyboard.keyDown('Space', false);
  keyboard.reset();
  assert.equal(keyboard.isDown('ShiftLeft'), false);
  assert.equal(keyboard.consumePress('Space'), false);
});
```

Delete `tests/keyboardState.test.mjs`.

- [ ] **Step 5: Run the test runner**

Run:

```powershell
npm test
```

Expected: 3 tests pass and `.test-dist/` remains ignored.

- [ ] **Step 6: Commit**

Run:

```powershell
git add package.json package-lock.json tests/run-tests.mjs tests/keyboardState.test.ts tests/keyboardState.test.mjs
git commit -m "test: add TypeScript unit test runner"
```

### Task 3: Define chicken profile and save-v3 primitives

**Files:**
- Create: `src/game/profile/chickenProfile.ts`
- Create: `src/game/persistence/saveGame.ts`
- Test: `tests/chickenProfile.test.ts`
- Test: `tests/saveGame.test.ts`

- [ ] **Step 1: Write failing profile tests**

Create `tests/chickenProfile.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CHICKEN_NAME,
  createChickenProfile,
  normalizeChickenName,
} from '../src/game/profile/chickenProfile';

test('trims and limits a chicken name to twelve code points', () => {
  assert.equal(normalizeChickenName('  小花  '), '小花');
  assert.equal(normalizeChickenName('一二三四五六七八九十甲乙丙'), '一二三四五六七八九十甲乙');
});

test('uses the default name for blank input', () => {
  assert.equal(normalizeChickenName('   '), DEFAULT_CHICKEN_NAME);
});

test('starts with only peck and cluck awakened', () => {
  const profile = createChickenProfile(1234);
  assert.deepEqual(profile.awakenedAbilities, {
    peck: true,
    cluck: true,
    scratch: false,
    sprint: false,
    flutter: false,
  });
  assert.equal(profile.runSeed, 1234);
  assert.equal(profile.named, false);
});
```

- [ ] **Step 2: Run the profile test to verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `src/game/profile/chickenProfile.ts` does not exist.

- [ ] **Step 3: Implement the profile module**

Create `src/game/profile/chickenProfile.ts`:

```ts
export type AbilityId = 'peck' | 'cluck' | 'scratch' | 'sprint' | 'flutter';
export type AbilityFlags = Record<AbilityId, boolean>;

export interface ChickenProfile {
  name: string;
  named: boolean;
  runSeed: number;
  awakenedAbilities: AbilityFlags;
}

export const DEFAULT_CHICKEN_NAME = '小鸡';
export const MAX_CHICKEN_NAME_LENGTH = 12;

export function normalizeChickenName(input: string) {
  const trimmed = input.trim();
  const visible = Array.from(trimmed).slice(0, MAX_CHICKEN_NAME_LENGTH).join('');
  return visible || DEFAULT_CHICKEN_NAME;
}

export function createChickenProfile(runSeed = Date.now()): ChickenProfile {
  return {
    name: DEFAULT_CHICKEN_NAME,
    named: false,
    runSeed,
    awakenedAbilities: {
      peck: true,
      cluck: true,
      scratch: false,
      sprint: false,
      flutter: false,
    },
  };
}
```

- [ ] **Step 4: Write failing save tests**

Create `tests/saveGame.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  loadSaveEnvelope,
  writeSaveEnvelope,
} from '../src/game/persistence/saveGame';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test('round trips a version three save envelope', () => {
  const storage = new MemoryStorage();
  const state = { profile: { name: '小花' }, day: 4 };
  assert.equal(writeSaveEnvelope(storage, state, 100), true);
  assert.deepEqual(loadSaveEnvelope(storage), {
    kind: 'loaded',
    state,
    savedAt: 100,
  });
});

test('reports a legacy prototype save without parsing it as v3', () => {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_SAVE_KEY, '{"version":2,"state":{"day":9}}');
  assert.deepEqual(loadSaveEnvelope(storage), { kind: 'legacy' });
});

test('treats malformed v3 JSON as empty', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, '{');
  assert.deepEqual(loadSaveEnvelope(storage), { kind: 'empty' });
});

test('treats blocked browser storage as empty', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(loadSaveEnvelope(storage), { kind: 'empty' });
  assert.equal(writeSaveEnvelope(storage, {}), false);
});
```

- [ ] **Step 5: Run the save tests to verify failure**

Run:

```powershell
npm test
```

Expected: profile tests pass; save tests fail because `saveGame.ts` does not exist.

- [ ] **Step 6: Implement the save module**

Create `src/game/persistence/saveGame.ts`:

```ts
export const SAVE_VERSION = 3;
export const SAVE_KEY = 'chicken-life-save-v3';
export const LEGACY_SAVE_KEY = 'chicken-life-save-v2';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type SaveLoadResult =
  | { kind: 'empty' }
  | { kind: 'legacy' }
  | { kind: 'loaded'; state: unknown; savedAt: number };

export function loadSaveEnvelope(storage: StorageLike): SaveLoadResult {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) {
      return storage.getItem(LEGACY_SAVE_KEY) ? { kind: 'legacy' } : { kind: 'empty' };
    }
    const parsed = JSON.parse(raw) as { version?: unknown; savedAt?: unknown; state?: unknown };
    if (parsed.version !== SAVE_VERSION || !parsed.state || typeof parsed.state !== 'object') {
      return { kind: 'empty' };
    }
    return {
      kind: 'loaded',
      state: parsed.state,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return { kind: 'empty' };
  }
}

export function writeSaveEnvelope(storage: StorageLike, state: unknown, savedAt = Date.now()) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt, state }));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
npm test
git add src/game/profile/chickenProfile.ts src/game/persistence/saveGame.ts tests/chickenProfile.test.ts tests/saveGame.test.ts
git commit -m "feat: add chicken profile and save v3 primitives"
```

Expected: 10 tests pass before the commit.

### Task 4: Add profile state and safe restoration

**Files:**
- Modify: `src/game/simulation/state.ts:19-233`
- Modify: `src/game/simulation/state.ts:258-340`
- Modify: `src/game/simulation/state.ts:1061-1109`
- Modify: `src/game/simulation/state.ts:1166-1201`
- Test: `tests/stateProfile.test.ts`

- [ ] **Step 1: Write failing state-profile tests**

Create `tests/stateProfile.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHudSnapshot,
  createGameState,
  restoreGameState,
  setChickenName,
} from '../src/game/simulation/state';

test('new state requires naming', () => {
  const state = createGameState();
  assert.equal(state.profile.named, false);
  assert.equal(buildHudSnapshot(state, false).requiresNaming, true);
});

test('setting the chicken name updates state and hud', () => {
  const state = createGameState();
  setChickenName(state, ' 小花 ');
  assert.equal(state.profile.name, '小花');
  assert.equal(state.profile.named, true);
  assert.equal(buildHudSnapshot(state, false).chickenName, '小花');
});

test('restore fills missing profile fields safely', () => {
  const restored = restoreGameState({ day: 3, profile: { name: '点点', named: true } });
  assert.equal(restored.profile.name, '点点');
  assert.equal(restored.profile.awakenedAbilities.peck, true);
  assert.equal(restored.profile.awakenedAbilities.sprint, false);
});
```

- [ ] **Step 2: Run to verify failure**

Run:

```powershell
npm test
```

Expected: FAIL because `GameState.profile`, `HudSnapshot.requiresNaming`, and `setChickenName` do not exist.

- [ ] **Step 3: Extend the state types**

Add this import to `src/game/simulation/state.ts`:

```ts
import {
  createChickenProfile,
  normalizeChickenName,
  type ChickenProfile,
} from '../profile/chickenProfile';
```

Add to `GameState`:

```ts
profile: ChickenProfile;
saveAvailable: boolean;
```

Add to `HudSnapshot`:

```ts
chickenName: string;
requiresNaming: boolean;
saveAvailable: boolean;
```

Initialize them in `createGameState()`:

```ts
profile: createChickenProfile(),
saveAvailable: true,
```

Add the mutation:

```ts
export function setChickenName(state: GameState, input: string) {
  state.profile.name = normalizeChickenName(input);
  state.profile.named = true;
  state.message = `从今天起，它叫${state.profile.name}。`;
}
```

Add to `buildHudSnapshot()`:

```ts
chickenName: state.profile.name,
requiresNaming: !state.profile.named,
saveAvailable: state.saveAvailable,
```

Restore the nested profile in `restoreGameState()`:

```ts
profile: {
  ...fresh.profile,
  ...(input.profile ?? {}),
  awakenedAbilities: {
    ...fresh.profile.awakenedAbilities,
    ...(input.profile?.awakenedAbilities ?? {}),
  },
},
saveAvailable: input.saveAvailable ?? true,
```

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass; Vite build succeeds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/game/simulation/state.ts tests/stateProfile.test.ts
git commit -m "feat: persist chicken profile in game state"
```

### Task 5: Add the naming overlay

**Files:**
- Modify: `index.html:7-136`
- Modify: `src/style.css`
- Modify: `src/main.ts:34-114`

- [ ] **Step 1: Add accessible naming markup**

Insert inside `#app`, before `#game`:

```html
<section id="namingPanel" class="naming-panel" aria-labelledby="namingTitle" hidden>
  <form id="namingForm" class="naming-card">
    <span>第一天</span>
    <h1 id="namingTitle">给这只鸡起个名字</h1>
    <p>以后你会用这个名字呼唤它回家。</p>
    <input
      id="chickenNameInput"
      name="chickenName"
      type="text"
      maxlength="12"
      autocomplete="off"
      placeholder="小鸡"
    />
    <button type="submit">就叫这个名字</button>
  </form>
</section>
<div id="saveWarning" class="save-warning" role="status" hidden>
  浏览器未允许保存；关闭页面后本次进度会消失。
</div>
```

- [ ] **Step 2: Add naming styles**

Append to `src/style.css`:

```css
.naming-panel {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(32, 28, 21, 0.76);
  backdrop-filter: blur(8px);
}

.naming-panel[hidden] {
  display: none;
}

.naming-card {
  width: min(420px, 100%);
  display: grid;
  gap: 14px;
  padding: 28px;
  color: #f8f0cf;
  background: #292a25;
  border: 1px solid rgba(248, 240, 207, 0.24);
  border-radius: 18px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
}

.naming-card input,
.naming-card button {
  min-height: 48px;
  padding: 0 14px;
  border-radius: 10px;
  font: inherit;
}

.save-warning {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 310;
  max-width: 320px;
  padding: 10px 14px;
  color: #fff1c6;
  background: #5b2c2c;
  border-radius: 10px;
}
```

- [ ] **Step 3: Wire the form in `main.ts`**

Add to the HUD element map:

```ts
namingPanel: document.querySelector<HTMLElement>('#namingPanel')!,
namingForm: document.querySelector<HTMLFormElement>('#namingForm')!,
chickenNameInput: document.querySelector<HTMLInputElement>('#chickenNameInput')!,
saveWarning: document.querySelector<HTMLElement>('#saveWarning')!,
```

Add to `renderHud(snapshot)`:

```ts
hud.namingPanel.hidden = !snapshot.requiresNaming;
hud.saveWarning.hidden = snapshot.saveAvailable;
if (snapshot.requiresNaming && document.activeElement !== hud.chickenNameInput) {
  hud.chickenNameInput.focus();
}
```

Add one submit handler:

```ts
hud.namingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  window.dispatchEvent(
    new CustomEvent('chicken-life:name-confirmed', {
      detail: { name: hud.chickenNameInput.value },
    }),
  );
});
```

- [ ] **Step 4: Build**

Run:

```powershell
npm run build
```

Expected: the build succeeds; no DOM selector is missing at startup.

- [ ] **Step 5: Commit**

Run:

```powershell
git add index.html src/style.css src/main.ts
git commit -m "feat: add chicken naming overlay"
```

### Task 6: Integrate save v3 and naming with `GameScene`

**Files:**
- Modify: `src/phaser/scenes/GameScene.ts:1-152`
- Modify: `src/phaser/scenes/GameScene.ts:182-317`
- Modify: `src/phaser/scenes/GameScene.ts:1577-1592`
- Modify: `src/game/simulation/state.ts`
- Test: `tests/saveIntegration.test.ts`

- [ ] **Step 1: Add a save integration test**

Create `tests/saveIntegration.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSaveEnvelope, writeSaveEnvelope } from '../src/game/persistence/saveGame';
import { createGameState, restoreGameState, setChickenName } from '../src/game/simulation/state';

class MemoryStorage {
  value: string | null = null;
  getItem() {
    return this.value;
  }
  setItem(_key: string, value: string) {
    this.value = value;
  }
}

test('name survives save encoding and state restoration', () => {
  const storage = new MemoryStorage();
  const state = createGameState();
  setChickenName(state, '<小花>');
  writeSaveEnvelope(storage, state, 12);
  const loaded = loadSaveEnvelope(storage);
  assert.equal(loaded.kind, 'loaded');
  if (loaded.kind !== 'loaded') return;
  const restored = restoreGameState(loaded.state);
  assert.equal(restored.profile.name, '<小花>');
  assert.equal(restored.profile.named, true);
});
```

- [ ] **Step 2: Replace inline save functions**

In `GameScene.ts`, import:

```ts
import {
  loadSaveEnvelope,
  writeSaveEnvelope,
} from '../../game/persistence/saveGame';
import { setChickenName } from '../../game/simulation/state';
```

Remove the local `SAVE_KEY`, `loadSavedGameState`, and `saveGameState`. Add:

```ts
function loadSavedGameState() {
  const result = loadSaveEnvelope(window.localStorage);
  return result.kind === 'loaded' ? restoreGameState(result.state) : createGameState();
}
```

Replace the body of `saveGame()` with:

```ts
private saveGame(force = false) {
  if (!force && this.time.now - this.lastSavedAt < 2600) return;
  this.lastSavedAt = this.time.now;
  this.state.saveAvailable = writeSaveEnvelope(window.localStorage, this.state);
}
```

- [ ] **Step 3: Handle the name event and pause unnamed play**

Add:

```ts
private handleNameConfirmed = (event: Event) => {
  const name = String((event as CustomEvent<{ name?: unknown }>).detail?.name ?? '');
  setChickenName(this.state, name);
  this.emitHud(true, true);
};
```

Register it in `create()`:

```ts
window.addEventListener('chicken-life:name-confirmed', this.handleNameConfirmed);
```

Remove it in the shutdown callback:

```ts
window.removeEventListener('chicken-life:name-confirmed', this.handleNameConfirmed);
```

At the top of `update()` after calculating `dt`, add:

```ts
if (!this.state.profile.named) {
  this.updateSprites(dt);
  return;
}
```

For the debug clear-save action, clear both v3 and legacy keys via exported constants from `saveGame.ts`, then create a fresh unnamed state.

- [ ] **Step 4: Run all verification**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass and the production build succeeds.

- [ ] **Step 5: Manual smoke test**

Run:

```powershell
npm run dev
```

Verify:

1. A fresh load shows the naming form before chicken movement.
2. Entering `小花` starts play.
3. Refreshing the page does not show the naming form again.
4. Debug clear-save returns to the naming form.
5. Entering `<b>鸡</b>` displays literal text if the name is rendered.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/phaser/scenes/GameScene.ts src/game/simulation/state.ts tests/saveIntegration.test.ts
git commit -m "feat: save chicken name in profile v3"
```

### Phase 1 exit check

Run:

```powershell
npm test
npm run build
git status --short
```

Expected: tests and build pass; no generated files are tracked; the game still uses the prototype loop but requires and remembers a chicken name.
