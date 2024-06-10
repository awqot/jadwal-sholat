// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/** @typedef {import('../js/jadwal-sholat.mjs').Metadata} Metadata */
/** @typedef {import('./fetch-data.mjs').JadwalSholatData} JadwalSholatData */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const loadingBeginDate = new Date();

/** @type {JadwalSholatData} */
const { timestamp, prayerTimeSchedules } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jadwal-sholat.json'), { encoding: 'utf8' }));

const loadingEndTime = new Date();

console.log('Loading time:', loadingEndTime.getTime() - loadingBeginDate.getTime(), 'ms');

/**
 * @typedef {Array<CompactScheduleProvince>} CompactSchedule
 */

/**
 * @typedef {Object} CompactScheduleProvince
 * @property {string} name
 * @property {Array<CompactScheduleRegency>} regencies
 */

/**
 * @typedef {Object} CompactScheduleRegency
 * @property {string} name
 * @property {Array<CompactSchedulePrayerTime>} prayerTimes
 */

/**
 * @typedef {Object} CompactSchedulePrayerTime
 * @property {string} name
 * @property {Array<PrayerTime>} times
 * @property {Array<number>} timeChanges
 */

/**
 * @typedef {Object} PrayerTime
 * @property {number} month
 * @property {number} date
 * @property {number} hour
 * @property {number} minute
 */

/**
 * @typedef {Object} TimeChange
 * @property {number} numOfDays
 * @property {number} changes
 */

const parsingBeginDate = new Date();

/** @type {CompactSchedule} */
const compactSchedule = [];

for (const schedule of schedules) {
  let province = compactSchedule.find(function (province) {
    return province.name === schedule.province;
  });

  if (province === undefined) {
    province = { name: schedule.province, regencies: [] };
    compactSchedule.push(province);
  }

  let regency = province.regencies.find(function (regency) {
    return regency.name === schedule.regency;
  });

  if (regency === undefined) {
    regency = { name: schedule.regency, prayerTimes: [] };
    province.regencies.push(regency);
  }

  let prayerTime = regency.prayerTimes.find(function (prayerTime) {
    return prayerTime.name === schedule.name;
  });

  if (prayerTime === undefined) {
    prayerTime = { name: schedule.name, times: [], timeChanges: [] };
    regency.prayerTimes.push(prayerTime);
  }

  prayerTime.times.push({
    month: schedule.month,
    date: schedule.date,
    hour: schedule.hour,
    minute: schedule.minute,
  });
}

const parsingEndTime = new Date();

console.log('Parsing time:', parsingEndTime.getTime() - parsingBeginDate.getTime(), 'ms');

const compactingBeginDate = new Date();

for (const province of compactSchedule) {
  for (const regency of province.regencies) {
    for (const prayerTime of regency.prayerTimes) {
      let date = new Date(timestamp);
      date.setMonth(0);
      date.setDate(1);
      date.setHours(0);
      date.setMinutes(0);
      date.setSeconds(0);
      date.setMilliseconds(0);

      /** @type {Array<PrayerTime>} */
      const sameTimes = [];

      const sortedTimes = prayerTime.times.toSorted(function (a, z) {
        if (a.month === z.month) {
          return a.date - z.date;
        }
        return a.month - z.month;
      });

      sortedTimesLoop:
      for (const time of sortedTimes) {
        // Ada kejanggalan di data
        // September 31 tidak ada
        if (time.month === 9 && time.date === 31) {
          console.log({
            province: province.name,
            regency: regency.name,
            month: time.month,
            date: time.date,
            prayerTime: prayerTime.name,
          });
          continue sortedTimesLoop;
        }
        // November 31 tidak ada
        if (time.month === 11 && time.date === 31) {
          console.log({
            province: province.name,
            regency: regency.name,
            month: time.month,
            date: time.date,
            prayerTime: prayerTime.name,
          });
          continue sortedTimesLoop;
        }

        date.setHours(time.hour);
        date.setMinutes(time.minute);

        if ((time.month - 1) !== date.getMonth() && time.date !== date.getDate()) {
          for (const time of sortedTimes) {
            console.log({
              month: time.month,
              date: time.date,
              hour: time.hour,
              minute: time.minute,
            });
          }
          console.log({
            datetime: date,
            province: province.name,
            regency: regency.name,
            month: time.month,
            date: time.date,
            prayerTime: prayerTime.name,
          });
          throw new Error(`Date mismatch: the ${time.month} ${time.date} should be ${date.getMonth() + 1} ${date.getDate()}`);
        }

        date.setDate(date.getDate() + 1);
      }

    }
  }
}

const endCompactDate = new Date();

console.log('Compacting time:', endCompactDate.getTime() - compactingBeginDate.getTime(), 'ms');
