# Weak-Query Handling & Retrieval-to-Answer Debugging — Report

This report summarizes changes to improve **weak-evidence handling**, **retrieval-to-answer inspection** in debug mode, and **evaluation** for weak queries and problem-type classification.

---

## 1. What changed

### Weak-evidence handling in the app

- **Weak-evidence instruction:** When evidence strength is **weak** or **mixed**, the prompt now includes an explicit block:  
  **WEAK/MIXED EVIDENCE: In your answer you must explicitly state: (1) what is supported by the KB above; (2) what is uncertain or not covered; (3) what additional codes or information would help (e.g. full code, SPN/FMI, vehicle details). Put these in most_likely_problem and/or missing_information. Do not repeat generic diagnostic filler.**

- **When it’s injected:** Evidence strength is computed from the resolved context *before* the model is called (text-only and image flows). When strength is weak or mixed, this instruction is appended to the synthesis block so the model sees it with the KB context. When strength is strong, nothing is added.

- **Effect:** Answers for sparse, weak, or mixed evidence are steered to say what *is* supported, what is uncertain, and what would help, and to avoid repeating generic filler.

### Retrieval-to-answer inspection (debug mode)

- **Per-item source label:** Each entry in `debug.inspection.diagnosticKb` now has a **source_label** (e.g. "OEM manual", "Recall / bulletin", "Wiring / electrical manual", "Forum discussion") so reviewers can see how each retrieved item was categorized without re-running label logic.

- **Strongest-items summary:** The debug payload now includes **debug.inspection.strongestItems**: the top 3 KB items by trust order (same as the first 3 in diagnosticKb). Reviewers can quickly check whether the final answer references these.

- **Eval script:** With `THN_DEBUG=1`, the script prints:
  - For each KB item: order, trust, **source_label**, display_code, snippet.
  - A **"Strongest items (answer should reference these):"** section with the top 3 items.

- **Still dev/debug only:** Debug payload is returned only when the request sends `debug=1` or `X-THN-Debug: true` and the server is in development or `THN_DEBUG=1`.

### Lightweight weak-query evaluation cases

- **Three new cases** in `volvo-synthesis-eval.json`:
  - **volvo-weak-unknown-code:** "Volvo. Code P2BAD. What does it mean?" — rare/unknown P-code; likely no or few KB hits.
  - **volvo-weak-symptom-no-code:** "Volvo truck sometimes loses power on hills. No codes. Where do I start?" — symptom only; coverage may be minimal.
  - **volvo-weak-rare-spn-fmi:** "SPN 9999 FMI 31 on a Volvo. What is it?" — unlikely to be in KB.

- **Review focus:** For these cases, check that the app responds **honestly and usefully**: states what is supported, what is uncertain, and what additional info would help; avoids generic filler.

### Problem-type distinction in evaluation

- **New section** in `lib/diagnostics/evaluation/volvo-synthesis-eval.md`: **"Problem type: what is limiting answer quality?"**

- **Four types** with a short “how to tell” and “fix”:
  1. **Retrieval coverage** — No/few KB items; nothing to ground on. *Tell:* empty/short diagnosticKb, weak evidenceStrength. *Fix:* targeted seeds / expand retrieval.
  2. **Synthesis faithfulness** — KB has relevant items but the answer ignores them or adds unsupported claims. *Tell:* strongestItems has good matches; reply doesn’t cite them or adds causes/checks not in KB. *Fix:* grounding prompt or model.
  3. **Prompt adherence** — Model doesn’t follow structure or weak-evidence rules. *Tell:* reply generic; doesn’t state “what is supported / uncertain / would help” when evidence is weak. *Fix:* prompt tuning or few-shot.
  4. **Provenance / labeling** — Source labels or evidence strength don’t match actual KB provenance. *Tell:* diagnosticKb provenance vs source_label/UI mismatch; wrong trust tier. *Fix:* normalize provenance or adjust label/trust rules.

- Reviewers use the debug payload (diagnosticKb, strongestItems, sourcesUsed, evidenceStrength) to decide which type applies.

---

## 2. Examples of improved weak-evidence answers

