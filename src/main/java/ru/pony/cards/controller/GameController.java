package ru.pony.cards.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.pony.cards.model.FinishRunRequest;
import ru.pony.cards.model.OpenPackRequest;
import ru.pony.cards.service.GameService;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class GameController {
    private final GameService gameService;
    public GameController(GameService gameService) { this.gameService = gameService; }

    @GetMapping("/game")
    public Map<String, Object> state() { return gameService.gameState(); }

    @PostMapping("/reward/daily")
    public ResponseEntity<?> dailyReward() {
        try { return ResponseEntity.ok(gameService.claimDailyReward()); }
        catch (IllegalStateException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }


    @PostMapping("/quests/claim")
    public ResponseEntity<?> claimQuest(@RequestBody Map<String,String> body) {
        try { return ResponseEntity.ok(gameService.claimDailyQuest(body.getOrDefault("questId", ""))); }
        catch (IllegalStateException | IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }

    @PostMapping("/game/boss-record")
    public Map<String, Object> bossRecord(@RequestBody Map<String, Integer> body) {
        return gameService.recordBossDamage(body == null ? 0 : body.getOrDefault("damage", 0));
    }

    @PostMapping("/game/finish")
    public Map<String, Object> finish(@Valid @RequestBody FinishRunRequest request) { return gameService.finishRun(request.score(), request.coinsCollected(), request.levelId(), request.bossWon(), request.endless(), request.damageTaken()); }

    @PostMapping("/cards/equip")
    public ResponseEntity<?> equip(@RequestBody Map<String, String> body) {
        try { return ResponseEntity.ok(gameService.equipCard(body.getOrDefault("cardId", ""), Integer.parseInt(body.getOrDefault("slot", "1")))); }
        catch (IllegalStateException | IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }


    @PostMapping("/cards/favorite")
    public ResponseEntity<?> favorite(@RequestBody Map<String,String> body) {
        try { return ResponseEntity.ok(gameService.toggleFavorite(body.getOrDefault("cardId", ""))); }
        catch (IllegalStateException | IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }

    @PostMapping("/cards/unequip")
    public ResponseEntity<?> unequip(@RequestBody(required=false) Map<String, String> body) {
        try { return ResponseEntity.ok(gameService.unequipCard(Integer.parseInt(body == null ? "1" : body.getOrDefault("slot", "1")))); }
        catch (IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }

    @PostMapping("/shop/upgrade")
    public ResponseEntity<?> upgrade(@RequestBody Map<String, String> body) {
        try { return ResponseEntity.ok(gameService.buyUpgrade(body.getOrDefault("upgradeId", ""))); }
        catch (IllegalArgumentException | IllegalStateException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }

    @PostMapping("/shop/open")
    public ResponseEntity<?> open(@Valid @RequestBody OpenPackRequest request) {
        try { return ResponseEntity.ok(gameService.openPack(request.packId())); }
        catch (IllegalArgumentException | IllegalStateException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }
}
