// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { exit } from 'node:process';
import url from 'node:url';

import puppeteer from 'puppeteer';

/** @typedef {import('puppeteer').Page} Page */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * @typedef {object} Schedule
 * @property {number} date
 * @property {number} month
 * @property {number} hour
 * @property {number} minute
 */

/**
 * @typedef {Object} RegencySchedules
 * @property {string} regencyName
 * @property {Array<Schedule>} schedules
 */

/**
 * @typedef {Object} ProvinceSchedules
 * @property {string} provinceName
 * @property {Array<RegencySchedules>} regencies
 */

/**
 * @typedef {Object} PrayerTimeSchedule
 * @property {number} retrievedTime
 * @property {Array<ProvinceSchedules>} provinces
 */

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: {
    width: 1600,
    height: 900,
    hasTouch: false,
    deviceScaleFactor: 1,
    isLandscape: true,
    isMobile: false,
  },
});

const page = await browser.newPage();

await page.goto('https://bimasislam.kemenag.go.id/jadwalshalat');
await page.waitForNetworkIdle();

/** perlu dimuat dua kali supaya selector provinsinya jalan */
await page.reload();
await page.waitForNetworkIdle();

/** @type {PrayerTimeSchedule} */
const prayerTimeSchedule = {
  retrievedTime: Date.now(),
  provinces: [],
};

/** @type {Array<string>} */
const provinces = await page.evaluate(function () {
  return Array.from(document.querySelectorAll('.input-field:nth-child(1) select option'))
    .map(function (option) {
      return option.textContent ?? '';
    });
});

for (const [provinceIndex, province] of provinces.entries()) {
  // open province dropdown
  await page.click('.input-field:nth-child(1) .mdi-navigation-arrow-drop-down');
  // wait until the dropdown is open
  await page.waitForFunction(function () {
    const ul = document.querySelector('.input-field:nth-child(1) ul.dropdown-content');
    if (!(ul instanceof HTMLUListElement)) {
      return false;
    }
    if (ul.style.display !== 'block') {
      return false;
    }
    if (ul.style.opacity !== '1') {
      return false;
    }
    return true;
  });
  // select the province
  await page.click(`.input-field:nth-child(1) ul.dropdown-content li:nth-child(${provinceIndex + 1})`);
  // wait until the province dropdown is closed
  await page.waitForFunction(function () {
    const ul = document.querySelector('.input-field:nth-child(1) ul.dropdown-content');
    if (!(ul instanceof HTMLUListElement)) {
      return false;
    }
    if (ul.style.display !== 'none') {
      return false;
    }
    if (ul.style.opacity !== '1') {
      return false;
    }
    return true;
  });
  // wait until the regency dropdown is updated
  await page.waitForNetworkIdle();

  const provinceSchedules = /** @type {ProvinceSchedules} */ ({
    provinceName: province,
    regencies: [],
  });

  // query all regencies
  const regencies = await page.evaluate(function () {
    return Array.from(document.querySelectorAll('.input-field:nth-child(2) select option'))
      .map(function (option) {
        return option.textContent ?? '';
      });
  });

  for (const [regencyIndex, regency] of regencies.entries()) {
    // open regency dropdown
    await page.click('.input-field:nth-child(2) .mdi-navigation-arrow-drop-down');
    // wait until the dropdown is open
    await page.waitForFunction(function () {
      const ul = document.querySelector('.input-field:nth-child(2) ul.dropdown-content');
      if (!(ul instanceof HTMLUListElement)) {
        return false;
      }
      if (ul.style.display !== 'block') {
        return false;
      }
      if (ul.style.opacity !== '1') {
        return false;
      }
      return true;
    });
    // select the regency
    await page.click(`.input-field:nth-child(2) ul.dropdown-content li:nth-child(${regencyIndex + 1})`);
    // wait until the regency dropdown is closed
    await page.waitForFunction(function () {
      const ul = document.querySelector('.input-field:nth-child(2) ul.dropdown-content');
      if (!(ul instanceof HTMLUListElement)) {
        return false;
      }
      if (ul.style.display !== 'none') {
        return false;
      }
      if (ul.style.opacity !== '1') {
        return false;
      }
      return true;
    });

    // query all months
    const months = await page.evaluate(function () {
      return Array.from(document.querySelectorAll('.input-field:nth-child(3) select option'))
        .map(function (option) {
          return option.textContent ?? '';
        });
    });

    const regencySchedules = /** @type {RegencySchedules} */ ({
      regencyName: regency,
      schedules: [],
    });

    for (const [monthIndex, month] of months.entries()) {
      console.info(provinceIndex, province, regencyIndex, regency, monthIndex, month);

      // open month dropdown
      await page.click('.input-field:nth-child(3) .mdi-navigation-arrow-drop-down');
      // wait until the dropdown is open
      await page.waitForFunction(function () {
        const ul = document.querySelector('.input-field:nth-child(3) ul.dropdown-content');
        if (!(ul instanceof HTMLUListElement)) {
          return false;
        }
        if (ul.style.display !== 'block') {
          return false;
        }
        if (ul.style.opacity !== '1') {
          return false;
        }
        return true;
      });
      // select the month
      await page.click(`.input-field:nth-child(3) ul.dropdown-content li:nth-child(${monthIndex + 1})`);
      // wait until the month dropdown is closed
      await page.waitForFunction(function () {
        const ul = document.querySelector('.input-field:nth-child(3) ul.dropdown-content');
        if (!(ul instanceof HTMLUListElement)) {
          return false;
        }
        if (ul.style.display !== 'none') {
          return false;
        }
        if (ul.style.opacity !== '1') {
          return false;
        }
        return true;
      });
      // wait until the schedule is loaded
      await page.evaluate(function () {
        // @ts-ignore
        click = true;
        // @ts-ignore
        loadjadwalshalat();
      });

      await page.waitForNetworkIdle();

      // query all schedules
      const rawSchedules = await page.evaluate(function () {
        return Array.from(document.querySelectorAll('.jadwalshalat.card'))
          .map(function (div) {
            /** @example Senin, 01/01/2024 */
            const dateDisplay = div.querySelector('.bold.margin-b-10')?.textContent ?? '';
            const times = Array.from(div.querySelectorAll('.waktushalat span.waktu'))
              .map(function (span) {
                const [hour, minute] = (span?.textContent ?? '')
                  .split(':')
                  .map(function (timeStr) {
                    return parseInt(timeStr, 10);
                  });
                return {
                  hour,
                  minute,
                };
              });
            return { dateDisplay, times };
          });
      });

      /** @type {Array<Schedule>} */
      const parsedSchedules = rawSchedules
        .map(function ({ dateDisplay, times }) {
          const [_, date] = dateDisplay.split(', ');
          const [dateStr, monthStr] = date.split('/');
          const dateInt = parseInt(dateStr, 10);
          const monthInt = parseInt(monthStr, 10);
          return times
            .map(function (time) {
              return {
                date: dateInt,
                month: monthInt,
                hour: time.hour,
                minute: time.minute,
              };
            });
        })
        .flat();

      regencySchedules.schedules.push(...parsedSchedules);
    }

    provinceSchedules.regencies.push(regencySchedules);
  }

  prayerTimeSchedule.provinces.push(provinceSchedules);
}

await page.close();
await browser.close();

const filePath = path.join(__dirname, '../data/jadwal-sholat.json');

if (fs.existsSync(filePath)) {
  fs.unlinkSync(filePath);
}

fs.writeFileSync(filePath, JSON.stringify(prayerTimeSchedule), { encoding: 'utf8' });
