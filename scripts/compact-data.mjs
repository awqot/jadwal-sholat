// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/** @typedef {import('../js/jadwal-sholat.mjs').Metadata} Metadata */
/** @typedef {import('./fetch-data.mjs').JadwalSholatData} JadwalSholatData */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const VERSION = 1;
const NUM_OF_TIMES = 366;
// const NUM_OF_REGENCIES = 517;
const NUM_OF_REGENCIES = 600;
const NUM_OF_PRAYER_TIMES = 8;

/** @type {JadwalSholatData} */
const { timestamp, prayerTimeScheduleMap } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jadwal-sholat.json'), { encoding: 'utf8' }));

let metadata = `${timestamp}`;

const magicBytes = Buffer.from('AWQTSHLT');

const headerSize = magicBytes.length
  + 2 // store version in 2 bytes
  + 2 // store number of regencies in 2 bytes
  + 2 // store number of diff schedules in 2 bytes

const rowSize = 2 // baseMinuteOfDay
  + (NUM_OF_PRAYER_TIMES * (NUM_OF_TIMES / 2)); // each schedule is 4 bit, so 2 schedules per byte

const contentSize = NUM_OF_REGENCIES * rowSize;

const bufferSize = headerSize + contentSize;

const buffer = Buffer.alloc(bufferSize);
let index = 0;

// Write header
buffer.subarray(0, magicBytes.length).set(magicBytes);
index += magicBytes.length;
// Write version
buffer.writeUInt16BE(VERSION, index);
index += 2;
// Write number of regencies
buffer.writeUInt16BE(NUM_OF_REGENCIES, index);
index += 2;
// Write number of diff schedules
buffer.writeUInt16BE(NUM_OF_TIMES, index);
index += 2;

const provinces = Object.keys(prayerTimeScheduleMap);

provinces.sort(function (a, z) {
  return a.localeCompare(z);
});

let regencyCount = 0;

for (const [provinceIndex, province] of provinces.entries()) {
  const regencies = Object.keys(prayerTimeScheduleMap[province]);

  regencies.sort(function (a, z) {
    return a.localeCompare(z);
  });

  metadata += '\n';
  metadata += `${province}:`;

  for (const [regencyIndex, regency] of regencies.entries()) {
    const prayerTimes = prayerTimeScheduleMap[province][regency];

    prayerTimes.sort(function (a, z) {
      return a.baseMinuteOfDay - z.baseMinuteOfDay;
    });

    metadata += '\t';
    metadata += `${regency}`;

    if (prayerTimes.length !== NUM_OF_PRAYER_TIMES) {
      throw new Error('Number of prayer times is not equal to 8.');
    }

    for (const [prayerTimeIndex, { baseMinuteOfDay, schedules }] of prayerTimes.entries()) {
      if (schedules.length !== NUM_OF_TIMES) {
        throw new Error('Number of schedules is not equal to 366.');
      }

      buffer.writeUInt16BE(baseMinuteOfDay, index);
      index += 2;

      const schedulePairs = schedules.reduce((schedulePairs, schedule, index) => {
        if (index % 2 === 0) {
          schedulePairs.push([schedule.timeDiff]);
        } else {
          schedulePairs[schedulePairs.length - 1].push(schedule.timeDiff);
        }
        return schedulePairs;
      }, /** @type {Array<Array<number>>} */ ([]));

      for (const schedulePair of schedulePairs) {
        const [left, right] = schedulePair;
        // console.log(index, left, right, (left << 4) | right, left << 4, right);
        buffer.writeInt8((left << 4) | right, index);
        index += 1;
      }
    }

    regencyCount++;
  }
}

// if (regencyCount !== NUM_OF_REGENCIES) {
//   throw new Error('Number of regencies is not equal to 517.');
// }

fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.bin'), buffer);
fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.metadata'), metadata, { encoding: 'utf8' });
