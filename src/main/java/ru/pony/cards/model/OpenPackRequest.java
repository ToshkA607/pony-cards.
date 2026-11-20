package ru.pony.cards.model;

import jakarta.validation.constraints.NotBlank;

public record OpenPackRequest(@NotBlank String packId) {}
