# Evidence Transparency & Diagnostic Inspectability — Report

This report summarizes changes made to improve **source transparency** and **debug visibility** in TruckHelpNow answers, so users can see what kind of sources support a response and reviewers can debug retrieval-to-answer quality more easily.

---

## 1. What changed

### Source transparency in answers

- **Structured source labels:** The API now derives concise, human-readable source labels from diagnostic KB provenance (e.g. *OEM manual*, *Recall / bulletin*, *Wiring / electrical manual*, *Forum discussion*) and returns them in `sourcesUsed` and appends a short line to the reply text: `Sources: OEM manual; Wiring / electrical manual.`
- **Evidence strength:** A single evidence-strength value is computed from the resolved context (strong / mixed / weak) and returned as `evidenceStrength` and appended to the reply: `Evidence: strong (high-trust docs used).` / `Evidence: mixed (multiple or ambiguous sources).` / `Evidence: limited (few or no matching docs).`
- **UI block:** The chat UI shows an **Evidence** block when the API returns `sourcesUsed` or `evidenceStrength`, with “Sources: …” and “Strength: Strong / Mixed / Limited” and color cues (e.g. green for strong, amber for mixed, gray for limited).

### Confidence / certainty signaling

- **Strong evidence:** High-trust KB items present, no ambiguity in ranking, no unresolved codes → `evidenceStrength: 'strong'` and reply line “Evidence: strong (high-trust docs used).”
- **Mixed evidence:** Both high- and low-trust sources, or ambiguous top matches, or unresolved codes → `evidenceStrength: 'mixed'` and “Evidence: mixed (multiple or ambiguous sources).”
- **Weak evidence:** Few or no KB matches, or only low-trust sources → `evidenceStrength: 'weak'` and “Evidence: limited (few or no matching docs).”
- The model’s `overall_confidence` is unchanged; the new signaling is additive so the answer text and Evidence block align with how much we trust the retrieved docs.

### Developer / debug inspection path

- **Debug flag:** The chat API accepts a debug request via form field `debug=1` (or `debug=true`) or header `X-THN-Debug: true`.
- **When enabled:** If the server is in development (`NODE_ENV=development`) or `THN_DEBUG=1` (or `THN_DEBUG=true`) is set, the response includes a `debug` object with `inspection.diagnosticKb`: the list of diagnostic KB items that were provided to synthesis, in trust order, each with:
  - `order` (1-based)
  - `display_code`
  - `provenance`
  - `trust` (`high` | `medium` | `low`)
  - `snippet` (short title/description, up to 80 chars)
- **Eval script:** Running with `THN_DEBUG=1` sends `debug=1` and the script prints `debugInspectionKbCount` when the API returns the inspection payload. For full payload inspection, call the API directly (e.g. curl with `-F debug=1`).

### Evaluation workflow

- **Volvo synthesis eval** (`lib/diagnostics/evaluation/volvo-synthesis-eval.md`) extended with:
  - **Source transparency:** Compare that the reply and Evidence block show concise source labels and are readable.
  - **Confidence wording:** Compare that strong/mixed/weak is clearly signaled and that main text does not overstate confidence when evidence is limited.
- **Eval runner** (`scripts/run-diagnostic-eval.ts`) and **test-case schema** now capture and print `sourcesUsed`, `evidenceStrength`, and (when debug is requested) `debugInspectionKbCount` so reviewers can compare answer structure, evidence usage, specificity, confidence wording, and source transparency.

---

## 2. Example answer outputs

### Before (conceptual)

- Reply: one or two paragraphs of diagnosis and checks, then a long “Knowledge base matches: …” / “Diagnostic KB matches: …” block. No clear “what sources” or “how strong is the evidence.”
- User could not quickly see whether the answer was backed by OEM docs vs forum only.

### After

- Reply still has the main diagnosis and checks, then:
  - **Sources: OEM manual; Wiring / electrical manual.**
  - **Evidence: strong (high-trust docs used).**
  - Then the existing “Knowledge base matches” / “From knowledge base” appendix as before.
- In the UI, the **Evidence** block appears under the main analysis with:
  - **Sources:** OEM manual; Wiring / electrical manual  
  - **Strength:** Strong (high-trust docs used) — in green when strong, amber when mixed, gray when limited.

When evidence is weak (e.g. no or few KB hits):

