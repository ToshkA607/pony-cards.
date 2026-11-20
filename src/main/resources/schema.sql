CREATE TABLE IF NOT EXISTS player_profile (
  id INT PRIMARY KEY,
  coins INT NOT NULL,
  best_score INT NOT NULL,
  best_boss_damage INT NOT NULL DEFAULT 0
);
ALTER TABLE player_profile ADD COLUMN IF NOT EXISTS best_boss_damage INT NOT NULL DEFAULT 0;
INSERT INTO player_profile (id, coins, best_score, best_boss_damage)
SELECT 1, 30, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM player_profile WHERE id=1);

-- One-time migration: version 2.0 stored best score as passed gates; 2.1 stores meters.
CREATE TABLE IF NOT EXISTS app_migrations (
  migration_key VARCHAR(80) PRIMARY KEY
);
UPDATE player_profile SET best_score = best_score * 10
WHERE id=1 AND NOT EXISTS (SELECT 1 FROM app_migrations WHERE migration_key='best_score_meters_v21');
INSERT INTO app_migrations (migration_key)
SELECT 'best_score_meters_v21' WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE migration_key='best_score_meters_v21');

CREATE TABLE IF NOT EXISTS card_catalog (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  rarity VARCHAR(30) NOT NULL,
  emoji VARCHAR(12) NOT NULL,
  color VARCHAR(20) NOT NULL,
  sort_order INT NOT NULL,
  ability_name VARCHAR(80) DEFAULT 'Без способности',
  effect_type VARCHAR(30) DEFAULT 'NONE',
  effect_value DECIMAL(6,3) DEFAULT 0,
  ability_description VARCHAR(220) DEFAULT '',
  category VARCHAR(40) DEFAULT 'Особая'
);

-- Safe upgrades for existing H2 databases.
ALTER TABLE card_catalog ADD COLUMN IF NOT EXISTS ability_name VARCHAR(80) DEFAULT 'Без способности';
ALTER TABLE card_catalog ADD COLUMN IF NOT EXISTS effect_type VARCHAR(30) DEFAULT 'NONE';
ALTER TABLE card_catalog ADD COLUMN IF NOT EXISTS effect_value DECIMAL(6,3) DEFAULT 0;
ALTER TABLE card_catalog ADD COLUMN IF NOT EXISTS ability_description VARCHAR(220) DEFAULT '';
ALTER TABLE card_catalog ADD COLUMN IF NOT EXISTS category VARCHAR(40) DEFAULT 'Особая';

CREATE TABLE IF NOT EXISTS active_card (
  id INT PRIMARY KEY,
  card_id VARCHAR(40),
  CONSTRAINT fk_active_card FOREIGN KEY (card_id) REFERENCES card_catalog(id)
);
INSERT INTO active_card (id, card_id) SELECT 1, CAST(NULL AS VARCHAR(40)) WHERE NOT EXISTS (SELECT 1 FROM active_card WHERE id=1);
INSERT INTO active_card (id, card_id) SELECT 2, CAST(NULL AS VARCHAR(40)) WHERE NOT EXISTS (SELECT 1 FROM active_card WHERE id=2);
INSERT INTO active_card (id, card_id) SELECT 3, CAST(NULL AS VARCHAR(40)) WHERE NOT EXISTS (SELECT 1 FROM active_card WHERE id=3);
INSERT INTO active_card (id, card_id) SELECT 4, CAST(NULL AS VARCHAR(40)) WHERE NOT EXISTS (SELECT 1 FROM active_card WHERE id=4);
INSERT INTO active_card (id, card_id) SELECT 5, CAST(NULL AS VARCHAR(40)) WHERE NOT EXISTS (SELECT 1 FROM active_card WHERE id=5);

CREATE TABLE IF NOT EXISTS player_cards (
  card_id VARCHAR(40) PRIMARY KEY,
  quantity INT NOT NULL,
  CONSTRAINT fk_player_card FOREIGN KEY (card_id) REFERENCES card_catalog(id)
);


