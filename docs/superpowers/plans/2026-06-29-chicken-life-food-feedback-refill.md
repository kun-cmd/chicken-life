# Chicken Life Food Feedback and Refill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep food on mud, prevent the yard from running empty, and give every successful bite readable positive feedback.

**Architecture:** Authored yard points guarantee valid ground. The foraging system owns deterministic unique plans and daily satisfaction progress; `GameScene` selects off-camera refill points and renders food-specific feedback.

**Tech Stack:** TypeScript, Phaser, Vite.

---

### Task 1: Valid deterministic food supply

**Files:**
- Modify: `src/game/content/yard.ts`
- Modify: `src/game/systems/foraging.ts`
- Modify: `src/game/simulation/state.ts`
- Modify: `src/phaser/scenes/GameScene.ts`

- [ ] Replace authored food and sprint-tutorial positions that overlap either stone path.
- [ ] Make daily plans use unique authored points before reusing any point.
- [ ] Increase the morning plan from 10 to 15 foods.
- [ ] Add a deterministic refill wave counter and state mutation that spawns 4 foods from scene-provided off-camera mud points.
- [ ] Trigger refill when at most 2 reachable visible foods remain.
- [ ] Keep fleeing insects off stone paths.

### Task 2: Layered eating feedback

**Files:**
- Modify: `src/game/systems/foraging.ts`
- Modify: `src/game/simulation/state.ts`
- Modify: `src/phaser/scenes/GameScene.ts`

- [ ] Track the daily bite count and whether the first daily satisfaction memory has occurred.
- [ ] Return bite milestone information from food consumption.
- [ ] Render food-colored crumbs, a swallow/head movement, sound, and a short happy motion for every bite.
- [ ] Trigger the larger satisfaction motion every third bite.
- [ ] Preserve first-discovery rewards and sprint-energy restoration.

### Task 3: Broad verification

**Files:**
- Modify only if defects are found.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Browser-smoke the first day, eat food, and confirm refill points remain off the paths.
- [ ] Commit the feature as one player-facing food improvement.
