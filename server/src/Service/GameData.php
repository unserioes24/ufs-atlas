<?php

namespace App\Service;

/**
 * Die aus den Spieldateien extrahierten Stammdaten, die der Server braucht:
 * Artenliste, Reviere mit ihren Arten und die Schlüssel, unter denen der
 * Spielstand die Revierstatistik ablegt. Erzeugt von tools/build2.ps1.
 */
final class GameData
{
    private ?array $data = null;

    public function __construct(private readonly string $file)
    {
    }

    private function load(): array
    {
        if ($this->data === null) {
            $raw = is_readable($this->file) ? file_get_contents($this->file) : '';
            $this->data = $raw ? (json_decode($raw, true) ?: []) : [];
        }

        return $this->data;
    }

    /** @return array<string, array{de?:string,en?:string,wMax?:float}> */
    public function species(): array
    {
        return $this->load()['species'] ?? [];
    }

    /** @return array<string, string[]> Revier-ID => Artenschlüssel */
    public function fisherySpecies(): array
    {
        return $this->load()['fisherySpecies'] ?? [];
    }

    /** @return array<string, string> Revier-ID => LEVELS/..._NAME */
    public function fisherySaveKeys(): array
    {
        return $this->load()['fisherySaveKeys'] ?? [];
    }

    /** @return array<string, string> Revier-ID => Anzeigename */
    public function fisheryNames(): array
    {
        return $this->load()['fisheryNames'] ?? [];
    }

    public function speciesName(string $key): string
    {
        $s = $this->species()[$key] ?? null;

        return $s['de'] ?? $s['en'] ?? $key;
    }

    public function totalSpecies(): int
    {
        return \count($this->species());
    }

    public function totalFisheries(): int
    {
        return \count(array_filter($this->fisherySpecies(), static fn ($l) => $l !== []));
    }
}
