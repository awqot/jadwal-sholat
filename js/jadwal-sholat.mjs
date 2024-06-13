// @ts-check

export class JadwalSholat {
  static get LABEL_IMSYA() { return 'Imsya'; };
  static get LABEL_SUBUH() { return 'Subuh'; };
  static get LABEL_TERBIT() { return 'Terbit'; };
  static get LABEL_DUHA() { return 'Duha'; };
  static get LABEL_DZUHUR() { return 'Dzuhur'; };
  static get LABEL_ASHAR() { return 'Ashar'; };
  static get LABEL_MAGRIB() { return 'Magrib'; };
  static get LABEL_ISYA() { return 'Isya'; };

  /** @type {string} */
  #cdn;

  /** @type {Date} */
  #date;

  /** @type {Array<string>} */
  #provinces;

  /** @type {Map<string, Map<string, number>>} */
  #provinceMap;

  /**
   * regencyIndex -> month -> date -> prayerTimeIndex -> minuteOfDay
   * @type {Map<number, Map<number, Map<number, Map<number, number>>>>}
   */
  #scheduleMap;

  /**
   * @param {string} cdn
   */
  constructor(cdn) {
    this.#cdn = cdn;
  }

  /**
   * @returns {Promise<Date>}
   */
  async getDataTimestamp() {
    await this.#ensureLoaded();

    return new Date(this.#date);
  }

  /**
   * @returns {Promise<Array<string>>}
   */
  async getProvinces() {
    await this.#ensureLoaded();

    return this.#provinces.slice();
  }

  /**
   * @param {string} provinceName
   * @returns {Promise<Array<String>>}
   */
  async getRegencies(provinceName) {
    await this.#ensureLoaded();

    const regencyMap = this.#provinceMap.get(provinceName);

    if (!(regencyMap instanceof Map)) {
      throw new Error(`Province "${provinceName}" not found`);
    }

    return Array.from(regencyMap.keys());
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   * @returns {Promise<Array<Schedule>>}
   */
  async getSchedules(provinceName, regencyName) {
    await this.#ensureLoaded();

    const regencyMap = this.#provinceMap.get(provinceName);

    if (!(regencyMap instanceof Map)) {
      throw new Error(`Province "${provinceName}" not found`);
    }

    const regencyIndex = regencyMap.get(regencyName);

    if (typeof regencyIndex !== 'number') {
      throw new Error(`Invalid regency index for "${regencyName}"`);
    }

    const monthMap = this.#scheduleMap.get(regencyIndex);

    if (!(monthMap instanceof Map)) {
      throw new Error(`Invalid month map for regency index ${regencyIndex}`);
    }

    /** @type {Array<Schedule>} */
    const schedules = [];

    const months = Array.from(monthMap.keys());

    for (const month of months) {
      const dateMap = monthMap.get(month);

      if (!(dateMap instanceof Map)) {
        throw new Error(`Invalid date map for month ${month}`);
      }

      const dates = Array.from(dateMap.keys());

      for (const date of dates) {
        const timeMap = dateMap.get(date);

        if (!(timeMap instanceof Map)) {
          throw new Error(`Invalid time map for date ${date}`);
        }

        const times = Array.from(timeMap.entries())
          .map(function ([prayerTimeIndex, minuteOfDay]) {
            let label;
            switch (prayerTimeIndex) {
              case 1:
                label = JadwalSholat.LABEL_SUBUH;
                break;
              case 2:
                label = JadwalSholat.LABEL_TERBIT;
                break;
              case 3:
                label = JadwalSholat.LABEL_DUHA;
                break;
              case 4:
                label = JadwalSholat.LABEL_DZUHUR;
                break;
              case 5:
                label = JadwalSholat.LABEL_ASHAR;
                break;
              case 6:
                label = JadwalSholat.LABEL_MAGRIB;
                break;
              case 7:
                label = JadwalSholat.LABEL_ISYA;
                break;
              default:
                throw new Error(`Invalid prayer time index ${prayerTimeIndex}`);
            }

            const hour = Math.floor(minuteOfDay / 60);
            const minute = minuteOfDay % 60;

            return {
              label,
              hour,
              minute,
            };
          });

        schedules.push({
          month,
          date,
          times,
        });
      }
    }

    return schedules;
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   * @param {number} month
   * @param {number} date
   * @returns {Promise<Array<Time>>}
   */
  async getTimes(provinceName, regencyName, month, date) {
    await this.#ensureLoaded();

    const schedules = await this.getSchedules(provinceName, regencyName);

    const schedule = schedules.find(function (schedule) {
      return schedule.month === month && schedule.date === date;
    });

    if (typeof schedule === 'undefined') {
      throw new Error(`Schedule not found for ${month}-${date}`);
    }

    return schedule.times;
  }

  get #metadataUrl() {
    return `${this.#cdn}/data/jadwal-sholat.metadata.gz`;
  }

  get #dataUrl() {
    return `${this.#cdn}/data/jadwal-sholat.bin.gz`;
  }

  async #ensureLoaded() {
    await Promise.all([
      this.#ensureMetadataLoaded(),
      this.#ensureDataLoaded(),
    ]);
  }

