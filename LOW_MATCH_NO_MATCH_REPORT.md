# Low-Match / No-Match Diagnostic Answers — Report

This report summarizes app-side changes to improve **low-match and no-match** diagnostic answers for weak Volvo queries where retrieval coverage is still thin (e.g. exact SPN/FMI with no direct hit, D13 fault coverage, rare OBD/P-codes).

---

## 1. What changed

### No-match / low-match detection and instruction

- **`isNoMatchOrLowMatch(ctx)`** in `lib/diagnostics/synthesis.ts`: Returns true when there are **unresolved codes** and **no or very few KB matches** (diagnostic KB count ≤ 1 and no ranked canonical faults). This targets the case where the user gave a code or query but retrieval found nothing or almost nothing.

- **`getNoMatchLowMatchInstruction(ctx)`**: When `isNoMatchOrLowMatch` is true, returns a strong prompt line:
  - **NO MATCH / LOW MATCH:** The code(s) or query have no or very few KB matches. Do not state exact causes unless they appear in the KB.
  - Clearly separate: (1) what is supported by the KB (if anything); (2) what is not covered; (3) what would narrow it down (exact code from scanner, full SPN/FMI, D13 subcode, when symptom occurs).
  - Set `overall_confidence` to low.
  - Be useful: give next-step guidance (e.g. read full code, note conditions) **without inventing causes**.

- **Injection:** The no-match instruction is appended to the synthesis block in both **text-only** and **image** flows whenever the resolved context satisfies `isNoMatchOrLowMatch`. It is used **in addition to** the existing weak-evidence instruction (which already runs when evidence strength is weak or mixed), so in no-match situations the model gets both.

### Reuse of existing signals

- Evidence strength (weak / mixed / strong) and weak-evidence instruction are unchanged; the no-match instruction is an **extra** hint when the situation is specifically “unresolved codes + empty/small KB.”
- Debug inspection (diagnosticKb, strongestItems, source_label) is unchanged; reviewers can still use it to confirm that a reply is not inventing causes when the payload shows few or no items.

### Evaluation

- **Two new cases** in `volvo-synthesis-eval.json`:
  - **volvo-low-match-d13-partial:** Partial D13/engine code (“might be 3710 or 3711”); answer should separate supported vs not covered and suggest full code or subcode; no invented exact causes.
  - **volvo-no-match-rare-pcode:** Rare P-code P1A9F; answer must not invent exact causes; state what is supported, what is not covered, what would narrow it down; useful next-step guidance.

- **Eval doc** (`volvo-synthesis-eval.md`): Table updated to nine cases; new **“Low-match / no-match evaluation”** subsection: compare before vs after, focus on honesty (supported vs not covered; no exact causes when KB doesn’t support), usefulness (what would narrow it down; next-step guidance without inventing), and an explicit check that the answer does not invent exact causes when the KB has no or very few matches.

---

## 2. Example before/after for weak queries

**Before (conceptual):** For a code with no KB hit (e.g. P1A9F), the model might say: “P1A9F can indicate a fault in the aftertreatment or sensor circuit. Have the vehicle scanned and check the DEF system.” That sounds like an exact cause even though the KB had no match.

**After:** With the no-match instruction, the model is guided to say something like: “**What is supported:** No matching documentation was found in our knowledge base for this code. **What is not covered:** We cannot state an exact cause or subsystem without a KB match. **What would narrow it down:** Get the full code and SPN/FMI from the scanner if possible; note when the light came on and any other codes. Next step: read the complete code and re-check, or have a dealer/tech pull the full fault set.” Plus low confidence and missing_information listing the gap.

**Rare SPN/FMI (e.g. SPN 9999 FMI 31):** Before: possible generic “SPN/FMI indicates a fault in the parameter…” with no admission of no match. After: explicit “no match for this SPN/FMI in the KB”; what is supported (e.g. that it is a J1939-style code); what would help (exact code from scanner, vehicle details).

**Partial D13:** Before: might guess “3710” or “3711” and give a cause. After: separate what (if anything) is in the KB; suggest obtaining the full code or subcode from the scanner; next-step guidance without stating an exact cause unless the KB supports it.

---

## 3. Where answers improved

- **Rare or unknown codes (P2BAD, P1A9F, SPN 9999 FMI 31):** When retrieval returns no or very few matches, the answer is steered to clearly say “no match” or “not covered,” what (if anything) is supported, what would narrow it down, and to give next-step guidance without stating exact causes.
- **Partial or ambiguous codes (e.g. D13 “might be 3710 or 3711”):** The no-match or weak-evidence logic can apply when the resolved context has unresolved or thin matches; the answer is steered to avoid inventing a specific cause and to suggest getting the full code/subcode.
- **Symptom-only with thin retrieval:** Existing weak-evidence instruction already asks for “what is supported / uncertain / what would help”; the no-match instruction reinforces “do not state exact causes unless in the KB” when the situation is also a no-match (e.g. user mentioned a code that didn’t match).

---

## 4. Where retrieval coverage is still the limiting factor

- **Exact SPN/FMI with no direct hit:** If the KB has no row for that SPN/FMI, the answer can only be honest about “no match” and suggest next steps. It cannot give a code-specific cause or procedure until **retrieval** has a matching seed or doc.
- **D13 fault-code coverage:** If D13-specific or engine-family content is missing or sparse in the KB, answers will remain generic or explicitly uncertain for D13 codes until the **gather pipeline** or targeted seeds add that coverage.
- **Rare OBD/P-codes:** Same as above: app-side behavior can only improve honesty and next-step guidance; code-specific causes and checks require **more targeted seeds** or expanded retrieval for those codes.

---

## 5. Next bottleneck after this

- **More targeted seeds in the gather pipeline:** For exact SPN/FMI pairs, D13 faults, and rare P-codes, the main limit is **retrieval coverage**. Adding targeted seeds (or expanding ingestion) for these will allow the same app-side logic to produce code-specific, grounded answers instead of “no match + next steps.”
- **Model / prompt tuning:** If the model still occasionally states exact causes when the KB is empty, or is too vague when we do have one weak match, the next levers are **prompt tuning** (e.g. few-shot examples of good no-match answers) or **model selection** (e.g. stronger instruction-following).
- **UI presentation:** The app already shows Evidence (sources, strength) and structured sections. No change required for this round. Optional future step: surface “No match for this code” or “Limited coverage” more prominently when evidence strength is weak and unresolved codes are present.

---

## 6. Files changed

| File | Change |
|------|--------|
| `lib/diagnostics/synthesis.ts` | Added `isNoMatchOrLowMatch(ctx)`; added `getNoMatchLowMatchInstruction(ctx)` returning strong no-match/low-match prompt text when applicable. |
| `app/api/chat/route.ts` | Import and call `getNoMatchLowMatchInstruction`; append `noMatchHint` to the synthesis block (text-only and image flows) when the resolved context satisfies no-match/low-match. |
| `lib/diagnostics/evaluation/volvo-synthesis-eval.json` | Added `volvo-low-match-d13-partial` and `volvo-no-match-rare-pcode` cases. |
| `lib/diagnostics/evaluation/volvo-synthesis-eval.md` | Updated test table to nine cases; added “Low-match / no-match evaluation” subsection (before vs after, honesty, usefulness, no invented exact causes). |
| `LOW_MATCH_NO_MATCH_REPORT.md` | New: this report. |

No changes to the data-scraper or gather pipeline; all work is app-side low-match/no-match answer behavior and evaluation.
