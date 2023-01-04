import { JadwalSholat } from './src/index.js';

const jadwalSholat = new JadwalSholat(location.origin + location.pathname);

/** ===== CONTEXT ===== */

const query = new URLSearchParams(location.search);
const selectedProvinceName = query.get('province') ?? 'DKI JAKARTA';
const selectedRegencyName = query.get('regency') ?? 'KOTA JAKARTA';


/** ===== FORM ===== */

const provinces = await jadwalSholat.getProvinces();

/** @type {HTMLSelectElement} */
const provinceSelect = document.querySelector('select[name="province"]');

provinces.forEach((province) => {
  const option = document.createElement('option');
  option.value = province.name;
  option.textContent = province.name;
  if (province.name === selectedProvinceName) {
    option.selected = true;
  }
  provinceSelect.appendChild(option);
});

provinceSelect.disabled = false;

let firstTimeRegencyLoad = true;

async function reloadRegencyOptions() {
  /** @type {HTMLSelectElement} */
  const regencySelect = document.querySelector('select[name="regency"]');

  regencySelect.disabled = true;

  const selectedProvinceIndex = provinceSelect.selectedIndex;
  const selectedProvinceName = provinceSelect.options.item(selectedProvinceIndex).value;

  const regencies = await jadwalSholat.getRegencies(selectedProvinceName);

  while (regencySelect.firstChild instanceof Node) {
    regencySelect.removeChild(regencySelect.firstChild);
  }

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '-- PILIH --';
  regencySelect.appendChild(emptyOption);

  regencies.forEach((regencyName) => {
    const option = document.createElement('option');
    option.value = regencyName;
    option.textContent = regencyName;
    if (regencyName === selectedRegencyName && firstTimeRegencyLoad) {
      option.selected = true;
    }
    regencySelect.appendChild(option);
  });

  regencySelect.disabled = false;
  firstTimeRegencyLoad = false;
}

await reloadRegencyOptions();

provinceSelect.addEventListener('change', reloadRegencyOptions);


/** ===== TABLE ===== */

const schedules = await jadwalSholat.getSchedules(selectedProvinceName, selectedRegencyName);

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const tbody = document.createElement('tbody');

for (const schedule of schedules) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.classList.add('text-center');
  td.textContent = `${schedule.date.toString().padStart(2, '0')} ${months[schedule.month - 1]}`;
  tr.appendChild(td);
  for (const time of schedule.times) {
    const td = document.createElement('td');
    td.classList.add('text-center');
    td.textContent = `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}`;
    tr.appendChild(td);
  }
  tbody.appendChild(tr);
}

/** @type {HTMLTableElement} */
const scheduleTable = document.getElementById('schedule-table');

/** @type {HTMLTableSectionElement} */
const placeholderTbody = document.getElementById('schedule-tbody-placeholder');

scheduleTable.replaceChild(tbody, placeholderTbody);

/** @type {HTMLTimeElement} */
const time = document.getElementById('data-timestamp');
const dataTimestamp = await jadwalSholat.getDataTimestamp();
time.value = dataTimestamp.toISOString();
time.textContent = dataTimestamp.toLocaleString();

const tfoot = document.querySelector('tfoot');
tfoot.classList.remove('d-none');