  async #ensureMetadataLoaded() {
    if (this.#date instanceof Date) {
      return;
    }

    const metadataBuffer = await this.#fetchGz(this.#metadataUrl);

    const textDecoder = new TextDecoder();
    const metadata = textDecoder.decode(metadataBuffer);

    const [timestampStr, ...provinceRows] = metadata.split('\n');

    const timestamp = parseInt(timestampStr, 10);
    const date = new Date(timestamp);

    /** @type {Array<string>} */
    const provinces = [];

    /** @type {Map<string, Map<string, number>>} */
    const provinceMap = new Map();

    let regencyIndex = 0;


    for (const [provinceIndex, provinceRow] of provinceRows.entries()) {
      const [provinceName, regencyCols] = provinceRow.split(':');

      provinces.push(provinceName);

      /** @type {Map<string, number>} */
      const regencyMap = new Map();

      const regencyNames = regencyCols
        .split('\t')
        .map(function (regencyName) {
          return regencyName.trim();
        })
        .filter(function (regencyName) {
          return regencyName.length > 0;
        });

      for (const regencyName of regencyNames) {
        regencyMap.set(regencyName, regencyIndex);
        regencyIndex++;
      }

      provinceMap.set(provinceName, regencyMap);
    }

    this.#date = date;
    this.#provinces = provinces;
    this.#provinceMap = provinceMap;
  }

  async #ensureDataLoaded() {
    if (this.#scheduleMap instanceof Map) {
      return;
    }

    const beginTime = Date.now();

    const textDecoder = new TextDecoder();

    const dataBuffer = await this.#fetchGz(this.#dataUrl);
    const dataView = new DataView(dataBuffer);

    let offset = 0;

    const magicBytes = dataView.buffer.slice(0, 8);
    offset += 8;

    const magicText = textDecoder.decode(magicBytes);

    if (magicText !== 'AWQTSHLT') {
      throw new Error('Invalid magic bytes');
    }

    const version = dataView.getUint16(offset, false);
    offset += 2;

    if (version !== 1) {
      throw new Error('Invalid version');
    }

    const timestamp = dataView.getBigUint64(offset, false);
    offset += 8;

    const numOfRegencies = dataView.getUint16(offset, false);
    offset += 2;

    const numOfTimeDiffGroups = dataView.getUint16(offset, false);
    offset += 2;

    const numOfTimeDiffsInGroup = dataView.getUint8(offset);
    offset += 1;

    const numOfPrayerTimes = dataView.getInt8(offset);
    offset += 1;

    console.log({
      magicBytes,
      timestamp,
      numOfRegencies,
      numOfTimeDiffGroups,
      numOfTimeDiffsInGroup,
      numOfPrayerTimes,
    });

    /** @type {Map<number, Map<number, Map<number, Map<number, number>>>>} */
    const scheduleMap = new Map();

    for (let regencyIndex = 0; regencyIndex < numOfRegencies; regencyIndex++) {

      for (let prayerTimeIndex = 0; prayerTimeIndex < numOfPrayerTimes; prayerTimeIndex++) {
        const baseDate = new Date(Number(timestamp));
        baseDate.setMonth(0);
        baseDate.setDate(0);
        baseDate.setHours(0);
        baseDate.setMinutes(0);
        baseDate.setSeconds(0);
        baseDate.setMilliseconds(0);

        const baseMinute = dataView.getUint16(offset, false);
        offset += 2;

        let dateStep = new Date(baseDate);

        let minuteStep = baseMinute;
        for (let timeDiffGroupIndex = 0; timeDiffGroupIndex < numOfTimeDiffGroups; timeDiffGroupIndex++) {
          const timeDiffGroup = dataView.getUint8(offset);
          offset += 1;

          const first = (timeDiffGroup >> 6) & 0b11;
          const second = (timeDiffGroup >> 4) & 0b11;
          const third = (timeDiffGroup >> 2) & 0b11;
          const fourth = (timeDiffGroup >> 0) & 0b11;

          const timeDiffs = [first, second, third, fourth];

          const adjustedTimeDiffs = timeDiffs.map(function (timeDiff) {
            return timeDiff - 2;
          });

          for (const timeDiff of adjustedTimeDiffs) {
            dateStep.setDate(dateStep.getDate() + 1);

            const date = new Date(dateStep);

            minuteStep += timeDiff;

            const month = date.getMonth();
            const dateOfMonth = date.getDate();
            const minuteOfDay = minuteStep;

            if (!scheduleMap.has(regencyIndex)) {
              scheduleMap.set(regencyIndex, new Map());
            }

            const regencyMap = scheduleMap.get(regencyIndex);

            if (!(regencyMap instanceof Map)) {
              throw new Error('Invalid regency map');
            }

            if (!regencyMap.has(month)) {
              regencyMap.set(month, new Map());
            }

            const monthMap = regencyMap.get(month);

            if (!(monthMap instanceof Map)) {
              throw new Error('Invalid month map');
            }

            if (!monthMap.has(dateOfMonth)) {
              monthMap.set(dateOfMonth, new Map());
            }

            const dateMap = monthMap.get(dateOfMonth);

            if (!(dateMap instanceof Map)) {
              throw new Error('Invalid date map');
            }

            if (!dateMap.has(prayerTimeIndex)) {
              dateMap.set(prayerTimeIndex, minuteOfDay);
            }

            console.log({
              regencyIndex,
              month,
              date: dateOfMonth,
              prayerTimeIndex,
              minuteOfDay,
            });

            throw new Error('Stop');
          }
        }
      }
    }

    const endTime = Date.now();

    console.log(`Data loaded in ${endTime - beginTime} ms`);

    this.#scheduleMap = scheduleMap;
  }

  /**
   * @param {string} url
   * @returns {Promise<ArrayBuffer>}
   */
  async #fetchGz(url) {
    const resp = await fetch(url);
    const respBodyBlob = await resp.blob();
    const respBodyStream = respBodyBlob.stream();

    const ds = new DecompressionStream('gzip');
    const decompressedStream = respBodyStream.pipeThrough(ds);

    const dsResponse = new Response(decompressedStream);
    const respBodyBuffer = await dsResponse.arrayBuffer();

    return respBodyBuffer;
  }
}

/**
 * @typedef {object} Regency
 * @property {number} index
 * @property {string} name
 */

/**
 * @typedef {object} Schedule
 * @property {number} month
 * @property {number} date
 * @property {Array<Time>} times
 */

/**
 * @typedef {object} Time
 * @property {string} label
 * @property {number} hour
 * @property {number} minute
 */
