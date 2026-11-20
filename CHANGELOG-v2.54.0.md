# Pony Cards — v2.54.0

## Startup and image loading
- Added a short two-second startup screen while the game manifest and player state initialize.
- After the menu appears, background-preloads and decodes level backgrounds, boss portraits, all flight skins, pack art, UI images, and the full card-art manifest in small batches.
- Pack opening now waits for the revealed card artwork to load and decode before starting the flip, avoiding the intermittent case where only the card back remains visible.
- Added a graceful fallback if an individual card image cannot be loaded.

## Boss combat
- Queen Chrysalis attacks more frequently; poison berries and mini-lasers arrive in larger, slightly faster volleys, and the splitting core moves faster.
- Nightmare Moon attacks more frequently; moon pillars, tornadoes, rifts, and crescents move faster. Crescent volleys now contain four projectiles instead of two.
- While Moon Pillars are active, Nightmare Moon cannot launch Moon Beam or Moon Rift. Discord also avoids its laser and copied Moon Beam / Moon Rift patterns during Moon Pillars.
- Discord attacks more frequently and launches denser projectile volleys, including wider fans and larger lane sweeps.

## Validation
- `node --check src/main/resources/static/js/game.js` passes.
- Browser/device visual testing and live Render deployment testing have not been performed in this environment.
