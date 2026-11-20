СВОИ ИЗОБРАЖЕНИЯ ДЛЯ PONY CARDS

Все пользовательские файлы клади в подпапки этой директории:
- backgrounds/ — фон игрового полёта;
- characters/ — персонажи (меню и спрайты игрока);
- cards/ — иллюстрации карточек;
- packs/ — обложки наборов;
- effects/ — эффекты;
- ui/ — дополнительные элементы интерфейса.

После копирования изображения открой asset-manifest.json и пропиши путь.
Путь всегда начинается с /assets/user-content/ . Форматы: PNG, WebP, JPG; SVG подходит для графики интерфейса.

ПРИМЕР: СВОЙ ФОН
1. Скопируй своё изображение в backgrounds/, например my-sky.jpg.
2. В asset-manifest.json замени backgrounds.flight на:
   "/assets/user-content/backgrounds/my-sky.jpg"
3. Сохрани файл и обнови игру Ctrl+F5 (на телефоне — перезагрузи страницу).

ПРИМЕР: СВОЯ КАРТИНКА КАРТОЧКИ
"cards": { "mint": "/assets/user-content/cards/my-fluttershy.png" }
Ключи карточек: starlight, berry, cloudy, mint, peach, rainbow, moon, bubble, crystal, aurora, phoenix, stardust, celestia, cosmos.

ПРИМЕР: СВОЙ ПЕРСОНАЖ ИСКОРКИ
"characters": {
  "menu": "/assets/user-content/characters/my-menu.png",
  "folded": "/assets/user-content/characters/my-folded.png",
  "open": "/assets/user-content/characters/my-open.png"
}
Для игрового персонажа желательно использовать прозрачный PNG/WebP с похожими пропорциями. Для меню можно использовать любое подходящее изображение.

ПРИМЕР: ОБЛОЖКИ НАБОРОВ
"packs": {
  "basic": "/assets/user-content/packs/my-basic.png",
  "magic": "/assets/user-content/packs/my-magic.png",
  "royal": "/assets/user-content/packs/my-royal.png"
}

Важно: не удаляй остальные поля asset-manifest.json — просто замени нужный путь. Это только графические ресурсы; Java-код менять не требуется. Если изображение не появилось, проверь имя файла, расширение и путь, затем сделай жёсткое обновление страницы.
