# Volvo Answer Synthesis Improvements — Report

This report summarizes changes made to improve **answer composition** for Volvo (and general) diagnostic queries in TruckHelpNow. The bottleneck was synthesis, not retrieval: the system already retrieves useful evidence, but final answers were often generic or under-structured.

---

## 1. What changed (synthesis logic)

### New module: `lib/diagnostics/synthesis.ts`

- **Query-type detection** (`inferDiagnosticQueryType`): Classifies the user request into:
  - `exact_obd_pcode` — e.g. P1B72, P04D900
  - `spn_fmi` — explicit SPN/FMI in message
  - `recall_campaign` — keywords: recall, campaign, bulletin, TSB
  - `electrical_ecu` — VECU, electrical, wiring, section 3, ECU labels
  - `general_symptom` — fallback

- **Evidence trust** (`classifyEvidenceTrust`): Uses the `provenance` field of `truck_diagnostic_kb` rows to tier sources:
  - **High:** OEM, recall, bulletin, TSB, electrical_ecu_manual, wiring, manual, workshop
  - **Low:** forum, discussion, thread, post (secondary only)
  - **Medium:** everything else

- **Synthesis instructions** (`getSynthesisInstructionsForQueryType`): Returns a short, query-type-specific instruction block injected into the prompt (e.g. for exact P-code: structure as what the code means → likely causes → what to check first → supporting evidence → confidence/caveats).

- **KB ordering** (`sortDiagnosticKbByTrust`): Diagnostic KB matches are sorted so high-trust sources appear first in the context sent to the model.

- **Provenance labeling** (`formatProvenanceWithTrust`): When listing sources in the prompt, provenance is annotated with “(high-trust source; prefer in summary)” or “(secondary/supporting only; not primary authority)” so the model knows how to weight them.

### Chat route: `app/api/chat/route.ts`

- **System prompt (text + image):** Added an **EVIDENCE USE** paragraph: prefer high-trust sources when summarizing; use forum as secondary; when evidence is strong be specific, when weak state what is known vs uncertain; avoid generic filler that doesn’t reflect retrieved docs.

- **Grounding block (text-only and image Pass 2):** The block now includes:
  1. **Query-type hint** — `getSynthesisInstructionsForQueryType(queryType)` so the model structures the answer by type (exact code vs SPN/FMI vs recall vs electrical vs general).
  2. **KB section** — `formatKnowledgeContextForPrompt` now:
     - Sorts `matchedDiagnosticKb` with `sortDiagnosticKbByTrust` (OEM/recall/electrical/wiring first, forum last).
     - Uses `formatProvenanceWithTrust(kb.provenance)` for the “Source:” line so the model sees trust hints.

- **Query type** is derived from `extractTruckEvidence` + user message and passed into the grounding for both text-only and image two-pass flows.

---

## 2. Example before/after (expected behavior)

| Aspect | Before | After |
|--------|--------|--------|
| **Structure** | Single paragraph or loose list; no clear “what it means → causes → checks → evidence → caveats”. | Prompt asks for (1) what code/query likely means (2) likely causes (3) what to inspect/check first (4) supporting evidence from docs (5) confidence/caveats when evidence is weak/mixed. |
| **Evidence** | All KB hits treated equally; forum and OEM mixed. | High-trust (OEM, recall, electrical manual, wiring) listed first and labeled; forum labeled as “secondary only”. Model instructed to prefer high-trust when summarizing. |
| **Vague filler** | Generic “have it inspected” or “see a mechanic” without tying to codes/docs. | Instructions to tie every recommendation to codes/symptoms and to state what is known vs uncertain when evidence is weak. |
| **Query type** | Same treatment for P-code, SPN/FMI, recall, electrical. | Different synthesis instructions per type (e.g. recall → campaign/action; electrical → circuit/wiring/VECU manual). |

Concrete before/after text depends on live retrieval and model output; run the eval (below) to capture real examples.

---

## 3. Where answers improved

- **Structure:** Answers are steered toward the five-part structure (meaning → causes → checks → evidence → caveats), especially for exact P-code and SPN/FMI.
- **Evidence hierarchy:** OEM/recall/electrical/wiring are prioritized in context and in instructions; forum is explicitly secondary.
- **Specificity vs honesty:** When KB evidence is strong, the model is asked to be specific; when weak, to say what is known vs uncertain instead of generic advice.
- **Query-type fit:** Recall-style queries get campaign/action emphasis; electrical/VECU queries get circuit/wiring and manual emphasis; P-code/SPN/FMI get code-centric interpretation and checks.

---

## 4. Where answers are still limited (source coverage)

- **Weak or no retrieval:** If `truck_diagnostic_kb` and canonical fault data have little or no content for a code (e.g. some exact P-codes), the reply will still be generic or uncertain. Synthesis cannot invent evidence.
- **Provenance quality:** Trust classification relies on `provenance` text. If provenance is missing or not labeled (e.g. no “OEM”, “recall”, “forum”), everything is treated as medium trust.
- **Ambiguity:** When top ranked faults are close in score, the system already preserves ambiguity; synthesis keeps that behavior and asks for caveats rather than forcing a single diagnosis.

---

## 5. Lightweight evaluation

- **Test cases:** `lib/diagnostics/evaluation/volvo-synthesis-eval.json` — four queries:
  - P1B72 (exact P-code)
  - P04D900 (exact P-code)
  - SPN 3710 FMI 2 (SPN/FMI)
  - VECU section 3 electrical / EECU communication (electrical)

- **How to run:**  
  `npx tsx scripts/run-diagnostic-eval.ts lib/diagnostics/evaluation/volvo-synthesis-eval.json`  
  (App must be running; optionally set `BASE_URL`.)

- **What to compare:** See `lib/diagnostics/evaluation/volvo-synthesis-eval.md` for criteria: structure, evidence use, specificity, query-type fit. Review the printed `reply` text manually; the script does not auto-check structure.

---

## 6. Files changed

| File | Change |
|------|--------|
| `lib/diagnostics/synthesis.ts` | **New.** Query-type inference, evidence trust from provenance, synthesis instructions per type, KB sort by trust, provenance formatting with trust hint. |
| `app/api/chat/route.ts` | Import synthesis helpers. Extended system prompt with EVIDENCE USE. Text-only and image Pass 2: add query-type synthesis hint to grounding block; in `formatKnowledgeContextForPrompt`, sort diagnostic KB by trust and use `formatProvenanceWithTrust` for source lines. |
| `lib/diagnostics/evaluation/volvo-synthesis-eval.json` | **New.** Four Volvo test cases (P1B72, P04D900, SPN/FMI, VECU electrical). |
| `lib/diagnostics/evaluation/volvo-synthesis-eval.md` | **New.** How to run and what to compare for before/after synthesis. |
| `lib/diagnostics/evaluation/README.md` | Mention Volvo synthesis eval and `volvo-synthesis-eval.md`. |
| `SYNTHESIS_IMPROVEMENTS_REPORT.md` | **New.** This report. |

No changes were made to the data-scraper, gather pipeline, or retrieval schema; all work is app-side answer generation and prompt/context shaping.
