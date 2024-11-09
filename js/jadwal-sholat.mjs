// @ts-check

const versionOffset = 0
  + 8 // magic word
  ;

const timestampOffset = versionOffset
  + 2 // version
  ;

const numOfProvincesOffset = timestampOffset
  + 8 // timestamp
  ;

const numOfRegenciesOffset = numOfProvincesOffset
  + 1 // number of provinces
  ;

const numOfSchedulesOffset = numOfRegenciesOffset
  + 2 // number of regencies
  ;

const provinceNamesOffsetOffset = numOfSchedulesOffset
  + 2 // number of schedules
  ;

const provinceNamesIndicesOffset = provinceNamesOffsetOffset
  + 8 // province names offset
  ;

const scheduleSize = 0
  + 1 // month as u8
  + 1 // date as u8
  + 1 // hour as u8
  + 1 // minute as u8
  ;

export class JadwalSholat {
  static get LABEL_IMSYA() { return 'Imsya'; };
  static get LABEL_SUBUH() { return 'Subuh'; };
  static get LABEL_TERBIT() { return 'Terbit'; };
  static get LABEL_DUHA() { return 'Duha'; };
  static get LABEL_DZUHUR() { return 'Dzuhur'; };
  static get LABEL_ASHAR() { return 'Ashar'; };
  static get LABEL_MAGRIB() { return 'Magrib'; };
  static get LABEL_ISYA() { return 'Isya'; };
  static get LABELS() {
    return [
      JadwalSholat.LABEL_IMSYA,
      JadwalSholat.LABEL_SUBUH,
      JadwalSholat.LABEL_TERBIT,
      JadwalSholat.LABEL_DUHA,
      JadwalSholat.LABEL_DZUHUR,
      JadwalSholat.LABEL_ASHAR,
      JadwalSholat.LABEL_MAGRIB,
      JadwalSholat.LABEL_ISYA,
    ];
  };

  #cdn = /** @type {string} */ ('');

  #data = /** @type {Uint8Array} */ (new Uint8Array([]));
  #view = /** @type {DataView} */ (new DataView(this.#data.buffer));
  #dataTimestamp = /** @type {Date} */ (new Date());

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
    await this.#ensureDataLoaded();

    return new Date(this.#dataTimestamp);
  }

  /**
   * @returns {Promise<Array<string>>}
   */
  async getProvinces() {
    await this.#ensureDataLoaded();

    const numOfProvinces = this.#data[numOfProvincesOffset];

    const provinceNamesIndicesU8a = this.#data.slice(
      provinceNamesIndicesOffset,
      provinceNamesIndicesOffset + (numOfProvinces * 2),
    );
    const provinceNameIndicesView = new DataView(provinceNamesIndicesU8a.buffer);

    const provinceNamesOffset = Number(this.#view.getBigUint64(provinceNamesOffsetOffset, true));

    const provinces = [];
    const textDecoder = new TextDecoder();
    for (let index = 0; index < numOfProvinces; index++) {
      const indexOffset = index * 2;
      const provinceNameIndexOffset = provinceNameIndicesView.getUint16(indexOffset, true);
      const provinceNameLengthOffset = provinceNamesOffset + provinceNameIndexOffset;
      const provinceNameLength = this.#data[provinceNameLengthOffset];
      const provinceNameOffset = provinceNameLengthOffset
        + 1 // length of the name as u8
        ;
      const provinceNameU8a = this.#data.slice(
        provinceNameOffset,
        provinceNameOffset + provinceNameLength,
      );
      const provinceName = textDecoder.decode(provinceNameU8a);
      provinces.push(provinceName);
    }

