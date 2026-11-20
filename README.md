# Pony Cards — Sky Adventure 2.6

Полный локальный проект игры: Java 17+, Spring Boot 3.4.5, Maven, H2, HTML/CSS/JavaScript. Графический пакет уже встроен в проект — отдельный Art Pack запускать не нужно.

## Запуск

**Linux:** откройте терминал в этой папке и выполните `./run.sh` (если файл не исполняется: `bash run.sh`).

**Windows:** дважды нажмите `run.bat` либо выполните `mvn -B -ntp spring-boot:run` в терминале этой папки.

Требуются JDK 17+ и Maven. При первом запуске Maven может скачать зависимости из интернета. Не закрывайте терминал, пока игра работает.

Откройте в браузере: http://localhost:8099

## Важно

Открывать в VS Code / VSCodium нужно именно папку `pony-cards-java-2.5`, в которой лежит `pom.xml`. Не запускайте Maven из папки `assets`, `cards` или отдельного `pony-cards-art-pack` — там нет `pom.xml`.

## Звук

Звуковые эффекты синтезируются локально через Web Audio API, поэтому не требуют скачивания аудиофайлов или внешнего сервиса. Первый звук включается после первого нажатия пользователя (ограничение браузеров). Кнопка «Звук» в верхней панели включает/выключает эффекты и мелодию. Настройка сохраняется в браузере.

В игре есть звуки нажатий, взмаха крыльев, монет, прохождения препятствий, столкновения, открытия набора и выпадения карточек разных редкостей. Фоновая короткая мелодия синтезируется браузером.

## Графика

Графика из Art Pack уже скопирована в `src/main/resources/static/assets/characters`, `cards`, `packs`, `effects`. Изображения карточек и наборов подключены в интерфейсе. Искорка в меню и две игровые позы используют прозрачные PNG.

## Сохранения

H2 хранит прогресс в `./data/pony-cards-db`. Не удаляйте папку `data`, если хотите сохранить монеты, рекорд и коллекцию.


## Версия 2.6 — способности и собственные ассеты

### Папки для твоих изображений
Все пользовательские ресурсы добавляй в `src/main/resources/static/assets/user-content/`:
- `backgrounds/` — фоны локаций;
- `characters/` — игровые персонажи и позы;
- `cards/` — портреты коллекционных карт;
- `packs/` — обложки наборов;
- `effects/` — эффекты и частицы;
- `ui/` — иконки и элементы интерфейса.

Изображения доступны браузеру по адресу `/assets/user-content/ИМЯ_ПАПКИ/ИМЯ_ФАЙЛА`. В каждой папке есть README с правилами.

### Новая механика карт
Каждый набор выдаёт ровно одну карту. Карты дают способности; в коллекции нажми «Активировать», чтобы выбрать одну способность для следующего полёта. Дубликаты увеличивают количество карты, но не складывают бонусы.

Способности: щит от одного столкновения, усиленный взмах, магнит монет, замедление препятствий, шанс дополнительной монеты и бонус к собранным монетам.

### Экономика и сложность
Монеты появляются не у каждой башни; количество и номинал случайны. За завершение полёта даётся небольшой случайный бонус и скромная награда за дистанцию. Базовый набор стоит 20 монет и содержит одну карту. Проходы между башнями постепенно сужаются, а скорость увеличивается плавно.

### База данных
При старте `schema.sql` добавляет поля способностей и таблицу активной карты. Существующий прогресс в H2 сохраняется. Для чистого тестового профиля можно удалить локальную папку `data`, но это удалит старые монеты и коллекцию.


## Финальная битва после 50-й башни (версия 2.7)

После прохождения 50-й башни бесконечный полёт завершается и запускается отдельная битва с боссом.

- Экран визуально разделён на две зоны: пони остаётся в левой половине, босс — в правой.
- В фазе атаки босс выпускает снаряды. У игрока 3 сердца.
- На телефоне перемещай пони касанием/перетаскиванием внутри левой половины поля.
- На компьютере перемещай пони клавишами WASD или стрелками.
- Во время передышки босса активируется кнопка «Удар»; на компьютере также можно нажать пробел.
- У босса 3 сердца. Нужно попасть по нему три раза, пережив его атаки.
- Победа завершает забег и начисляет дополнительную награду. После финального экрана игра возвращается в главное меню.

Управление во время обычного полёта не изменилось: касание/пробел для взмаха.


## Версия 2.8 — финальная сцена и Дискорд