-- One-time migration from the earlier 14-artifact catalogue to the 30-card catalogue.
INSERT INTO app_migrations (migration_key)
SELECT 'catalog_30_cards_v1' WHERE NOT EXISTS (SELECT 1 FROM app_migrations WHERE migration_key='catalog_30_cards_v1');
UPDATE active_card SET card_id=NULL WHERE card_id IS NOT NULL AND card_id NOT IN ('golden-blessing','dragon-greed','coin-per-flap','treasury','lucky-horseshoe','reward-star','rainbow-wings','wind-of-freedom','cloud-lightness','time-stop','gliding','spatial-jump','harmony-shield','friendship-heart','crystal-armor','phoenix-flame','bubble-invulnerability','royal-blessing','spell-power','discord-lightning','magic-volley','flame-trail','sphere-of-destruction','hunter-mark','mirror-of-illusions','ancient-scroll','treasure-magnet','harmony-combo','chaos-dice','absolute-harmony');
DELETE FROM player_cards WHERE card_id NOT IN ('golden-blessing','dragon-greed','coin-per-flap','treasury','lucky-horseshoe','reward-star','rainbow-wings','wind-of-freedom','cloud-lightness','time-stop','gliding','spatial-jump','harmony-shield','friendship-heart','crystal-armor','phoenix-flame','bubble-invulnerability','royal-blessing','spell-power','discord-lightning','magic-volley','flame-trail','sphere-of-destruction','hunter-mark','mirror-of-illusions','ancient-scroll','treasure-magnet','harmony-combo','chaos-dice','absolute-harmony');
DELETE FROM card_catalog WHERE id NOT IN ('golden-blessing','dragon-greed','coin-per-flap','treasury','lucky-horseshoe','reward-star','rainbow-wings','wind-of-freedom','cloud-lightness','time-stop','gliding','spatial-jump','harmony-shield','friendship-heart','crystal-armor','phoenix-flame','bubble-invulnerability','royal-blessing','spell-power','discord-lightning','magic-volley','flame-trail','sphere-of-destruction','hunter-mark','mirror-of-illusions','ancient-scroll','treasure-magnet','harmony-combo','chaos-dice','absolute-harmony');
MERGE INTO card_catalog (id,name,rarity,emoji,color,sort_order,ability_name,effect_type,effect_value,ability_description,category) KEY(id) VALUES
('golden-blessing','Золотое благословение','Обычная','✨','#e8bd55',1,'Золотое благословение','COIN_BONUS',0,'+15% монет за завершение уровня','Экономика'),
('dragon-greed','Жадность дракона','Редкая','🐉','#e69a45',7,'Жадность дракона','COIN_BONUS',0.2,'+20% монет за подобранные монеты','Экономика'),
('coin-per-flap','Монета за взмах','Обычная','🪙','#e8bd55',2,'Монета за взмах','NONE',0,'1 монета за каждые 5 взмахов','Экономика'),
('treasury','Сокровищница','Обычная','🏦','#d9ae55',6,'Сокровищница','NONE',0,'+25% монет за победу над боссом','Экономика'),
('lucky-horseshoe','Подкова удачи','Редкая','🍀','#78c98b',8,'Подкова удачи','EXTRA_COIN',0.1,'10% шанс удвоить подобранную монету','Экономика'),
('reward-star','Звезда награды','Обычная','⭐','#f2cf68',3,'Звезда награды','NONE',0,'+3 монеты за каждые 100 метров','Экономика'),
('rainbow-wings','Радужные крылья','Редкая','🌈','#b78ce8',9,'Радужные крылья','JUMP_POWER',0.15,'+15% силы взмаха','Полёт'),
('wind-of-freedom','Ветер свободы','Обычная','🌬️','#7bc8e8',5,'Ветер свободы','SPEED',0.1,'+10% скорости полёта вперёд','Полёт'),
('cloud-lightness','Лёгкость облаков','Обычная','☁️','#9ccce8',4,'Лёгкость облаков','NONE',0,'Скорость падения уменьшена на 12%','Полёт'),
('time-stop','Остановка времени','Эпическая','⌛','#8c9de8',14,'Остановка времени','NONE',0,'Замедляет препятствия на 40% на 2 секунды. Перезарядка — 30 секунд','Полёт'),
('gliding','Парение','Редкая','🪽','#8dc9d8',10,'Парение','NONE',0,'После 5 взмахов персонаж плавно падает в течение 1 секунды','Полёт'),
('spatial-jump','Пространственный скачок','Редкая','🌀','#a98ce8',11,'Пространственный скачок','NONE',0,'Позволяет переместиться вверх или вниз, чтобы избежать препятствия. Перезарядка — 35 секунд','Полёт'),
('harmony-shield','Щит гармонии','Эпическая','🛡️','#83c9a7',15,'Щит гармонии','SHIELD',1,'Один раз за полёт предотвращает столкновение','Защита'),
('friendship-heart','Сердце дружбы','Эпическая','💗','#e98eb8',16,'Сердце дружбы','NONE',0,'Восстанавливает одно сердце во время битвы с боссом','Защита'),
('crystal-armor','Кристальная броня','Редкая','💎','#83b8e8',12,'Кристальная броня','NONE',0,'Уменьшает получаемый урон от босса на 20%','Защита'),
('phoenix-flame','Пламя феникса','Легендарная','🔥','#e88c62',24,'Пламя феникса','NONE',0,'Один раз за прохождение возрождает персонажа с 1 HP','Защита'),
('bubble-invulnerability','Пузырь неуязвимости','Эпическая','🫧','#80d4d2',17,'Пузырь неуязвимости','NONE',0,'После столкновения даёт 2 секунды защиты','Защита'),
('royal-blessing','Королевское благословение','Эпическая','👑','#e8cf82',18,'Королевское благословение','NONE',0,'+1 максимальное здоровье в битве с боссом','Защита'),
('spell-power','Сила заклинаний','Эпическая','✨','#ae8ce8',19,'Сила заклинаний','NONE',0,'+20% магического урона боссу','Боевая магия'),
('discord-lightning','Молния Дискорда','Эпическая','⚡','#e4cf68',20,'Молния Дискорда','NONE',0,'Каждая пятая атака наносит двойной урон','Боевая магия'),
('magic-volley','Магический залп','Эпическая','🔮','#a88be8',23,'Магический залп','NONE',0,'Добавляет один дополнительный снаряд к атаке','Боевая магия'),
('flame-trail','Огненный след','Эпическая','🔥','#e88a62',22,'Огненный след','NONE',0,'Через секунду после попадания наносит дополнительный урон','Боевая магия'),
('sphere-of-destruction','Сфера разрушения','Легендарная','☄️','#ba82d8',25,'Сфера разрушения','NONE',0,'+35% урона боссу, но скорость полёта уменьшается на 5%','Боевая магия'),
('hunter-mark','Метка охотника','Эпическая','🎯','#d68f9f',21,'Метка охотника','NONE',0,'+15% урона по отмеченному боссу','Боевая магия'),
('mirror-of-illusions','Зеркало иллюзий','Легендарная','🪞','#9ca9e8',26,'Зеркало иллюзий','NONE',0,'15% шанс отразить атаку босса','Особая'),
('ancient-scroll','Свиток древних знаний','Легендарная','📜','#d8b78a',27,'Свиток древних знаний','NONE',0,'Предупреждает о следующей атаке босса за 1 секунду','Особая'),
('treasure-magnet','Магнит сокровищ','Редкая','🧲','#e8bd65',13,'Магнит сокровищ','MAGNET',0.5,'Увеличивает радиус притяжения монет на 50%','Особая'),
('harmony-combo','Комбо гармонии','Легендарная','🎼','#a68be0',28,'Комбо гармонии','NONE',0,'Каждые 5 препятствий без столкновений дают +5% урона на 5 секунд','Особая'),
('chaos-dice','Кости хаоса','Легендарная','🎲','#b19ad8',29,'Кости хаоса','NONE',0,'В начале уровня случайно даёт один бонус: +20% монет, +15% урона или щит','Особая'),
('absolute-harmony','Абсолютная гармония','Легендарная','🌟','#f0d78c',30,'Абсолютная гармония','NONE',0,'Если экипированы 3 разных типа артефактов, все их эффекты усиливаются на 10%','Особая');

