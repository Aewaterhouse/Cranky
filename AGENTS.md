# Agent instructions

Copy this section into AGENTS.md at the repo root.
Working rules
• Work one phase at a time from PLAN.md. Tick checklist items as they are done.
• Keep each change small and runnable. Commit after each checklist item.
• Every feature must work with the simulated trainer. Never require real hardware to run tests.
• Do not wait for the owner. This is a janky hobby project and the owner will not review most decisions. Make a reasonable assumption, log it in docs/decisions.md and keep going.
• Do not build features from later phases.
• Prefer simple and janky over clever. Fun first. You may invent or tune mechanics and numbers to make it more fun; log them in docs/decisions.md.
Safety rules for ERG
• All ERG writes go through ergController.ts. No other module writes to the trainer.
• Enforce the 150% FTP cap with unit tests. Sprint blocks must never send an ERG target; test this too.
• Ramp target changes over 2 s. On disconnect or error set ERG to 50% FTP then release control.
Code style
• Python: black, ruff, Google docstrings, type hints, pathlib for paths. Comments only on complex blocks.
• TypeScript: strict mode, prettier, eslint. Comments only on complex blocks.
• Australian English in UI text and docs.
• Config values (caps, bands, tick rates, sync window) live in one config file per side, not inline.
Shortest form
• Write code in its shortest readable form. Fewer lines, fewer files, fewer abstractions.
• No speculative interfaces, factories or class hierarchies. Add structure only when a second use exists.
• Prefer the standard library and existing dependencies. A new dependency is fine if it removes a lot of code.
• Delete dead code instead of commenting it out.
Assets
• Use CC0 assets only unless approved. Record every asset in client/public/assets/CREDITS.md with source and licence.
• Visual properties (colours, fog, camera) must be tunable parameters exposed in a debug panel.
Testing
• Unit tests for plan parsing, compliance, ERG caps, session generator and scoring.
• A headless multiplayer test that runs four simulated riders through a 5 min plan.
• Manual test notes per phase in docs/testing.md.
Context management
Agents degrade when their context fills with code. Keep reading minimal and state on disk.
1. Start every session by reading AGENTS.md, docs/status.md and the current phase in PLAN.md. Nothing else until needed.
2. Use docs/map.md to find files. Locate code with grep or ls, then read only the relevant function or line range, not whole files.
3. Keep files under about 300 lines with one job each. Split before they grow past that.
4. Modules talk through docs/protocol.md, the shared types and config. A change should touch few files.
5. Work one checklist item at a time. Commit when it works, then update docs/status.md and docs/map.md.
6. Never read node_modules, build output, lockfiles, binary assets or large JSON. Pipe long command output through head or tail and summarise errors rather than dumping them.
7. Run targeted tests for the change, then the full suite before committing.
8. If stuck after three attempts, stub or simplify, note it under known issues in docs/status.md and move on.
9. If the context is getting long, finish the current item, write status and start a fresh session.
10. Use sub-agents for exploration or broad searches when available and keep only their summary.
