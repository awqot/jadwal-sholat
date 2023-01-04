<?php

namespace Awqot\JadwalSholat;

class Schedule
{
  /**
   * @param array<Time> $times
   */
  public function __construct(
    public readonly int $date,
    public readonly int $month,
    public readonly array $times,
  ) {
  }
}
