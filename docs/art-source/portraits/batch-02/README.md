# Independent portrait batch 02

Resumed from PR #6 commit `7752f389fdcfeceb739b44f6879949a8c742509f`.
Six independent generated originals are retained byte-for-byte here. Runtime
portraits are in `public/assets/portraits/`, registered in `delivered-art.json`.
They are static illustrations, not Live2D models or battle animation sheets.

## Production briefs

These are concise records of the generation instructions, not verbatim tool logs.
Each request used that character's existing reference preview. Shared direction:
polished roster portrait, smooth cel-shaded anime/2.5D; centered head and shoulders,
complete ears, readable at 256px, actual transparent RGBA background, no text,
frame, glow or checkerboard. Preserve the reference's hair, ears, accessories,
eye color and racing-costume identity. One independently generated image per character.

| Character | Specific brief |
| --- | --- |
| Silence Suzuka | Copper-orange long hair, turquoise eyes, green covered ears, circular green/yellow side ribbon, white/orange headband; white/green/gold racing uniform, navy chest ribbon; calm gentle smile. |
| Fuji Kiseki | Short swept black hair, turquoise eyes, gold ear accessory; confident smile; black tailored race jacket with lime/gold shoulders and white collar, dark tie. |
| Oguri Cap | Long silver-white hair and blunt fringe, violet-blue eyes, gold diamond headband, blue ear band; white/navy sailor costume, red ribbon and large gold star; calm expression. |
| Gold Ship | Silver-lavender hair, straight fringe, reddish-violet eyes, small brown/gold cap and ear ornaments; red racing top with gold diamond brooch; playful smile. |
| Vodka | Short tousled reddish-brown hair with white forelock, side fringe over one eye, golden-brown eye, dark ears with yellow-green band; black biker jacket with lime lapels and pendant; confident smile. |
| Grass Wonder | Long chestnut hair, blue eyes, brown ears with blue/red side ribbon; white/blue racing collar, white bow, gold pendant and red/gold accents; gentle smile. |

## Packaging and verification

`python scripts/import-portrait.py <character_id> <generated_rgba.png>` validates
the character ID, refuses existing delivered art, preserves the original, crops
to alpha bounds, fits within 244×244, and centers on a transparent 256×256 canvas.
Only crop, resize and padding are applied. No background removal or alpha synthesis.
Hashes, crop bounds and reference paths are in `generated-portraits.json`.

All six originals are 1254×1254 RGBA. All runtime files have alpha extrema 0–255,
at least six pixels of transparent outer margin, and were visually inspected
together on a dark background at their actual game resolution.
See `docs/qa/portrait-batch-02-report.json` for per-file checks.

Accepted art is now 239/514: prior accepted 233 plus these six inspected additions.
Remaining: 130 portraits and 145 battle sheets. Existing remote binary assets were
not revalidated; full npm tests/build and browser scene checks were not rerun in
this art-only batch. The dependency cache is incomplete.

Special Week rigging remains five partial source components, with no assembled
full model, Cubism export or runtime model verification. This batch adds no rigs.
See `docs/ART_PRODUCTION_CHECKPOINT.json` for the exact continuation queue.
