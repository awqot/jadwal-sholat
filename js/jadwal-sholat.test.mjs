// @ts-check

import { access, constants, readFile } from 'node:fs/promises';
import { Server, createServer } from 'node:http';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { URL } from 'node:url';

import { JadwalSholat } from './jadwal-sholat.mjs';
import assert from 'node:assert';

/** @typedef {import('../js/jadwal-sholat.mjs').Schedule} Schedule */

const __dirname = new URL('.', import.meta.url).pathname;

describe('JadwalSholat', function () {
  /** @type {Server} */
  let server;

  /** @type {JadwalSholat} */
  let jadwalSholat;

  before(async function () {
    server = await serveWorkingDir();
    const serverUrl = getUrlFromServer(server);
    jadwalSholat = new JadwalSholat(serverUrl);
  });

  after(function () {
    if (server instanceof Server) {
      server.close();
    }
  });

  it('getDataTimestamp', async function () {
    const timestamp = await jadwalSholat.getDataTimestamp();
    assert.ok(timestamp instanceof Date, 'timestamp is not a Date');
  });

  it('getProvinces', async function () {
    const provinces = await jadwalSholat.getProvinces();
    assert.ok(Array.isArray(provinces), 'provinces is not an array');
    assert.ok(provinces.every(province => typeof province === 'string'), 'provinces is not an array of string');
    assert.equal(provinces.length, 34, 'num of provinces is not 34');
    assert.equal(provinces[0], 'ACEH', 'provinces[0] is not ACEH');
    assert.equal(provinces[20], 'KALIMANTAN SELATAN', 'provinces[20] is not KALIMANTAN SELATAN');
    assert.equal(provinces[33], 'PAPUA BARAT', 'provinces[33] is not PAPUA BARAT');
    const startTime = performance.now();
    for (let index = 0; index < 4000; index++) {
      await jadwalSholat.getProvinces();
    }
    const endTime = performance.now();
    assert.ok((endTime - startTime) < 100, 'getProvinces takes more than 0.3ms');
  });

  it('getRegencies', async function () {
    const regencies = await jadwalSholat.getRegencies('ACEH');
    assert.ok(Array.isArray(regencies), 'regencies is not an array');
    assert.ok(regencies.every(regency => typeof regency === 'string'), 'regencies is not an array of string');
    assert.equal(regencies.length, 23, 'num of regencies is not 23');
    assert.equal(regencies[0], 'KAB. ACEH BARAT', 'regencies[0] is not KAB. ACEH BARAT');
    assert.equal(regencies[10], 'KAB. ACEH UTARA', 'regencies[10] is not KAB. ACEH UTARA');
    assert.equal(regencies[22], 'KOTA SUBULUSSALAM', 'regencies[22] is not KOTA SUBULUSSALAM');
    const startTime = performance.now();
    for (let index = 0; index < 300; index++) {
      await jadwalSholat.getRegencies('ACEH');
    }
    const endTime = performance.now();
    assert.ok((endTime - startTime) < 100, 'getRegencies takes more than 0.3ms');
  });

  it('getSchedules', async function () {
    const schedules = await jadwalSholat.getSchedules('DKI JAKARTA', 'KOTA JAKARTA');
    assert.ok(Array.isArray(schedules), 'schedules is not an array');
    assert.ok(schedules.every(schedule => typeof schedule === 'object'), 'schedules is not an array of object');
    assert.equal(schedules.length, 366, 'num of schedules is not 366');
    assert.ok(schedules.every(schedule => typeof schedule.date === 'number'), 'date is not a number');
    assert.ok(schedules.every(schedule => typeof schedule.month === 'number'), 'month is not a number');
    assert.ok(schedules.every(schedule => Array.isArray(schedule.times) && schedule.times.length === 8), 'times is not an array and length is not 8');
    const startTime = performance.now();
    for (let index = 0; index < 100; index++) {
      await jadwalSholat.getSchedules('DKI JAKARTA', 'KOTA JAKARTA');
    }
    const endTime = performance.now();
    assert.ok((endTime - startTime) < 100, 'getSchedules takes more than 1ms');
  });

  it('getTimes', async function () {
    const times = await jadwalSholat.getTimes('DKI JAKARTA', 'KOTA JAKARTA', 2, 29);
    assert.ok(Array.isArray(times), 'times is not an array');
    assert.equal(times.length, 8, 'num of times is not 8');
    assert.ok(times.every(time => typeof time === 'object'), 'times is not an array of object');
    assert.ok(times.every(time => typeof time.label === 'string'), 'label is not a string');
    assert.ok(times.every(time => typeof time.hour === 'number'), 'time is not a number');
    assert.ok(times.every(time => typeof time.minute === 'number'), 'minute is not a number');
    const startTime = performance.now();
    for (let index = 0; index < 100; index++) {
      await jadwalSholat.getTimes('DKI JAKARTA', 'KOTA JAKARTA', 2, 29);
    }
    const endTime = performance.now();
    assert.ok((endTime - startTime) < 100, 'getTimes takes more than 1ms');
  });

});

/**
 * @returns {Promise<Server>} http server url
 */
function serveWorkingDir() {
  return new Promise(function (resolve, reject) {
    const workingDir = join(__dirname, '..');
    const server = createServer(async function (req, res) {
      try {
        const filePath = join(workingDir, req.url ?? '');
        await access(filePath, constants.R_OK);
        const fileBuffer = await readFile(filePath, { encoding: undefined });
        res.statusCode = 200;
        res.write(fileBuffer);
        res.end();
      }
      catch (error) {
        res.statusCode = 404;
        res.end();
      }
    });
    server.listen(0, 'localhost');
    server.on('listening', function () {
      resolve(server);
    });
    server.on('error', function (error) {
      reject(error);
    });
  });
}

/**
 * @param {Server} server
 * @returns {string}
 */
function getUrlFromServer(server) {
  const address = server.address();
  if (typeof address === 'string') {
    return address;
  }
  else if (typeof address === 'object') {
    const host = address?.address;
    const port = address?.port;
    const family = address?.family;
    if (family === 'IPv6' && typeof host === 'string' && typeof port === 'number') {
      return `http://[${host}]:${port}`;
    }
    else if (typeof host === 'string' && typeof port === 'number') {
      return `http://${host}:${port}`;
    }
    else {
      throw new Error(`Invalid address: ${host} ${port}`);
    }
  }
  else {
    throw new Error(`Invalid address: ${address}`);
  }
}
