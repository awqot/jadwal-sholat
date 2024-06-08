// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/** @typedef {import('../js/jadwal-sholat.mjs').Metadata} Metadata */
/** @typedef {import('./fetch-data.mjs').Schedule} Schedule */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * Sehari ada 8 waktu signifikan: imsak, subuh, terbit, duha, zuhur, asar, magrib, isya
 * Sewaktu ada 2 bagian: jam dan menit
 * Jadi 8 * 2 = 16
 */
const numOfTimePartsADay = 16;

const max6bit = 0b111111;
const max8bit = 0b11111111;

/**
 * Little-endian
 * @param {number} first
 * @param {number} second
 */
function join8bitTo16bit(first, second) {
  if (first > max8bit || second > max8bit) {
    console.warn(first, second);
    throw new Error('Data lebih besar dari 8 bit');
  }
  return first | (second << 8);
}

/**
 * @param {Array<number>} times pasangan jam dan menit diasumsikan 6 bit integer.
 */
function compactTimesADayToBinary(times) {
  if (times.length !== numOfTimePartsADay) {
    console.warn(times);
    throw new Error('Data waktu tidak sesuai spesifikasi');
  }
  for (const time of times) {
    if (time > max6bit) {
      console.warn(time, times);
      throw new Error('Data lebih besar dari 6 bit');
    }
  }

  const imsya = (times[0] * 60) + times[1]; 
  const subuh = (times[2] * 60) + times[3];
  const terbit = (times[4] * 60) + times[5];
  const duha = (times[6] * 60) + times[7];
  const dzuhur = (times[8] * 60) + times[9];
  const ashar = (times[10] * 60) + times[11];
  const magrib = (times[12] * 60) + times[13];
  const isya = (times[14] * 60) + times[15];

  return [
    imsya,
    subuh,
    terbit,
    duha,
    dzuhur,
    ashar,
    magrib,
    isya,
  ];
}

/** @type {{ timestamp: number, schedules: Array<Schedule> }} */
const { timestamp, schedules } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jadwal-sholat.json'), { encoding: 'utf8' }));

/** @type {{ [locationGroup: number]: { [dateGroup: number]: Array<number> } }} */
const compactTimeGroupMap = {};

/** @type {Metadata} */
const metadata = { timestamp, timePaddings: [], provinces: [] };

schedules.forEach(({ province: provinceName, regency: regencyName, date, month, time }) => {
  let province = metadata.provinces.find((province) => province.name === provinceName);
  if (province === undefined) {
    province = { name: provinceName, regencies: [] };
    metadata.provinces.push(province);
  }
  const provinceIndex = metadata.provinces.indexOf(province);

  let regency = province.regencies.find((regency) => regency.name === regencyName);
  if (regency === undefined) {
    regency = { name: regencyName };
    province.regencies.push(regency);
  }
  const regencyIndex = province.regencies.indexOf(regency);

  const [hour, minute] = time.split(':').map((str) => parseInt(str, 10));

  /** index mulai dari 1 agar kab/kot di provinsi pertama tidak 0 */
  const location = (provinceIndex + 1) * regencyIndex;

  const monthDate = month * date;

  if (compactTimeGroupMap[location] === undefined) compactTimeGroupMap[location] = {};
  if (compactTimeGroupMap[location][monthDate] === undefined) compactTimeGroupMap[location][monthDate] = [];

  compactTimeGroupMap[location][monthDate].push(hour, minute);
});

/** @type {number} */
let numOfDaysInAYear;

const dailyTimess = metadata.provinces
  .map((province, provinceIndex) => {
    const row = province.regencies
      .map((regency, regencyIndex) => {
        const location = (provinceIndex + 1) * regencyIndex;

        const dailyTimes = Object.keys(compactTimeGroupMap[location])
          .map((dateGroupStr) => parseInt(dateGroupStr, 10))
          .sort((a, z) => a - z)
          .map((dateGroup) => {
            /** @type {Array<number>} */
            const times = compactTimeGroupMap[location][dateGroup];
            if (times.length !== numOfTimePartsADay) {
              console.warn(location, dateGroup, times);
              throw new Error('Jumlah data waktu tidak sesuai spesifikasi');
            }
            return compactTimesADayToBinary(times);
          });

        if (typeof numOfDaysInAYear !== 'number') {
          numOfDaysInAYear = dailyTimes.length;
        }

        if (dailyTimes.length !== numOfDaysInAYear) {
          console.warn(province.name, regency.name, dailyTimes);
          throw new Error('Jumlah data waktu tidak sesuai spesifikasi');
        }

        return dailyTimes;
      })
      .flat();

    return row;
  })
  .flat();

