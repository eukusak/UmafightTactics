# Background generation brief

Method: built-in `image_gen`; no API/CLI fallback. Eight separate generations. Output files: `public/assets/boards/bg_*.png`, normalized to 1920×1080 without removing scenery. The following is the reusable production brief; the first three entries summarize the earlier prompts, the remaining entries retain their scene requirements.

Common: `Use case: stylized-concept. One polished production videogame background, landscape 16:9. Modern Pokémon-like cel-shaded 3D anime illustration, Live2D-like soft shading, TFT fantasy arena atmosphere blended with a horse-racing academy. Navy, teal, gold, ivory. Sculpted bevels, atmospheric clouds. No characters, UI, lettering, logos, or watermark. Keep gameplay/UI regions unobstructed.`

| File | Scene direction |
|---|---|
| bg_title.png | Magical floating racing academy and grand golden horseshoe gateway on the right; dark quiet navy space on the left for title and start button. Soft warm light. |
| bg_main_menu.png | Trainer lounge, large windows overlooking the academy at sunset; quiet center for menu controls, polished warm interior, teal and gold accents. |
| bg_board_turf_day.png | Floating rectangular green turf arena, elevated three-quarter camera, clean empty center, academy architecture, gold trimmed sandstone perimeter and distant cloud islands. |
| bg_board_turf_night.png | Floating rectangular green turf arena at NIGHT. Elevated three-quarter camera. Empty turf centered from 20–85% canvas height and 16–84% width, narrowing toward far edge. No painted grid. Academy grandstands at sides, distant horseshoe arch and crescent moon, tiny star lights and low teal shrubs. |
| bg_board_dirt.png | Sunlit terracotta running ground on floating rectangular arena. Empty flat clay center, 20–80% height and 16–84% width, perspective narrowing at far edge. Track fences, trimmed foliage at perimeter, distant horseshoe arch and academy towers. No painted grid. |
| bg_twinkle_draft.png | Magical academy hall with empty circular blue marble platform, gold orbit rings around perimeter, seven small empty pedestal lights at far edge, arched windows over floating islands, violet night sky and stars. Middle 60% quiet for cards; ornaments at sides/top. |
| bg_pve_training.png | Broad empty rectangular sage green padded turf platform, rounded sandstone edges, elevated three-quarter camera. Equipment racks and wooden targets outside arena at side edges. Blue/gold banners without writing; cozy morning light and academy floating over clouds. |
| bg_final_result.png | Twilight celebration on marble award terrace over academy city. Distant gold horseshoe monument upper right, soft fireworks high in sky, gold confetti at perimeter. Middle 60% dark and quiet for results panel; trophies and laurel garlands in corners. |

Character-generation acceptance remains blocked by opaque/checkerboard output. See `../ART_DIRECTION_2026.md`. Do not reuse these backgrounds as character assets or infer alpha from a painted checkerboard.