- **Sources:** (empty or only “Forum discussion” if that’s all that matched)
- **Evidence: limited (few or no matching docs).**
- UI shows **Strength: Limited (few or no matching docs)** in gray.

---

## 3. How source transparency appears

- **In the reply text:** Two short lines before the existing KB appendix: `Sources: …` and `Evidence: …`. Only added when there is knowledge context; labels are deduplicated (e.g. multiple OEM rows yield a single “OEM manual”).
- **In the API response:** Top-level `sourcesUsed: string[]` and `evidenceStrength: 'strong' | 'mixed' | 'weak'` when applicable.
- **In the chat UI:** The **Evidence** card under the analysis shows “Sources” and “Strength” with the above wording and color so users can see at a glance what kind of sources were used and how reliable the answer is.

---

## 4. How to use the debug / inspection mode

1. **Enable on the server:** Run with `NODE_ENV=development` (e.g. `npm run dev`) or set `THN_DEBUG=1` (or `THN_DEBUG=true`) in the environment.
2. **Request debug in the call:**
   - **Form:** Include `debug=1` or `debug=true` in the form body (e.g. when posting to `/api/chat`).
   - **Header:** Send `X-THN-Debug: true` (or `X-THN-Debug: 1`).
3. **Inspect the response:** The JSON response will include `debug.inspection.diagnosticKb`: an array of objects with `order`, `display_code`, `provenance`, `trust`, and `snippet`. Use this to see exactly which KB rows were sent to synthesis and in what order (trust-sorted).
4. **Eval script:** Run `THN_DEBUG=1 npx tsx scripts/run-diagnostic-eval.ts lib/diagnostics/evaluation/volvo-synthesis-eval.json` to have the script send `debug=1` and print `debugInspectionKbCount` per case when the server returns the inspection payload.

Debug payload is only returned when both the request asks for it and the server is in dev/debug mode, so it is not exposed in production.

---

## 5. What the next bottleneck becomes

- **Retrieval coverage and quality:** Transparency and strength signaling make it obvious when evidence is “limited” or “mixed.” The next bottleneck is improving **what** gets retrieved (more/better Volvo OEM content, recalls, wiring docs) and how it is ranked—i.e. data and retrieval pipeline, not answer presentation.
- **Model adherence:** The model may still sometimes use generic wording or overstate confidence; prompt and schema are already set to prefer high-trust sources and to state uncertainty. Further tuning (e.g. stronger instructions, few-shot examples) can improve adherence.
- **Provenance consistency:** Source labels depend on `provenance` strings in `truck_diagnostic_kb`. If provenance is missing or inconsistent, “Sources” may be empty or incomplete. Standardizing and backfilling provenance will improve transparency accuracy.

---

## 6. Files changed

| File | Change |
|------|--------|
| `lib/diagnostics/synthesis.ts` | Added `getSourceLabelsForDisplay`, `getEvidenceStrength`, `formatSourcesLine`, `formatEvidenceStrengthLine`, `buildDebugInspectionKb`; `EvidenceStrength` type and `DebugInspectionKbItem` interface. |
| `app/api/chat/route.ts` | Detect `debug` form/header; compute `sourcesUsed` and `evidenceStrength` from context; append Sources and Evidence lines to reply; add `sourcesUsed` and `evidenceStrength` to JSON response; when debug requested and dev/debug mode, add `debug.inspection.diagnosticKb`. |
| `app/chat/page.tsx` | Extended `ChatMsg` with `sourcesUsed` and `evidenceStrength`; parse them from API response; added `EvidenceSourcesBlock`; render Evidence block for assistant messages (with or without structured). |
| `lib/diagnostics/evaluation/test-case-schema.ts` | Added `sourcesUsed`, `evidenceStrength`, `debugInspectionKbCount` to `DiagnosticTestRunOutput`. |
| `scripts/run-diagnostic-eval.ts` | Parse and output `sourcesUsed`, `evidenceStrength`, `debugInspectionKbCount`; send `debug=1` when `THN_DEBUG` is set; print new fields in per-case results. |
| `lib/diagnostics/evaluation/volvo-synthesis-eval.md` | Added comparison criteria for source transparency and confidence wording; added “Debug / inspection mode” section. |
| `EVIDENCE_TRANSPARENCY_REPORT.md` | New: this report. |

No changes were made to the data-scraper or gather pipeline; all work is app-side answer presentation and debugging visibility.
