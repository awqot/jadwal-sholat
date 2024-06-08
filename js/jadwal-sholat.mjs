// @ts-check

export class JadwalSholat {
  static get LABEL_IMSYA() { return "Imsya"; };
  static get LABEL_SUBUH() { return "Subuh"; };
  static get LABEL_TERBIT() { return "Terbit"; };
  static get LABEL_DUHA() { return "Duha"; };
  static get LABEL_DZUHUR() { return "Dzuhur"; };
  static get LABEL_ASHAR() { return "Ashar"; };
  static get LABEL_MAGRIB() { return "Magrib"; };
  static get LABEL_ISYA() { return "Isya"; };

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

  async getProvinces() {
    await this.#ensureMetadataLoaded();
    return this.#metadata.provinces;
  }

  /**
   * @param {string} provinceName
   */
  async getRegencies(provinceName) {
    await this.#ensureMetadataLoaded();
    return this.#metadata.provinces
      .find((province) => province.name === provinceName)
      ?.regencies
      .map((regency) => regency.name);
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   */
  async getLocation(provinceName, regencyName) {
    await this.#ensureMetadataLoaded();

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

    return this.#join8bitTo16bit(provinceIndex, regencyIndex);
  }

  /**
   * @param {number} location
   */
  async getProvince(location) {
    await this.#ensureMetadataLoaded();

    const [provinceIndex] = this.#split16bitTo8bit(location);

    return this.#metadata.provinces[provinceIndex];
  }

  /**
   * @param {number} location
   */
  async getRegency(location) {
    await this.#ensureMetadataLoaded();

    const [provinceIndex, regencyIndex] = this.#split16bitTo8bit(location);

    return this.#metadata.provinces[provinceIndex]?.regencies[regencyIndex].name;
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   */
  async getSchedules(provinceName, regencyName) {
    const [{ locationContentWidth, locationContentBeginAt }] = await Promise.all([
      this.#getLocationContentCursor(provinceName, regencyName),
      this.#ensureDataLoaded(),
    ]);

    const dateMonthMetadataWidth = 1;
    const dateMonthGroupWidth = 7;
    const dateMonthGroupLength = locationContentWidth / dateMonthGroupWidth;

    /** @type {Array<Schedule>} */
    const schedules = [];

    for (let index = 0; index < dateMonthGroupLength; index++) {
      const beginReadAt = locationContentBeginAt + (index * dateMonthGroupWidth);
      const dateMonth = this.#buffer.at(beginReadAt) ?? 0;
      const dateMonthBuffer = Array.from(this.#buffer.slice(
        beginReadAt + dateMonthMetadataWidth, /** remove date month data */
        beginReadAt + dateMonthGroupWidth,
      ));
      const [date, month] = this.#split16bitTo8bit(dateMonth);
      const pairOfHourAndMinute = this.#decompactTimesBinary(Array.from(dateMonthBuffer));
      schedules.push({
        date,
        month,
        times: [
          { label: JadwalSholat.LABEL_IMSYA, hour: pairOfHourAndMinute[0], minute: pairOfHourAndMinute[1] },
          { label: JadwalSholat.LABEL_SUBUH, hour: pairOfHourAndMinute[2], minute: pairOfHourAndMinute[3] },
          { label: JadwalSholat.LABEL_TERBIT, hour: pairOfHourAndMinute[4], minute: pairOfHourAndMinute[5] },
          { label: JadwalSholat.LABEL_DUHA, hour: pairOfHourAndMinute[6], minute: pairOfHourAndMinute[7] },
          { label: JadwalSholat.LABEL_DZUHUR, hour: pairOfHourAndMinute[8], minute: pairOfHourAndMinute[9] },
          { label: JadwalSholat.LABEL_ASHAR, hour: pairOfHourAndMinute[10], minute: pairOfHourAndMinute[11] },
          { label: JadwalSholat.LABEL_MAGRIB, hour: pairOfHourAndMinute[12], minute: pairOfHourAndMinute[13] },
          { label: JadwalSholat.LABEL_ISYA, hour: pairOfHourAndMinute[14], minute: pairOfHourAndMinute[15] },
        ],
      });
    }

    return schedules;
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   * @param {number} month
   * @param {number} date
   */
  async getTimes(provinceName, regencyName, month, date) {
    const [{ locationContentWidth, locationContentBeginAt }] = await Promise.all([
      this.#getLocationContentCursor(provinceName, regencyName),
      this.#ensureDataLoaded(),
    ]);

    const dateMonthMetadataWidth = 1;
    const dateMonthGroupWidth = 7;
    const dateMonthGroupLength = locationContentWidth / dateMonthGroupWidth;

    for (let index = 0; index < dateMonthGroupLength; index++) {
      const beginReadAt = locationContentBeginAt + (index * dateMonthGroupWidth);
      const dateMonth = this.#buffer.at(beginReadAt) ?? 0;
      const dateMonthBuffer = Array.from(this.#buffer.slice(
        beginReadAt + dateMonthMetadataWidth, /** remove date month data */
        beginReadAt + dateMonthGroupWidth,
      ));
      const [_date, _month] = this.#split16bitTo8bit(dateMonth);
      if (date === _date && month === _month) {
        const pairOfHourAndMinute = this.#decompactTimesBinary(Array.from(dateMonthBuffer));
        return [
          { label: JadwalSholat.LABEL_IMSYA, hour: pairOfHourAndMinute[0], minute: pairOfHourAndMinute[1] },
          { label: JadwalSholat.LABEL_SUBUH, hour: pairOfHourAndMinute[2], minute: pairOfHourAndMinute[3] },
          { label: JadwalSholat.LABEL_TERBIT, hour: pairOfHourAndMinute[4], minute: pairOfHourAndMinute[5] },
          { label: JadwalSholat.LABEL_DUHA, hour: pairOfHourAndMinute[6], minute: pairOfHourAndMinute[7] },
          { label: JadwalSholat.LABEL_DZUHUR, hour: pairOfHourAndMinute[8], minute: pairOfHourAndMinute[9] },
          { label: JadwalSholat.LABEL_ASHAR, hour: pairOfHourAndMinute[10], minute: pairOfHourAndMinute[11] },
          { label: JadwalSholat.LABEL_MAGRIB, hour: pairOfHourAndMinute[12], minute: pairOfHourAndMinute[13] },
          { label: JadwalSholat.LABEL_ISYA, hour: pairOfHourAndMinute[14], minute: pairOfHourAndMinute[15] },
        ];
      }
    }

    throw new Error('Time not found');
  }

  /**
   * @param {string} provinceName
   * @param {string} regencyName
   */
  async #getLocationContentCursor(provinceName, regencyName) {
    const [location] = await Promise.all([
      this.getLocation(provinceName, regencyName),
      this.#ensureDataLoaded(),
    ]);

    const locationGroupWidth = 2556;
    const locationGroupsLength = this.#buffer.length / 2556;
    /** @type {number|undefined} */
    let locationGroupBeginAt = undefined;
    const locationMetadataWidth = 1;
    /** @type {number|undefined} */
    let locationContentBeginAt = undefined;
    const locationContentWidth = locationGroupWidth - locationMetadataWidth;

    for (let index = 0; index < locationGroupsLength; index++) {
      const beginReadAt = index * locationGroupWidth;
      if (this.#buffer.at(beginReadAt) === location) {
        locationGroupBeginAt = beginReadAt;
        locationContentBeginAt = beginReadAt + locationMetadataWidth;
        break;
      }
    }

    if (locationGroupBeginAt === undefined || locationContentBeginAt === undefined) {
      throw new Error('Schedule not found');
    }

    return { locationContentWidth, locationContentBeginAt };
  }

