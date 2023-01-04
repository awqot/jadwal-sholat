// @ts-check

import fs from 'fs';
import path from 'path';
import url from 'url';
import puppeteer from 'puppeteer';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * @typedef {object} Schedule
 * @property {string} province
 * @property {string} regency
 * @property {number} date
 * @property {number} month
 * @property {string} name
 * @property {string} time
 */

/**
 * @param {number} duration
 */
async function sleep(duration) {
  await new Promise((resolve) => setTimeout(resolve, duration));
}

const browser = await puppeteer.launch({
  headless: false,
});

const page = await browser.newPage();

await page.goto('https://bimasislam.kemenag.go.id/jadwalshalat');
await page.waitForNetworkIdle();

/** perlu dimuat dua kali supaya selector provinsinya jalan */
await page.reload();
await page.waitForNetworkIdle();

/** @type {Array<string>} */
const provinces = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.input-field:nth-child(1) select option'))
    .map((option) => {
      return option.textContent ?? '';
    });
});

/** @type {Array<Schedule>} */
const schedules = [];

for (const [provinceIndex, province] of provinces.entries()) {
  /** Lewati provinsi "PUSAT", tidak jalan */
  if (provinceIndex === 0) continue;

  await page.click('.input-field:nth-child(1) .mdi-navigation-arrow-drop-down');
  await sleep(500);
  await page.click(`.input-field:nth-child(1) .dropdown-content li:nth-child(${provinceIndex + 1})`);
  await page.waitForNetworkIdle();

  /** @type {Array<string>} */
  const regencies = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.input-field:nth-child(2) select option'))
      .map((option) => {
        return option.textContent ?? '';
      });
  });

  for (const [regencyIndex, regency] of regencies.entries()) {
    await page.click('.input-field:nth-child(2) .mdi-navigation-arrow-drop-down');
    await sleep(500);
    await page.click(`.input-field:nth-child(2) .dropdown-content li:nth-child(${regencyIndex + 1})`);

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      await page.click('.input-field:nth-child(3) .mdi-navigation-arrow-drop-down');
      await sleep(500);
      await page.click(`.input-field:nth-child(3) .dropdown-content li:nth-child(${monthIndex + 1})`);

      /**
       * seharusnya ini, tapi tidak jalan
       * await page.click('#btn_search');
       */
      await page.evaluate(() => {
        // @ts-ignore
        click = true;
        // @ts-ignore
        loadjadwalshalat();
      });
      await page.waitForNetworkIdle();

      /** @type {Array<Schedule>} */
      const capturedTimes = await page.evaluate((province, regency, monthIndex) => {
        const timeNames = ['imsak', 'subuh', 'terbit', 'duha', 'zuhur', 'asar', 'magrib', 'isya'];
        return Array.from(document.querySelectorAll('div.jadwalshalat.card'))
          .map((div, dateIndex) => {
            return Array.from(div.querySelectorAll('span.waktu'))
              .map((span) => span.textContent ?? '')
              .map((time, index) => {
                return {
                  province,
                  regency,
                  date: dateIndex + 1,
                  month: monthIndex + 1,
                  name: timeNames[index],
                  time,
                };
              });
          })
          .flat();
      }, province, regency, monthIndex);

      schedules.push(...capturedTimes);
    }
  }
}

const filePath = path.join(__dirname, '../data/jadwal-sholat.json');

if (fs.existsSync(filePath)) {
  fs.unlinkSync(filePath);
}

fs.writeFileSync(filePath, JSON.stringify({
  timestamp: Date.now(),
  schedules,
}), { encoding: 'utf8' });
