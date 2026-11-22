# Pony Cards HTML5 v1.3.5

- Mobile gameplay is now portrait-first: landscape touch devices display a rotate-phone prompt instead of the arena.
- In portrait on touch devices, the virtual gameplay height is increased from 720 to 1440 units. This makes fixed-size game objects (pony, columns, projectiles and effects) render at roughly half their previous on-screen size while preserving the existing simulation code and collision logic.
- Desktop gameplay keeps the previous 720-unit scale.
- Added resize handling after device orientation changes.

Note: test on a real phone; viewport/browser chrome behavior varies by device.