- «Серия» переименована в «Цепочка»: это последовательность успешных пролётов мимо труб и сборов монет. Она увеличивается за каждую пройденную трубу и каждую монету, а сбрасывается после короткого периода без действий (2,2–2,5 секунды).
- После 50-й трубы начинается отдельная переходная сцена: полёт останавливается, появляется титр о завершении 50 испытаний, затем объявляется последняя битва.
- Босс визуально представлен Discord — Дискордом из My Little Pony, отдельный PNG с прозрачностью.
- Удары выпускаются на высоте босса, летят быстрее и имеют проверку попадания по области персонажа босса.
- Перемещение с клавиатуры усилено: стрелки/WASD смещают пони заметнее. Касание/перетаскивание мышью или пальцем также перемещает её в левой зоне.


## Версия 2.9 — исправления и новые возможности

- Битва с Дискордом снова использует привычный полёт: гравитация и взмахи касанием/пробелом, уклонение от снарядов; в фазу передышки можно атаковать кнопкой «Удар» или взмахом.
- Исправлена нормализация имён столбцов H2/JDBC: ранее ключи `ID`, `COINS`, `BEST_SCORE` могли приходить в верхнем регистре, из-за чего интерфейс считал каждую карточку одной и той же и показывал нулевые монеты/рекорд. Каталог, коллекция, активная карта и выпавшая карта теперь приводятся к единым нижнерегистровым ключам.
- В коллекции отображается описание способности; добавлены действия «Применить» и «Снять способность».
- Добавлена вкладка «Скины»: Искорка, Флаттершай, Радуга Дэш, Эпплджек, Пинки Пай и Рарити. Выбор сохраняется в браузере.
- Убраны дублирующие кнопки/ссылки коллекции и магазина с главной, нижняя навигация; игровые показатели собраны слева, добавлен счётчик башен `N / 50`.
- Исправлено обновление рекорда через переносимый SQL `CASE`, а монета в кнопках магазина заменена на стилизованный символ.
- Инструкция по пользовательским изображениям находится в `src/main/resources/static/assets/user-content/README.txt`.


## Версия 2.10 — исправление запуска полёта

- Исправлена причина, из-за которой кнопка «Начать полёт» переключала экран, но игровой цикл не запускался: скрипт обращался к удалённым элементам `live-score` и `live-coins`. Удалены устаревшие обращения; актуальные показатели выводятся в `hud-distance` и `hud-coins`.
- Добавлена обработка непредвиденной ошибки при старте: вместо тихого зависания пользователь получает сообщение, а приложение возвращается в главное меню.
- Обновлены версии CSS/JS в ссылках, чтобы браузер не использовал старый кэш.

## Версия 2.22
- Каталог расширен девятью новыми карточками персонажей и способностей.
- В магазине добавлено постоянное улучшение скорости: +1% за уровень, цена растёт после каждой покупки (1, 2, 3, 5, 7... монет).
- Переход к боссу длится дольше: камера удерживает 50-ю колонну, затем Дискорд постепенно проявляется справа, а интерфейс битвы появляется до начала боя.
- Босс получил 5 единиц здоровья, более частые прицельные снаряды и дополнительные залпы при низком здоровье.
- Карты Dragon Lord Ember и Discord — Эхо хаоса усиливают урон по боссу.
- В паузе отображается активная карта и описание её способности.
- Фоновая панорама теперь движется туда и обратно с плавной сменой направления без резкого скачка.


## Версия 2.22
- После 20-й колонны сохраняется сама последняя колонна на время появления босса; новые колонны больше не создаются.
- Дискорд и HUD проявляются поверх непрерывного полёта без разделения арены.
- Удалены декоративные частицы при каждом взмахе, чтобы прыжки не оставляли точки.
- Босс получил несколько типов атак: самонаводящиеся магические сферы, предупреждаемый лазер, синусоидальная волна и чередующиеся падающие/восходящие снаряды.


## Версия 2.22 — финальная последовательность 20 колонн

- Генерируется ровно 20 колонн; после двадцатой новые препятствия не создаются.
- После прохождения двадцатой колонны фон ещё немного движется, затем камера фиксируется.
- Дискорд появляется справа в том же игровом поле, без разделительной полосы.
- После появления босса плавно показывается плашка «Битва с Дискордом», затем начинается бой.


## 2.22 — Seamless boss entrance
The twentieth column is the final obstacle. Discord enters from the right in the same uninterrupted flight scene; the camera eases forward, the boss title plaque appears briefly, then the boss HUD and combat begin without a loading screen or scene cut.


