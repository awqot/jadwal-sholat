<?php

namespace Awqot\JadwalSholat;

use Exception;

class JadwalSholat
{
  public static function default()
  {
    return JadwalSholat::fromFile(
      __DIR__ . "/../../../data/jadwal-sholat.metadata",
      __DIR__ . "/../../../data/jadwal-sholat.bin",
    );
  }

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

  /**
   * @return array<Schedule>
   */
  public function getSchedules(string $province, string $regency)
  {
    [$locationContentWidth, $locationContentBeginAt] = $this->getLocationContentCursor($province, $regency);

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
      array_push($schedules, new Schedule($date, $month, [
        new Time("Imsya", $pairOfHourAndMinute[0], $pairOfHourAndMinute[1]),
        new Time("Subuh", $pairOfHourAndMinute[2], $pairOfHourAndMinute[3]),
        new Time("Terbit", $pairOfHourAndMinute[4], $pairOfHourAndMinute[5]),
        new Time("Duha", $pairOfHourAndMinute[6], $pairOfHourAndMinute[7]),
        new Time("Dzuhur", $pairOfHourAndMinute[8], $pairOfHourAndMinute[9]),
        new Time("Ashar", $pairOfHourAndMinute[10], $pairOfHourAndMinute[11]),
        new Time("Magrib", $pairOfHourAndMinute[12], $pairOfHourAndMinute[13]),
        new Time("Isya", $pairOfHourAndMinute[14], $pairOfHourAndMinute[15]),
      ]));
    }

    return $schedules;
  }

  /**
   * @return array<Time>
   */
  public function getTimes(string $province, string $regency, int $date, int $month)
  {
    [$locationContentWidth, $locationContentBeginAt] = $this->getLocationContentCursor($province, $regency);

    $dateMonthMetadataWidth = 1 * 2;
    $dateMonthGroupWidth = 7 * 2;
    $dateMonthGroupLength = $locationContentWidth / $dateMonthGroupWidth;
    $dateMonthContentWidth = $dateMonthGroupWidth - $dateMonthMetadataWidth;

    for ($index = 0; $index < $dateMonthGroupLength; $index++) {
      $beginReadAt = $locationContentBeginAt + ($index * $dateMonthGroupWidth);
      if (ord($this->buffer[$beginReadAt]) === $date && $month === ord($this->buffer[$beginReadAt + 1])) {
        $dateMonthBuffer = substr(
          $this->buffer,
          $beginReadAt + $dateMonthMetadataWidth, /** remove date month data */
          $dateMonthContentWidth,
        );

        $pairOfHourAndMinute = static::decompactTimesBinary($dateMonthBuffer);

        return [
          new Time("Imsya", $pairOfHourAndMinute[0], $pairOfHourAndMinute[1]),
          new Time("Subuh", $pairOfHourAndMinute[2], $pairOfHourAndMinute[3]),
          new Time("Terbit", $pairOfHourAndMinute[4], $pairOfHourAndMinute[5]),
          new Time("Duha", $pairOfHourAndMinute[6], $pairOfHourAndMinute[7]),
          new Time("Dzuhur", $pairOfHourAndMinute[8], $pairOfHourAndMinute[9]),
          new Time("Ashar", $pairOfHourAndMinute[10], $pairOfHourAndMinute[11]),
          new Time("Magrib", $pairOfHourAndMinute[12], $pairOfHourAndMinute[13]),
          new Time("Isya", $pairOfHourAndMinute[14], $pairOfHourAndMinute[15]),
        ];
      }
    }

    throw new Exception("Times not found");
  }

  private function getLocationContentCursor(string $province, string $regency)
  {
    $location = $this->metadata->getLocation($province, $regency);

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
      throw new Exception("Schedules not found");
    }

    return [
      $locationContentWidth,
      $locationContentBeginAt
    ];
  }
}
