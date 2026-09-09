# Portrait batch 03 — five characters

Resumed from PR #6 head `fe9c14649206223d4ba4f187cc95388052f53f8f`.
Built-in image generation created each portrait separately using its original
`public/assets/characters/race/*-Race.png` reference, inspected before generation.
All five accepted source PNGs are preserved unchanged beside this file.

## Generation briefs

Shared prompt: one centered head-and-shoulders roster portrait, smooth cel-shaded
anime illustration with subtle 2.5D shading; preserve reference identity and race
costume; real transparent PNG alpha; full ears; no text, frame, glow or painted
checkerboard. These are prompt summaries, not verbatim invocation logs.

| ID | Race reference | Character-specific brief |
| --- | --- | --- |
| hishi_amazon | HishiAmazon-Race.png | Tan skin, long indigo hair, amber-red eyes, red ear ribbon, blue/white race outfit, confident smile. |
| mejiro_mcqueen | MejiroMcQueen-Race.png | Lavender hair, violet eyes, teal ear ribbon/cravat, black/gold jacket, white ruffles, elegant smile. |
| el_condor_pasa | ElCondorPasa-Race.png | Brown ponytail, blue/gold eye mask, striped ear ornament, red/gold coat, pink epaulettes, cheerful smile. |
| narita_brian | NaritaBrian-Race.png | Dark purple ponytail, white forelock/nose strip, yellow-green eyes, orange rope ornaments, white/purple race jacket, serious expression. |
| symboli_rudolf | SymboliRudolf-Race.png | Chestnut hair, sweeping white forelock, violet eyes, green/gold uniform, white cravat, red cape, composed smile. |

Hishi Amazon's first attempt had a painted RGB checkerboard and clipped ear; it
was rejected. Only its regenerated RGBA cutout is registered here.

## Validation and handoff

`scripts/import-portrait.py --batch batch-03 <id> <source>` preserves original
bytes and packages a centered 256x256 RGBA runtime image with >=6px clear margins.
Only cropping, scaling and padding are applied. No background removal is applied
by the packaging script. Sources and runtime files are hash-recorded.

All five runtime portraits were visually inspected at native resolution against
both dark and light backgrounds. See `docs/qa/portrait-batch-03-report.json` and
`docs/qa/portrait-batch-03-review.png`.

Portraits: 20/145 accepted, 125 remaining. Accepted required art: prior 239 + 5 =
244/514; 145 battle sheets remain. This is not a full revalidation of older art.
No application code changed; full npm tests/build/browser validation was not run.

User-directed workflow: complete five characters, inspect, save to GitHub and
verify before generating the next five. Target includes Genuine and Samson Big.
Their existing race PNGs and portraits are preserved. Actual Cubism models remain
at zero; complete all 145 portraits before one-character-at-a-time rigging work.
No hit/flinch animation has been introduced.
