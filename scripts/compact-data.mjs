// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/** @typedef {import('../js/jadwal-sholat.mjs').Metadata} Metadata */
/** @typedef {import('./fetch-data.mjs').JadwalSholatData} JadwalSholatData */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const VERSION = 1;
const NUM_OF_TIME_DIFFS = 366;
const NUM_OF_REGENCIES = 517;
// const NUM_OF_PRAYER_TIMES = 8;
const NUM_OF_PRAYER_TIMES = 7; // minus imsak dari fact check bahwa imsak selalu 10 menit sebelum subuh
const TIME_DIFF_GROUP_SIZE = 4;

/** @type {JadwalSholatData} */
const { timestamp, prayerTimeScheduleMap } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jadwal-sholat.json'), { encoding: 'utf8' }));

let metadata = `${timestamp}`;

const magicBytes = Buffer.from('AWQTSHLT');

const headerSize = magicBytes.length
  + 2 // store version in 2 bytes
  + 2 // store number of regencies in 2 bytes
  + 2 // store number of time diffs in 2 bytes
  + 1 // store time diff group size in 1 byte
  + 1 // store number of prayer times in 1 byte

const regencyScheduleSize = 2 // baseMinuteOfDay
  + Math.ceil(NUM_OF_TIME_DIFFS / TIME_DIFF_GROUP_SIZE); // kita dapat menyimpan 4 time diff dalam 8 bit, 2 bit merepresentasikan 4 states: -2, -1, 0, 1.

const rowSize = NUM_OF_PRAYER_TIMES * regencyScheduleSize;

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
// Write number of time diffs
buffer.writeUInt16BE(Math.ceil(NUM_OF_TIME_DIFFS / TIME_DIFF_GROUP_SIZE), index);
index += 2;
// Write time diff group size
buffer.writeUInt8(4, index);
index += 1;
// Write number of prayer times
buffer.writeUInt8(NUM_OF_PRAYER_TIMES, index);
index += 1;

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

    // Fact Check: Apakah imsak selalu 10 menit sebelum subuh?
    const imsak = prayerTimes[0];
    const subuh = prayerTimes[1];

    if (imsak.baseMinuteOfDay !== subuh.baseMinuteOfDay - 10) {
      throw new Error('Imsak is not always 10 minutes before subuh.');
    }

    for (const [scheduleIndex, { timeDiff }] of subuh.schedules.entries()) {
      const imsakSchedule = imsak.schedules[scheduleIndex];

      if (timeDiff !== imsakSchedule.timeDiff) {
        throw new Error('Imsak schedule is not equal to subuh schedule.');
      }
    }

    metadata += '\t';
    metadata += `${regency}`;

    const includedPrayerTimes = prayerTimes.filter(function (_, index) {
      // Skip imsak
      if (index === 0) {
        return false;
      }
      return true;
    });

    if (includedPrayerTimes.length !== NUM_OF_PRAYER_TIMES) {
      throw new Error(`Number of prayer times is not equal to ${NUM_OF_PRAYER_TIMES}.`);
    }

    prayerTimeLoop:
    for (const [prayerTimeIndex, { baseMinuteOfDay, schedules }] of includedPrayerTimes.entries()) {
      if (schedules.length !== NUM_OF_TIME_DIFFS) {
        throw new Error('Number of schedules is not equal to 366.');
      }

      buffer.writeUInt16BE(baseMinuteOfDay, index);
      index += 2;

      const timeDiffs = schedules.map(function (schedule) {
        return schedule.timeDiff;
      });

      for (const timeDiff of timeDiffs) {
        if (![-2, -1, 0, 1].includes(timeDiff)) {
          throw new Error('Time diff is not in range of -2 to 1.');
        }
      }

      const adjustedTimeDiffs = timeDiffs.map(function (timeDiff) {
        return timeDiff + 2;
      });

      for (let timeDiffIndex = 0; timeDiffIndex < adjustedTimeDiffs.length; timeDiffIndex += 4) {
        const first = adjustedTimeDiffs[timeDiffIndex];
        const second = adjustedTimeDiffs[timeDiffIndex + 1];
        const third = adjustedTimeDiffs[timeDiffIndex + 2] ?? 0;
        const fourth = adjustedTimeDiffs[timeDiffIndex + 3] ?? 0;

        const value = (first << 6) | (second << 4) | (third << 2) | fourth;

        buffer.writeUInt8(value, index);
        index += 1;
      }
    }

    regencyCount++;
  }
}

if (regencyCount !== NUM_OF_REGENCIES) {
  throw new Error('Number of regencies is not equal to 517.');
}

if (index !== bufferSize) {
  throw new Error(`Expected index to be ${bufferSize}, but got ${index}.`);
}

fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.bin'), buffer);
fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.metadata'), metadata, { encoding: 'utf8' });
