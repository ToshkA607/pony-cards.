# Artwork notes — Pony Cards 2.4

The game now uses two transparent, high-resolution PNG character poses exported from the project's original pony artwork:
- `src/main/resources/static/assets/twilight-sparkle-wings-folded.png` — folded-wing idle pose.
- `src/main/resources/static/assets/twilight-sparkle-wings-open.png` — open-wing jump pose.

The main menu uses the transparent open-wing image with a gentle idle float. The game canvas switches between folded and open poses when the player taps / presses Space. The card catalogue contains named characters from My Little Pony: Friendship is Magic. The card portraits in this project are original fan-game stylizations, not official screenshots or official Hasbro artwork. My Little Pony and related character names are trademarks of Hasbro.


## 2.29 rendering correction
- Replaced Rainbow Dash menu and both flight poses with newly extracted, full-body transparent sprites; all three are padded to consistent canvas frames.
- Skin-card and hero CSS now forces contain rather than cover and disables clipping.
- Level backgrounds are high-quality 3840×1440 web JPEGs with gentle sharpening.
- Disabled backdrop filters throughout the game frame/HUD to remove frosted blur artefacts.
- Bumped static asset cache keys to v2.29.
