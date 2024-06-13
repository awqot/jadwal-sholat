// @ts-check

import { access, constants, readFile } from 'node:fs/promises';
import { Server, createServer } from 'node:http';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { JadwalSholat } from './jadwal-sholat.mjs';
import { URL } from 'node:url';

/** @typedef {import('../js/jadwal-sholat.mjs').Schedule} Schedule */

const __dirname = new URL('.', import.meta.url).pathname;

describe('JadwalSholat', function () {
  /** @type {Server} */
  let server;

  before(async function () {
    server = await serveWorkingDir();
  });

  after(function () {
    if (server instanceof Server) {
      server.close();
    }
  });

  it('getDataTimestamp', async function () {
    const serverUrl = getUrlFromServer(server);

    const jadwalSholat = new JadwalSholat(serverUrl);

    const timestamp = await jadwalSholat.getDataTimestamp();

    console.log(timestamp);
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
        const url = new URL(req.url ?? '');
        const filePath = join(workingDir, url.pathname);
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
    if (typeof host === 'string' && typeof port === 'number') {
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
