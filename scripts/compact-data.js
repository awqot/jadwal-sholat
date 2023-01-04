// @ts-check

import fs from 'fs';
import path from 'path';
import url from 'url';

/** @typedef {import('../src/index.js').Metadata} Metadata */
/** @typedef {import('./fetch-data.js').Schedule} Schedule */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * @param {number} first
 * @param {number} second
 */
function join8bitTo16bit(first, second) {
  if (first > 0b11111111 || second > 0b11111111) {
    console.warn(first, second);
    throw new Error('Data lebih besar dari 8 bit');
  }
  // console.log(
  //   (first | (second << 8)),
  //   first.toString(2).padStart(8, '0'),
  //   second.toString(2).padStart(8, '0'),
  //   (first | (second << 8)).toString(2).padStart(16, '0'),
  // );
  return first | (second << 8);
}

/**
 * @param {Array<number>} times pasangan jam dan menit diasumsikan 6 bit integer
 */
function compactTimesBinary(times) {
  if (times.length !== 16) {
    console.warn(times);
    throw new Error('Data waktu tidak sesuai spesifikasi');
  }
  for (const time of times) {
    if (time > 0b111111) {
      console.warn(time, times);
      throw new Error('Data lebih besar dari 6 bit');
    }
  }
  return [
    times[0] | (times[1] << 6) | (((times[2] & 0b111100) >> 2) << 12),
    (times[2] & 0b000011) | (times[3] << 2) | (times[4] << 8) | (((times[5] & 0b110000) >> 4) << 14),
    (times[5] & 0b001111) | (times[6] << 4) | (times[7] << 10),
    times[8] | (times[9] << 6) | (((times[10] & 0b111100) >> 2) << 12),
    (times[10] & 0b000011) | (times[11] << 2) | (times[12] << 8) | (((times[13] & 0b110000) >> 4) << 14),
    (times[13] & 0b001111) | (times[14] << 4) | (times[15] << 10),
  ];
}

/** @type {{ timestamp: number, schedules: Array<Schedule> }} */
const { timestamp, schedules } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jadwal-sholat.json'), { encoding: 'utf8' }));

/** @type {{ [locationGroup: number]: { [dateGroup: number]: Array<number> } }} */
const groupedCompactTimes = {};

/** @type {Metadata} */
const metadata = { timestamp, provinces: [] };

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

  const location = join8bitTo16bit(provinceIndex, regencyIndex);
  const dateMonth = join8bitTo16bit(date, month);

  if (groupedCompactTimes[location] === undefined) groupedCompactTimes[location] = {};
  if (groupedCompactTimes[location][dateMonth] === undefined) groupedCompactTimes[location][dateMonth] = [];

  groupedCompactTimes[location][dateMonth].push(hour, minute);
});

const compactTimes = metadata.provinces
  .map((province, provinceIndex) => {
    const row = province.regencies
      .map((_, regencyIndex) => {
        const location = join8bitTo16bit(provinceIndex, regencyIndex);

        const dailyTimes = Object.keys(groupedCompactTimes[location])
          .map((dateGroupStr) => parseInt(dateGroupStr, 10))
          .sort((a, z) => a - z)
          .map((dateGroup) => {
            /** @type {Array<number>} */
            const times = groupedCompactTimes[location][dateGroup];
            if (times.length !== 16) {
              console.warn(location, dateGroup, times);
              throw new Error('Jumlah data waktu tidak sesuai spesifikasi');
            }
            return [dateGroup, ...compactTimesBinary(times)];
          })
          .flat();

        if (dailyTimes.length !== 2555) {
          console.warn(location, dailyTimes.length, dailyTimes);
          throw new Error('Jumlah data lokasi tidak sesuai spesifikasi');
        }

        return [location, ...dailyTimes];
      })
      .flat();

    return row;
  })
  .flat();

const timeBuffer = new Uint16Array(compactTimes);
const metadataRaw = [
  `${timestamp}`,
  ...metadata.provinces.map((province) => {
    const regencies = province.regencies
      .map((regency) => regency.name)
      .join('\t')
    return `${province.name}:${regencies}`;
  }),
].join('\n');

fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.bin'), timeBuffer);
fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.metadata'), metadataRaw, { encoding: 'utf8' });
