# Cut-in production — 2026-09-08

Tool: built-in image_gen. Actual generated alpha retained; no synthetic poses or Cubism model claimed.

Common prompt: `Transparent RGBA skill cut-in for UmafightTactics. Smooth polished cel-shaded anime / 2.5D illustration. Match the supplied racing-costume reference, including hair, eyes, ears, tail and costume. Dynamic upper-body skill pose on the right 60% of a wide frame. Left 40% empty for UI. No lettering, logo, border, background or checkerboard. Keep real zero-alpha space outside the silhouette. Sparse skill accents that do not obscure the face.`

- `kitasan_black`: reference `public/assets/characters/race/KitasanBlack-Race.png`. `Joyful determined forward rush, hand reaching forward, short black hair, red eyes, red/black/gold racing costume with festival cords. Sparse golden arcs; vivid but controlled gold light.`
- `almond_eye`: reference `public/assets/characters/race/AlmondEye-Race.png`. `Graceful sweeping-arm casting pose, long light-brown hair, blue eyes, white ear bow, pale blue and white dress with red waist bow. Sparse blue-white diamond motes.`

Reviewed generated originals: `docs/art-source/cutins/kitasan_black.png`, `docs/art-source/cutins/almond_eye.png`.
Runtime files: `public/assets/characters/cutin/kitasan_black.png`, `public/assets/characters/cutin/almond_eye.png`.

`import-cutin.py` crops to the alpha bounds, fits without distortion and pads to 960×540. The leftmost 384 columns remain transparent. This only packages the generated artwork; it does not draw a new pose or remove a background. Runtime metadata and source hashes: `src/data/manual/cutins.json`.
