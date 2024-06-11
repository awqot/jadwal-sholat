// @ts-check

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const __dirname = new URL('.', import.meta.url).pathname;

process.on('uncaughtException', function (error) {
  console.error('Uncaught exception', error);
});

process.on('uncaughtExceptionMonitor', function (error) {
  console.error('Uncaught exception monitor', error);
});

process.on('unhandledRejection', function (reason, promise) {
  console.error('Unhandled rejection', reason, promise);
});

async function main() {
  const compressedFilePaths = [
    join(__dirname, '../data/jadwal-sholat.bin.gz'),
    join(__dirname, '../data/jadwal-sholat.json.gz'),
    join(__dirname, '../data/jadwal-sholat.metadata.gz'),
  ];

  console.info('Extracting data...');

  for (const compressedFilePath of compressedFilePaths) {
    try {
      console.info(`Extracting ${compressedFilePath}...`);

      console.info(`Reading ${compressedFilePath}...`);
      const compressedBuffer = await readFile(compressedFilePath, { encoding: undefined });

      console.debug(`Compressed buffer length: ${compressedBuffer.length}`);

      const ds = new DecompressionStream('gzip');

      console.debug('Creating writable stream...');

      const writer = ds.writable.getWriter();

      console.info(`Writing ${compressedFilePath}...`);
      await writer.write(compressedBuffer);

      console.debug('Closing writable stream...');

      await writer.close();

      console.debug('Reading decompressed stream...');

      const dsReadable = ds.readable;
      const dsReadableResp = new Response(dsReadable);

      console.info(`Decompressing ${compressedFilePath}...`);
      const decompressedBuffer = await dsReadableResp.arrayBuffer();
      const decompressedFilePath = compressedFilePath.replace(/\.gz$/, '');

      console.info(`Writing ${decompressedFilePath}...`);
      await writeFile(decompressedFilePath, Buffer.from(decompressedBuffer));

      console.info(`Done extracting ${compressedFilePath}.`);
    }
    catch (error) {
      console.error(`Failed to extract ${compressedFilePath}: ${error.message}`, {
        cause: error,
      });
    }
  }

  console.info('Done.');
}

main().catch(function (error) {
  console.error('Unhandled', error);
});
