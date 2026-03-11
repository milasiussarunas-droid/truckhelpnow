# Diagnostic evaluation

Test-case schema and example fixtures for the TruckHelpNow diagnostic system.

- **Schema (TypeScript):** `test-case-schema.ts` — types for test cases and run output.
- **Example cases (JSON):** `test-cases.example.json` — 3 starter cases; expand to 20–50.
- **Evaluation plan:** `docs/evaluation-plan.md` — what to capture, how to compare, metrics.
- **Volvo synthesis eval:** `volvo-synthesis-eval.json` — P1B72, P04D900, SPN/FMI, VECU/section 3 queries for comparing answer quality before/after synthesis improvements. See `volvo-synthesis-eval.md` for how to run and what to compare.

No app code changes required; use with captured API responses and optional scripts.
