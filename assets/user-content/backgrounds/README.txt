Сюда добавляй изображения фона: PNG, JPG или WebP.

1) Главный экран:
   Положи файл в эту папку, например home-sky.webp.
   В ../asset-manifest.json укажи:
   "backgrounds": { "home": "/assets/user-content/backgrounds/home-sky.webp" }

2) Игровой полёт:
   Укажи путь в поле backgrounds.flight, например:
   "/assets/user-content/backgrounds/my-flight.jpg"

Не удаляй остальные поля asset-manifest.json — меняй только нужный путь.
После загрузки файла в GitHub обнови сайт Render и перезагрузи страницу.
