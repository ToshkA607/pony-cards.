package ru.pony.cards.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.*;

@Service
public class GameService {
    private final JdbcTemplate jdbc;
    private final Random random = new Random();

    @Value("${pony.cards.test-mode:false}")
    private boolean cardTestMode;

    public GameService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private void unlockAllCardsForTesting() {
        if (!cardTestMode) return;
        jdbc.update("""
            INSERT INTO player_cards (card_id, quantity)
            SELECT id, 1 FROM card_catalog
            WHERE id NOT IN (SELECT card_id FROM player_cards)
            """);
    }

    public Map<String, Object> gameState() {
        ensureDailyQuestWindow();
        unlockAllCardsForTesting();
        refreshAchievements();
        Map<String, Object> profileRow = jdbc.queryForMap("SELECT coins AS coins_value, best_score AS best_score_value, best_boss_damage AS best_boss_damage_value FROM player_profile WHERE id=1");
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("coins", profileRow.get("COINS_VALUE") != null ? profileRow.get("COINS_VALUE") : profileRow.get("coins_value"));
        profile.put("best_score", profileRow.get("BEST_SCORE_VALUE") != null ? profileRow.get("BEST_SCORE_VALUE") : profileRow.get("best_score_value"));
        profile.put("best_boss_damage", profileRow.get("BEST_BOSS_DAMAGE_VALUE") != null ? profileRow.get("BEST_BOSS_DAMAGE_VALUE") : profileRow.get("best_boss_damage_value"));
        List<Map<String, Object>> catalog = lowerCaseRows(jdbc.queryForList("SELECT id, name, rarity, emoji, color, ability_name, effect_type, effect_value, ability_description, category FROM card_catalog ORDER BY sort_order"));
        List<Map<String, Object>> collection = lowerCaseRows(jdbc.queryForList("SELECT c.card_id AS id, c.quantity, d.name, d.rarity, d.emoji, d.color, d.ability_name, d.effect_type, d.effect_value, d.ability_description, d.category FROM player_cards c JOIN card_catalog d ON d.id=c.card_id ORDER BY d.sort_order"));
        List<Map<String, Object>> packs = List.of(
                packWithPity("basic", "Небесный набор", 60, "Одна карта способности · доступный старт", "Обычная 72% · редкая 22% · эпическая 5% · легендарная 1%", 25),
                packWithPity("magic", "Волшебный набор", 110, "Одна карта способности · больше редких находок", "Обычная 50% · редкая 32% · эпическая 15% · легендарная 3%", 15),
                packWithPity("royal", "Королевский набор", 240, "Одна карта способности · лучшие шансы", "Обычная 30% · редкая 35% · эпическая 27% · легендарная 8%", 7)
        );
        List<Map<String, Object>> activeRows = lowerCaseRows(jdbc.queryForList("SELECT a.id AS slot, c.id, c.name, c.rarity, c.ability_name, c.effect_type, c.effect_value, c.ability_description, c.category FROM active_card a JOIN card_catalog c ON c.id=a.card_id ORDER BY a.id"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("profile", profile);
        result.put("catalog", catalog);
        result.put("collection", collection);
        result.put("packs", packs);
        result.put("activeCards", activeRows);
        result.put("activeCard", activeRows.isEmpty() ? null : activeRows.get(0));
        Map<String,Integer> upgradeState = new LinkedHashMap<>();
        for (Map<String,Object> row : jdbc.queryForList("SELECT upgrade_id, level FROM player_upgrades")) {
            upgradeState.put(String.valueOf(row.get("UPGRADE_ID") != null ? row.get("UPGRADE_ID") : row.get("upgrade_id")),
                    ((Number)(row.get("LEVEL") != null ? row.get("LEVEL") : row.get("level"))).intValue());
        }
        result.put("upgrades", upgradeState);
        Map<String,Object> campaign = jdbc.queryForMap("SELECT unlocked_level, completed_mask FROM player_campaign WHERE id=1");
        result.put("campaign", Map.of("unlockedLevel", campaign.get("UNLOCKED_LEVEL") != null ? campaign.get("UNLOCKED_LEVEL") : campaign.get("unlocked_level"), "completedMask", campaign.get("COMPLETED_MASK") != null ? campaign.get("COMPLETED_MASK") : campaign.get("completed_mask")));
        result.put("dailyQuests", dailyQuestState());
        result.put("favoriteCardIds", jdbc.queryForList("SELECT card_id FROM player_favorites ORDER BY card_id", String.class));
        result.put("achievements", achievementState());
        return result;
    }


    private void ensureDailyQuestWindow() {
        Timestamp started = jdbc.queryForObject("SELECT window_started FROM daily_quest_state WHERE id=1", Timestamp.class);
        if (started == null || started.toLocalDateTime().plusHours(1).isBefore(LocalDateTime.now())) {
            jdbc.update("UPDATE daily_quest_state SET window_started=?, flight_meters=0, packs_opened=0, coins_collected=0, claimed_mask=0 WHERE id=1", Timestamp.valueOf(LocalDateTime.now()));
        }
    }

    private Map<String, Object> dailyQuestState() {
        Map<String,Object> row = jdbc.queryForMap("SELECT window_started, flight_meters, packs_opened, coins_collected, claimed_mask FROM daily_quest_state WHERE id=1");
        LocalDateTime started = ((Timestamp)(row.get("WINDOW_STARTED") != null ? row.get("WINDOW_STARTED") : row.get("window_started"))).toLocalDateTime();
        long seconds = Math.max(0, 3600 - Duration.between(started, LocalDateTime.now()).getSeconds());
        Map<String,Object> out = new LinkedHashMap<>();
        out.put("flightMeters", row.getOrDefault("FLIGHT_METERS", row.get("flight_meters")));
        out.put("packsOpened", row.getOrDefault("PACKS_OPENED", row.get("packs_opened")));
        out.put("coinsCollected", row.getOrDefault("COINS_COLLECTED", row.get("coins_collected")));
        out.put("claimedMask", row.getOrDefault("CLAIMED_MASK", row.get("claimed_mask")));
        out.put("secondsUntilReset", seconds);
        return out;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Map<String,Object> claimDailyQuest(String questId) {
        ensureDailyQuestWindow();
        Map<String,Object> q = dailyQuestState();
        int meters = ((Number)q.get("flightMeters")).intValue() / 10;
        int packs = ((Number)q.get("packsOpened")).intValue();
        int coins = ((Number)q.get("coinsCollected")).intValue();
        int mask = ((Number)q.get("claimedMask")).intValue();
        int bit, reward; boolean complete; String message;
        switch (questId) {
            case "flight" -> { bit=1; reward=150; complete=meters>=10; message="Пролететь через 10 колонн"; }
            case "pack" -> { bit=2; reward=100; complete=packs>=1; message="Открыть набор"; }
            case "coins" -> { bit=4; reward=75; complete=coins>=30; message="Собрать 30 монет"; }
            default -> throw new IllegalArgumentException("Неизвестное задание");
        }
        if ((mask & bit)!=0) throw new IllegalStateException("Награда за это задание уже получена");
        if (!complete) throw new IllegalStateException("Задание ещё не выполнено: "+message);
        jdbc.update("UPDATE daily_quest_state SET claimed_mask=? WHERE id=1", mask | bit);
        jdbc.update("UPDATE player_profile SET coins=coins+? WHERE id=1", reward);
        return Map.of("reward",reward,"state",gameState());
    }

    private List<Map<String, Object>> lowerCaseRows(List<Map<String, Object>> rows) {
        List<Map<String, Object>> normalized = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            row.forEach((key, value) -> item.put(key.toLowerCase(Locale.ROOT), value));
            normalized.add(item);
        }
        return normalized;
    }

    private Map<String, Object> packWithPity(String id, String name, int price, String description, String odds, int guarantee) {
        Map<String, Object> p = new LinkedHashMap<>();
        int misses = Optional.ofNullable(jdbc.queryForObject("SELECT misses FROM pack_pity WHERE pack_id=?", Integer.class, id)).orElse(0);
        p.put("id", id); p.put("name", name); p.put("price", price); p.put("count", 1);
        p.put("description", description); p.put("odds", odds);
        p.put("pityMisses", misses); p.put("pityGuarantee", guarantee);
        p.put("pityRemaining", Math.max(0, guarantee - misses));
        return p;
    }

    private record AchievementDef(String id, String title, String description, int goal, int reward, String stat) {}
    private List<AchievementDef> achievementDefs() {
        return List.of(
            new AchievementDef("columns_1000", "Небесный путешественник", "Пролететь 1 000 колонн суммарно", 1000, 100, "columns"),
            new AchievementDef("columns_5000", "Покоритель небес", "Пролететь 5 000 колонн суммарно", 5000, 250, "columns"),
            new AchievementDef("packs_10", "Любопытство", "Открыть 10 наборов", 10, 100, "packs"),
            new AchievementDef("packs_25", "Охотник за сокровищами", "Открыть 25 наборов", 25, 200, "packs"),
            new AchievementDef("collection_10", "Первые страницы", "Собрать 10 разных карточек", 10, 100, "collection"),
            new AchievementDef("collection_20", "Настоящий коллекционер", "Собрать 20 разных карточек", 20, 200, "collection"),
            new AchievementDef("collection_30", "Полная коллекция", "Собрать все 30 карточек", 30, 500, "collection"),
            new AchievementDef("epic_1", "Сила эпоса", "Получить первую эпическую карту", 1, 100, "epic"),
            new AchievementDef("epic_10", "Эпический след", "Получить 10 эпических карт", 10, 250, "epic"),
            new AchievementDef("legendary_1", "Легендарная удача", "Получить первую легендарную карту", 1, 250, "legendary"),
            new AchievementDef("legendary_5", "Легендарный охотник", "Получить 5 легендарных карт", 5, 500, "legendary"),
            new AchievementDef("boss_1", "Первый триумф", "Победить первого босса", 1, 100, "boss"),
            new AchievementDef("boss_10", "Гроза боссов", "Победить 10 боссов", 10, 300, "boss"),
            new AchievementDef("no_damage_1", "Без единой царапины", "Пройти уровень и победить босса без урона", 1, 250, "noDamage"),
            new AchievementDef("coins_1000", "Золотое облако", "Подобрать 1 000 монет за все полёты", 1000, 200, "coins")
        );
    }

    private Map<String,Integer> achievementStats() {
        Map<String,Integer> m = new HashMap<>();
        Map<String,Object> r = jdbc.queryForMap("SELECT * FROM player_stats WHERE id=1");
        m.put("columns", ((Number)r.getOrDefault("TOTAL_COLUMNS", r.get("total_columns"))).intValue());
        m.put("packs", ((Number)r.getOrDefault("TOTAL_PACKS", r.get("total_packs"))).intValue());
        m.put("coins", ((Number)r.getOrDefault("TOTAL_COINS_COLLECTED", r.get("total_coins_collected"))).intValue());
        m.put("boss", ((Number)r.getOrDefault("BOSS_WINS", r.get("boss_wins"))).intValue());
        m.put("noDamage", ((Number)r.getOrDefault("NO_DAMAGE_WINS", r.get("no_damage_wins"))).intValue());
        m.put("epic", ((Number)r.getOrDefault("EPIC_PULLS", r.get("epic_pulls"))).intValue());
        m.put("legendary", ((Number)r.getOrDefault("LEGENDARY_PULLS", r.get("legendary_pulls"))).intValue());
        m.put("collection", Optional.ofNullable(jdbc.queryForObject("SELECT COUNT(*) FROM player_cards", Integer.class)).orElse(0));
        return m;
    }

    private void refreshAchievements() {
        Map<String,Integer> stats = achievementStats();
        for (AchievementDef d : achievementDefs()) {
            if (stats.getOrDefault(d.stat(), 0) >= d.goal()) {
                int inserted = jdbc.update("INSERT INTO player_achievements (achievement_id, unlocked_at) SELECT ?, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM player_achievements WHERE achievement_id=?)", d.id(), d.id());
                if (inserted > 0) jdbc.update("UPDATE player_profile SET coins=coins+? WHERE id=1", d.reward());
            }
        }
    }

    private List<Map<String,Object>> achievementState() {
        Map<String,Integer> stats = achievementStats();
        Set<String> unlocked = new HashSet<>(jdbc.queryForList("SELECT achievement_id FROM player_achievements", String.class));
        List<Map<String,Object>> out = new ArrayList<>();
        for (AchievementDef d : achievementDefs()) {
            int progress = stats.getOrDefault(d.stat(), 0);
            out.add(Map.of("id",d.id(),"title",d.title(),"description",d.description(),"goal",d.goal(),"progress",Math.min(progress,d.goal()),"reward",d.reward(),"unlocked",unlocked.contains(d.id())));
        }
        return out;
    }

    @Transactional
    public Map<String,Object> toggleFavorite(String cardId) {
        Integer owned = jdbc.queryForObject("SELECT COUNT(*) FROM player_cards WHERE card_id=?", Integer.class, cardId);
        if (owned == null || owned == 0) throw new IllegalStateException("В избранное можно добавить только собранную карту");
        Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM player_favorites WHERE card_id=?", Integer.class, cardId);
        if (exists != null && exists > 0) jdbc.update("DELETE FROM player_favorites WHERE card_id=?", cardId);
        else jdbc.update("INSERT INTO player_favorites (card_id) VALUES (?)", cardId);
        return gameState();
    }

    @Transactional
    public Map<String, Object> buyUpgrade(String upgradeId) {
        Map<String,int[]> costs = Map.of(
                "max_health", new int[]{220, 128, 5}, "dash", new int[]{400, 100, 1},
                "magic_power", new int[]{320, 130, 5}, "shield", new int[]{320, 130, 5},
                "regeneration", new int[]{480, 132, 3}, "flight_speed", new int[]{100, 128, 10},
                "card_slots", new int[]{500, 150, 4});
        int[] cfg = costs.get(upgradeId);
        if (cfg == null) throw new IllegalArgumentException("Такого улучшения нет");
        Integer level = jdbc.queryForObject("SELECT level FROM player_upgrades WHERE upgrade_id=?", Integer.class, upgradeId);
        int current = level == null ? 0 : level;
        if (current >= cfg[2]) throw new IllegalStateException("Улучшение уже достигло максимального уровня");
        int price = (int)Math.ceil(cfg[0] * Math.pow(cfg[1] / 100.0, current));
        Integer coins = jdbc.queryForObject("SELECT coins FROM player_profile WHERE id=1", Integer.class);
        if (coins == null || coins < price) throw new IllegalStateException("Недостаточно монет. Нужно " + price + " монет.");
        jdbc.update("UPDATE player_profile SET coins=coins-? WHERE id=1", price);
        jdbc.update("UPDATE player_upgrades SET level=level+1 WHERE upgrade_id=?", upgradeId);
        return Map.of("price", price, "state", gameState());
    }

    @Transactional
    public void completeCampaignLevel(int levelId) {
        if (levelId < 1 || levelId > 3) return;
        int mask = jdbc.queryForObject("SELECT completed_mask FROM player_campaign WHERE id=1", Integer.class);
        int unlocked = jdbc.queryForObject("SELECT unlocked_level FROM player_campaign WHERE id=1", Integer.class);
        int newMask = mask | (1 << (levelId - 1));
        int newUnlocked = Math.max(unlocked, Math.min(3, levelId + 1));
        jdbc.update("UPDATE player_campaign SET completed_mask=?, unlocked_level=? WHERE id=1", newMask, newUnlocked);
    }

    @Transactional
    public Map<String, Object> claimDailyReward() {
        Date today = Date.valueOf(LocalDate.now());
        Date last = jdbc.queryForObject("SELECT claim_date FROM daily_reward_claim WHERE id=1", Date.class);
        if (today.equals(last)) throw new IllegalStateException("Ежедневный подарок уже получен. Возвращайся завтра!");
        int reward = 12 + random.nextInt(9);
        jdbc.update("UPDATE daily_reward_claim SET claim_date=? WHERE id=1", today);
        jdbc.update("UPDATE player_profile SET coins=coins+? WHERE id=1", reward);
        return Map.of("reward", reward, "state", gameState());
    }

    @Transactional
    public Map<String, Object> recordBossDamage(int damage) {
        int safeDamage = Math.max(0, Math.min(damage, 10000000));
        jdbc.update("UPDATE player_profile SET best_boss_damage=CASE WHEN best_boss_damage<? THEN ? ELSE best_boss_damage END WHERE id=1", safeDamage, safeDamage);
        return Map.of("bestBossDamage", jdbc.queryForObject("SELECT best_boss_damage FROM player_profile WHERE id=1", Integer.class), "state", gameState());
    }

    @Transactional
    public Map<String, Object> finishRun(int score, int coinsCollected, int levelId, boolean bossWon, boolean endless, boolean damageTaken) {
        int safeScore = Math.max(0, Math.min(score, 100000));
        int safeCoins = Math.max(0, Math.min(coinsCollected, 500));
        int completionBonus = bossWon ? 100 : random.nextInt(8);
        int distanceBonus = endless ? Math.min(300, safeScore / 8) : Math.min(50, safeScore / 30);
        int reward = safeCoins + completionBonus + distanceBonus;
        jdbc.update("UPDATE player_profile SET coins=coins+?, best_score=CASE WHEN best_score<? THEN ? ELSE best_score END WHERE id=1", reward, safeScore, safeScore);
        ensureDailyQuestWindow();
        jdbc.update("UPDATE daily_quest_state SET flight_meters=flight_meters+?, coins_collected=coins_collected+? WHERE id=1", safeScore, safeCoins);
        jdbc.update("UPDATE player_stats SET total_columns=total_columns+?, total_coins_collected=total_coins_collected+?, boss_wins=boss_wins+?, no_damage_wins=no_damage_wins+? WHERE id=1",
                safeScore / 10, safeCoins, bossWon ? 1 : 0, (bossWon && !endless && !damageTaken) ? 1 : 0);
        if (bossWon && !endless && levelId >= 1 && levelId <= 3) completeCampaignLevel(levelId);
        return Map.of("score", safeScore, "coinsEarned", reward, "state", gameState());
    }

    @Transactional
    public Map<String, Object> openPack(String packId) {
        int price;
        switch (packId) {
            case "basic" -> price = 60;
            case "magic" -> price = 110;
            case "royal" -> price = 240;
            default -> throw new IllegalArgumentException("Такого набора не существует");
        }
        Integer coins = jdbc.queryForObject("SELECT coins FROM player_profile WHERE id=1", Integer.class);
        if (coins == null || coins < price) throw new IllegalStateException("Недостаточно монет для покупки этого набора");
        jdbc.update("UPDATE player_profile SET coins=coins-? WHERE id=1", price);

        int guarantee = switch (packId) { case "basic" -> 25; case "magic" -> 15; default -> 7; };
        int misses = Optional.ofNullable(jdbc.queryForObject("SELECT misses FROM pack_pity WHERE pack_id=?", Integer.class, packId)).orElse(0);
        boolean pityTriggered = misses + 1 >= guarantee;
        Map<String, Object> card = new LinkedHashMap<>(pityTriggered ? chooseRarity("Легендарная") : chooseCard(packId));
        String rarity = String.valueOf(card.get("rarity"));
        jdbc.update("UPDATE pack_pity SET misses=? WHERE pack_id=?", "Легендарная".equals(rarity) ? 0 : misses + 1, packId);
        jdbc.update("UPDATE player_stats SET total_packs=total_packs+1, epic_pulls=epic_pulls+?, legendary_pulls=legendary_pulls+? WHERE id=1", "Эпическая".equals(rarity) ? 1 : 0, "Легендарная".equals(rarity) ? 1 : 0);
        card.put("pityTriggered", pityTriggered);
        card.put("pityGuarantee", guarantee);
        card.put("pityRemaining", "Легендарная".equals(rarity) ? guarantee : Math.max(0, guarantee - misses - 1));
        String id = (String) card.get("id");
        Integer previousQuantity = jdbc.queryForObject("SELECT COALESCE(MAX(quantity),0) FROM player_cards WHERE card_id=?", Integer.class, id);
        boolean duplicate = previousQuantity != null && previousQuantity > 0;
        int updated = jdbc.update("UPDATE player_cards SET quantity=quantity+1 WHERE card_id=?", id);
        if (updated == 0) jdbc.update("INSERT INTO player_cards (card_id, quantity) VALUES (?, 1)", id);
        card.put("duplicate", duplicate);
        card.put("quantity", (previousQuantity == null ? 0 : previousQuantity) + 1);
        ensureDailyQuestWindow();
        jdbc.update("UPDATE daily_quest_state SET packs_opened=packs_opened+1 WHERE id=1");
        return Map.of("opened", List.of(card), "state", gameState());
    }

    @Transactional
    public Map<String, Object> equipCard(String cardId, int slot) {
        if (slot < 1 || slot > 5) throw new IllegalArgumentException("Неверный слот");
        int availableSlots = 1 + Optional.ofNullable(jdbc.queryForObject("SELECT level FROM player_upgrades WHERE upgrade_id='card_slots'", Integer.class)).orElse(0);
        if (slot > availableSlots) throw new IllegalStateException("Сначала купи улучшение слотов карт.");
        Integer owned = jdbc.queryForObject("SELECT COUNT(*) FROM player_cards WHERE card_id=?", Integer.class, cardId);
        if (owned == null || owned == 0) throw new IllegalStateException("Сначала получи эту карточку из набора.");
        jdbc.update("UPDATE active_card SET card_id=NULL WHERE card_id=? AND id<>?", cardId, slot);
        jdbc.update("UPDATE active_card SET card_id=? WHERE id=?", cardId, slot);
        return gameState();
    }

    @Transactional
    public Map<String, Object> unequipCard(int slot) {
        if (slot < 1 || slot > 5) throw new IllegalArgumentException("Неверный слот");
        jdbc.update("UPDATE active_card SET card_id=NULL WHERE id=?", slot);
        return gameState();
    }

    private Map<String,Object> chooseRarity(String rarity) {
        List<Map<String,Object>> candidates = lowerCaseRows(jdbc.queryForList("SELECT id, name, rarity, emoji, color, ability_name, effect_type, effect_value, ability_description, category FROM card_catalog WHERE rarity=?", rarity));
        if (candidates.isEmpty()) throw new IllegalStateException("В каталоге пока нет карт редкости: " + rarity);
        return candidates.get(random.nextInt(candidates.size()));
    }

    private Map<String, Object> chooseCard(String pack) {
        int roll = random.nextInt(100);
        String rarity;
        if ("royal".equals(pack)) rarity = roll < 8 ? "Легендарная" : roll < 35 ? "Эпическая" : roll < 70 ? "Редкая" : "Обычная";
        else if ("magic".equals(pack)) rarity = roll < 3 ? "Легендарная" : roll < 18 ? "Эпическая" : roll < 50 ? "Редкая" : "Обычная";
        else rarity = roll < 1 ? "Легендарная" : roll < 6 ? "Эпическая" : roll < 28 ? "Редкая" : "Обычная";
        List<Map<String, Object>> candidates = lowerCaseRows(jdbc.queryForList("SELECT id, name, rarity, emoji, color, ability_name, effect_type, effect_value, ability_description, category FROM card_catalog WHERE rarity=?", rarity));
        if (candidates.isEmpty()) candidates = lowerCaseRows(jdbc.queryForList("SELECT id, name, rarity, emoji, color, ability_name, effect_type, effect_value, ability_description, category FROM card_catalog"));
        return candidates.get(random.nextInt(candidates.size()));
    }
}
