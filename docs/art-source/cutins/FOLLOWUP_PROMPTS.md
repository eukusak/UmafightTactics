# Cut-in follow-up — 2026-09-08

Built-in image_gen, one call per character. Reference input was each repository `public/assets/characters/reference_previews/<id>.png`, derived from its matching Race source, not the full-resolution Race file. Generated originals remain in this directory and runtime cut-ins are in `public/assets/characters/cutin/`.

Common generation brief: `One transparent RGBA skill cut-in, polished smooth cel-shaded anime / 2.5D game illustration, reference costume and face preserved. Dynamic waist-up skill pose on right 60% of landscape, left 40% empty for UI. Keep ears and fingers inside margins, sparse skill accents, no text/logo/border/ground/checkerboard; true transparent background and solid character interior.`

| ID | Identity and pose brief |
|---|---|
| special_week | Short brown bob, white forelock, violet eyes, purple ribbon; white/pink jacket and purple gold-laced corset; determined forward lunge and reaching hand, violet/gold speed accents. |
| maruzensky | Long chestnut hair, green eyes, blue ear accessory; red-orange/white/dark costume with gold trim; confident open-arm aura, red/gold accents. |
| daiwa_scarlet | Long chestnut twin-tails, red eyes, blue feather ribbons, jeweled tiara; royal blue/gold jacket and white ruffled blouse; compact red/gold burst between opening hands. |
| taiki_shuttle | Blonde ponytail, blue eyes, green ribbons, red bandana, green Western racing top; energetic sweeping-arm gold/green burst, no guns. |
| tm_opera_o | Short swept copper hair, violet eyes, tilted magenta/gold crown; white blouse, gold epaulettes and purple cape; regal protective palm and golden shield crescent. |
| mihono_bourbon | Reddish-brown hair, blue eyes, silver/cyan ear devices; white/dark bodice and magenta tie, armored forearms; focused two-handed cyan/magenta energy burst. |

`import-cutin.py` retains the source alpha, crops/fits/pads to 960×540 and clears no painted pixels. Runtime leftmost 384 pixels are empty by layout. Some generated opaque interiors peak at alpha 254; the importer accepts 250–255 rather than requiring exactly 255. No alpha normalization/background removal was used.

Five missing portraits are **derived face crops** from these generated cut-ins, not five independently generated illustrations. Exact source hashes and crop rectangles: `src/data/manual/portrait-crops.json`; packaging: `scripts/package-art-followup.py`. Special Week's existing portrait remains unchanged.
