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
 * @property {number} timeDiff
 */

/**
 * @typedef {Object} PrayerTimeRegencySchedule
 * @property {string} name
 * @property {number} baseMinuteOfDay
 * @property {number} lastMinuteOfDay
 * @property {Array<Schedule>} schedules
 */

/**
 * @typedef {{ [regency: string]: Array<PrayerTimeRegencySchedule> }} PrayerTimeProvinceSchedule
 */

/**
 * @typedef {{ [province: string]: PrayerTimeProvinceSchedule }} PrayerTimeScheduleMap
 */

const browser = await puppeteer.launch({
  headless: false,
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

/** @type {Array<string>} */
const provinces = await page.evaluate(function () {
  return Array.from(document.querySelectorAll('.input-field:nth-child(1) select option'))
    .map(function (option) {
      return option.textContent ?? '';
    });
});

await page.close();
await browser.close();

/** @type {PrayerTimeScheduleMap} */
const prayerTimeScheduleMap = {};

const browsers = Array.from({ length: 2 })
  .map(async function (_, index) {
    await new Promise(function (resolve) {
      setTimeout(resolve, index * 500);
    });

    const browser = await puppeteer.launch({
      headless: false,
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

    await page.reload();

    await page.waitForNetworkIdle();

    return { page };
  });

const provinceEntries = Array.from(provinces.entries());

await Promise.all(browsers.map(async function (browser, browserIndex) {
  const { page } = await browser;
  while (provinceEntries.length > 0) {
    const provinceEntry = provinceEntries.shift();
    if (Array.isArray(provinceEntry)) {
      const [provinceIndex, province] = provinceEntry;
      const prayerTimeSchedule = await fetchPrayerTimeProvinceSchedule(page, browserIndex, provinceIndex, province);
      prayerTimeScheduleMap[province] = prayerTimeSchedule;
    }
  }
}));

const filePath = path.join(__dirname, '../data/jadwal-sholat.json');

if (fs.existsSync(filePath)) {
  fs.unlinkSync(filePath);
}

/**
 * @typedef JadwalSholatData
 * @property {number} timestamp
 * @property {PrayerTimeScheduleMap} prayerTimeScheduleMap
 */

/** @type {JadwalSholatData} */
const jadwalSholatData = {
  timestamp: Date.now(),
  prayerTimeScheduleMap: prayerTimeScheduleMap,
};

fs.writeFileSync(filePath, JSON.stringify(jadwalSholatData), { encoding: 'utf8' });

exit(0);


/**
 * @param {Page} page
 * @param {number} browserIndex
 * @param {number} provinceIndex
 * @param {string} province
 * @returns {Promise<PrayerTimeProvinceSchedule>}
 */
async function fetchPrayerTimeProvinceSchedule(page, browserIndex, provinceIndex, province) {
  console.info(browserIndex, 'Begin Province', provinceIndex, province);

  /** @type {PrayerTimeProvinceSchedule} */
  const prayerTimeProvinceSchedule = {};

  await selectProvince(page, provinceIndex);

  /** @type {Array<string>} */
  const regencies = await page.evaluate(function () {
    return Array.from(document.querySelectorAll('.input-field:nth-child(2) select option'))
      .map(function (option) {
        return option.textContent ?? '';
      });
  });

  for (const [regencyIndex, regency] of regencies.entries()) {
    console.info(browserIndex, 'Begin Regency', regencyIndex, regency);

    await selectRegency(page, regencyIndex);

    /** @type {Array<string>} */
    const months = await page.evaluate(function () {
      return Array.from(document.querySelectorAll('.input-field:nth-child(3) select option'))
        .map(function (option) {
          return option.textContent ?? '';
        });
    });

    for (const [monthIndex, month] of months.entries()) {
      console.info(browserIndex, 'Begin Month', provinceIndex, province, regencyIndex, regency, monthIndex, month);

      const capturedTimes = await captureTimes(page, province, regency, monthIndex);

      for (const capturedTime of capturedTimes) {
        prayerTimeProvinceSchedule[regency] = prayerTimeProvinceSchedule[regency] ?? [];

        let prayerTimeSchedule = prayerTimeProvinceSchedule[regency].find(function (prayerTimeSchedule) {
          return prayerTimeSchedule.name === capturedTime.name;
        });

        if (prayerTimeSchedule === undefined) {
          prayerTimeSchedule = {
            name: capturedTime.name,
            baseMinuteOfDay: (capturedTime.hour * 60) + capturedTime.minute,
            lastMinuteOfDay: (capturedTime.hour * 60) + capturedTime.minute,
            schedules: [],
          };
          prayerTimeProvinceSchedule[regency].push(prayerTimeSchedule);
        }

        const minuteOfDay = (capturedTime.hour * 60) + capturedTime.minute;
        const timeDiff = minuteOfDay - prayerTimeSchedule.lastMinuteOfDay;

        const lastSchedule = prayerTimeSchedule.schedules.at(-1);

        if (lastSchedule !== undefined) {
          if (timeDiff > 3) {
            console.warn(JSON.stringify({
              province,
              regency,
              monthIndex,
              capturedTime,
              prayerTimeSchedule,
            }, null, 2));
            throw new Error(`Time diff is too big: ${timeDiff}`);
          }
        }

        prayerTimeSchedule.schedules.push({
          date: capturedTime.date,
          month: capturedTime.month,
          timeDiff,
        });

        prayerTimeSchedule.lastMinuteOfDay = minuteOfDay;
      }

      console.info(browserIndex, 'End Month', provinceIndex, province, regencyIndex, regency, monthIndex, month);
    }

    console.info(browserIndex, 'End Regency', regencyIndex, regency);
  }

  console.info(browserIndex, 'End Province', provinceIndex, province);

  return prayerTimeProvinceSchedule;
}

/**
 * @param {Page} page
 * @param {number} provinceIndex
 */
async function selectProvince(page, provinceIndex) {
  // Open province dropdown
  await page.click('.input-field:nth-child(1) .mdi-navigation-arrow-drop-down');

  // Wait until the dropdown is open
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

  const isProvinceAlreadyBeenSelected = await page.evaluate(function (provinceIndex) {
    const li = document.querySelector(`.input-field:nth-child(1) ul.dropdown-content li:nth-child(${provinceIndex + 1})`);
    if (!(li instanceof HTMLLIElement)) {
      return false;
    }
    return li.classList.contains('active');
  }, provinceIndex);

  // Get current regencies data to compare later
  const currentRegencies = await page.evaluate(function () {
    return Array.from(document.querySelectorAll('.input-field:nth-child(2) select option'))
      .map(function (option) {
        return option.textContent ?? '';
      })
      .join('');
  });

  // Select the province
  await page.click(`.input-field:nth-child(1) ul.dropdown-content li:nth-child(${provinceIndex + 1})`);

  await Promise.all([
    // Wait until the regency dropdown is updated
    page.waitForNetworkIdle(),

    // Make sure the province dropdown is closed
    page.waitForFunction(function () {
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
    }),
  ]);

  // Get the new regencies data
  const newRegencies = await page.evaluate(function () {
    return Array.from(document.querySelectorAll('.input-field:nth-child(2) select option'))
      .map(function (option) {
        return option.textContent ?? '';
      })
      .join('');
  });

  if (!isProvinceAlreadyBeenSelected) {
    if (currentRegencies === newRegencies) {
      // Retry the select process
      await selectProvince(page, provinceIndex);
    }
  }
}

/**
 * @param {Page} page
 * @param {number} regencyIndex
 */
async function selectRegency(page, regencyIndex) {
  // Open regency dropdown
  await page.click('.input-field:nth-child(2) .mdi-navigation-arrow-drop-down');

  // Wait until the dropdown is open
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

  // Select the regency
  await page.click(`.input-field:nth-child(2) ul.dropdown-content li:nth-child(${regencyIndex + 1})`);

  // Wait until the regency dropdown is closed
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
}

/**
 * @param {Page} page
 * @param {number} monthIndex
 */
async function selectMonth(page, monthIndex) {
  // Open month dropdown
  await page.click('.input-field:nth-child(3) .mdi-navigation-arrow-drop-down');

  // Wait until the dropdown is open
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

  // Select the month
  await page.click(`.input-field:nth-child(3) ul.dropdown-content li:nth-child(${monthIndex + 1})`);

  // Wait until the month dropdown is closed
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
}

/**
 * @typedef {Object} CapturedTime
 * @property {string} province
 * @property {string} regency
 * @property {number} month
 * @property {number} date
 * @property {string} name
 * @property {number} hour
 * @property {number} minute
 */

/**
 * @param {Page} page
 * @param {string} province
 * @param {string} regency
 * @param {number} monthIndex
 * @returns {Promise<Array<CapturedTime>>}
 */
async function captureTimes(page, province, regency, monthIndex) {
  await selectMonth(page, monthIndex);

  await loadJadwalShalat(page);

  const capturedTimes = await page.evaluate(function (province, regency, monthIndex) {
    const timeNames = ['imsak', 'subuh', 'terbit', 'duha', 'zuhur', 'asar', 'magrib', 'isya'];

    const scrappedSchedules = Array.from(document.querySelectorAll('div.jadwalshalat.card'))
      .map(function (div) {
        return {
          dateDisplay: div.querySelector('div.bold.margin-b-10')?.textContent,
          times: Array.from(div.querySelectorAll('.waktushalat span.waktu'))
            .map(function (span) {
              return span?.textContent;
            }),
        };
      });

    const capturedTimes = scrappedSchedules
      .map(function ({ dateDisplay, times }) {
        const [_, date] = dateDisplay.split(', ');
        const [dateStr, monthStr] = date.split('/');
        const dateInt = parseInt(dateStr, 10);
        const monthInt = parseInt(monthStr, 10);
        return times
          .map(function (time, index) {
            const [hour, minute] = time.split(':').map(function (time) {
              return parseInt(time, 10);
            });
            return {
              province,
              regency,
              month: monthInt,
              date: dateInt,
              name: timeNames[index],
              hour,
              minute,
            };
          });
      })
      .flat();

    const sortedCapturedTimes = capturedTimes.sort(function (a, z) {
      if (a.month === z.month) {
        return a.date - z.date;
      }
      return a.month - z.month;
    });

    return sortedCapturedTimes;
  }, province, regency, monthIndex);

  for (const capturedTime of capturedTimes) {
    if (capturedTime.month !== (monthIndex + 1)) {
      console.info('Month mismatch, recapturing...', province, regency, monthIndex, capturedTime);
      return await captureTimes(page, province, regency, monthIndex);
    }
  }

  return capturedTimes;
}

/**
 * @param {Page} page
 */
async function loadJadwalShalat(page) {
  await Promise.all([
    // Wait until progress indicator is shown
    // page.waitForFunction(function () {
    //   const progressIndicatorDiv = document.querySelector('.collapsible.collapsible-accordion .progress');
    //   if (!(progressIndicatorDiv instanceof HTMLDivElement)) {
    //     return false;
    //   }
    //   if (progressIndicatorDiv.style.display !== 'block') {
    //     return false;
    //   }
    //   return true;
    // }),

    // Execute the script to load the schedule
    page.evaluate(function () {
      // @ts-ignore
      click = true;
      // @ts-ignore
      loadjadwalshalat();
    }),
  ]);

  await Promise.all([
    page.waitForNetworkIdle(),

    // Wait until load indicator is hidden
    page.waitForFunction(function () {
      const progressIndicatorDiv = document.querySelector('.collapsible.collapsible-accordion .progress');
      if (!(progressIndicatorDiv instanceof HTMLDivElement)) {
        return false;
      }
      if (progressIndicatorDiv.style.display !== 'none') {
        return false;
      }
      return true;
    }),
  ]);
}
