<?php

namespace Awqot\JadwalSholat;

require_once __DIR__ . "/vendor/autoload.php";

use DateTime;
use Exception;

$selectedProvince = isset($_GET["province"]) ? $_GET["province"] : "DKI JAKARTA";
$selectedRegency = isset($_GET["regency"]) ? $_GET["regency"] : "KOTA JAKARTA";

$jadwalSholat = JadwalSholat::default();

$provinces = $jadwalSholat->getProvinces();
$regencies = [];
$schedules = [];

try {
  $regencies = $jadwalSholat->getRegencies($selectedProvince);
  $schedules = $jadwalSholat->getSchedules($selectedProvince, $selectedRegency);
}
catch (Exception $error) {
}

$months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
?>
<!DOCTYPE html>
<html lang="id">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Jadwal Sholat</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous" media="screen">
  <script type="module">
    function applyTheme() {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.dataset.bsTheme = 'dark';
      } else {
        document.documentElement.dataset.bsTheme = 'light';
      }
    }
    setInterval(applyTheme, 1000);
    applyTheme();
  </script>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 1cm;
      }

      body {
        font-family: sans-serif;
      }

      form {
        display: none;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead th,
      tbody td {
        border: 1px solid #000;
        text-align: center;
        padding: 4px;
      }

      tfoot td {
        border: none;
        font-style: italic;
        padding: 4px;
      }

      tfoot td p {
        margin: .25rem 0px;
      }
    }
  </style>
</head>

<body>
  <div class="container">
    <header class="mt-3">
      <div class="d-flex justify-content-between">
        <h1>Jadwal Sholat</h1>
      </div>
    </header>

    <div class="card mt-3">
      <div class="card-body">
        <form method="GET">
          <div class="row">
            <div class="col-12 col-md-5">
              <div>
                <label for="province-select" class="form-label">Provinsi</label>
                <div class="input-group">
                  <select
                    id="province-select"
                    class="form-select"
                    name="province"
                    required>
                    <?php foreach ($provinces as $province): ?>
                      <option
                        value="<?= $province ?>"
                        <?php if ($province === $selectedProvince): ?>
                        selected
                        <?php endif ?>><?= $province ?></option>
                    <?php endforeach ?>
                  </select>
                </div>
              </div>
            </div>
            <div class="col-12 col-md-5 mt-3 mt-md-0">
              <div>
                <label for="regency-select" class="form-label">Kota/Kab.</label>
                <div class="input-group">
                  <select
                    id="regency-select"
                    class="form-select"
                    name="regency"
                    required>
                    <?php foreach ($regencies as $regency): ?>
                      <option
                        value="<?= $regency ?>"
                        <?php if ($regency === $selectedRegency): ?>
                        selected
                        <?php endif ?>><?= $regency ?></option>
                    <?php endforeach ?>
                  </select>
                </div>
              </div>
            </div>
            <div class="col-12 col-md-2 mt-3 mt-md-0">
              <div class="d-flex align-items-end h-100">
                <button type="submit" class="btn btn-primary">Terapkan</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-body" style="overflow-x: auto;">
        <table id="schedule-table" class="table table-sm">
          <thead>
            <tr>
              <th class="text-center">Tanggal</th>
              <th class="text-center">Imsya</th>
              <th class="text-center">Subuh</th>
              <th class="text-center">Terbit</th>
              <th class="text-center">Duha</th>
              <th class="text-center">Dzuhur</th>
              <th class="text-center">Ashar</th>
              <th class="text-center">Magrib</th>
              <th class="text-center">Isya</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($schedules as $schedule): ?>
              <tr>
                <td class="text-center"><?= str_pad($schedule->date, 2, "0", STR_PAD_LEFT) ?> <?= $months[$schedule->month - 1] ?></td>
                <?php foreach ($schedule->times as $time): ?>
                  <td class="text-center"><?= str_pad($time->hour, 2, "0", STR_PAD_LEFT) ?>:<?= str_pad($time->minute, 2, "0", STR_PAD_LEFT) ?></td>
                <?php endforeach ?>
              </tr>
            <?php endforeach ?>
          </tbody>
          <tbody id="schedule-tbody-placeholder"></tbody>
          <tfoot>
            <tr>
              <td colspan="9">
                <p class="text-start fst-italic">Data jadwal sholat diambil dari <a href="https://bimasislam.kemenag.go.id/">https://bimasislam.kemenag.go.id</a> pada <time value="<?= $jadwalSholat->getDataTimestamp()->format(DateTime::RFC3339) ?>"><?= $jadwalSholat->getDataTimestamp()->format("d M Y H:i:s") ?></time></p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
  <script type="module">
    import {
      JadwalSholat
    } from './jadwal-sholat.js';

    const jadwalSholat = new JadwalSholat(location.origin + location.pathname.split('/').slice(0, -1).join('/'));


    /** ===== CONTEXT ===== */

    const query = new URLSearchParams(location.search);
    const selectedProvinceName = query.get('province') ?? '<?= $selectedProvince ?>';
    const selectedRegencyName = query.get('regency') ?? '<?= $selectedRegency ?>';


    /** ===== FORM ===== */

    /** @type {HTMLSelectElement} */
    const provinceSelect = document.querySelector('select[name="province"]');

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
        regencySelect.appendChild(option);
      });

      regencySelect.disabled = false;
    }

    provinceSelect.addEventListener('change', reloadRegencyOptions);
  </script>
</body>

</html>