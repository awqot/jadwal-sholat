<?php

namespace Awqot\JadwalSholat;

class Time
{
  /**
   * @param array<Time> $times
   */
  public function __construct(
    public readonly string $label,
    public readonly int $hour,
    public readonly int $minute,
  ) {
  }
}
