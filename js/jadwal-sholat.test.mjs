// @ts-check

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

/** @typedef {import('../js/jadwal-sholat.mjs').Schedule} Schedule */

const __dirname = new URL('.', import.meta.url).pathname;

test('jadwal-sholat', async function () {
  await prepareFixtures();
});

async function prepareFixtures() {
  const jadwalSholatJsonGzPath = join(__dirname, '../data/jadwal-sholat.json.gz');
  const jadwalSholatJsonPath = join(__dirname, '../data/jadwal-sholat.json');

  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();

  await writer.write(await readFile(jadwalSholatJsonGzPath));
  await writer.close();

  const dsReadable = ds.readable;
  const dsReadableResp = new Response(dsReadable);
  const decompressedBuffer = await dsReadableResp.arrayBuffer();

  await writeFile(jadwalSholatJsonPath, Buffer.from(decompressedBuffer));

  const textDecoder = new TextDecoder();

  /** @type {{ schedules: Array<Schedule> }} */
  const jadwalSholat = JSON.parse(textDecoder.decode(decompressedBuffer));

  console.log(jadwalSholat.schedules.length)
}
