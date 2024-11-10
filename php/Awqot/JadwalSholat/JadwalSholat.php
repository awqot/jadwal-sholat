<?php

namespace Awqot\JadwalSholat;

use DateTime;
use Exception;

class JadwalSholat
{
  const LABEL_IMSYA = "Imsya";
  const LABEL_SUBUH = "Subuh";
  const LABEL_TERBIT = "Terbit";
  const LABEL_DUHA = "Duha";
  const LABEL_DZUHUR = "Dzuhur";
  const LABEL_ASHAR = "Ashar";
  const LABEL_MAGRIB = "Magrib";
  const LABEL_ISYA = "Isya";
  const LABELS = [
    self::LABEL_IMSYA,
    self::LABEL_SUBUH,
    self::LABEL_TERBIT,
    self::LABEL_DUHA,
    self::LABEL_DZUHUR,
    self::LABEL_ASHAR,
    self::LABEL_MAGRIB,
    self::LABEL_ISYA,
  ];

  private const magicWord = "AWQTSHLT";

  private const versionOffset = 0
      + 8 // magic word as bytes array with length 8
  ;
  private const timestampOffset = self::versionOffset
      + 2 // version as u16
  ;
  private const numOfProvincesOffset = self::timestampOffset
      + 8 // timestamp as u64
  ;
  private const numOfRegenciesOffset = self::numOfProvincesOffset
      + 1 // number of provinces as u8
  ;
  private const numOfSchedulesOffset = self::numOfRegenciesOffset
      + 2 // number of regencies as u16
  ;
  private const provinceNamesOffsetOffset = self::numOfSchedulesOffset
      + 2 // number of schedules as u16
  ;
  private const provinceNamesIndicesOffset = self::provinceNamesOffsetOffset
      + 8 // province names offset as u64
  ;
  private const scheduleSize = 0
      + 1 // month as u8
      + 1 // date as u8
      + 1 // hour as u8
      + 1 // minute as u8
  ;

  public static function default()
  {
    return JadwalSholat::fromFile(
      __DIR__ . "/../../../data/jadwal-sholat.ajs",
    );
  }

  public static function fromFile(string $absDataFilePath)
  {
    $buffer = file_get_contents($absDataFilePath) ?: "";

    if (substr($buffer, 0, 8) !== self::magicWord) {
      throw new Exception("Invalid magic word data. Expected: " . self::magicWord . ", got: " . substr($buffer, 0, 8));
    }

    $supportedVersion = [1];
    $versionData = unpack("v", substr($buffer, self::versionOffset, 2));
    if (!in_array($versionData[1], $supportedVersion)) {
      throw new Exception("Unsupported version data. Expected: " . implode(", ", $supportedVersion) . ", got: " . $versionData[1]);
    }

    return new JadwalSholat($buffer);
  }

  public function __construct(
    private readonly string $buffer,
  ) {}

  public function getDataTimestamp(): DateTime
  {
    $timestamp = unpack("P", substr($this->buffer, self::timestampOffset, 8))[1];
    return DateTime::createFromFormat(
      "U",
      round($timestamp / 1000),
    );
  }

  /**
   * @return array<string>
   */
  public function getProvinces(): array
  {
    $numOfProvinces = ord($this->buffer[self::numOfProvincesOffset]);

    $provinceNamesIndicesBuffer = substr(
      $this->buffer,
      self::provinceNamesIndicesOffset,
      $numOfProvinces * 2,
    );

    $provinceNamesOffset = unpack("P", substr($this->buffer, self::provinceNamesOffsetOffset, 8))[1];

    $provinceNames = [];
    for ($provinceIndex = 0; $provinceIndex < $numOfProvinces; $provinceIndex++) {
      $provinceIndexOffset = $provinceIndex * 2;
      $provinceNameIndexOffset = unpack("v", substr($provinceNamesIndicesBuffer, $provinceIndexOffset, 2))[1];
      $provinceNameLengthOffset = $provinceNamesOffset + $provinceNameIndexOffset;
      $provinceNameLength = ord($this->buffer[$provinceNameLengthOffset]);
      $provinceNameOffset = $provinceNameLengthOffset
        + 1 // province name length as u8
      ;
      $provinceName = substr($this->buffer, $provinceNameOffset, $provinceNameLength);
      array_push($provinceNames, $provinceName);
    }

    return $provinceNames;
  }

  /**
   * @return array<string>
   */
  public function getRegencies(string $provinceName): array
  {
    $numOfProvinces = ord($this->buffer[self::numOfProvincesOffset]);

    $provinceNamesIndicesBuffer = substr(
      $this->buffer,
      self::provinceNamesIndicesOffset,
      $numOfProvinces * 2,
    );

    $provinceNamesOffset = unpack("P", substr($this->buffer, self::provinceNamesOffsetOffset, 8))[1];

    for ($provinceIndex = 0; $provinceIndex < $numOfProvinces; $provinceIndex++) {
      $provinceIndexOffset = $provinceIndex * 2;
      $provinceNameIndexOffset = unpack("v", substr($provinceNamesIndicesBuffer, $provinceIndexOffset, 2))[1];
      $provinceNameLengthOffset = $provinceNamesOffset + $provinceNameIndexOffset;
      $provinceNameLength = ord($this->buffer[$provinceNameLengthOffset]);
      $provinceNameOffset = $provinceNameLengthOffset
        + 1 // province name length as u8
      ;
      $decodedProvinceName = substr($this->buffer, $provinceNameOffset, $provinceNameLength);
      if ($decodedProvinceName === $provinceName) {
        $numOfRegenciesOffset = $provinceNameOffset + $provinceNameLength;
        $numOfRegencies = ord($this->buffer[$numOfRegenciesOffset]);

        $regencyNames = [];
        $regenciesOffset = $numOfRegenciesOffset
          + 1 // number of regencies as u8
        ;
        for ($regencyIndex = 0; $regencyIndex < $numOfRegencies; $regencyIndex++) {
          $regencyNameLength = ord($this->buffer[$regenciesOffset]);
          $regenciesOffset += 1;
          $regencyName = substr($this->buffer, $regenciesOffset, $regencyNameLength);
          $regenciesOffset += $regencyNameLength;
          array_push($regencyNames, $regencyName);
        }

        return $regencyNames;
      }
    }

    throw new Exception("Province not found: " . $provinceName);
  }