const imsyaRange = [Infinity, -Infinity];
const subuhRange = [Infinity, -Infinity];
const terbitRange = [Infinity, -Infinity];
const duhaRange = [Infinity, -Infinity];
const dzuhurRange = [Infinity, -Infinity];
const asharRange = [Infinity, -Infinity];
const magribRange = [Infinity, -Infinity];
const isyaRange = [Infinity, -Infinity];

for (const dailyTimes of dailyTimess) {
  const imsya = dailyTimes[0];
  const subuh = dailyTimes[1];
  const terbit = dailyTimes[2];
  const duha = dailyTimes[3];
  const dzuhur = dailyTimes[4];
  const ashar = dailyTimes[5];
  const magrib = dailyTimes[6];
  const isya = dailyTimes[7];

  imsyaRange[0] = Math.min(imsyaRange[0], imsya);
  imsyaRange[1] = Math.max(imsyaRange[1], imsya);

  subuhRange[0] = Math.min(subuhRange[0], subuh);
  subuhRange[1] = Math.max(subuhRange[1], subuh);

  terbitRange[0] = Math.min(terbitRange[0], terbit);
  terbitRange[1] = Math.max(terbitRange[1], terbit);

  duhaRange[0] = Math.min(duhaRange[0], duha);
  duhaRange[1] = Math.max(duhaRange[1], duha);

  dzuhurRange[0] = Math.min(dzuhurRange[0], dzuhur);
  dzuhurRange[1] = Math.max(dzuhurRange[1], dzuhur);

  asharRange[0] = Math.min(asharRange[0], ashar);
  asharRange[1] = Math.max(asharRange[1], ashar);

  magribRange[0] = Math.min(magribRange[0], magrib);
  magribRange[1] = Math.max(magribRange[1], magrib);

  isyaRange[0] = Math.min(isyaRange[0], isya);
  isyaRange[1] = Math.max(isyaRange[1], isya);
}

const ranges = [
  imsyaRange,
  subuhRange,
  terbitRange,
  duhaRange,
  dzuhurRange,
  asharRange,
  magribRange,
  isyaRange,
];

if (ranges.some(([min, max]) => min < 0 || max > 1440)) {
  console.warn(ranges);
  throw new Error('Selisih waktu melebihi 24 jam');
}

for (const range of ranges) {
  const diff = range[1] - range[0];
  if (diff > max8bit) {
    console.warn(range);
    throw new Error('Selisih waktu melebihi 8 bit');
  }
}

const imsyaPadding = Math.floor(imsyaRange[0] / 60) * 60;
const subuhPadding = Math.floor(subuhRange[0] / 60) * 60;
const terbitPadding = Math.floor(terbitRange[0] / 60) * 60;
const duhaPadding = Math.floor(duhaRange[0] / 60) * 60;
const dzuhurPadding = Math.floor(dzuhurRange[0] / 60) * 60;
const asharPadding = Math.floor(asharRange[0] / 60) * 60;
const magribPadding = Math.floor(magribRange[0] / 60) * 60;
const isyaPadding = Math.floor(isyaRange[0] / 60) * 60;

metadata.timePaddings = [
  imsyaPadding,
  subuhPadding,
  terbitPadding,
  duhaPadding,
  dzuhurPadding,
  asharPadding,
  magribPadding,
  isyaPadding,
];

const compactTimes = dailyTimess
  .map((dailyTimes) => {
    return [
      dailyTimes[0] - imsyaPadding,
      dailyTimes[1] - subuhPadding,
      dailyTimes[2] - terbitPadding,
      dailyTimes[3] - duhaPadding,
      dailyTimes[4] - dzuhurPadding,
      dailyTimes[5] - asharPadding,
      dailyTimes[6] - magribPadding,
      dailyTimes[7] - isyaPadding,
    ];
  })
  .flat();

for (const time of compactTimes) {
  if (time < 0 || time > max8bit) {
    console.warn(time);
    throw new Error('Data waktu tidak sesuai spesifikasi');
  }
}

const timeBuffer = new Uint8Array(compactTimes);
const metadataRaw = [
  `${timestamp}`,
  [imsyaPadding, subuhPadding, terbitPadding, duhaPadding, dzuhurPadding, asharPadding, magribPadding, isyaPadding].join('\t'),
  ...metadata.provinces.map((province) => {
    const regencies = province.regencies
      .map((regency) => regency.name)
      .join('\t')
    return `${province.name}:${regencies}`;
  }),
].join('\n');

fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.bin'), timeBuffer);
fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.metadata'), metadataRaw, { encoding: 'utf8' });
