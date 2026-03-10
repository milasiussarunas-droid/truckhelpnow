# TruckHelpNow Diagnostic System — Evaluation Plan

Lightweight, developer-facing plan to test output quality across real cases. No app code changes required to run evaluations; use captured API responses and optional test-case fixtures.

---

## 1. Fields to capture per test case

### Input (what the user sends)

| Field | Description | Use |
|-------|-------------|-----|
| `message` | Raw user message text | Reproducibility; text-only flow |
| `hasImage` | Whether an image was attached | Flow type; two-pass vs fallback |
| `rawCodes` | Codes extracted from message/image (if known) | Compare to KB resolution |
| `suspectedBrand` | Brand mentioned (if any) | Brand override / KB alignment |

### Output (what the API returns)

| Field | Description | Use |
|-------|-------------|-----|
| `reply` | Full reply text (includes honesty note + KB appendix when present) | Compare to expected; check placement of honesty note |
| `structured` | Full `DiagnosticResponse` (most_likely_problem, primary_systems_involved, missing_information, overall_confidence, safety_*, etc.) | Compare to expectations; metrics |
| `usedTwoPassFlow` | `true` if image used two-pass (extract then diagnose), else `false` | Flow coverage; regression |
| `knowledgeContext` | Full resolved KB context or `null` | Ranked matches; procedures; unresolved |
| `diagnosticConsistency` | `{ isConsistent, warnings, severity }` | Honesty note trigger; consistency metrics |

### Derived / snapshot for comparison

| Field | Description | Use |
|-------|-------------|-----|
| `rankedCanonicalFaults` | From `knowledgeContext.rankedCanonicalFaults` (top N) | Compare order/confidence to expected |
| `unresolvedCodes` | From `knowledgeContext.unresolvedCodes` | Expect acknowledgment in reply/structured |
| `matchedCanonicalFaults` | From `knowledgeContext.matchedCanonicalFaults` (count or ids) | KB hit rate |

---

## 2. Comparing current output to expected outcomes

- **Stored expected file:** Each test case can store optional `expected` (see schema below). Comparison is manual or scripted.
- **Reply:** Compare `reply` to expected summary or key phrases (e.g. “safety”, “unresolved”, honesty note present when `diagnosticConsistency.isConsistent === false`).
- **Structured:** Assert or diff:
  - `primary_systems_involved` includes expected subsystems when KB top match suggests them.
  - `missing_information` or `most_likely_problem` mentions gaps when `unresolvedCodes.length > 0`.
  - `overall_confidence` is not `high` when `diagnosticConsistency.isConsistent === false` (optional soft check).
- **Consistency:** If `diagnosticConsistency.isConsistent === false`, expect honesty note in `reply` and optionally that `diagnosticConsistency.warnings` match known failure modes.
- **Ranking:** For cases with known “correct” fault, check that the top `rankedCanonicalFaults` entry matches or is in top 2 when ambiguous.

---

## 3. Using API response fields in evaluation

| Field | How to use in evaluation |
|-------|---------------------------|
| **usedTwoPassFlow** | Segment results by flow (text-only vs image two-pass vs image fallback). Track pass rate and quality per flow. |
| **knowledgeContext** | If null, no KB was used; expect no ranked/appendix. If present, use `rankedCanonicalFaults`, `unresolvedCodes`, `evidenceSummary`, `confidenceNotes` to judge alignment with reply and structured. |
| **rankedCanonicalFaults** | Check order (score desc); top 1–3 vs expected fault(s); confidence and reasons; whether reply/structured aligns with top match or acknowledges ambiguity when top two are close. |
| **diagnosticConsistency** | If `isConsistent === false`, expect honesty note in reply and optionally log `warnings` for tuning. Aggregate % consistent and severity (low/medium) across runs. |
| **reply** | Check for: main diagnosis, honesty note (when inconsistent), KB appendix; no duplicate or misplaced sections. |

---

## 4. Metrics and review criteria

### Automated / scriptable

- **Consistency rate:** % of runs where `diagnosticConsistency.isConsistent === true`.
- **Honesty note when inconsistent:** When `isConsistent === false`, `reply` contains the honesty note (string match or key phrase).
- **Flow distribution:** % text-only, % two-pass, % fallback (when image present).
- **KB hit rate:** % of cases with at least one `matchedCanonicalFaults` (or `rankedCanonicalFaults.length > 0`).
- **Unresolved acknowledgment:** When `unresolvedCodes.length > 0`, `missing_information` or `most_likely_problem` contains gap-related phrasing (heuristic).

### Human review (per case or sample)

- **Subsystem alignment:** Top ranked fault subsystem vs `primary_systems_involved` and reply narrative.
- **Ambiguity:** When top two ranked scores are close, reply does not present a single winner as certain.
- **Safety:** Critical symptoms (brakes, steering, overheating, etc.) get appropriate safety_level and safety_message.
- **Usefulness:** Reply is concrete (codes/subsystems referenced) and not generic.

### Optional aggregates

- **By flow:** consistency rate and KB hit rate by `usedTwoPassFlow` and hasImage.
- **By severity:** when inconsistent, share of `severity === 'medium'` vs `'low'`.

---

## 5. Test-case format (20–50 real cases)

Use the TypeScript schema in `lib/diagnostics/evaluation/test-case-schema.ts` and the example in `lib/diagnostics/evaluation/test-cases.example.json`. Each case has:

- **id:** Unique slug.
- **input:** `message`, optional `hasImage` (default false), optional `rawCodes` / `suspectedBrand` for reference.
- **expected (optional):** Minimal expectations for comparison (e.g. expected subsystems, key phrases, or “honesty note if inconsistent”).
- **notes:** Free text for reviewers (e.g. “known DEF code”, “ambiguous SPN”).

Run the app or a script that POSTs each case to the chat API, captures the response, and optionally compares to `expected` and logs `diagnosticConsistency` and `rankedCanonicalFaults` for review.

---

## File locations

- **This plan:** `docs/evaluation-plan.md`
- **Test-case schema (TypeScript):** `lib/diagnostics/evaluation/test-case-schema.ts`
- **Example test cases (JSON):** `lib/diagnostics/evaluation/test-cases.example.json`