  /**
   * @returns {Promise<Date>}
   */
  async getDataTimestamp() {
    await this.#ensureMetadataLoaded();
    return new Date(this.#metadata.timestamp);
  }

  #isDataLoaded = false;
  async #ensureDataLoaded() {
    if (this.#isDataLoaded) return;
    const response = await fetch(`${this.cdn}/data/jadwal-sholat.bin`);
    this.#buffer = new Uint16Array(await response.arrayBuffer());
    this.#isDataLoaded = true;
  }

  #isMetadataLoaded = false;
  async #ensureMetadataLoaded() {
    if (this.#isMetadataLoaded) return;
    const response = await fetch(`${this.cdn}/data/jadwal-sholat.metadata`);
    this.#metadata = this.#parseMetadata(await response.text());
    this.#isMetadataLoaded = true;
  }

  /**
   * @param {string} raw
   * @returns {Metadata}
   */
  #parseMetadata(raw) {
    const lines = raw.split('\n');

    const [timestamp] = lines.shift()?.split('\t') ?? [];
    const timePaddingStrs = lines.shift()?.split('\t') ?? [];

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

    return {
      timestamp: parseInt(timestamp, 10),
      timePaddings: timePaddingStrs.map((str) => parseInt(str, 10)),
      provinces,
    };
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
      (number & 0b0000000011111111),
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
 * @typedef {object} Schedule
 * @property {number} date
 * @property {number} month
 * @property {Array<Time>} times
 */

/**
 * @typedef {object} Time
 * @property {string} label
 * @property {number} hour
 * @property {number} minute
 */

/**
 * @typedef {object} Metadata
 * @property {number} timestamp
 * @property {Array<number>} timePaddings
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
