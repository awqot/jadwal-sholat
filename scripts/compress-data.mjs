// @ts-check

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

async function main() {
  const files = [
    join(__dirname, '../data/jadwal-sholat.bin'),
    join(__dirname, '../data/jadwal-sholat.json'),
    join(__dirname, '../data/jadwal-sholat.metadata'),
  ];
  
  for (const file of files) {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    const fileBuffer = await readFile(file);
    await writer.write(fileBuffer);
    await writer.close();
    const csReadable = cs.readable;
    const csReadableResp = new Response(csReadable);
    const compressedBuffer = await csReadableResp.arrayBuffer();
    await writeFile(`${file}.gz`, Buffer.from(compressedBuffer));
  }
}

main();
