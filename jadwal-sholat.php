<?php

namespace Awqot\JadwalSholat;

use Exception;

class Metadata
{
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

class JadwalSholat
{
  public static function fromFile(string $absMetadataFilePath, string $absJadwalSholatFilePath)
  {
    $metadata = Metadata::fromFile($absMetadataFilePath);

    $chars = file_get_contents($absJadwalSholatFilePath) ?: "";

    return new JadwalSholat(
      $metadata,
      $chars,
    );
  }

  private static function join8bitTo16bit(int $first, int $second)
  {
    if ($first > 0b11111111 || $second > 0b11111111) {
      throw new Exception('Data lebih besar dari 8 bit');
    }
    return $first | ($second << 8);
  }

  private static function decompactTimesBinary(string $i8Chars)
  {
    $i16Ints = [
      static::join8bitTo16bit(ord($i8Chars[0]), ord($i8Chars[1])),
      static::join8bitTo16bit(ord($i8Chars[2]), ord($i8Chars[3])),
      static::join8bitTo16bit(ord($i8Chars[4]), ord($i8Chars[5])),
      static::join8bitTo16bit(ord($i8Chars[6]), ord($i8Chars[7])),
      static::join8bitTo16bit(ord($i8Chars[8]), ord($i8Chars[9])),
      static::join8bitTo16bit(ord($i8Chars[10]), ord($i8Chars[11])),
    ];
    return [
      (($i16Ints[0] & 0b0000000000111111) >> 0),
      (($i16Ints[0] & 0b0000111111000000) >> 6),
      (($i16Ints[0] & 0b1111000000000000) >> 10) | ($i16Ints[1] & 0b0000000000000011),
      (($i16Ints[1] & 0b0000000011111100) >> 2),
      (($i16Ints[1] & 0b0011111100000000) >> 8),
      (($i16Ints[1] & 0b1100000000000000) >> 10) | ($i16Ints[2] & 0b0000000000001111),
      (($i16Ints[2] & 0b0000001111110000) >> 4),
      (($i16Ints[2] & 0b1111110000000000) >> 10),
      (($i16Ints[3] & 0b0000000000111111) >> 0),
      (($i16Ints[3] & 0b0000111111000000) >> 6),
      (($i16Ints[3] & 0b1111000000000000) >> 10) | ($i16Ints[4] & 0b0000000000000011),
      (($i16Ints[4] & 0b0000000011111100) >> 2),
      (($i16Ints[4] & 0b0011111100000000) >> 8),
      (($i16Ints[4] & 0b1100000000000000) >> 10) | ($i16Ints[5] & 0b0000000000001111),
      (($i16Ints[5] & 0b0000001111110000) >> 4),
      (($i16Ints[5] & 0b1111110000000000) >> 10),
    ];
  }

  public function __construct(
    private readonly Metadata $metadata,
    private readonly string $buffer,
  ) {
  }

  public function getProvinces()
  {
    return array_values($this->metadata->provinces);
  }

  public function getRegencies(string $province)
  {
    $provinceIndex = (int) array_search($province, $this->metadata->provinces);

    if ($provinceIndex === false) {
      throw new Exception('Province not found');
    }

    return array_values($this->metadata->regencies[$provinceIndex]);
  }

  public function getSchedules(string $province, string $regency)
  {
    $provinceIndex = (int) array_search($province, $this->metadata->provinces);

    if ($provinceIndex === false) {
      throw new Exception('Province not found');
    }

    $regencyIndex = (int) array_search($regency, $this->metadata->regencies[$provinceIndex]);

    if ($regencyIndex === false) {
      throw new Exception('Regency not found');
    }

    $location = static::join8bitTo16bit($provinceIndex, $regencyIndex);

    $locationGroupWidth = 2556 * 2;
    $locationGroupLength = strlen($this->buffer) / $locationGroupWidth;
    $locationGroupBeginAt = null;
    $locationMetadataWidth = 1 * 2;
    $locationContentBeginAt = null;
    $locationContentWidth = $locationGroupWidth - $locationMetadataWidth;

    for ($index = 0; $index < $locationGroupLength; $index++) {
      $beginReadAt = $index * $locationGroupWidth;
      $currentLocation = static::join8bitTo16bit(
        ord($this->buffer[$beginReadAt]),
        ord($this->buffer[$beginReadAt + 1]),
      );
      if ($currentLocation === $location) {
        $locationGroupBeginAt = $beginReadAt;
        $locationContentBeginAt = $beginReadAt + $locationMetadataWidth;
        break;
      }
    }

    if ($locationGroupBeginAt === null) {
      throw new Exception("Schedule not found");
    }

    $dateMonthMetadataWidth = 1 * 2;
    $dateMonthGroupWidth = 7 * 2;
    $dateMonthGroupLength = $locationContentWidth / $dateMonthGroupWidth;
    $dateMonthContentWidth = $dateMonthGroupWidth - $dateMonthMetadataWidth;

    $schedules = [];

    for ($index = 0; $index < $dateMonthGroupLength; $index++) {
      $beginReadAt = $locationContentBeginAt + ($index * $dateMonthGroupWidth);
      $date = (int) ord($this->buffer[$beginReadAt]);
      $month = (int) ord($this->buffer[$beginReadAt + 1]);
      $dateMonthBuffer = substr(
        $this->buffer,
        $beginReadAt + $dateMonthMetadataWidth, /** remove date month data */
        $dateMonthContentWidth,
      );
      $pairOfHourAndMinute = static::decompactTimesBinary($dateMonthBuffer);
      array_push($schedules, (object) [
        "date" => $date,
        "month" => $month,
        "times" => [
          (object) [ "label" => "Imsya", "hour" => $pairOfHourAndMinute[0], "minute" => $pairOfHourAndMinute[1] ],
          (object) [ "label" => "Subuh", "hour" => $pairOfHourAndMinute[2], "minute" => $pairOfHourAndMinute[3] ],
          (object) [ "label" => "Terbit", "hour" => $pairOfHourAndMinute[4], "minute" => $pairOfHourAndMinute[5] ],
          (object) [ "label" => "Duha", "hour" => $pairOfHourAndMinute[6], "minute" => $pairOfHourAndMinute[7] ],
          (object) [ "label" => "Dzuhur", "hour" => $pairOfHourAndMinute[8], "minute" => $pairOfHourAndMinute[9] ],
          (object) [ "label" => "Ashar", "hour" => $pairOfHourAndMinute[10], "minute" => $pairOfHourAndMinute[11] ],
          (object) [ "label" => "Magrib", "hour" => $pairOfHourAndMinute[12], "minute" => $pairOfHourAndMinute[13] ],
          (object) [ "label" => "Isya", "hour" => $pairOfHourAndMinute[14], "minute" => $pairOfHourAndMinute[15] ],
        ],
      ]);
    }

    return $schedules;
  }
}
