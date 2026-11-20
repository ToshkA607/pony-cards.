# v2.53.0 — Desktop viewport correction

- Restored the original full-viewport canvas layout used by v2.52.7 instead of fitting a separate centered 16:9 inner viewport.
- Restored canvas logical dimensions to its actual visible CSS dimensions, preserving the original apparent size of columns, coins, pickups and other game objects.
- Kept high-DPI backing-store rendering (up to 2.5x device pixel ratio) to retain sharpness.
- Aligned the HUD and game overlay with the full canvas so the edges are no longer cut off by the 16:9 fit.
- This is a desktop-first correction; mobile landscape/portrait behavior still needs a separate test.
