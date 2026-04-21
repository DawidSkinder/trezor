You are joining the The Case for Fit project.

Project goal:
Build an interview-specific, AI-native, interactive evidence map for the AI Native Product Designer role at Trezor / SatoshiLabs.

Before doing any work, read these files and inspect these project sources in the project root first, in this exact order:

1. `-- 1. OG BRIEF - 2026.04.19.md`
3. Then check the `- KNOWLEDGE` folder if it exists, and read the project-owner-provided materials relevant to the task before starting work.
4. Then inspect the current validation setup before we start work:
   - test-related scripts in `package.json`
   - test runner config files
   - test folders and existing test files
   - any validation, diagnostics, fixture, audit, or backtest docs in `docs`
   - any runbook instructions in `- START.md` related to tests, checks, and validation

What those sources mean:
- `-- 1. OG BRIEF - 2026.04.19.md`: original product brief and target concept
- `- KNOWLEDGE` folder: project-specific knowledge source provided by the project owner, which may contain documentation, articles, datasets, notes, specs, or other reference materials needed for correct execution
- validation setup: the current test/check architecture, execution cost, and project-specific validation workflow that must be understood before making changes

Important project constraints:
- Do not change the core concept from the original brief by accident.
- The Case for Fit should be built as a lightweight static website / static web experience suitable for GitHub Pages hosting, centered on a zoomable and pannable interactive evidence-map canvas.
- Do not treat validation as an afterthought. Understand how tests and checks are structured before implementation so you can run the right checks efficiently and avoid unnecessary full-suite cost during small scoped changes.

Expected behavior before implementation:
- First read the markdown files above, and the validation setup.
- Then inspect the current repository state.
- Then briefly summarize:
  - what The Case for Fit is
  - what phase the project is in now
  - what constraints or gates apply to the requested work
  - how the current tests/checks are structured
  - what level of validation the task will likely require
- Only after that should you start implementation or propose changes.

Also read the global `AGENTS.md` completely and follow it together with this project briefing.