## 2.22 — boss arena stability
- Fixed a runtime ReferenceError in the boss update loop that could stop animation after the boss entered.
- Discord now enters from the right with a responsive, non-overlapping target position.
- Kept the final encounter in the same continuously rendered canvas; no scene switch or player repositioning.


## Версия 2.22
- Ежедневные задания сохраняются на сервере и обновляются через 24 часа после начала текущего цикла.
- Награды выдаются только после выполнения задания и могут быть забраны один раз за цикл.
- Прогресс заданий учитывает дистанцию завершённого полёта, открытые наборы и собранные монеты.
- Карточки в коллекции, при открытии наборов и в выборе скина используют единый портретный формат 3:4 с `object-fit: contain`, без обрезания персонажей.


## Версия 2.23 — кампания и развитие
- Русская кодировка явно закреплена как UTF-8 для Maven, HTTP и SQL-инициализации.
- Иллюстрации коллекционных карт заменены на магические артефакты; изображения пони используются в выборе скинов.
- Сетка скинов уплотнена и адаптируется к ширине экрана.
- Добавлены постоянные улучшения: здоровье (от 500 монет), рывок (1 000 монет), сила магии, защита, регенерация и скорость полёта.
- Добавлена кампания из трёх уровней с разной длиной, скоростью, сложностью и здоровьем босса. Прогресс кампании хранится в H2.
- В бою усилены магические попадания, визуальные эффекты и здоровье/регенерация игрока.

Для запуска на Windows используйте `mvn -B -ntp spring-boot:run` из папки с `pom.xml`. Не удаляйте папку `data`, если хотите сохранить прогресс.


## Обновление 2.24 — подготовка изображений и скинов

- Выровнено содержимое блока постоянных улучшений в магазине: текстовый блок сдвинут правее и получил дополнительный внутренний отступ.
- В разделе скинов оставлены шесть мест: Твайлайт Спаркл и пять свободных слотов.
- Для добавления будущих скинов поместите PNG-файлы `slot-2.png` … `slot-6.png` в `src/main/resources/static/assets/skins/`. После обновления страницы изображения появятся автоматически; заполненные слоты можно будет выбрать.
- Из коллекции и окна открытия наборов убраны старые изображения артефактов. Вместо них показывается аккуратная заглушка, карточки и их способности продолжают работать.
- Удалены неиспользуемые изображения предыдущих вариантов оформления. Рабочие фоны, портреты Твайлайт, изображение босса, обложки наборов и пользовательские папки сохранены.


## Оригинальные боевые эффекты (2.24)

В боевой сцене используются исходные алгоритмы и классы из предоставленных HTML:
`EnergySphere`, `AcidBall`, `DarkMatter`, `TurquoiseLightning`, `RainbowOrb`,
полная система чёрной дыры с туманностями и спиралями, а также полный цикл
фиолетового лазера с частицами, зарядным кольцом, лучом и затуханием. Эффекты
отрисовываются в прозрачных вспомогательных canvas-слоях поверх игрового поля,
а их обновление вызывается из игрового цикла. Старые шаблоны атак босса отключены.
Исходные HTML сохранены в `docs/attack-reference/`.


## Исправления по отзывам — боевая система и интерфейс

- Персонаж стреляет энергетическими сферами; радужная сфера зарезервирована для будущего радужного скина.
- Дискорд использует кислотные, тёмные и бирюзовые молниевые снаряды сериями и веерами, а также оригинальные чёрную дыру и лазер.
- Попадание снаряда проверяется по фактическому положению персонажа на каждом кадре, а не по точке, куда босс целился при запуске.
- Колонны препятствий перерисованы как декоративные кристаллические опоры с фасками, вставками и светящимися кристаллами.
- Ежедневные задания обновляются каждый час; таймер идёт в реальном времени и синхронизируется с сервером.
- Надпись с цепочкой комбо убрана из игрового экрана.

Фоновая музыка пока оставлена прежней: в проекте нет исходного музыкального файла, поэтому для точного трека нужен сам файл или ссылка на оригинал.


### Combat update (2.24 follow-up)
- Added a two-frame Rainbow Dash-inspired flight skin (wings open/folded).
- Boss volleys now travel beyond the left edge; the laser spans beyond the left edge.
- Black hole now enters from Discord's right side, grows while flying left, then collapses near the player.
- Player projectile hitbox now uses an ellipse aligned to Discord's visible body and swept projectile travel.
- The original soundtrack file is not present in this source archive; add/upload the exact track to wire it in without substituting another song.


## Музыка уровней (обновление 2.25)

