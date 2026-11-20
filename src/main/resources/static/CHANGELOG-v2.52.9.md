# Pony Cards 2.52.9

## Responsive game viewport
- Restored a true 16:9 game viewport on desktop and mobile instead of stretching the canvas to the full screen dimensions.
- Kept the play screen full-screen while centering the 16:9 arena inside it.
- HUD and in-game overlay now follow the same 16:9 viewport as the canvas.
- In portrait mobile orientation, show a hint asking the player to rotate the phone.
- In landscape mobile orientation, the 16:9 arena uses the available screen area.

## Rendering quality
- Kept the gameplay world at logical 960×540 coordinates, so gameplay speed, obstacle spacing and boss distances do not depend on browser zoom.
- Resized the canvas backing store to the actual displayed CSS dimensions multiplied by devicePixelRatio (capped at 2.5), improving sharpness at different browser zoom levels and high-density screens.
- Updated cache-busting query strings for the new frontend version.
