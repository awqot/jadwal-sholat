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
/**
 * @param {string} url
 * @returns
 */
export function createJadwalSholatFromUrl(url: string): Promise<JadwalSholat>;
export class JadwalSholat {
    static get LABEL_IMSYA(): string;
    static get LABEL_SUBUH(): string;
    static get LABEL_TERBIT(): string;
    static get LABEL_DUHA(): string;
    static get LABEL_DZUHUR(): string;
    static get LABEL_ASHAR(): string;
    static get LABEL_MAGRIB(): string;
    static get LABEL_ISYA(): string;
    static get LABELS(): string[];
    /**
     * @param {Uint8Array} data
     */
    constructor(data: Uint8Array);
    /**
     * @returns {Promise<Date>}
     */
    getDataTimestamp(): Promise<Date>;
    /**
     * @returns {Promise<Array<string>>}
     */
    getProvinces(): Promise<Array<string>>;
    /**
     * @param {string} provinceName
     * @returns {Promise<Array<String>>}
     */
    getRegencies(provinceName: string): Promise<Array<string>>;
    /**
     * @param {string} provinceName
     * @param {string} regencyName
     * @returns {Promise<Array<Schedule>>}
     */
    getSchedules(provinceName: string, regencyName: string): Promise<Array<Schedule>>;
    /**
     * @param {string} provinceName
     * @param {string} regencyName
     * @param {number} month
     * @param {number} date
     * @returns {Promise<Array<Time>>}
     */
    getTimes(provinceName: string, regencyName: string, month: number, date: number): Promise<Array<Time>>;
    #private;
}
export type Regency = {
    index: number;
    name: string;
};
export type Schedule = {
    month: number;
    date: number;
    times: Array<Time>;
};
export type Time = {
    label: string;
    hour: number;
    minute: number;
};
//# sourceMappingURL=jadwal-sholat.d.mts.map