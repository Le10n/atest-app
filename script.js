const state = {
  polarityCorrect: true,
  phaseOrderCorrect: true,
  breakerSizingCorrect: true,
  visualInspectionOk: true,
  functionalTestOk: true,
  separationOk: true,
  companyLogoDataUrl: '',
  objectPhotoDataUrl: '',
  signatureDataUrl: '',
  theme: localStorage.getItem('atestTheme') || 'light',
  circuits: [],
};

const INPUT_SELECTOR = 'input:not([type="file"]), textarea, select';

document.addEventListener('DOMContentLoaded', init);

function init() {
  document.getElementById('date').value = new Date().toISOString().slice(0, 10);

  document.querySelectorAll(INPUT_SELECTOR).forEach((el) => {
    el.addEventListener('input', renderAnalysis);
    el.addEventListener('change', renderAnalysis);
  });

  document.querySelectorAll('.toggle-box').forEach((button) =>
    button.addEventListener('click', () => toggleCheck(button))
  );

  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('settingsOpenBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('openSignatureBtn').addEventListener('click', openSignatureModal);

  document.getElementById('circuitOpenBtn').addEventListener('click', openCircuitModal);
  document.getElementById('closeCircuitModalBtn').addEventListener('click', closeCircuitModal);
  document.getElementById('addCircuitBtn').addEventListener('click', addCircuit);

  document.getElementById('closeSignatureModalBtn').addEventListener('click', closeSignatureModal);
  document.getElementById('clearSignatureBtn').addEventListener('click', clearSignature);
  document.getElementById('saveSignatureBtn').addEventListener('click', saveSignature);

  document.getElementById('saveProjectBtn').addEventListener('click', saveProjectData);
  document.getElementById('loadProjectBtn').addEventListener('click', loadProjectData);
  document.getElementById('exportJsonBtn').addEventListener('click', exportProjectJson);
  document.getElementById('generatePdfBtn').addEventListener('click', generatePDF);

  document.getElementById('companyLogo').addEventListener('change', handleLogoUpload);
  document.getElementById('objectPhoto').addEventListener('change', handleObjectPhotoUpload);
  document.getElementById('installationType').addEventListener('change', () => {
    applyInstallationTypeVisibility();
    renderToggleStates();
    renderAnalysis();
  });

  loadSettings();
  applyTheme();
  applyInstallationTypeVisibility();
  renderToggleStates();
  renderCircuits();
  renderAnalysis();

  document.getElementById('testsNote').textContent =
    'Tip instalacije sada prikazuje samo bitna mjerenja za odabrani objekt.';
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function getNumber(id) {
  const value = getValue(id);
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSelectValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function passFail(ok) {
  return ok ? 'PROLAZ' : 'PAD';
}

function scoreLabel(score) {
  if (score >= 90) return 'Odlično';
  if (score >= 75) return 'Dobro';
  if (score >= 60) return 'Uvjetno';
  return 'Nesigurno';
}

function scoreClass(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'warning';
  return 'danger';
}

function requiredInsulationMin() {
  const testVoltage = getNumber('insulationTestVoltage');
  if (testVoltage === 1000) return 1;
  if (testVoltage === 500) return 0.5;
  if (testVoltage === 250) return 0.25;
  return getNumber('insulationMinMOhm') || 0.5;
}

function applyInstallationTypeVisibility() {
  const type = getValue('installationType') || 'stambena';

  document.querySelectorAll('[data-types]').forEach((el) => {
    const types = (el.dataset.types || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const visible = types.includes(type);
    el.style.display = visible ? '' : 'none';
  });
}

function fieldVisible(id) {
  const el = document.getElementById(id);
  if (!el) return false;

  const wrapper = el.closest('[data-types]');
  if (!wrapper) return true;

  return wrapper.style.display !== 'none';
}

function toggleCheck(button) {
  const key = button.dataset.key;
  if (!isToggleVisible(button)) return;

  state[key] = !state[key];
  renderToggleStates();
  renderAnalysis();
}

function isToggleVisible(button) {
  return button.style.display !== 'none';
}

function renderToggleStates() {
  document.querySelectorAll('.toggle-box').forEach((button) => {
    const key = button.dataset.key;
    const visible = isToggleVisible(button);

    button.classList.toggle('ok', !!state[key]);
    button.classList.toggle('bad', !state[key]);
    button.querySelector('.pill').textContent = state[key] ? 'DA' : 'NE';

    if (!visible) {
      button.classList.remove('ok', 'bad');
    }
  });
}

function classifyNumericResult(value, config = {}) {
  const {
    mode = 'max',
    goodLimit = null,
    warnLimit = null,
    allowEmptyAsNa = false,
  } = config;

  if (value === null) {
    return allowEmptyAsNa ? 'na' : 'danger';
  }

  if (mode === 'max') {
    if (goodLimit !== null && value <= goodLimit) return 'ok';
    if (warnLimit !== null && value <= warnLimit) return 'warn';
    return 'danger';
  }

  if (mode === 'min') {
    if (goodLimit !== null && value >= goodLimit) return 'ok';
    if (warnLimit !== null && value >= warnLimit) return 'warn';
    return 'danger';
  }

  return 'ok';
}

function buildItem(
  label,
  measured,
  unit,
  limitText,
  validator,
  recommendation,
  visible = true,
  level = null,
  weight = 1
) {
  const ok = validator(measured);

  return {
    label,
    measured,
    unit,
    limitText,
    ok,
    recommendation,
    visible,
    level: level || (ok ? 'ok' : 'danger'),
    weight,
  };
}

function buildBooleanItem(
  label,
  okValue,
  limitText,
  recommendation,
  visible = true,
  weight = 1
) {
  return {
    label,
    measured: okValue ? 'Ispravno' : 'Neispravno',
    unit: '',
    limitText,
    ok: okValue,
    recommendation,
    visible,
    level: okValue ? 'ok' : 'danger',
    weight,
  };
}

function visibleToggle(key) {
  const el = document.querySelector(`.toggle-box[data-key="${key}"]`);
  return el ? el.style.display !== 'none' : false;
}

function buildAnalysis() {
  const insulationMinimum = requiredInsulationMin();
  const insulationMinInput = document.getElementById('insulationMinMOhm');
  if (insulationMinInput) insulationMinInput.value = insulationMinimum;

  const continuityMax = getNumber('continuityMaxOhm');
  const insulationMin = insulationMinimum;
  const earthMax = getNumber('earthResistanceMaxOhm');
  const zsMax = getNumber('loopImpedanceMaxOhm');
  const zeMax = getNumber('externalLoopZeMax');
  const rcdTimeMax = getNumber('rcdTripMaxMs');
  const rcdCurrentMax = getNumber('rcdTripCurrentMaxMa');
  const r1r2Max = getNumber('r1r2MaxOhm');
  const ringMax = getNumber('ringContinuityMaxOhm');
  const dropMax = getNumber('maxVoltageDropLimit');
  const floorMin = getNumber('floorWallResistanceMin');
  const evTripMax = getNumber('evTripMaxMs');

  const continuityValue = getNumber('continuityOhm');
  const insulationLE = getNumber('insulationMOhm');
  const insulationLL = getNumber('insulationLLMOhm');
  const earthValue = getNumber('earthResistanceOhm');
  const zsValue = getNumber('loopImpedanceOhm');
  const zeValue = getNumber('externalLoopZe');
  const rcdTime = getNumber('rcdTripMs');
  const rcdCurrent = getNumber('rcdTripCurrentMa');
  const ipfValue = getNumber('ipfKa');
  const r1r2Value = getNumber('r1r2Ohm');
  const ringValue = getNumber('ringContinuityOhm');
  const dropValue = getNumber('maxVoltageDrop');
  const floorValue = getNumber('floorWallResistance');
  const pvVoc = getNumber('pvVoc');
  const pvIsc = getNumber('pvIsc');
  const evTrip = getNumber('evTripMs');

  const continuityLevel = classifyNumericResult(continuityValue, {
    mode: 'max',
    goodLimit: continuityMax,
    warnLimit: continuityMax !== null ? continuityMax * 1.2 : null,
  });

  const insulationLevel = classifyNumericResult(insulationLE, {
    mode: 'min',
    goodLimit: insulationMin,
    warnLimit: insulationMin !== null ? insulationMin * 0.8 : null,
  });

  const insulationLLLevel = classifyNumericResult(insulationLL, {
    mode: 'min',
    goodLimit: insulationMin,
    warnLimit: insulationMin !== null ? insulationMin * 0.8 : null,
  });

  const earthLevel = classifyNumericResult(earthValue, {
    mode: 'max',
    goodLimit: earthMax,
    warnLimit: earthMax !== null ? earthMax * 1.3 : null,
  });

  const zsLevel = classifyNumericResult(zsValue, {
    mode: 'max',
    goodLimit: zsMax,
    warnLimit: zsMax !== null ? zsMax * 1.2 : null,
  });

  const zeLevel = classifyNumericResult(zeValue, {
    mode: 'max',
    goodLimit: zeMax,
    warnLimit: zeMax !== null ? zeMax * 1.2 : null,
  });

  const rcdTimeLevel = classifyNumericResult(rcdTime, {
    mode: 'max',
    goodLimit: rcdTimeMax,
    warnLimit: rcdTimeMax !== null ? rcdTimeMax * 1.1 : null,
  });

  const rcdCurrentLevel = classifyNumericResult(rcdCurrent, {
    mode: 'max',
    goodLimit: rcdCurrentMax,
    warnLimit: rcdCurrentMax !== null ? rcdCurrentMax * 1.1 : null,
  });

  const r1r2Level = classifyNumericResult(r1r2Value, {
    mode: 'max',
    goodLimit: r1r2Max,
    warnLimit: r1r2Max !== null ? r1r2Max * 1.25 : null,
  });

  const ringLevel = classifyNumericResult(ringValue, {
    mode: 'max',
    goodLimit: ringMax,
    warnLimit: ringMax !== null ? ringMax * 1.25 : null,
  });

  const dropLevel =
    dropValue === null
      ? 'na'
      : classifyNumericResult(dropValue, {
          mode: 'max',
          goodLimit: dropMax,
          warnLimit: dropMax !== null ? dropMax * 1.15 : null,
        });

  const floorLevel =
    floorValue === null
      ? 'na'
      : classifyNumericResult(floorValue, {
          mode: 'min',
          goodLimit: floorMin,
          warnLimit: floorMin !== null ? floorMin * 0.8 : null,
        });

  const evTripLevel = classifyNumericResult(evTrip, {
    mode: 'max',
    goodLimit: evTripMax,
    warnLimit: evTripMax !== null ? evTripMax * 1.1 : null,
  });

  const items = [
    buildItem(
      'Kontinuitet PE vodiča',
      continuityValue,
      'Ω',
      `≤ ${continuityMax} Ω`,
      (v) => v !== null && continuityLevel !== 'danger',
      'Provjeriti spojeve zaštitnog vodiča, stezaljke i kontinuitet uzemljenja.',
      fieldVisible('continuityOhm'),
      continuityLevel,
      3
    ),
    buildItem(
      'Izolacijski otpor L-E',
      insulationLE,
      'MΩ',
      `≥ ${insulationMin} MΩ`,
      (v) => v !== null && insulationLevel !== 'danger',
      'Pregledati izolaciju, vlagu, spojne kutije i moguća curenja prema PE vodiču.',
      fieldVisible('insulationMOhm'),
      insulationLevel,
      3
    ),
    buildItem(
      'Izolacijski otpor L-L',
      insulationLL,
      'MΩ',
      `≥ ${insulationMin} MΩ`,
      (v) => v !== null && insulationLLLevel !== 'danger',
      'Provjeriti međufaznu izolaciju i moguće oštećenje vodiča ili priključaka.',
      fieldVisible('insulationLLMOhm'),
      insulationLLLevel,
      2
    ),
    buildItem(
      'Otpor uzemljenja / elektrode',
      earthValue,
      'Ω',
      `≤ ${earthMax} Ω`,
      (v) => v !== null && earthLevel !== 'danger',
      'Poboljšati uzemljivač, provjeriti spojeve i stanje uzemljivačke trake ili sonde.',
      fieldVisible('earthResistanceOhm'),
      earthLevel,
      3
    ),
    buildItem(
      'Impedancija petlje kvara Zs',
      zsValue,
      'Ω',
      `≤ ${zsMax} Ω`,
      (v) => v !== null && zsLevel !== 'danger',
      'Provjeriti presjek vodiča, duljinu vodova i ispravnost zaštitnih uređaja.',
      fieldVisible('loopImpedanceOhm'),
      zsLevel,
      3
    ),
    buildItem(
      'Vanjska petlja kvara Ze',
      zeValue,
      'Ω',
      `≤ ${zeMax} Ω`,
      (v) => v !== null && zeLevel !== 'danger',
      'Provjeriti glavni dovod, uzemljenje i uvjete napajanja na mjestu priključenja.',
      fieldVisible('externalLoopZe'),
      zeLevel,
      2
    ),
    buildItem(
      'RCD vrijeme isključenja',
      rcdTime,
      'ms',
      `≤ ${rcdTimeMax} ms`,
      (v) => v !== null && rcdTimeLevel !== 'danger',
      'Ispitati FID/RCD sklopku i po potrebi zamijeniti uređaj ili provjeriti ožičenje.',
      fieldVisible('rcdTripMs'),
      rcdTimeLevel,
      3
    ),
    buildItem(
      'RCD struja okidanja',
      rcdCurrent,
      'mA',
      `≤ ${rcdCurrentMax} mA`,
      (v) => v !== null && rcdCurrentLevel !== 'danger',
      'Provjeriti specifikaciju i ispravnost RCD uređaja prema traženoj zaštiti.',
      fieldVisible('rcdTripCurrentMa'),
      rcdCurrentLevel,
      3
    ),
    buildItem(
      'Prospektivna struja kvara Ipf',
      ipfValue,
      'kA',
      'informativno / mora odgovarati zaštiti',
      (v) => v !== null,
      'Provjeriti usklađenost prekidne moći zaštitnog uređaja s izmjerenim Ipf.',
      fieldVisible('ipfKa'),
      ipfValue === null ? 'na' : 'warn',
      1
    ),
    buildItem(
      'R1 + R2',
      r1r2Value,
      'Ω',
      `≤ ${r1r2Max} Ω`,
      (v) => v !== null && r1r2Level !== 'danger',
      'Provjeriti kontinuitet zaštitnog voda po krugu i spojeve na krajnjim točkama.',
      fieldVisible('r1r2Ohm'),
      r1r2Level,
      2
    ),
    buildItem(
      'Kontinuitet ring kruga',
      ringValue,
      'Ω',
      `≤ ${ringMax} Ω`,
      (v) => v !== null && ringLevel !== 'danger',
      'Provjeriti kontinuitet linijskog, neutralnog i CPC vodiča ring kruga.',
      fieldVisible('ringContinuityOhm'),
      ringLevel,
      1
    ),
    buildItem(
      'Pad napona',
      dropValue,
      '%',
      `≤ ${dropMax} %`,
      () => dropLevel !== 'danger',
      'Provjeriti duljinu vodova, presjek vodiča i opterećenje kruga.',
      fieldVisible('maxVoltageDrop'),
      dropLevel,
      1
    ),
    buildItem(
      'Otpor poda/zida',
      floorValue,
      'kΩ',
      `≥ ${floorMin} kΩ`,
      () => floorLevel !== 'danger',
      'Ponoviti mjerenje na relevantnim površinama i provjeriti uvjete prostora.',
      fieldVisible('floorWallResistance'),
      floorLevel,
      1
    ),

    buildItem(
      'PV otvoreni napon Voc',
      pvVoc,
      'V',
      'prema projektu / stringu',
      (v) => v !== null,
      'Provjeriti otvoreni napon stringa i usporediti s očekivanom vrijednošću proizvođača i projekta.',
      fieldVisible('pvVoc'),
      pvVoc === null ? 'danger' : 'ok',
      2
    ),
    buildItem(
      'PV struja kratkog spoja Isc',
      pvIsc,
      'A',
      'prema projektu / stringu',
      (v) => v !== null,
      'Provjeriti Isc stringa i usporediti s očekivanom vrijednošću modula i uvjetima mjerenja.',
      fieldVisible('pvIsc'),
      pvIsc === null ? 'danger' : 'ok',
      2
    ),
    buildItem(
      'PV polaritet stringa',
      getSelectValue('pvStringPolarity') === 'ispravno' ? 'Ispravno' : 'Neispravno',
      '',
      'mora biti ispravan',
      () => getSelectValue('pvStringPolarity') === 'ispravno',
      'Provjeriti polaritet DC stringa prije priključenja na inverter.',
      fieldVisible('pvStringPolarity'),
      getSelectValue('pvStringPolarity') === 'ispravno' ? 'ok' : 'danger',
      3
    ),

    buildItem(
      'CP/PP test EV punionice',
      getSelectValue('evCpdTest') === 'ispravno' ? 'Ispravno' : 'Neispravno',
      '',
      'mora biti ispravan',
      () => getSelectValue('evCpdTest') === 'ispravno',
      'Provjeriti CP/PP komunikaciju i funkcionalnost EV punionice.',
      fieldVisible('evCpdTest'),
      getSelectValue('evCpdTest') === 'ispravno' ? 'ok' : 'danger',
      3
    ),
    buildItem(
      'Vrijeme isključenja EV zaštite',
      evTrip,
      'ms',
      `≤ ${evTripMax} ms`,
      (v) => v !== null && evTripLevel !== 'danger',
      'Provjeriti zaštitu EV punionice i vrijeme isključenja prema traženom tipu zaštite.',
      fieldVisible('evTripMs'),
      evTripLevel,
      3
    ),

    buildBooleanItem(
      'Polaritet',
      state.polarityCorrect,
      'mora biti ispravan',
      'Ispraviti raspored faze i nule na utičnicama i priključnim točkama.',
      visibleToggle('polarityCorrect'),
      3
    ),
    buildBooleanItem(
      'Redoslijed faza',
      state.phaseOrderCorrect,
      'mora biti ispravan',
      'Zamijeniti faze na trofaznom priključku kako bi redoslijed bio ispravan.',
      visibleToggle('phaseOrderCorrect'),
      2
    ),
    buildBooleanItem(
      'Dimenzioniranje zaštitnih uređaja',
      state.breakerSizingCorrect,
      'mora biti ispravno',
      'Provjeriti odabir osigurača i automata prema presjeku vodiča i opterećenju.',
      visibleToggle('breakerSizingCorrect'),
      3
    ),
    buildBooleanItem(
      'Vizualni pregled',
      state.visualInspectionOk,
      'mora biti uredno izvedeno',
      'Pregledati ormarić, stezaljke, oznake, mehanička oštećenja i vlagu.',
      visibleToggle('visualInspectionOk'),
      2
    ),
    buildBooleanItem(
      'Funkcionalni test',
      state.functionalTestOk,
      'mora proći',
      'Provjeriti rad tipkala, sklopki, zaštitnih funkcija i upravljanja opremom.',
      visibleToggle('functionalTestOk'),
      2
    ),
    buildBooleanItem(
      'Odvajanje krugova',
      state.separationOk,
      'mora biti potvrđeno',
      'Provjeriti zaštitu odvajanjem i izolacijsko odvajanje između relevantnih krugova.',
      visibleToggle('separationOk'),
      1
    ),
  ];

  const activeItems = items.filter((item) => item.visible !== false);

  const criticalItems = activeItems.filter((item) => item.level === 'danger');
  const warningItems = activeItems.filter((item) => item.level === 'warn');
  const okItems = activeItems.filter((item) => item.level === 'ok');
  const naItems = activeItems.filter((item) => item.level === 'na');

  const failed = criticalItems;
  const missing = activeItems.filter((item) => item.measured === null);

  const totalWeight = activeItems
    .filter((item) => item.level !== 'na')
    .reduce((sum, item) => sum + (item.weight || 1), 0);

  const earnedWeight = activeItems.reduce((sum, item) => {
    const weight = item.weight || 1;
    if (item.level === 'ok') return sum + weight;
    if (item.level === 'warn') return sum + weight * 0.5;
    return sum;
  }, 0);

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  let verdict = 'Instalacija zadovoljava osnovne kriterije sigurnosti.';
  if (criticalItems.length > 0 && criticalItems.length <= 2) {
    verdict = 'Postoje kritične stavke koje treba otkloniti prije konačne potvrde.';
  }
  if (criticalItems.length >= 3) {
    verdict = 'Instalacija nije sigurna za potvrdu bez sanacije i ponovnog ispitivanja.';
  }
  if (!criticalItems.length && warningItems.length > 0) {
    verdict = 'Instalacija je uglavnom dobra, ali postoje upozorenja i preporučene korekcije.';
  }
  if (missing.length >= 5) {
    verdict += ' Nedostaje više rezultata pa je procjena djelomična.';
  }

  return {
    items: activeItems,
    failed,
    missing,
    passed: okItems.length,
    total: activeItems.length,
    score,
    verdict,
    safe: criticalItems.length === 0,
    label: scoreLabel(score),
    okItems,
    warningItems,
    criticalItems,
    naItems,
  };
}

function renderRecommendations(analysis) {
  const container = document.getElementById('recommendations');
  container.innerHTML = '';

  const priorityItems = [...analysis.criticalItems, ...analysis.warningItems].slice(0, 3);

  if (!priorityItems.length) {
    container.innerHTML =
      '<div class="recommendation excellent">Nisu pronađeni problemi prema unesenim podacima.</div>';
    return;
  }

  priorityItems.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = `recommendation ${item.level === 'danger' ? 'danger' : 'warning'}`;
    el.innerHTML = `
      <strong>Preporuka ${index + 1}</strong>
      <div class="muted top-gap-tiny">${item.label}: ${item.recommendation}</div>
    `;
    container.appendChild(el);
  });
}

function renderDetails(analysis) {
  const container = document.getElementById('detailList');
  container.innerHTML = '';

  analysis.items.forEach((item) => {
    const levelClass =
      item.level === 'ok'
        ? 'level-ok'
        : item.level === 'warn'
          ? 'level-warn'
          : item.level === 'danger'
            ? 'level-danger'
            : 'level-na';

    const pillClass =
      item.level === 'ok'
        ? 'pass'
        : item.level === 'warn'
          ? 'chip-warn'
          : item.level === 'danger'
            ? 'fail'
            : 'chip-na';

    const levelLabel =
      item.level === 'ok'
        ? 'ISPRAVNO'
        : item.level === 'warn'
          ? 'UPOZORENJE'
          : item.level === 'danger'
            ? 'KRITIČNO'
            : 'N/A';

    const measuredText =
      item.measured !== null && item.measured !== undefined ? item.measured : '-';

    const el = document.createElement('div');
    el.className = `detail-item ${levelClass}`;
    el.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-title">${item.label}</div>
          <div class="muted">Vrijednost: ${measuredText} ${item.unit || ''}</div>
          <div class="muted">Granica: ${item.limitText}</div>
        </div>
        <span class="pill ${pillClass}">${levelLabel}</span>
      </div>`;
    container.appendChild(el);
  });
}

function renderAnalysis() {
  const analysis = buildAnalysis();

  const scoreBox = document.getElementById('scoreBox');
  scoreBox.className = `score-box ${scoreClass(analysis.score)}`;
  document.getElementById('scoreValue').textContent = `${analysis.score}/100`;
  document.getElementById('scoreLabel').textContent = `Ocjena: ${analysis.label}`;

  const statusBox = document.getElementById('statusBox');
  statusBox.className = `status-box ${analysis.safe ? 'status-safe' : 'status-unsafe'} top-gap-small`;
  document.getElementById('safeTitle').textContent = analysis.safe
    ? 'Instalacija je sigurna'
    : 'Instalacija nije sigurna';
  document.getElementById('verdictText').textContent = analysis.verdict;

  document.getElementById('summaryPassed').textContent = `Prošlo: ${analysis.passed}/${analysis.total} kriterija`;
  document.getElementById('summaryFailed').textContent = `Neispravno: ${analysis.criticalItems.length}`;
  document.getElementById('summaryMissing').textContent = `Nedostaje unosa: ${analysis.missing.length}`;

  const okCount = document.getElementById('summaryOkCount');
  const warningCount = document.getElementById('summaryWarningCount');
  const criticalCount = document.getElementById('summaryCriticalCount');
  const naCount = document.getElementById('summaryNaCount');

  if (okCount) okCount.textContent = `${analysis.okItems.length} stavki`;
  if (warningCount) warningCount.textContent = `${analysis.warningItems.length} stavki`;
  if (criticalCount) criticalCount.textContent = `${analysis.criticalItems.length} stavki`;
  if (naCount) naCount.textContent = `${analysis.naItems.length} stavki`;

  renderRecommendations(analysis);
  renderDetails(analysis);

  return analysis;
}

function openSettings() {
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

function saveSettings() {
  const settings = {
    companyName: getValue('companyName'),
    companyOib: getValue('companyOib'),
    companyAddress: getValue('companyAddress'),
    companyEmail: getValue('companyEmail'),
    companyPhone: getValue('companyPhone'),
    companyWeb: getValue('companyWeb'),
    responsiblePerson: getValue('responsiblePerson'),
    signatureText: getValue('signatureText'),
    companyLogoDataUrl: state.companyLogoDataUrl,
    objectPhotoDataUrl: state.objectPhotoDataUrl,
    signatureDataUrl: state.signatureDataUrl,
    theme: state.theme,
    circuits: state.circuits,
  };

  window.StorageService.saveSettings(settings);
  applyCompanyPreview(settings);
  renderCircuits();
  closeSettings();
}

function loadSettings() {
  const saved = window.StorageService.loadSettings();

  ['companyName', 'companyOib', 'companyAddress', 'companyEmail', 'companyPhone', 'companyWeb', 'responsiblePerson', 'signatureText'].forEach((id) => {
    if (saved[id]) document.getElementById(id).value = saved[id];
  });

  if (saved.companyLogoDataUrl) state.companyLogoDataUrl = saved.companyLogoDataUrl;
  if (saved.objectPhotoDataUrl) state.objectPhotoDataUrl = saved.objectPhotoDataUrl;
  if (saved.signatureDataUrl) state.signatureDataUrl = saved.signatureDataUrl;
  if (Array.isArray(saved.circuits)) state.circuits = saved.circuits;
  if (saved.theme) state.theme = saved.theme;

  applyCompanyPreview(saved);
}

function applyCompanyPreview(settings = {}) {
  const companyName = settings.companyName || getValue('companyName') || 'Tvoja firma';
  const metaParts = [
    settings.companyAddress || getValue('companyAddress'),
    (settings.companyOib || getValue('companyOib')) ? `OIB: ${settings.companyOib || getValue('companyOib')}` : '',
    settings.companyEmail || getValue('companyEmail'),
    settings.companyPhone || getValue('companyPhone'),
  ].filter(Boolean);

  document.getElementById('companyNamePreview').textContent = companyName;
  document.getElementById('companyMetaPreview').textContent = metaParts.length ? metaParts.join(' • ') : 'Adresa, OIB, kontakt';
  renderLogoPreview('headerLogoPreview', state.companyLogoDataUrl);
  renderLogoPreview('companyCardLogo', state.companyLogoDataUrl);
  document.getElementById('objectPhotoPreview').textContent = state.objectPhotoDataUrl ? 'Dodana slika objekta' : 'Nije dodana';
  document.getElementById('signaturePreviewStatus').textContent = state.signatureDataUrl ? 'Dodan potpis' : 'Nije dodan';
}

function renderLogoPreview(targetId, dataUrl) {
  const target = document.getElementById(targetId);
  target.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Logo" />` : '<span class="muted">Logo</span>';
}

function handleImageUpload(event, onLoad) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result);
  reader.readAsDataURL(file);
}

function handleLogoUpload(event) {
  handleImageUpload(event, (dataUrl) => {
    state.companyLogoDataUrl = dataUrl;
    applyCompanyPreview();
  });
}

function handleObjectPhotoUpload(event) {
  handleImageUpload(event, (dataUrl) => {
    state.objectPhotoDataUrl = dataUrl;
    applyCompanyPreview();
  });
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveSettings();
}

function applyTheme() {
  document.body.classList.toggle('dark', state.theme === 'dark');
  localStorage.setItem('atestTheme', state.theme);
  document.getElementById('themeBtn').textContent = state.theme === 'dark' ? '☀️ Svijetli način' : '🌙 Tamni način';
}

function openCircuitModal() {
  document.getElementById('circuitModal').classList.add('open');
  renderCircuits();
}

function closeCircuitModal() {
  document.getElementById('circuitModal').classList.remove('open');
}

function addCircuit() {
  const circuit = {
    name: getValue('circuitName'),
    breaker: getValue('circuitBreaker'),
    type: getValue('circuitType'),
    cable: getValue('circuitCable'),
    length: getValue('circuitLength'),
    zs: getValue('circuitMeasuredZs'),
    rcd: getValue('circuitRcd'),
    drop: getValue('circuitVoltageDrop'),
    result: getValue('circuitResult'),
  };

  if (!circuit.name) return;

  state.circuits.push(circuit);

  ['circuitName', 'circuitBreaker', 'circuitCable', 'circuitLength', 'circuitMeasuredZs', 'circuitVoltageDrop'].forEach((id) => {
    document.getElementById(id).value = '';
  });

  document.getElementById('circuitType').selectedIndex = 0;
  document.getElementById('circuitRcd').selectedIndex = 0;
  document.getElementById('circuitResult').selectedIndex = 0;

  renderCircuits();
  saveSettings();
}

function removeCircuit(index) {
  state.circuits.splice(index, 1);
  renderCircuits();
  saveSettings();
}

window.removeCircuit = removeCircuit;

function renderCircuits() {
  document.getElementById('circuitsSummary').textContent = state.circuits.length
    ? `Dodano krugova: ${state.circuits.length}`
    : 'Nema dodanih krugova.';

  const wrap = document.getElementById('circuitsTableWrap');
  if (!wrap) return;

  if (!state.circuits.length) {
    wrap.innerHTML = '<div class="muted">Još nema dodanih krugova.</div>';
    return;
  }

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Krug</th>
            <th>Osigurač</th>
            <th>Presjek</th>
            <th>Zs</th>
            <th>Pad</th>
            <th>Rezultat</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.circuits.map((circuit, index) => `
            <tr>
              <td>${circuit.name}</td>
              <td>${circuit.breaker || '-'}</td>
              <td>${circuit.cable || '-'}</td>
              <td>${circuit.zs || '-'}</td>
              <td>${circuit.drop || '-'}</td>
              <td>${circuit.result}</td>
              <td><button class="btn" type="button" onclick="removeCircuit(${index})">Obriši</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function openSignatureModal() {
  document.getElementById('signatureModal').classList.add('open');
  setupSignatureCanvas();
}

function closeSignatureModal() {
  document.getElementById('signatureModal').classList.remove('open');
}

function setupSignatureCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = document.body.classList.contains('dark') ? '#e5eefc' : '#0f172a';

  if (state.signatureDataUrl) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = state.signatureDataUrl;
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  let drawing = false;

  const getPosition = (event) => {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return {
      x: (point.clientX - rect.left) * (canvas.width / rect.width),
      y: (point.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  canvas.onmousedown = canvas.ontouchstart = (event) => {
    drawing = true;
    const point = getPosition(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    event.preventDefault();
  };

  canvas.onmousemove = canvas.ontouchmove = (event) => {
    if (!drawing) return;
    const point = getPosition(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    event.preventDefault();
  };

  canvas.onmouseup = canvas.onmouseleave = canvas.ontouchend = () => {
    drawing = false;
  };
}

function clearSignature() {
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveSignature() {
  const canvas = document.getElementById('signatureCanvas');
  state.signatureDataUrl = canvas.toDataURL('image/png');
  applyCompanyPreview();
  saveSettings();
  closeSignatureModal();
}

function collectProjectData() {
  const fields = {};
  document.querySelectorAll(INPUT_SELECTOR).forEach((el) => {
    fields[el.id] = el.value;
  });

  return {
    fields,
    state: { ...state },
  };
}

function saveProjectData() {
  window.StorageService.saveProject(collectProjectData());
  alert('Projekt je spremljen.');
}

function loadProjectData() {
  const saved = window.StorageService.loadProject();
  if (!Object.keys(saved).length) {
    alert('Nema spremljenog projekta.');
    return;
  }

  Object.entries(saved.fields || {}).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && el.type !== 'file') el.value = value;
  });

  Object.assign(state, saved.state || {});
  applyTheme();
  applyCompanyPreview();
  applyInstallationTypeVisibility();
  renderToggleStates();
  renderCircuits();
  renderAnalysis();
  alert('Projekt je učitan.');
}

function exportProjectJson() {
  const filename = `${getValue('projectName') || 'atest-projekt'}.json`;
  window.StorageService.exportProject(collectProjectData(), filename);
}

function generatePDF() {
  const analysis = renderAnalysis();
  window.PdfService.createPdf({
    state,
    analysis,
    getValue,
  });
}

if (window.innerWidth < 900) {
  document.querySelector('.right')?.scrollIntoView({ behavior: 'smooth' });
}
function openDatePicker() {
  document.getElementById("realDate").click();
}

function setDate(value) {
  if (!value) return;

  const d = new Date(value);
  const formatted = d.toLocaleDateString("hr-HR");

  document.getElementById("date").value = formatted;
}
window.addEventListener("load", () => {
  const today = new Date().toLocaleDateString("hr-HR");
  document.getElementById("date").value = today;
});
const today = new Date().toLocaleDateString("hr-HR");
