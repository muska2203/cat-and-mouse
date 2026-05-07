# AGENTS.md

Compact rules for AI agents working in this repository.

> Note: this project is Russian-first. Keep UI text, logs, tooltips, and code comments in Russian unless the task explicitly asks for another language.

## Project basics
- Stack: static frontend, no framework, browser ES modules.
- Entry point: `index.html` -> `src/main.js`.
- Core state split: long-lived character data in `state.playerSheet`, run-level data in `run`.
- Keep `main.js` as composition root (wiring). Put domain logic in focused modules (`game/*`, `items/*`, `runtime/*`, `ui/*`).

## Must-follow rules
- Do not invent domain terms or mechanics; verify in code.
- Keep one source of truth for formulas and gameplay numbers; avoid duplicated logic.
- Keep domain state separate from UI-only transient state (hover/preview/targeting).
- Any formula change must also update related player-facing texts/tooltips in the same task.
- In user-facing formulas, avoid technical wording like `floor/round/ceil`.

## Inventory and consumables invariants
- `instanceId` is a global item-instance id: unique per instance and preserved when moving between bag/equipment.
- For non-trap consumables, do not add branching by `item.id` in `src/game/consumables.js`.
- Add new consumable behavior in `src/items/consumableApply.js` via resolver map, and keep item catalog in `src/loadout.js` declarative.
- Consumable logs/tooltips must go through `src/items/itemPresentation.js`.

## UI and design constraints
- Do not edit files in `design/` unless explicitly requested.
- For UI changes, verify against `design/main_concept.png` and related specs in `design/projects/` and `design/impl/`.
- If implementation and design conflict, ask user before improvising.
- Current migration stage is desktop-first: do not add/restore mobile controls unless explicitly requested.

## Versioning / release hygiene
- For commits/pushes to `main`, run:
  - `node scripts/set-app-version.mjs --suggest`
  - `node scripts/set-app-version.mjs <new_version>`
- IMPORTANT: version update before commit/push and devlog update are mandatory and must never be skipped.
- This must sync version in `src/app-config.js`, `index.html`, and `?v=` suffixes in `src/*` imports.
- After version bump, prepend a new user-visible entry to `src/devlog.js` for that version (mandatory; do not skip).