    return provinces;
  }

  /**
   * @param {string} provinceName
   * @returns {Promise<Array<String>>}
   */
  async getRegencies(provinceName) {
    await this.#ensureDataLoaded();

    const numOfProvinces = this.#data[numOfProvincesOffset];

    const provinceNamesIndicesU8a = this.#data.slice(
      provinceNamesIndicesOffset,
      provinceNamesIndicesOffset + (numOfProvinces * 2),
    );
    const provinceNameIndicesView = new DataView(provinceNamesIndicesU8a.buffer);

    const provinceNamesOffset = Number(this.#view.getBigUint64(provinceNamesOffsetOffset, true));

    const textDecoder = new TextDecoder();
    for (let provinceIndex = 0; provinceIndex < numOfProvinces; provinceIndex++) {
      const provinceIndexOffset = provinceIndex * 2;
      const provinceNameIndexOffset = provinceNameIndicesView.getUint16(provinceIndexOffset, true);
      const provinceNameLengthOffset = provinceNamesOffset + provinceNameIndexOffset;
      const provinceNameLength = this.#data[provinceNameLengthOffset];
      const provinceNameOffset = provinceNameLengthOffset
        + 1 // length of the name as u8
        ;
      const provinceNameU8a = this.#data.slice(
        provinceNameOffset,
        provinceNameOffset + provinceNameLength,
      );
      const decodedProvinceName = textDecoder.decode(provinceNameU8a);

      if (decodedProvinceName === provinceName) {
        const numOfRegenciesOffset = provinceNameOffset + provinceNameLength;
        const numOfRegencies = this.#data[numOfRegenciesOffset];

        const regencies = [];
        let regenciesOffset = numOfRegenciesOffset
          + 1 // number of regencies as u8
          ;
        for (let regencyIndex = 0; regencyIndex < numOfRegencies; regencyIndex++) {
          const regencyNameLength = this.#data[regenciesOffset];
          regenciesOffset += 1;
          const regencyNameU8a = this.#data.slice(
            regenciesOffset,
            regenciesOffset + regencyNameLength,
          );
          regenciesOffset += regencyNameLength;
          const regencyName = textDecoder.decode(regencyNameU8a);
          regencies.push(regencyName);
        }

        return regencies;
      }

    }

    return [];
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   * @returns {Promise<Array<Schedule>>}
   */
  async getSchedules(provinceName, regencyName) {
    await this.#ensureDataLoaded();

    const regencySchedulesIndex = this.#getRegencySchedulesIndex(provinceName, regencyName);

    if (regencySchedulesIndex === undefined) {
      throw new Error(`Regency ${regencyName} in province ${provinceName} not found.`);
    }

    const { provinceIndex, regencyIndex } = regencySchedulesIndex;

    const numOfProvinces = this.#data[numOfProvincesOffset];
    const numOfSchedules = this.#view.getUint16(numOfSchedulesOffset, true);
    const schedulesIndicesOffset = provinceNamesIndicesOffset
      + (numOfProvinces * 2) // province names indices
      ;

    const provinceRegencyIndexOffset = schedulesIndicesOffset
      + (provinceIndex * 2)
      ;
    const provinceRegencyIndex = this.#view.getUint16(provinceRegencyIndexOffset, true);
    const regencyScheduleIndex = provinceRegencyIndex + regencyIndex;

    const regencyScheduleSize = numOfSchedules * scheduleSize;
    const schedulesOffset = schedulesIndicesOffset
      + (numOfProvinces * 2) // province schedule indices
      ;
    const regencySceduleOffset = schedulesOffset
      + (regencyScheduleIndex * regencyScheduleSize) // previous regencies
      ;

    /** @type {Array<Schedule>} */
    const schedules = [];
    for (let scheduleIndex = 0; scheduleIndex < numOfSchedules; scheduleIndex++) {
      const scheduleOffset = regencySceduleOffset
        + (scheduleIndex * scheduleSize)
        ;
      const month = this.#data[scheduleOffset];
      const date = this.#data[scheduleOffset + 1];
      const hour = this.#data[scheduleOffset + 2];
      const minute = this.#data[scheduleOffset + 3];
      let schedule = schedules[schedules.length - 1];
      if (schedule === undefined || schedule.month !== month || schedule.date !== date) {
        schedule = {
          month: month,
          date: date,
          times: [],
        };
        schedules.push(schedule);
      }
      schedule.times.push({
        label: JadwalSholat.LABELS[schedule.times.length],
        hour,
        minute,
      });
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
    await this.#ensureDataLoaded();

    const regencySchedulesIndex = this.#getRegencySchedulesIndex(provinceName, regencyName);

    if (regencySchedulesIndex === undefined) {
      throw new Error(`Regency ${regencyName} in province ${provinceName} not found.`);
    }

    const { provinceIndex, regencyIndex } = regencySchedulesIndex;

    const numOfProvinces = this.#data[numOfProvincesOffset];
    const numOfSchedules = this.#view.getUint16(numOfSchedulesOffset, true);
    const schedulesIndicesOffset = provinceNamesIndicesOffset
      + (numOfProvinces * 2) // province names indices
      ;

    const provinceRegencyIndexOffset = schedulesIndicesOffset
      + (provinceIndex * 2)
      ;
    const provinceRegencyIndex = this.#view.getUint16(provinceRegencyIndexOffset, true);
    const regencyScheduleIndex = provinceRegencyIndex + regencyIndex;

    const regencyScheduleSize = numOfSchedules * scheduleSize;
    const schedulesOffset = schedulesIndicesOffset
      + (numOfProvinces * 2) // province schedule indices
      ;
    const regencySceduleOffset = schedulesOffset
      + (regencyScheduleIndex * regencyScheduleSize) // previous regencies
      ;

    /** @type {Array<Time>} */
    const times = [];
    for (let scheduleIndex = 0; scheduleIndex < numOfSchedules; scheduleIndex++) {
      const scheduleOffset = regencySceduleOffset
        + (scheduleIndex * scheduleSize)
        ;
      const scheduleMonth = this.#data[scheduleOffset];
      const scheduleDate = this.#data[scheduleOffset + 1];
      const hour = this.#data[scheduleOffset + 2];
      const minute = this.#data[scheduleOffset + 3];
      if (scheduleMonth === month && scheduleDate === date) {
        times.push({
          label: JadwalSholat.LABELS[times.length],
          hour,
          minute,
        });
      }
      if (times.length === JadwalSholat.LABELS.length) {
        break;
      }
    }

    return times;
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   * @returns {{ provinceIndex: number, regencyIndex: number }|undefined}
   */
  #getRegencySchedulesIndex(provinceName, regencyName) {
    const numOfProvinces = this.#data[numOfProvincesOffset];

    const provinceNamesIndicesU8a = this.#data.slice(
      provinceNamesIndicesOffset,
      provinceNamesIndicesOffset + (numOfProvinces * 2),
    );
    const provinceNameIndicesView = new DataView(provinceNamesIndicesU8a.buffer);

    const provinceNamesOffset = Number(this.#view.getBigUint64(provinceNamesOffsetOffset, true));

    const textDecoder = new TextDecoder();
    for (let provinceIndex = 0; provinceIndex < numOfProvinces; provinceIndex++) {
      const provinceIndexOffset = provinceIndex * 2;
      const provinceNameIndexOffset = provinceNameIndicesView.getUint16(provinceIndexOffset, true);
      const provinceNameLengthOffset = provinceNamesOffset + provinceNameIndexOffset;
      const provinceNameLength = this.#data[provinceNameLengthOffset];
      const provinceNameOffset = provinceNameLengthOffset
        + 1 // length of the name as u8
        ;
      const provinceNameU8a = this.#data.slice(
        provinceNameOffset,
        provinceNameOffset + provinceNameLength,
      );
      const decodedProvinceName = textDecoder.decode(provinceNameU8a);
      if (decodedProvinceName === provinceName) {
        const numOfRegenciesOffset = provinceNameOffset + provinceNameLength;
        const numOfRegencies = this.#data[numOfRegenciesOffset];
        let regenciesOffset = numOfRegenciesOffset
          + 1 // number of regencies as u8
          ;
        for (let regencyIndex = 0; regencyIndex < numOfRegencies; regencyIndex++) {
          const regencyNameLength = this.#data[regenciesOffset];
          regenciesOffset += 1;
          const regencyNameU8a = this.#data.slice(
            regenciesOffset,
            regenciesOffset + regencyNameLength,
          );
          regenciesOffset += regencyNameLength;
          const decodedRegencyName = textDecoder.decode(regencyNameU8a);
          if (decodedRegencyName === regencyName) {
            return {
              provinceIndex: provinceIndex,
              regencyIndex: regencyIndex,
            };
          }
        }
      }
    }
  }

  get #dataUrl() {
    return `${this.#cdn}/data/jadwal-sholat.ajs`;
  }

  async #ensureDataLoaded() {
    if (this.#data.byteLength === 0) {
      console.info(`Fetching data from ${this.#dataUrl}`);
      const resp = await fetch(this.#dataUrl);
      const respBodyBuffer = await resp.arrayBuffer();
      const respBodyU8a = new Uint8Array(respBodyBuffer);
      this.#data = respBodyU8a;
      this.#view = new DataView(this.#data.buffer);
      const timestamp = Number(this.#view.getBigUint64(timestampOffset, true));
      this.#dataTimestamp = new Date(timestamp);
    }

    const magicWord = [65, 87, 81, 84, 83, 72, 76, 84]; // AWQTSHLT
    for (let index = 0; index < magicWord.length; index++) {
      if (this.#data[index] !== magicWord[index]) {
        throw new Error(`Invalid magic word data. Expected: ${magicWord.join(', ')}. Actual: ${Array.from(this.#data.subarray(0, magicWord.length)).join(', ')}.`);
      }
    }

    const suportedVersions = [1];
    const version = this.#view.getUint16(versionOffset, true);
    if (!suportedVersions.includes(version)) {
      throw new Error(`Unsupported version: ${version}. Supported versions: ${suportedVersions.join(', ')}.`);
    }
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
