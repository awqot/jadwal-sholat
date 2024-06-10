// @ts-check

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

async function main() {
  const compressedFilePaths = [
    join(__dirname, '../data/jadwal-sholat.bin.gz'),
    join(__dirname, '../data/jadwal-sholat.json.gz'),
    join(__dirname, '../data/jadwal-sholat.metadata.gz'),
  ];
  
  for (const compressedFilePath of compressedFilePaths) {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    const compressedBuffer = await readFile(compressedFilePath, { encoding: undefined });
    await writer.write(compressedBuffer);
    await writer.close();
    const dsReadable = ds.readable;
    const dsReadableResp = new Response(dsReadable);
    const decompressedBuffer = await dsReadableResp.arrayBuffer();
    const decompressedFilePath = compressedFilePath.replace(/\.gz$/, '');
    await writeFile(decompressedFilePath, Buffer.from(decompressedBuffer));
  }
}

main();
