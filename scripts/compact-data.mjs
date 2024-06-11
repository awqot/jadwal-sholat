// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { exit } from 'node:process';
import url from 'node:url';

/** @typedef {import('../js/jadwal-sholat.mjs').Metadata} Metadata */
/** @typedef {import('./fetch-data.mjs').JadwalSholatData} JadwalSholatData */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const magicFileHeader = Buffer.from('AWQTSHLT');

console.log(magicFileHeader.length, magicFileHeader);

exit(0);

/** @type {JadwalSholatData} */
const { timestamp, prayerTimeScheduleMap } = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jadwal-sholat.json'), { encoding: 'utf8' }));

const provinces = Object.keys(prayerTimeScheduleMap);
const sortedProvinces = provinces.toSorted(function (a, z) {
  return a.localeCompare(z);
});

for (const province of sortedProvinces) {
  const regencies = Object.keys(prayerTimeScheduleMap[province]);
  const sortedRegencies = regencies.toSorted(function (a, z) {
    return a.localeCompare(z);
  });

  for (const regency of sortedRegencies) {
    const prayerTimes = prayerTimeScheduleMap[province][regency];

    for (const {  } of prayerTimes) {
    }
  }
}

// fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.bin'), timeBuffer);
// fs.writeFileSync(path.join(__dirname, '../data/jadwal-sholat.metadata'), metadataRaw, { encoding: 'utf8' });
