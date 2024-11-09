// @ts-check

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/** @typedef {import('./fetch-data.mjs').PrayerTimeSchedule} PrayerTimeSchedule */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/** @type {PrayerTimeSchedule} */
const { retrievedTime, provinces } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jadwal-sholat.json'), {
  encoding: 'utf8',
}));

const MAX_UINT16 = 0xFFFF;
const MAX_UINT8 = 0xFF;

const VERSION = 1;
const NUM_OF_PROVINCES = provinces.length;
const NUM_OF_REGENCIES = provinces.reduce((sum, { regencies }) => sum + regencies.length, 0);
const NUM_OF_SCHEDULES = provinces[0].regencies[0].schedules.length; // this is sample, it should be the same for all regencies

const textEncoder = new TextEncoder();

const utf8ProvinceNames = provinces.map(({ provinceName }) => textEncoder.encode(provinceName));
const utf8RegencyNamesOfProvinces = provinces.map(({ regencies }) => regencies.map(({ regencyName }) => textEncoder.encode(regencyName)));

const magicU8a = textEncoder.encode('AWQTSHLT');

const headerSize = magicU8a.byteLength
  + 2 // version as u16
  + 8 // timestamp in millis as u64
  + 1 // number of provinces as u8
  + 2 // number of regencies as u16
  + 2 // number of schedules as u16
  ;

const indexSize = 0
  + 8 // province names index as u64
  + (2 * NUM_OF_PROVINCES) // province names indices as u16
  + (2 * NUM_OF_PROVINCES) // province schedule indices as u16
  ;

const scheduleSize = 0
  + 1 // date as u8
  + 1 // month as u8
  + 1 // hour as u8
  + 1 // minute as u8
  ;

const regencyScheduleSize = NUM_OF_SCHEDULES * scheduleSize;
const schedulesTotalSize = NUM_OF_REGENCIES * regencyScheduleSize;

const provinceNamesOffset = headerSize + indexSize + schedulesTotalSize;

const { provinceNamesSize, provinceNamesIndices } = utf8ProvinceNames
  .reduce(function ({ provinceNamesSize, provinceNamesIndices }, provinceName, index) {
    const regencyNames = utf8RegencyNamesOfProvinces[index];
    const regencyNamesSize = regencyNames
      .reduce(function (accSize, regencyName) {
        return accSize
          + 1 // length of the name as u8
          + regencyName.byteLength
          ;
      }, 0);
    return {
      provinceNamesSize: provinceNamesSize
        + 1 // length of the name as u8
        + provinceName.byteLength
        + 1 // number of regencies as u8
        + regencyNamesSize,
      provinceNamesIndices: [...provinceNamesIndices, provinceNamesSize],
    };
  }, {
    provinceNamesSize: 0,
    provinceNamesIndices: /** @type {Array<number>} */ ([]),
  });

const { provinceScheduleIndices } = provinces
  .reduce(function ({ provinceOffset, provinceScheduleIndices }, { regencies }) {
    return {
      provinceOffset: provinceOffset + regencies.length,
      provinceScheduleIndices: [
        ...provinceScheduleIndices,
        provinceOffset,
      ],
    };
  }, {
    provinceOffset: 0,
    provinceScheduleIndices: /** @type {Array<number>} */ ([]),
  });

const u8a = new Uint8Array(headerSize + indexSize + schedulesTotalSize + provinceNamesSize);
const data = new DataView(u8a.buffer);
let offset = 0;

u8a.set(magicU8a, offset);
offset += magicU8a.byteLength;

data.setUint16(offset, VERSION, true);
offset += 2;

data.setBigUint64(offset, BigInt(retrievedTime), true);
offset += 8;

u8a[offset] = NUM_OF_PROVINCES;
offset += 1;

data.setUint16(offset, NUM_OF_REGENCIES, true);
offset += 2;

data.setUint16(offset, NUM_OF_SCHEDULES, true);
offset += 2;

data.setBigUint64(offset, BigInt(provinceNamesOffset), true);
offset += 8;

for (const provinceNameIndex of provinceNamesIndices) {
  assert.ok(provinceNameIndex <= MAX_UINT16, `Region name index is too big: ${provinceNameIndex} > ${MAX_UINT16}`);

  data.setUint16(offset, provinceNameIndex, true);
  offset += 2;
}

for (const provinceScheduleIndex of provinceScheduleIndices) {
  assert.ok(provinceScheduleIndex <= MAX_UINT16, `Region schedule index is too big: ${provinceScheduleIndex} > ${MAX_UINT16}`);

  data.setUint16(offset, provinceScheduleIndex, true);
  offset += 2;
}

for (const { regencies } of provinces) {
  for (const { schedules } of regencies) {
    assert.strictEqual(schedules.length, NUM_OF_SCHEDULES, 'Number of schedules is not the same for all regencies');

    schedules.sort(function (a, z) {
      if (a.month === z.month) {
        if (a.date === z.date) {
          if (a.hour === z.hour) {
            return a.minute - z.minute;
          }
          return a.hour - z.hour;
        }
        return a.date - z.date;
      }
      return a.month - z.month;
    });

    for (const { month, date, hour, minute } of schedules) {
      u8a[offset] = month;
      offset += 1;

      u8a[offset] = date;
      offset += 1;

      u8a[offset] = hour;
      offset += 1;

      u8a[offset] = minute;
      offset += 1;
    }
  }
}

for (const [provinceIndex, utf8ProvinceName] of utf8ProvinceNames.entries()) {
  assert.ok(utf8ProvinceName.byteLength <= MAX_UINT8, `Province name is too long: ${utf8ProvinceName.byteLength} > ${MAX_UINT16}`);

  const utf8RegencyNames = utf8RegencyNamesOfProvinces[provinceIndex];

  data.setUint8(offset, utf8ProvinceName.byteLength);
  offset += 1;

  u8a.set(utf8ProvinceName, offset);
  offset += utf8ProvinceName.byteLength;

  u8a[offset] = utf8RegencyNames.length;
  offset += 1;

  for (const utf8RegencyName of utf8RegencyNames) {
    assert.ok(utf8RegencyName.byteLength <= MAX_UINT8, `Regency name is too long: ${utf8RegencyName.byteLength} > ${MAX_UINT16}`);

    data.setUint8(offset, utf8RegencyName.byteLength);
    offset += 1;

    u8a.set(utf8RegencyName, offset);
    offset += utf8RegencyName.byteLength;
  }
}

console.info(`Magic word: ${magicU8a.byteLength} bytes @ ${0}`);
console.info(`Header: ${headerSize} bytes @ ${magicU8a.byteLength}`);
console.info(`Index: ${indexSize} bytes @ ${magicU8a.byteLength + headerSize}`);
console.info(`Schedule: ${schedulesTotalSize} bytes @ ${magicU8a.byteLength + headerSize + indexSize}`);
console.info(`Region names: ${provinceNamesSize} bytes @ ${magicU8a.byteLength + headerSize + indexSize + schedulesTotalSize}`);
console.info(`Total size: ${u8a.byteLength} bytes`);

fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.ajs'), u8a);