  /**
   * @return array<Schedule>
   */
  public function getSchedules(string $provinceName, string $regencyName)
  {
    $regencySchedulesIndex = $this->getRegencySchedulesIndex($provinceName, $regencyName);

    if ($regencySchedulesIndex === null) {
      throw new Exception("Regency not found: " . $regencyName);
    }

    [$provinceIndex, $regencyIndex] = $regencySchedulesIndex;

    $numOfProvinces = ord($this->buffer[self::numOfProvincesOffset]);
    $numOfSchedules = unpack("v", substr($this->buffer, self::numOfSchedulesOffset, 2))[1];
    $schedulesIndicesOffset = self::provinceNamesIndicesOffset
      + ($numOfProvinces * 2) // number of schedules as u16
    ;

    $provinceRegencyIndexOffset = $schedulesIndicesOffset
      + ($provinceIndex * 2) // province schedules index as u16
    ;
    $provinceRegencyIndex = unpack("v", substr($this->buffer, $provinceRegencyIndexOffset, 2))[1];
    $regencyScheduleIndex = $provinceRegencyIndex + $regencyIndex;

    $regencyScheduleSize = $numOfSchedules * self::scheduleSize;
    $schedulesOffset = $schedulesIndicesOffset
      + ($numOfProvinces * 2) // province schedules indices as u16
    ;
    $regencySceduleOffset = $schedulesOffset
      + ($regencyScheduleIndex * $regencyScheduleSize) // regency schedule offset as u16
    ;

    /** @var Array<Schedule> */
    $schedules = [];
    for ($scheduleIndex = 0; $scheduleIndex < $numOfSchedules; $scheduleIndex++) {
      $scheduleOffset = $regencySceduleOffset
        + ($scheduleIndex * self::scheduleSize);
      $month = ord($this->buffer[$scheduleOffset]);
      $date = ord($this->buffer[$scheduleOffset + 1]);
      $hour = ord($this->buffer[$scheduleOffset + 2]);
      $minute = ord($this->buffer[$scheduleOffset + 3]);
      /** @var Schedule */
      $schedule = null;
      if (isset($schedules[count($schedules) - 1])) {
        $schedule = $schedules[count($schedules) - 1];
      }
      if ($schedule === null || $schedule->month !== $month || $schedule->date !== $date) {
        $schedule = new Schedule($month, $date, []);
        array_push($schedules, $schedule);
      }
      array_push($schedule->times, new Time(
        self::LABELS[count($schedule->times)],
        $hour,
        $minute,
      ));
    }

    return $schedules;
  }

  /**
   * @return array<Time>
   */
  public function getTimes(string $province, string $regency, int $date, int $month)
  {
    return [];
  }

  private function getRegencySchedulesIndex(string $provinceName, string $regencyName): null|array
  {
    $numOfProvinces = ord($this->buffer[self::numOfProvincesOffset]);

    $provinceNamesIndicesBuffer = substr(
      $this->buffer,
      self::provinceNamesIndicesOffset,
      $numOfProvinces * 2,
    );

    $provinceNamesOffset = unpack("P", substr($this->buffer, self::provinceNamesOffsetOffset, 8))[1];

    for ($provinceIndex = 0; $provinceIndex < $numOfProvinces; $provinceIndex++) {
      $provinceIndexOffset = $provinceIndex * 2;
      $provinceNameIndexOffset = unpack("v", substr($provinceNamesIndicesBuffer, $provinceIndexOffset, 2))[1];
      $provinceNameLengthOffset = $provinceNamesOffset + $provinceNameIndexOffset;
      $provinceNameLength = ord($this->buffer[$provinceNameLengthOffset]);
      $provinceNameOffset = $provinceNameLengthOffset
        + 1 // province name length as u8
      ;
      $decodedProvinceName = substr($this->buffer, $provinceNameOffset, $provinceNameLength);
      if ($decodedProvinceName === $provinceName) {
        $numOfRegenciesOffset = $provinceNameOffset + $provinceNameLength;
        $numOfRegencies = ord($this->buffer[$numOfRegenciesOffset]);
        $regenciesOffset = $numOfRegenciesOffset
          + 1 // number of regencies as u8
        ;
        for ($regencyIndex = 0; $regencyIndex < $numOfRegencies; $regencyIndex++) {
          $regencyNameLength = ord($this->buffer[$regenciesOffset]);
          $regenciesOffset += 1;
          $decodedRegencyName = substr($this->buffer, $regenciesOffset, $regencyNameLength);
          $regenciesOffset += $regencyNameLength;
          if ($decodedRegencyName === $regencyName) {
            return [
              $provinceIndex,
              $regencyIndex,
            ];
          }
        }
      }
    }

    return null;
  }
}