- **Before:** For a code with no KB hit, the model might say “This could be related to the aftertreatment system. Have the vehicle inspected by a technician” with no indication of what was or wasn’t found.

- **After:** With the weak-evidence instruction, the model is guided to say something like: “No matching documentation was found for this code in our knowledge base. **What is supported:** the code format suggests a manufacturer-specific fault. **What is uncertain:** exact subsystem and cause. **What would help:** full code from the scanner, SPN/FMI if available, and vehicle model/year.” Plus low confidence and missing_information listing the gaps.

- **Symptom, no code:** For “loses power on hills, no codes,” the answer should now separate what can be inferred from the symptom alone (e.g. possible fuel/air/boost) from what is uncertain without codes, and suggest what additional info (e.g. codes, when it happens) would help.

---

## 3. Where weak queries are still limited by missing retrieval coverage

- **Unknown/rare codes:** If the KB has no row for a code (e.g. P2BAD, SPN 9999 FMI 31), the answer can only be honest about “no match” and suggest what would help. It cannot give a code-specific cause or procedure until **retrieval coverage** is extended (e.g. targeted seeds).

- **Symptom-only queries:** With little or no KB content for a vague symptom, the answer will stay high-level and explicitly uncertain. Better coverage (e.g. symptom → possible codes or systems) would improve usefulness.

- **Mixed evidence:** When the KB returns both high- and low-trust items, the model is instructed to prefer high-trust and to state uncertainty; it may still occasionally over-weight forum content. Prompt and model tuning can reduce that further.

---

## 4. Next bottleneck after this

- **Targeted seeds / coverage expansion:** For weak queries, the main limit is **missing or thin retrieval**. Improving answers for rare codes and symptom-only questions requires adding targeted seeds and/or expanding retrieval so more queries get at least one high-value KB item.

- **UI answer presentation:** The app already shows Evidence (sources, strength) and structured sections. No change needed for this round. Optional future improvement: visually distinguish “supported by KB” vs “general guidance” if the API exposes that.

- **Model selection / prompt tuning:** If weak-evidence structure (supported / uncertain / what would help) or faithfulness to strongest items is still inconsistent, the next levers are **model selection** (e.g. stronger instruction-following model) and **prompt tuning** (e.g. few-shot examples of good weak-evidence answers).

---

## 5. Files changed

| File | Change |
|------|--------|
| `lib/diagnostics/synthesis.ts` | Added `getWeakEvidenceInstruction(strength)`; extended `DebugInspectionKbItem` with `source_label`; added `getSourceLabelForRow`; `buildDebugInspectionKb` now sets `source_label` per item; added `getStrongestItemsForDebug` and `DEBUG_STRONGEST_ITEMS_COUNT`. |
| `app/api/chat/route.ts` | Text-only and image flows: compute evidence strength before building the grounding block; append `getWeakEvidenceInstruction(evidenceStrength)` when strength is weak or mixed; debug payload now includes `inspection.strongestItems` from `getStrongestItemsForDebug`. |
| `lib/diagnostics/evaluation/volvo-synthesis-eval.json` | Added three weak-query cases: `volvo-weak-unknown-code`, `volvo-weak-symptom-no-code`, `volvo-weak-rare-spn-fmi`. |
| `lib/diagnostics/evaluation/volvo-synthesis-eval.md` | Updated test table to include weak-query cases; added “Problem type: what is limiting answer quality?” with four types (retrieval coverage, synthesis faithfulness, prompt adherence, provenance/labeling) and how to tell; updated debug section to mention source_label and strongestItems. |
| `lib/diagnostics/evaluation/test-case-schema.ts` | Added `source_label` to `debugInspectionKb` item type; added `debugStrongestItems` to `DiagnosticTestRunOutput`. |
| `scripts/run-diagnostic-eval.ts` | Parse and output `source_label` and `strongestItems`; print source_label in KB item list; print “Strongest items (answer should reference these)” when `debugStrongestItems` is present. |
| `WEAK_QUERY_AND_DEBUG_REPORT.md` | New: this report. |

No changes to the data-scraper or gather pipeline; all work is app-side weak-query handling, debug visibility, and evaluation.