-- The old 14-card cleanup was removed: the active catalogue now contains 30 artifacts.

CREATE TABLE IF NOT EXISTS daily_reward_claim (
  id INT PRIMARY KEY,
  claim_date DATE
);
INSERT INTO daily_reward_claim (id, claim_date)
SELECT 1, NULL WHERE NOT EXISTS (SELECT 1 FROM daily_reward_claim WHERE id=1);


CREATE TABLE IF NOT EXISTS player_upgrades (
  upgrade_id VARCHAR(40) PRIMARY KEY,
  level INT NOT NULL DEFAULT 0
);
INSERT INTO player_upgrades (upgrade_id, level) SELECT 'flight_speed', 0 WHERE NOT EXISTS (SELECT 1 FROM player_upgrades WHERE upgrade_id='flight_speed');


-- Daily quests: progress and claims are stored server-side and reset every 24 hours.
CREATE TABLE IF NOT EXISTS daily_quest_state (
  id INT PRIMARY KEY,
  window_started TIMESTAMP NOT NULL,
  flight_meters INT NOT NULL DEFAULT 0,
  packs_opened INT NOT NULL DEFAULT 0,
  coins_collected INT NOT NULL DEFAULT 0,
  claimed_mask INT NOT NULL DEFAULT 0
);
INSERT INTO daily_quest_state (id, window_started, flight_meters, packs_opened, coins_collected, claimed_mask)
SELECT 1, CURRENT_TIMESTAMP, 0, 0, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM daily_quest_state WHERE id=1);


