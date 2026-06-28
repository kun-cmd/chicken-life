# Chicken Life Rebuild Roadmap

This roadmap splits the approved MDA redesign into six sequential implementation plans. Each phase must leave a runnable, testable game and must be completed before the next phase begins.

## Repository constraint

Only the design documents are currently tracked by Git. The prototype source, tests, audio, and configuration files are untracked. Phase 1 begins by ignoring generated artifacts and committing the existing prototype as a clean baseline. Do not add ZIP files, logs, `dist/`, `dist-itch/`, `node_modules/`, `.npm-cache/`, or `.test-dist/`.

## Phase order

1. [Profile, naming, save v3, and test foundation](./2026-06-28-chicken-life-phase-1-profile-foundation.md)
2. [Dual-perspective day flow and minimal HUD](./2026-06-28-chicken-life-phase-2-day-flow-hud.md)
3. [Instinct awakenings, chicken movement, and foraging](./2026-06-28-chicken-life-phase-3-chicken-abilities-food.md)
4. [Close interaction, relationship growth, and dusk collection](./2026-06-28-chicken-life-phase-4-human-relationship-dusk.md)
5. [Egg search, album, wood delivery, yard upgrades, and weather](./2026-06-28-chicken-life-phase-5-eggs-upgrades.md)
6. [Observable weasel danger, Day 14 finale, cleanup, and release verification](./2026-06-28-chicken-life-phase-6-weasel-finale-polish.md)

## Design coverage

| Approved design area | Owning phase |
| --- | --- |
| Chicken naming and save persistence | Phase 1 |
| Morning human → chicken day → dusk human → night result | Phase 2 |
| Minimal HUD and contextual prompts | Phase 2 |
| Peck, scratch, sprint, flutter, call | Phase 3 |
| Ability awakenings on Days 4, 5, and 7 | Phase 3 |
| Autonomous foraging and staged food pool | Phase 3 |
| First-person close feeding and touch | Phase 4 |
| Hidden relationship stages and name response | Phase 4 |
| Human collection, carrying, following, and coop door | Phase 4 |
| Hidden egg position, escalating clues, and album | Phase 5 |
| One egg → one delivered wood | Phase 5 |
| Six visible upgrades costing twelve wood | Phase 5 |
| Controlled weather and facility idle life | Phase 5 |
| Fixed/random weasel schedule and handheld lantern | Phase 6 |
| Closed coop is absolutely safe | Phase 6 |
| Day 14 storm, checkpoint, ending, and free play | Phase 6 |
| Rewrite `rules.md`, full test/build/package verification | Phase 6 |

## Global execution rules

- Use TDD for every pure system and state transition.
- Commit after every numbered task using the exact commit message in that phase plan.
- Run `npm test` after every task and `npm run build` after every scene/UI integration task.
- Keep the current generated-art style during this rebuild; do not introduce a separate asset pipeline.
- Preserve unrelated user files and generated release archives.
- Before any itch.io release, run `npm run package:itch` and upload only `chicken-life-itch-flat.zip`.

## Completion definition

The rebuild is complete when all six phase plans are checked off, `npm test`, `npm run build`, and `npm run package:itch` pass, the browser playtest covers a complete 14-day run plus free play, and `rules.md` matches the implemented behavior.