- Главное меню сохраняет прежнюю музыку без изменений.
- Уровень 1: `src/main/resources/static/assets/music/level-1.mp3` (исходный файл `1.mp3`).
- Уровень 2: `src/main/resources/static/assets/music/level-2.mp3` (конвертация пользовательского `2.m4a` в MP3 для совместимого воспроизведения в браузерах).
- Уровень 3: `src/main/resources/static/assets/music/level-3.mp3` (исходный файл `3.mp3`).
- Музыка уровня зациклена, ставится на паузу вместе с игрой и останавливается после завершения боя.

## Visual update 2.26
- Discord's black hole now starts as a tiny singularity, expands while travelling from the boss side, and only begins collapsing after its full visual radius has passed the player's lane (no fixed lifetime timeout).
- Rainbow Dash uses a separate standing portrait for menus/skin selection and keeps the two flight sprites for open/folded wings. The portrait uses bright magenta irises rather than dark red eyes.
- Each campaign level has a distinct illustrated SVG background: enchanted forest, crystal caves, and chaos citadel.
- Level soundtrack stops on defeat/victory and whenever the player returns to the home menu.


## Pony Cards 2.30 — Economy & gameplay polish

- Campaign boss victories now grant a larger completion reward; distance rewards are increased.
- Added a dedicated endless flight mode from the campaign screen. Endless runs grant coins based on collected coins and distance.
- Added visible upper/lower flight-boundary guides. Leaving the boss arena vertically now costs a heart instead of granting free invulnerability.
- Reduced permanent upgrade prices and growth multipliers.
- Added six varied Discord projectile patterns, including alternating multi-wave volleys.
- Simplified the boss-intro plaque: fade/scale reveal only, without swords or shard burst.
- Pack-opening results now identify new cards and duplicates, including the updated owned quantity.
- Disabled text selection across the game UI while keeping form fields selectable.


## Pony Cards 2.31 gameplay and economy corrections

- Endless flight is a separate run mode; its finish request is stored with `endless=true`, and endless runs cannot complete campaign levels.
- Endless rewards use collected coins plus a capped distance reward (up to 300); campaign boss victories grant a 100-coin completion bonus, with a capped distance reward.
- Boss arena boundary contact now bypasses ordinary projectile invulnerability and has its own short boundary cooldown, so hovering outside the arena cannot avoid damage.
- Boss attack cycle now has eight patterns, including alternating multi-lane waves and staggered mixed volleys.
- Upgrade prices and their client-side preview calculations are synchronized at lower values.
- Boss intro banner is a simple fade/slide panel without swords or shard effects.
- Card reveal uses the catalog emoji, shows the card name and ability, and displays a larger duplicate marker with the new owned quantity.
- UI text selection remains disabled outside editable fields.

Validation: `node --check` passes for `game.js`; ZIP integrity is checked. A full Spring Boot/browser playthrough has not been run in this build environment.


## 2.32 — Atmospheric flight boundaries and combat audio
- Flight boundary markers now use level-specific forest, crystal-cavern, and chaos-citadel palettes with animated crystal markers.
- Added distinct synthesized Web Audio cues for acid, dark-matter, lightning, black-hole, laser, mixed volleys, and player magic attacks.
- No external sound assets are required; combat cues respect the existing sound toggle.


## Коллекция артефактов (14 карт)

Каталог теперь состоит из 14 магических артефактов, а не карточек персонажей.
Названия и описания способностей задаются в `src/main/resources/schema.sql`.
Изображения карточек загружаются из `src/main/resources/static/assets/user-content/cards/`.

Для каждой карты имя PNG должно совпадать с её постоянным ID. Полный список из 14
имён файлов находится в `assets/user-content/cards/README.txt`. Первые три картинки
уже добавлены; остальные можно положить в эту папку без правок JavaScript.
Пути всех 14 карт уже прописаны в `assets/user-content/asset-manifest.json`.
Если файл ещё не добавлен, игра покажет заглушку, но получение и применение способности
останутся доступными.


## Коллекция артефактов v2.36

Каталог содержит 30 карточек. Точные имена PNG и папка для изображений указаны в `src/main/resources/static/assets/user-content/cards/README.txt`.


## Режим проверки коллекции

Для локального тестирования в `src/main/resources/application.properties` включён параметр
`pony.cards.test-mode=true`. При открытии игры он автоматически добавляет в коллекцию все
30 артефактов (по одному экземпляру), поэтому их можно просматривать и экипировать без монет.
Перед публикацией игры обязательно установите `pony.cards.test-mode=false`.
