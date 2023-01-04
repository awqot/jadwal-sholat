<?php

namespace Awqot\JadwalSholat;

class Metadata
{
  static function default()
  {
    return Metadata::fromFile(
      __DIR__ . "/../../../data/jadwal-sholat.metadata",
    );
  }

  static function fromFile(string $absFilePath)
  {
    $lines = explode("\n", file_get_contents($absFilePath));

    $timestamp = (int) array_shift($lines);

    $provinces = [];
    $regencies = [];

    foreach ($lines as $line) {
      [$province, $regenciesStr] = explode(":", $line);
      array_push($provinces, $province);
      array_push($regencies, explode("\t", $regenciesStr));
    }

    return new Metadata(
      $timestamp,
      $provinces,
      $regencies,
    );
  }

  public function __construct(
    public readonly int $timestamp,
    public readonly array $provinces,
    public readonly array $regencies,
  ) {
  }
}
