package ru.pony.cards.model;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record FinishRunRequest(
        @Min(0) @Max(100000) int score,
        @Min(0) @Max(100000) int coinsCollected,
        @Min(0) @Max(3) int levelId,
        boolean bossWon,
        boolean endless,
        boolean damageTaken
) {}
