# Race art v2 — IMAGEGEN delivery

The current PR25 request, including the battle-impact addendum, is **89 PNG atlases / 447 frames**. All 89 were generated with the built-in IMAGEGEN tool, one requested asset per generation. Five weather half-resolution atlases are additional runtime derivatives, not additional generated drawings.

| Category | Files | Frames |
|---|---:|---:|
| Phase banners | 5 | 60 |
| Style auras | 8 | 80 |
| Style signatures | 4 | 48 |
| Condition icons | 20 | 20 |
| Weather | 5 | 60 |
| Mana / recast / stat-conversion VFX | 3 | 30 |
| Card frames | 4 | 4 |
| GⅠ crests | 16 | 16 |
| Course marks | 7 | 7 |
| HUD parts | 6 | 6 |
| Exposed carry / dive / physical hit addendum | 11 | 116 |
| **Total** | **89** | **447** |

## Provenance and reproducibility

- [jobs.json](jobs.json): exact prompts, source filenames and SHA-256, output dimensions, frame layout, source layout, generator, final SHA-256 and packing settings. Rejected attempts and their reasons are retained for three regenerated assets.
- [verification.json](verification.json): per-file byte size, maximum alpha and distinct frame count. Final generated atlases total 28,666,213 bytes (27.34 MiB).
- Source PNGs remain in the local ignored originals/ directory. The PR contains all production PNGs and five weather derivatives, rather than duplicating the large generator originals.
- With the originals available, run node scripts/pack-race-art.mjs to reproduce packing. It only reorders/crops cells, scales into fixed insets, feathers cell boundaries, normalizes alpha and quantizes weather. It does not draw replacement artwork.
- Run npm run check:race-art to verify the committed production files without needing originals. It checks all 447 frames, dimensions, transparent edges, real alpha, unique frames, hashes, registration and weather limits. npm run check:art also runs this check.

## Runtime bindings

- Preparation uses the same exposed-carry predicate as combat. Warning/target rings ignore pointer events and retain a CSS fallback.
- Battle frames record actual conditions and resolved native/emblem styles. Style auras follow the active phase/pace curve; signatures and mana/recast/conversion bursts respond to actual engine events.
- Bruiser dives emit their real path and landing; execute art requires a recorded dive followed by that source killing that target. Physical skill impact tiers use the attack multiplier recorded at damage time.
- Banners follow recorded phase events. All animation playback uses battle time, preserving pause/speed/spectating behavior. Reduced-motion settings use static frames.
- Weather loads only its current @half atlas in combat (3840×1620, 12 frames), with maximum source alpha 23%; full-resolution weather is never requested by the runtime. Both resolutions are below 2 MiB per file.
- GⅠ crests use actual identity overrides; course icons and condition icons remain decorative alongside readable text. Missing decorative downloads preserve playable controls/text.
- The track art deliberately has no baked phase ticks. Code positions ticks at the actual simulation thresholds; both markers show shared race progress, not win probability.

## Visual review

Every atlas was reviewed in contact sheets, including all animated frames. Three assets were regenerated: dive_impact (cross-cell dust), style_signature_oikomi (edge-bound plume), hud_track_bar (incorrect baked ticks). Browser screenshots at desktop and laptop sizes verify placement and readability.

See [the delivery report](../../RACE_PLAN_ART_DELIVERY_2026-09-14.md) for final checks.
