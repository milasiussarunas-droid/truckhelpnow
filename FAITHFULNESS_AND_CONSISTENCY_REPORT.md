# Diagnostic Answer Consistency & Retrieval-to-Answer Faithfulness — Report

This report summarizes changes made to keep TruckHelpNow answers **tightly grounded** in retrieved evidence and **consistently structured**, and to improve **provenance consistency** and **faithfulness evaluation**.

---

## 1. What changed

### Answer faithfulness to retrieved evidence

- **Prompt grounding:** The system prompt (text and image flows) now includes an explicit **GROUNDING** rule: base the answer only on the provided KB block and the user message; do not invent causes, checks, or part numbers that are not in the KB or clearly implied by the user’s codes/symptoms. When the KB is empty or lists “Codes not found in KB”, set `overall_confidence` to low and state in `most_likely_problem` or `missing_information` that coverage is limited. Every claim in `most_likely_problem`, `possible_causes`, and `recommended_checks` should be traceable to the KB or to the user’s stated codes/symptoms.
- **Grounding block header:** The context injected before the KB block was changed from “Supporting context … use to inform your response” to “Knowledge base context — use this as the **primary evidence** for your answer. Base your diagnosis on the items below; **do not add causes or checks that are not supported by them**.”
- **Synthesis instructions:** Each query-type synthesis hint now ends with: “Do not add claims that are not supported by the KB block below; when the KB is empty or weak, state limited coverage and what is uncertain.”

### Consistency of answer structure

- **ANSWER STRUCTURE** was added to both system prompts: “For every diagnostic answer use this structure: most_likely_problem = likely meaning + problem summary; possible_causes = likely causes; recommended_checks_immediate = first checks to do; cite supporting evidence from the KB in your text; overall_confidence and missing_information = confidence/caveats (set confidence to low when KB is weak or empty).”
- The existing query-type hints already asked for (1) meaning (2) causes (3) first checks (4) supporting evidence (5) confidence/caveats; the new structure rule ties those directly to the JSON fields so the model fills them consistently.

### Provenance consistency

- **Normalization:** `normalizeProvenanceForConsistency(provenance)` was added: lowercase, trim, collapse spaces. It is used before trust classification and before label matching so that “OEM Manual”, “oem manual”, and “Service Manual” are treated consistently.
- **Trust classification:** `classifyEvidenceTrust()` now uses the normalized string. High-trust terms were extended with `manufacturer`, `service bulletin`; low-trust with `user post`, `community`.
- **Source labels:** `getSourceLabelsForDisplay()` now runs on normalized provenance. Label patterns were extended so that “volvo manual” → OEM manual, “service bulletin” → Recall / bulletin, “electrical_ecu” → Wiring / electrical manual, “user post” / “community” → Forum discussion. This keeps OEM / recall / wiring / forum categories stable across different provenance phrasings.

### Faithfulness evaluation

- **Faithfulness checklist** was added to `lib/diagnostics/evaluation/volvo-synthesis-eval.md`:
  1. **Claims supported by KB:** For each substantive claim in the reply, can you trace it to an item in the KB block or to the user’s codes/symptoms?
  2. **Source transparency match:** Do the source labels (e.g. OEM manual, Recall / bulletin) match the actual provenance of the retrieved KB items? Compare to `debug.inspection.diagnosticKb`.
  3. **Confidence vs evidence quality:** When the KB is weak, does the answer say “limited coverage” and set confidence to low? When the KB is strong, does it avoid over-caveating?
- **Eval script:** When `THN_DEBUG=1` is set, the script now captures `debug.inspection.diagnosticKb` and prints a compact list per case: “KB items used for synthesis (for faithfulness check)” with order, trust, display_code, and snippet. Reviewers can compare the reply to these items without calling the API separately.

---

## 2. Examples of improved consistency and faithfulness

- **Before:** The model could add generic causes (e.g. “check wiring harness”) even when the KB only had one OEM line about a sensor. **After:** The prompt tells the model not to add unsupported causes; when the KB is weak, it should state limited coverage and use low confidence.
- **Before:** Provenance like “Volvo Service Manual” might not map to “OEM manual” if the pattern only had “oem|manufacturer”. **After:** “volvo manual” is in the OEM label pattern and normalization makes “Volvo Service Manual” match; source labels and trust stay consistent.
- **Before:** Reviewers had to call the API with debug and inspect JSON to see which KB items were used. **After:** Running `THN_DEBUG=1 npx tsx scripts/run-diagnostic-eval.ts …` prints, per case, the list of KB items (order, trust, code, snippet) so reviewers can quickly check whether claims in the reply are supported.

---

## 3. Where the model still drifts or coverage is still thin

- **Residual drift:** The model may still occasionally add a generic check or cause not present in the KB; the new rules reduce this but do not remove it. Stronger constraints (e.g. few-shot examples, or post-processing that checks key phrases against KB snippets) would require more implementation.
- **Thin coverage:** When retrieval returns no or very few KB rows for a code (e.g. some P-codes), the answer will correctly say “limited coverage” and low confidence, but the content will still be generic because there is nothing to ground on. Improving that requires better **retrieval coverage** or targeted seeds, not only prompt changes.
- **Provenance gaps:** If `truck_diagnostic_kb` rows have null or very varied provenance strings, normalization and label patterns can only do so much; some rows may still show as “medium” trust and no source label until provenance is standardized in the data pipeline.

---

## 4. Next bottleneck after this

- **Retrieval coverage:** For codes or topics with few or no KB hits, answers will remain generic or explicitly limited. The next lever is adding or improving **targeted seeds** and retrieval so more queries get at least one high-value KB item.
- **Targeted seeds:** Focused seed content for under-covered codes (e.g. specific P-codes, SPN/FMI) will improve both faithfulness (there is something to ground on) and consistency (same structure with real evidence).
- **UI presentation:** The app already shows Evidence (sources + strength) and structured sections; no change required for this round. Future improvements could highlight “supported by KB” vs “general guidance” if we add that distinction in the API.
- **Model selection / prompt tuning:** If drift or over-caveating persists after retrieval is improved, the next step is **model selection** (e.g. stronger instruction-following model) or **prompt tuning** (e.g. few-shot examples of faithful, structured answers).

---

## 5. Files changed

| File | Change |
|------|--------|
| `lib/diagnostics/synthesis.ts` | Added `normalizeProvenanceForConsistency`; extended high/low-trust term lists and PROVENANCE_TO_LABEL patterns; use normalized provenance in `classifyEvidenceTrust` and `getSourceLabelsForDisplay`; appended faithfulness line to each query-type synthesis hint; added `REQUIRED_ANSWER_STRUCTURE` constant. |
| `app/api/chat/route.ts` | Added GROUNDING and ANSWER STRUCTURE paragraphs to text and image system prompts; changed grounding block header to “use this as the primary evidence … do not add causes or checks that are not supported”. |
| `lib/diagnostics/evaluation/volvo-synthesis-eval.md` | Added “Faithfulness checklist (retrieval-to-answer)” with three checks: claims supported by KB, source transparency match, confidence vs evidence quality. |
| `lib/diagnostics/evaluation/test-case-schema.ts` | Added optional `debugInspectionKb` to `DiagnosticTestRunOutput` for faithfulness review. |
| `scripts/run-diagnostic-eval.ts` | Capture `debug.inspection.diagnosticKb` in output; when present, print “KB items used for synthesis” with order, trust, display_code, snippet per item. |
| `FAITHFULNESS_AND_CONSISTENCY_REPORT.md` | New: this report. |

No changes were made to the data-scraper or gather pipeline; work is limited to app-side answer generation, provenance handling, and evaluation.
