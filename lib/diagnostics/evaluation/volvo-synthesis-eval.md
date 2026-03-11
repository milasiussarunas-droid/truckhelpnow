# Volvo answer synthesis — lightweight evaluation

This file describes how to compare answer quality **before vs after** the synthesis changes (query-type awareness, evidence trust, structured answers).

## Test queries

The file `volvo-synthesis-eval.json` contains nine cases: four representative Volvo diagnostic queries and five **weak / low-match / no-match** cases (coverage-limited or minimal KB).

| ID | Query type | Example message |
|----|------------|------------------|
| `volvo-p1b72-exact-pcode` | Exact OBD/P-code | "Volvo VNL. Code P1B72. What does it mean and what should I check?" |
| `volvo-p04d900-exact-pcode` | Exact P-code | "I have P04D900 on my Volvo. What is it?" |
| `volvo-spn-fmi-representative` | SPN/FMI | "SPN 3710 FMI 2 on a Volvo. What are the likely causes and what should the shop check?" |
| `volvo-vecu-section3-electrical` | Electrical/VECU/section | "Volvo VECU section 3 electrical issue — no communication with EECU. Where do I look in the wiring?" |
| `volvo-weak-unknown-code` | Weak (unknown code) | "Volvo. Code P2BAD. What does it mean?" |
| `volvo-weak-symptom-no-code` | Weak (symptom, no code) | "Volvo truck sometimes loses power on hills. No codes. Where do I start?" |
| `volvo-weak-rare-spn-fmi` | Weak (rare SPN/FMI) | "SPN 9999 FMI 31 on a Volvo. What is it?" |
| `volvo-low-match-d13-partial` | Low-match (partial D13) | "Volvo D13 engine fault. Dash shows a code but I only caught part of it — might be 3710 or 3711. What should I do?" |
| `volvo-no-match-rare-pcode` | No-match (rare P-code) | "Volvo VNL 2022. Code P1A9F came up. What does it mean?" |

For weak and low-match / no-match cases, review whether the app responds **honestly and usefully**: states what is supported, what is uncertain, and what additional info would help; avoids repeating generic filler.

### Low-match / no-match evaluation

For cases where retrieval has no exact code match or only weak evidence (e.g. rare SPN/FMI, rare OBD/P-code, partial D13, symptom-only with thin retrieval):

- **Compare before vs after** running the app with the latest low-match/no-match prompt changes.
- **Honesty:** Does the answer clearly separate what is supported by the KB from what is not covered? Does it avoid stating exact causes when the KB does not support them?
- **Usefulness:** Does it suggest what would narrow it down (exact code from scanner, full SPN/FMI, D13 subcode, when symptom occurs)? Does it give next-step guidance without inventing causes?
- **Check:** The answer must not invent exact causes when the KB has no or very few matches for the code or query.

## How to run

1. Start the app (e.g. `npm run dev` with `BASE_URL=http://localhost:3000`).
2. Run the eval script with the Volvo synthesis test file:

   ```bash
   npx tsx scripts/run-diagnostic-eval.ts lib/diagnostics/evaluation/volvo-synthesis-eval.json
   ```

3. Optionally run the same with a **pre-synthesis** version of the app (e.g. prior commit) and save the output:

   ```bash
   npx tsx scripts/run-diagnostic-eval.ts lib/diagnostics/evaluation/volvo-synthesis-eval.json > volvo-eval-after.txt
   ```

## What to compare

- **Structure:** Does the reply follow (1) what the code/query likely means → (2) likely causes → (3) what to inspect/check first → (4) supporting evidence from docs → (5) confidence/caveats?
- **Evidence use:** Are OEM/recall/electrical/wiring sources emphasized over forum when both exist? Is forum used only as secondary?
- **Specificity:** When KB evidence is strong, is the answer specific (cites code meaning, causes, checks from docs)? When evidence is weak, does it say what is known vs uncertain instead of generic filler?
- **Query-type fit:** For P-codes, is the answer code-centric? For SPN/FMI, does it interpret SPN/FMI and tie causes to that? For electrical/VECU, does it focus on circuit/wiring/connector and prioritize electrical manual content?
- **Source transparency:** Does the reply (and the UI “Evidence” block) show concise source labels (e.g. “OEM manual”, “Recall / bulletin”, “Wiring / electrical manual”, “Forum discussion”)? Is it lightweight and readable, not noisy?
- **Confidence wording:** Does the answer clearly signal strong evidence (high-trust docs), mixed evidence, or weak/limited coverage? Check the “Evidence: strong / mixed / limited” line and that the main text wording aligns (e.g. no “high confidence” when evidence is limited).

