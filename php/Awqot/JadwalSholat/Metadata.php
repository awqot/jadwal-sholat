<?php

namespace Awqot\JadwalSholat;

use Exception;

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

  private static function join8bitTo16bit(int $first, int $second)
  {
    if ($first > 0b11111111 || $second > 0b11111111) {
      throw new Exception('Data lebih besar dari 8 bit');
    }
    return $first | ($second << 8);
  }

  public function __construct(
    public readonly int $timestamp,
    public readonly array $provinces,
    public readonly array $regencies,
  ) {
  }

  public function getProvinces()
  {
    return array_values($this->provinces);
  }

  public function getRegencies(string $province)
  {
    $provinceIndex = (int) array_search($province, $this->provinces);

    if ($provinceIndex === false) {
      throw new Exception('Province not found');
    }

    return array_values($this->regencies[$provinceIndex]);
  }

  public function getLocation(string $province, string $regency)
  {
    $provinceIndex = (int) array_search($province, $this->provinces);

    if ($provinceIndex === false) {
      throw new Exception('Province not found');
    }

    $regencyIndex = (int) array_search($regency, $this->regencies[$provinceIndex]);

    if ($regencyIndex === false) {
      throw new Exception('Regency not found');
    }

    return static::join8bitTo16bit($provinceIndex, $regencyIndex);
  }
}
