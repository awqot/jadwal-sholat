// @ts-check

export class JadwalSholat {
  /** @type {Metadata} */
  #metadata;
  /** @type {Uint16Array} */
  #buffer;

  /**
   * @param {string} cdn
   */
  constructor(cdn) {
    this.cdn = cdn;
  }

  #isDataLoaded = false;
  async #ensureDataLoaded() {
    if (this.#isDataLoaded) return;
    const [binResp, metaResp] = await Promise.all([
      fetch(`${this.cdn}/data/jadwal-sholat.bin`),
      fetch(`${this.cdn}/data/jadwal-sholat.metadata`),
    ]);
    this.#buffer = new Uint16Array(await binResp.arrayBuffer());
    this.#metadata = this.#parseMetadata(await metaResp.text());
    this.#isDataLoaded = true;
  }

  async getProvinces() {
    await this.#ensureDataLoaded();
    return this.#metadata.provinces;
  }

  /**
   * @param {string} provinceName
   */
  async getRegencies(provinceName) {
    await this.#ensureDataLoaded();
    return this.#metadata.provinces
      .find((province) => province.name === provinceName)
      ?.regencies
      .map((regency) => regency.name);
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   */
  async getSchedules(provinceName, regencyName) {
    await this.#ensureDataLoaded();

    const provinceIndex = this.#metadata.provinces
      .findIndex((province) => province.name === provinceName);

    if (provinceIndex === -1) {
      throw new Error('Province not found');
    }

    const regencyIndex = this.#metadata.provinces[provinceIndex].regencies
      .findIndex((regency) => regency.name === regencyName);

    if (regencyIndex === -1) {
      throw new Error('Regency not found');
    }

    const location = this.#join8bitTo16bit(provinceIndex, regencyIndex);
    const locationGroupsLength = this.#buffer.length / 2556;

    /** @type {Uint16Array|undefined} */
    let locationBuffer = undefined;
    for (let index = 0; index < locationGroupsLength; index++) {
      const beginReadAt = index * 2556;
      if (this.#buffer.at(beginReadAt) === location) {
        locationBuffer = this.#buffer.slice(
          beginReadAt + 1, /** remove location data */
          beginReadAt + 2556,
        );
        break;
      }
    }

    if (locationBuffer === undefined) {
      throw new Error('Schedule not found');
    }

    const dateMonthsLength = locationBuffer.length / 7;
    const times = [];

    for (let index = 0; index < dateMonthsLength; index++) {
      const beginReadAt = index * 7;
      const dateMonth = locationBuffer.at(beginReadAt) ?? 0;
      const dateMonthBuffer = Array.from(locationBuffer.slice(
        beginReadAt + 1, /** remove date month data */
        beginReadAt + 7,
      ));
      const [date, month] = this.#split16bitTo8bit(dateMonth);
      const pairOfHourAndMinute = this.#decompactTimesBinary(Array.from(dateMonthBuffer));
      times.push({
        date,
        month,
        times: [
          { label: 'Imsya', hour: pairOfHourAndMinute[0], minute: pairOfHourAndMinute[1] },
          { label: 'Subuh', hour: pairOfHourAndMinute[2], minute: pairOfHourAndMinute[3] },
          { label: 'Terbit', hour: pairOfHourAndMinute[4], minute: pairOfHourAndMinute[5] },
          { label: 'Duha', hour: pairOfHourAndMinute[6], minute: pairOfHourAndMinute[7] },
          { label: 'Dzuhur', hour: pairOfHourAndMinute[8], minute: pairOfHourAndMinute[9] },
          { label: 'Ashar', hour: pairOfHourAndMinute[10], minute: pairOfHourAndMinute[11] },
          { label: 'Magrib', hour: pairOfHourAndMinute[12], minute: pairOfHourAndMinute[13] },
          { label: 'Isya', hour: pairOfHourAndMinute[14], minute: pairOfHourAndMinute[15] },
        ],
      });
    }

    return times;
  }

  /**
   * @returns {Promise<Date>}
   */
  async getDataTimestamp() {
    await this.#ensureDataLoaded();
    return new Date(this.#metadata.timestamp);
  }

  /**
   * @param {string} raw
   * @returns {Metadata}
   */
  #parseMetadata(raw) {
    const lines = raw.split('\n');

    const [timestamp] = lines.shift()?.split('\t') ?? [];

    /** @type {Array<Province>} */
    const provinces = lines
      .map((line) => {
        const [name, regenciesRaw] = line.split(':');
        /** @type {Array<Regency>} */
        const regencies = regenciesRaw
          .split('\t')
          .map((name) => {
            return { name };
          });
        return {
          name,
          regencies,
        }
      });

    return { timestamp: parseInt(timestamp, 10), provinces };
  }

  /**
   * @param {number} first
   * @param {number} second
   */
  #join8bitTo16bit(first, second) {
    if (first > 0b11111111 || second > 0b11111111) {
      console.warn(first, second);
      throw new Error('Data lebih besar dari 8 bit');
    }
    return first | (second << 8);
  }

  /**
   * @param {number} number
   */
  #split16bitTo8bit(number) {
    return [
      number & 0b0000000011111111,
      (number & 0b1111111100000000) >> 8,
    ];
  }

  /**
   * @param {Array<number>} compacts
   */
  #decompactTimesBinary(compacts) {
    return [
      ((compacts[0] & 0b0000000000111111) >> 0),
      ((compacts[0] & 0b0000111111000000) >> 6),
      ((compacts[0] & 0b1111000000000000) >> 10) | (compacts[1] & 0b0000000000000011),
      ((compacts[1] & 0b0000000011111100) >> 2),
      ((compacts[1] & 0b0011111100000000) >> 8),
      ((compacts[1] & 0b1100000000000000) >> 10) | (compacts[2] & 0b0000000000001111),
      ((compacts[2] & 0b0000001111110000) >> 4),
      ((compacts[2] & 0b1111110000000000) >> 10),
      ((compacts[3] & 0b0000000000111111) >> 0),
      ((compacts[3] & 0b0000111111000000) >> 6),
      ((compacts[3] & 0b1111000000000000) >> 10) | (compacts[4] & 0b0000000000000011),
      ((compacts[4] & 0b0000000011111100) >> 2),
      ((compacts[4] & 0b0011111100000000) >> 8),
      ((compacts[4] & 0b1100000000000000) >> 10) | (compacts[5] & 0b0000000000001111),
      ((compacts[5] & 0b0000001111110000) >> 4),
      ((compacts[5] & 0b1111110000000000) >> 10),
    ];
  }
}

/**
 * @typedef {object} Metadata
 * @property {number} timestamp
 * @property {Array<Province>} provinces
 */

/**
 * @typedef {object} Province
 * @property {string} name
 * @property {Array<Regency>} regencies
 */

/**
 * @typedef {object} Regency
 * @property {string} name
 */