-- Campaign progression and permanent upgrades. Existing player progress is preserved.
INSERT INTO player_upgrades (upgrade_id, level) SELECT 'max_health', 0 WHERE NOT EXISTS (SELECT 1 FROM player_upgrades WHERE upgrade_id='max_health');
INSERT INTO player_upgrades (upgrade_id, level) SELECT 'dash', 0 WHERE NOT EXISTS (SELECT 1 FROM player_upgrades WHERE upgrade_id='dash');
INSERT INTO player_upgrades (upgrade_id, level) SELECT 'magic_power', 0 WHERE NOT EXISTS (SELECT 1 FROM player_upgrades WHERE upgrade_id='magic_power');
INSERT INTO player_upgrades (upgrade_id, level) SELECT 'shield', 0 WHERE NOT EXISTS (SELECT 1 FROM player_upgrades WHERE upgrade_id='shield');
INSERT INTO player_upgrades (upgrade_id, level) SELECT 'regeneration', 0 WHERE NOT EXISTS (SELECT 1 FROM player_upgrades WHERE upgrade_id='regeneration');
CREATE TABLE IF NOT EXISTS player_campaign (id INT PRIMARY KEY, unlocked_level INT NOT NULL DEFAULT 1, completed_mask INT NOT NULL DEFAULT 0);
INSERT INTO player_campaign (id, unlocked_level, completed_mask) SELECT 1, 1, 0 WHERE NOT EXISTS (SELECT 1 FROM player_campaign WHERE id=1);

INSERT INTO player_upgrades (upgrade_id, level) SELECT 'card_slots', 0 WHERE NOT EXISTS (SELECT 1 FROM player_upgrades WHERE upgrade_id='card_slots');


-- Long-term achievements, favorites, and independent pity counters.
CREATE TABLE IF NOT EXISTS player_stats (
  id INT PRIMARY KEY,
  total_columns INT NOT NULL DEFAULT 0,
  total_packs INT NOT NULL DEFAULT 0,
  total_coins_collected INT NOT NULL DEFAULT 0,
  boss_wins INT NOT NULL DEFAULT 0,
  no_damage_wins INT NOT NULL DEFAULT 0,
  epic_pulls INT NOT NULL DEFAULT 0,
  legendary_pulls INT NOT NULL DEFAULT 0
);
INSERT INTO player_stats (id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM player_stats WHERE id=1);

CREATE TABLE IF NOT EXISTS player_achievements (
  achievement_id VARCHAR(50) PRIMARY KEY,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS player_favorites (
  card_id VARCHAR(40) PRIMARY KEY,
  CONSTRAINT fk_favorite_card FOREIGN KEY (card_id) REFERENCES card_catalog(id)
);
CREATE TABLE IF NOT EXISTS pack_pity (
  pack_id VARCHAR(20) PRIMARY KEY,
  misses INT NOT NULL DEFAULT 0
);
INSERT INTO pack_pity (pack_id, misses) SELECT 'basic',0 WHERE NOT EXISTS (SELECT 1 FROM pack_pity WHERE pack_id='basic');
INSERT INTO pack_pity (pack_id, misses) SELECT 'magic',0 WHERE NOT EXISTS (SELECT 1 FROM pack_pity WHERE pack_id='magic');
INSERT INTO pack_pity (pack_id, misses) SELECT 'royal',0 WHERE NOT EXISTS (SELECT 1 FROM pack_pity WHERE pack_id='royal');
