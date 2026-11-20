# Pony Cards 2.52.4 — boss attack fixes

- Shifted Queen Chrysalis's stationary toxic smoke cloud further left so its active area reaches the player's lane.
- Removed the sinusoidal vertical offset from poison berries; berry projectiles now retain their straight trajectory.
- Restricted Queen Chrysalis to the five attacks defined by the supplied reference: Acid Laser, Toxic Cloud, Splitting Poison Core, Poison Berry, and Mini Laser. Removed fallback acid volleys that could appear as unintended attacks.
- Corrected Nightmare Moon's attack dispatch to expose all six supplied attacks independently: Moon Beam, Moon Pillars, Moon Rift, Tornado, Moon 1, and Moon 2.
- Fixed a boss-freeze bug: `spawnNightmareAttack` used `b.x`/`b.width` without defining `b`, causing a `ReferenceError` when pillar, rift, or tornado attacks spawned. The boss reference is now initialized.
- Added a guarded animation-frame loop so an unexpected effect exception is logged and does not silently stop future animation frames.
- Discord's mixed attack pool now includes all five Chrysalis attacks and all six Nightmare Moon attacks, in addition to Discord's own patterns.
