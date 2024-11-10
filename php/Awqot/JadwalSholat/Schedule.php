<?php

namespace Awqot\JadwalSholat;

class Schedule
{
  /**
   * @param array<Time> $times
   */
  public function __construct(
    public readonly int $month,
    public readonly int $date,
    public array $times,
  ) {
  }
}