## Faithfulness checklist (retrieval-to-answer)

Use this when comparing whether the answer stays grounded in the retrieved evidence. Run with `THN_DEBUG=1` to get `debug.inspection.diagnosticKb` in the response (or inspect the printed debug payload).

1. **Claims supported by KB:** For each substantive claim in the reply (code meaning, likely cause, recommended check), can you trace it to an item in the KB block (or to the user's stated codes/symptoms)? If the answer mentions a cause or check that does not appear in the provided KB or in the user message, flag it as unsupported.
2. **Source transparency match:** Do the source labels shown (e.g. OEM manual, Recall / bulletin) match the actual provenance of the retrieved KB items? Compare the reply's Sources line and Evidence block to `debug.inspection.diagnosticKb` (provenance and trust per item).
3. **Confidence vs evidence quality:** When the KB has few or only low-trust items, does the answer say "limited coverage" or "uncertain" and set overall_confidence to low? When the KB has high-trust items and a clear match, does the answer avoid over-caveating?

## Debug / inspection mode

To see which KB items were sent to synthesis (order, provenance, trust, snippet), run with debug enabled. The API returns a `debug.inspection.diagnosticKb` payload when:

- The request includes `debug=1` (form field) or header `X-THN-Debug: true`, and
- The server is in development (`NODE_ENV=development`) or `THN_DEBUG=1` is set.

Example with the eval script:

```bash
THN_DEBUG=1 npx tsx scripts/run-diagnostic-eval.ts lib/diagnostics/evaluation/volvo-synthesis-eval.json
```

The script prints `debugInspectionKbCount` when the API returns the inspection payload and, when present, a compact list of KB items (order, trust, display_code, snippet) and **strongestItems** (top 3 by trust). Each item includes `source_label` (OEM manual, Recall / bulletin, etc.). Use `debug.inspection.strongestItems` to quickly check whether the final answer references the strongest retrieved items. For full inspection content, call the API directly (e.g. curl with `-F debug=1`) and inspect the response `debug.inspection`.

## Problem type: what is limiting answer quality?

When an answer is poor or generic, classify the **primary** cause so we can target fixes:

| Type | Meaning | How to tell |
|------|--------|-------------|
| **Retrieval coverage** | No or few KB items for this query; nothing to ground on. | Debug: `diagnosticKb` empty or very short; `evidenceStrength` weak. Fix: add targeted seeds or expand retrieval. |
| **Synthesis faithfulness** | KB has relevant items but the answer ignores them or adds unsupported claims. | Debug: `strongestItems` or `diagnosticKb` has good matches; reply does not cite them or adds causes/checks not in KB. Fix: strengthen grounding prompt or model. |
| **Prompt adherence** | Model does not follow structure (meaning → causes → checks → evidence → caveats) or weak-evidence rules. | Reply is generic, does not state "what is supported / uncertain / would help" when evidence is weak. Fix: prompt tuning or few-shot. |
| **Provenance / labeling** | Source labels or evidence strength do not match actual KB provenance. | Debug: `diagnosticKb` item has provenance X but `source_label` or UI shows wrong category; trust tier seems wrong. Fix: normalize provenance or adjust label/trust rules. |

Use the debug payload (`diagnosticKb`, `strongestItems`, `sourcesUsed`, `evidenceStrength`) to decide which type applies.

## Limitations

- Answer quality is still limited by **source coverage** in `truck_diagnostic_kb` and canonical fault data. If retrieval returns little or no Volvo content for a code, the reply will remain generic or uncertain.
- The eval script does not auto-check reply structure; review the printed `reply` text manually for the criteria above.
