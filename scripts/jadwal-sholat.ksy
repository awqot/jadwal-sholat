meta:
  id: awqot_jadwal_sholat
  file-extension: ajs
  endian: le
  bit-endian: le
  encoding: utf-8

seq:
  - id: magic
    contents: "AWQTSHLT"
  - id: version
    type: u2
  - id: timestamp
    type: u8
  - id: num_of_provinces
    type: u1
  - id: num_of_regencies
    type: u2
  - id: num_of_schedules
    type: u2
  - id: index
    type: index(num_of_provinces)
  - id: schedules
    type: schedules(num_of_regencies, num_of_schedules)
  - id: provinces
    type: province
    repeat: expr
    repeat-expr: num_of_provinces

types:
  index:
    params:
      - id: num_of_provinces
        type: u1
    seq:
      - id: province_name_indices
        type: u4
        repeat: expr
        repeat-expr: num_of_provinces
      - id: province_schedule_indices
        type: u2
        repeat: expr
        repeat-expr: num_of_provinces

  schedules:
    params:
      - id: num_of_regencies
        type: u2
      - id: num_of_schedules
        type: u2
    seq:
      - id: regencies
        type: regency_schedules(num_of_schedules)
        repeat: expr
        repeat-expr: num_of_regencies

  regency_schedules:
    params:
      - id: num_of_schedules
        type: u2
    seq:
      - id: schedules
        type: schedule
        repeat: expr
        repeat-expr: num_of_schedules

  schedule:
    seq:
      - id: month
        type: u1
      - id: date
        type: u1
      - id: hour
        type: u1
      - id: minute
        type: u1

  province:
    seq:
      - id: province_name_length
        type: u1
      - id: province_name
        type: str
        size: province_name_length
      - id: num_of_regencies
        type: u1
      - id: regencies
        type: regency
        repeat: expr
        repeat-expr: num_of_regencies

  regency:
    seq:
      - id: regency_name_length
        type: u1
      - id: regency_name
        type: str
        size: regency_name_length
