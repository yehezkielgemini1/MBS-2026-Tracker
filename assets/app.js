/* MBS 2026 Response Tracker — Alpine store v5 (Hub UX + Non-debitur Region/Area/Cabang) */
/* Landing hub -> Debitur detail | Non-debitur drill (Region -> Area -> Cabang). */

const TARGET_N = 1400;
const TARGET_DEBITUR = 1031;
const TARGET_NONDEBITUR = 369;
const FIELDWORK_START = '2026-05-14';
const NEAR_COMPLETE_THRESHOLD = 7;

// ============ MONOCHROMATIC BLUE GRADIENT PALETTE ============
const MI_BLUE = {
  b1: '#00153A', b2: '#001F4D', b3: '#002852', b4: '#003D79',
  b5: '#1A5394', b6: '#2C6FB5', b7: '#4A8BC4', b8: '#67B2E8',
  b9: '#A9C4DF', b10: '#D5E3F0', b11: '#EAF1F8', b12: '#F4F8FC',
};

// ============ SEKTOR ============
const SEKTOR_ORDER = [
  'Industri Pengolahan',
  'Perdagangan',
  'Lainnya',
  'Penyediaan Akomodasi dan Penyediaan Makan Minum',
  'Pertanian dan Perkebunan',
  'Konstruksi',
];
const SEKTOR_DISPLAY = {
  'Industri Pengolahan': 'Industri',
  'Perdagangan': 'Perdagangan',
  'Lainnya': 'Lainnya',
  'Penyediaan Akomodasi dan Penyediaan Makan Minum': 'Akmamin',
  'Pertanian dan Perkebunan': 'Pertanian',
  'Konstruksi': 'Konstruksi',
};
const SEKTOR_COLORS = {
  'Industri Pengolahan': MI_BLUE.b3,
  'Perdagangan': MI_BLUE.b5,
  'Lainnya': MI_BLUE.b6,
  'Penyediaan Akomodasi dan Penyediaan Makan Minum': MI_BLUE.b7,
  'Pertanian dan Perkebunan': MI_BLUE.b8,
  'Konstruksi': MI_BLUE.b9,
};

// ============ SKALA USAHA ============
const SKALA_ORDER = ['Kecil', 'Menengah'];
const SKALA_COLORS = { 'Kecil': MI_BLUE.b4, 'Menengah': MI_BLUE.b7 };

// ============ STATUS DEBITUR ============
const DEBITUR_ORDER = ['Debitur', 'Non-Debitur', 'Non-Nasabah'];
const DEBITUR_COLORS = {
  'Debitur':     MI_BLUE.b3,
  'Non-Debitur': MI_BLUE.b6,
  'Non-Nasabah': MI_BLUE.b9,
};

// ============ VALID PANELS ============
const VALID_PANELS = [
  'hub', 'nasional', 'center', 'unit',
  'debitur', 'debitur_center',
  'nondebitur', 'nd_region', 'nd_area', 'nd_cabang',
];

// ============ DATA LOADER ============
async function fetchCSV(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true, skipEmptyLines: true, dynamicTyping: true,
        complete: (results) => resolve(results.data),
      });
    });
  } catch (e) { console.warn('CSV fetch failed:', path, e); return null; }
}

async function fetchJSON(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { console.warn('JSON fetch failed:', path, e); return null; }
}

function filterN1400(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => !r.scenario || r.scenario === 'N=1400');
}

// ============ ALPINE STORE ============
function mbsApp() {
  return {
    // ----- routing state -----
    activePanel: 'hub',  // default landing
    selectedCenter: null,
    selectedUnit: null,
    // Non-debitur drill state
    selectedNdRegion: null,
    selectedNdArea: null,
    selectedNdCabang: null,

    loading: true,
    theme: 'light',

    // ----- data -----
    centersList: [],
    unitsList: [],
    targets: [],
    targetsByRegion: [],
    targetsByArea: [],
    targetsBySektor: [],
    targetsByDebitur: [],
    targetsBySektorArea: [],
    targetsDebiturByCenter: [],
    targetsNondebiturByUnit: [],
    targetsNdByRegion: [],   // targets_nondebitur_by_region.csv
    targetsNdByArea: [],     // targets_nondebitur_by_area.csv
    liveResponses: [],
    liveMetadata: null,
    liveReady: false,

    // ----- init -----
    async init() {
      this.initTheme();
      this.handleHashRoute();
      window.addEventListener('hashchange', () => {
        this.handleHashRoute();
        this.$nextTick(() => this.renderActivePanel());
      });

      const base = 'data';
      const [
        centers, units,
        targets, byRegion, byArea, bySektor, byDebitur, bySektorArea,
        debByCenter, ndebByUnit,
        ndByRegion, ndByArea,
        live, meta
      ] = await Promise.all([
        fetchCSV(`${base}/sme_banking_centers.csv`),
        fetchCSV(`${base}/sme_banking_units.csv`),
        fetchCSV(`${base}/targets.csv`),
        fetchCSV(`${base}/targets_by_region.csv`),
        fetchCSV(`${base}/targets_by_area.csv`),
        fetchCSV(`${base}/targets_by_sektor.csv`),
        fetchCSV(`${base}/targets_by_debitur.csv`),
        fetchCSV(`${base}/targets_by_sektor_area.csv`),
        fetchCSV(`${base}/targets_debitur_by_center.csv`),
        fetchCSV(`${base}/targets_nondebitur_by_unit.csv`),
        fetchCSV(`${base}/targets_nondebitur_by_region.csv`),
        fetchCSV(`${base}/targets_nondebitur_by_area.csv`),
        fetchCSV(`${base}/mbs_live_realization.csv`),
        fetchJSON(`${base}/mbs_live_metadata.json`),
      ]);

      this.centersList = (centers || []).sort((a, b) => a.order_idx - b.order_idx);
      this.unitsList = units || [];
      this.targets = filterN1400(targets || []);
      this.targetsByRegion = byRegion || [];
      this.targetsByArea = byArea || [];
      this.targetsBySektor = bySektor || [];
      this.targetsByDebitur = filterN1400(byDebitur || []);
      this.targetsBySektorArea = filterN1400(bySektorArea || []);
      this.targetsDebiturByCenter = debByCenter || [];
      this.targetsNondebiturByUnit = ndebByUnit || [];
      this.targetsNdByRegion = ndByRegion || [];
      this.targetsNdByArea = ndByArea || [];
      // Live CSV schema: response_status, region, area, cabang, skala_usaha, sektor, status_debitur
      this.liveResponses = (live || []).filter(r => r && r.response_status);
      this.liveMetadata = meta;
      this.liveReady = this.liveResponses.length > 0;

      if (this.centersList.length > 0 && !this.selectedCenter) {
        this.selectedCenter = this.centersList[0].new_center;
      }
      if (this.unitsList.length > 0 && !this.selectedUnit) {
        const firstUnit = this.unitsList.find(u => u.new_center === this.selectedCenter);
        this.selectedUnit = firstUnit ? firstUnit.new_unit : this.unitsList[0].new_unit;
      }

      // Default selectedNdRegion to first region
      if (!this.selectedNdRegion && this.targetsNdByRegion.length > 0) {
        this.selectedNdRegion = this.targetsNdByRegion[0].region;
      }

      this.loading = false;
      this.$nextTick(() => this.renderActivePanel());
    },

    // ----- routing -----
    handleHashRoute() {
      const hash = window.location.hash.replace('#', '');
      const params = new URLSearchParams(hash);
      const panel = params.get('panel');
      const center = params.get('center');
      const unit = params.get('unit');
      const ndRegion = params.get('nd_region');
      const ndArea = params.get('nd_area');
      const ndCabang = params.get('nd_cabang');

      if (panel && VALID_PANELS.includes(panel)) this.activePanel = panel;
      else if (!panel) this.activePanel = 'hub';

      if (center) this.selectedCenter = decodeURIComponent(center);
      if (unit) this.selectedUnit = decodeURIComponent(unit);
      if (ndRegion) this.selectedNdRegion = decodeURIComponent(ndRegion);
      if (ndArea) this.selectedNdArea = decodeURIComponent(ndArea);
      if (ndCabang) this.selectedNdCabang = decodeURIComponent(ndCabang);
    },

    updateHash() {
      const parts = [`panel=${this.activePanel}`];
      if (this.activePanel === 'center' && this.selectedCenter) parts.push(`center=${encodeURIComponent(this.selectedCenter)}`);
      if (this.activePanel === 'unit' && this.selectedUnit) parts.push(`unit=${encodeURIComponent(this.selectedUnit)}`);
      if (['nd_region','nd_area','nd_cabang'].includes(this.activePanel) && this.selectedNdRegion) parts.push(`nd_region=${encodeURIComponent(this.selectedNdRegion)}`);
      if (['nd_area','nd_cabang'].includes(this.activePanel) && this.selectedNdArea) parts.push(`nd_area=${encodeURIComponent(this.selectedNdArea)}`);
      if (this.activePanel === 'nd_cabang' && this.selectedNdCabang) parts.push(`nd_cabang=${encodeURIComponent(this.selectedNdCabang)}`);
      window.history.replaceState(null, '', `#${parts.join('&')}`);
    },

    switchPanel(panel) {
      this.activePanel = panel;
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    drillToCenter(center) {
      this.selectedCenter = center;
      const firstUnit = this.unitsList.find(u => u.new_center === center);
      if (firstUnit) this.selectedUnit = firstUnit.new_unit;
      this.switchPanel('center');
    },

    drillToUnit(center, unit) {
      this.selectedCenter = center;
      this.selectedUnit = unit;
      this.switchPanel('unit');
    },

    // Non-debitur drill navigation
    drillNdToArea(region) {
      this.selectedNdRegion = region;
      // Default area to first area with target in this region
      const areas = this.targetsNdByArea.filter(r => r.region === region);
      this.selectedNdArea = areas.length > 0 ? areas[0].area : null;
      this.switchPanel('nd_region');
    },

    drillNdToCabang(region, area) {
      this.selectedNdRegion = region;
      this.selectedNdArea = area;
      this.switchPanel('nd_area');
    },

    onCenterChange() {
      const firstUnit = this.unitsList.find(u => u.new_center === this.selectedCenter);
      if (firstUnit) this.selectedUnit = firstUnit.new_unit;
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    // ----- THEME -----
    initTheme() {
      const stored = localStorage.getItem('mbs-theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.theme = stored || (prefersDark ? 'dark' : 'light');
      this.applyTheme();
    },
    applyTheme() { document.documentElement.dataset.theme = this.theme; },
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('mbs-theme', this.theme);
      this.applyTheme();
      this.$nextTick(() => this.renderActivePanel());
    },

    onUnitChange() {
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    renderActivePanel() {
      if (this.activePanel === 'hub') renderHub(this);
      else if (this.activePanel === 'nasional') renderNasional(this);
      else if (this.activePanel === 'center') renderCenter(this);
      else if (this.activePanel === 'unit') renderUnit(this);
      else if (this.activePanel === 'debitur') renderDebitur(this);
      else if (this.activePanel === 'nondebitur') renderNondebiturRegion(this);
      else if (this.activePanel === 'nd_region') renderNdArea(this);
      else if (this.activePanel === 'nd_area') { /* cabang view is table-only, no chart */ }
    },

    // ----- page titles -----
    get pageTitle() {
      if (this.activePanel === 'hub') return 'Mandiri Business Survey 2026: Tracker Beranda';
      if (this.activePanel === 'nasional') return 'Mandiri Business Survey 2026: Responden Nasional';
      if (this.activePanel === 'center') return 'Mandiri Business Survey 2026: Responden per SME Banking Center';
      if (this.activePanel === 'unit') return 'Mandiri Business Survey 2026: Responden per SME Banking Unit';
      if (this.activePanel === 'debitur') return 'Mandiri Business Survey 2026: Tracking Debitur per Center';
      if (this.activePanel === 'nondebitur') return 'Mandiri Business Survey 2026: Tracking Non-debitur per Region';
      if (this.activePanel === 'nd_region') return 'Non-debitur: Area dalam ' + (this.selectedNdRegion || '—');
      if (this.activePanel === 'nd_area') return 'Non-debitur: Kode Cabang dalam ' + (this.selectedNdArea || '—');
      if (this.activePanel === 'nd_cabang') return 'Non-debitur: Cabang ' + (this.selectedNdCabang || '—');
      return 'Mandiri Business Survey 2026';
    },

    get pageSubtitle() {
      if (this.activePanel === 'center') return `SME Banking Center ${this.selectedCenter}`;
      if (this.activePanel === 'unit') return `${this.selectedCenter} · ${this.selectedUnit}`;
      if (this.activePanel === 'debitur') return '26 SME Banking Center · Debitur RM (SME-side) · Target = 1.031';
      if (this.activePanel === 'nondebitur') return '12 Branch Region · Non-debitur RM (cabang/RDPS) · Target = 369';
      if (this.activePanel === 'nd_region') return this.selectedNdRegion || '';
      if (this.activePanel === 'nd_area') return (this.selectedNdRegion || '') + ' · ' + (this.selectedNdArea || '');
      return null;
    },

    // ----- last refresh -----
    get lastRefreshLabel() {
      if (!this.liveMetadata) return 'Belum ada respons';
      const ts = this.liveMetadata.last_refresh_wib || this.liveMetadata.last_refresh;
      if (!ts) return '—';
      return ts.replace(/T/, ' ').replace(/\+.*/, '') + ' WIB';
    },

    get refreshFreshness() {
      if (!this.liveMetadata) return 'expired';
      const ts = this.liveMetadata.last_refresh;
      if (!ts) return 'expired';
      const ageH = (new Date() - new Date(ts)) / (1000 * 60 * 60);
      if (ageH < 6) return 'fresh';
      if (ageH < 12) return 'stale';
      return 'expired';
    },

    // ----- format -----
    fmt(n) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return Number(n).toLocaleString('id-ID');
    },
    fmtPct(n, digits = 1) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return Number(n).toFixed(digits) + '%';
    },

    // ----- KPI strip (scoped per panel) -----
    get kpiTarget() {
      if (this.activePanel === 'hub' || this.activePanel === 'nasional') return TARGET_N;
      if (this.activePanel === 'center') return this.targetForCenter(this.selectedCenter);
      if (this.activePanel === 'unit')   return this.targetForUnit(this.selectedUnit);
      if (this.activePanel === 'debitur' || this.activePanel === 'debitur_center') return TARGET_DEBITUR;
      if (this.activePanel === 'nondebitur') return TARGET_NONDEBITUR;
      if (this.activePanel === 'nd_region') {
        const row = this.targetsNdByRegion.find(r => r.region === this.selectedNdRegion);
        return row ? (row.target_nondebitur || 0) : 0;
      }
      if (this.activePanel === 'nd_area') {
        const rows = this.targetsNdByArea.filter(r => r.region === this.selectedNdRegion && r.area === this.selectedNdArea);
        return rows.reduce((s, r) => s + (r.target_nondebitur || 0), 0);
      }
      return 0;
    },
    get kpiAktual() {
      if (!this.liveReady) return null;
      const completed = this.liveResponses.filter(r => r.response_status === 'completed');
      if (this.activePanel === 'hub' || this.activePanel === 'nasional') return completed.length;
      if (this.activePanel === 'center') return this.aktualForCenter(this.selectedCenter);
      if (this.activePanel === 'unit') return this.aktualForUnit(this.selectedUnit);
      if (this.activePanel === 'debitur' || this.activePanel === 'debitur_center') {
        return completed.filter(r => r.status_debitur === 'Debitur').length;
      }
      if (this.activePanel === 'nondebitur') {
        return completed.filter(r => r.status_debitur === 'Non-Debitur').length;
      }
      if (this.activePanel === 'nd_region') {
        return this.aktualNdForRegion(this.selectedNdRegion);
      }
      if (this.activePanel === 'nd_area') {
        return this.aktualNdForArea(this.selectedNdRegion, this.selectedNdArea);
      }
      return 0;
    },
    get kpiCompletionPct() {
      if (!this.liveReady) return null;
      const t = this.kpiTarget;
      const a = this.kpiAktual || 0;
      return t > 0 ? (a / t) * 100 : 0;
    },
    get kpiDefisit() {
      if (!this.liveReady) return null;
      return Math.max(0, this.kpiTarget - (this.kpiAktual || 0));
    },
    get kpiScopeLabel() {
      if (this.activePanel === 'hub') return 'Nasional · N=1.400 · Debitur + Non-debitur';
      if (this.activePanel === 'nasional') return 'Nasional · N=1.400 · 26 Center · 103 Unit';
      if (this.activePanel === 'center') return this.selectedCenter;
      if (this.activePanel === 'unit') return this.selectedUnit;
      if (this.activePanel === 'debitur' || this.activePanel === 'debitur_center') return 'Debitur · 26 SME Banking Center';
      if (this.activePanel === 'nondebitur') return 'Non-debitur · 12 Branch Region';
      if (this.activePanel === 'nd_region') return (this.selectedNdRegion || '') + ' · Non-debitur';
      if (this.activePanel === 'nd_area') return (this.selectedNdArea || '') + ' · Non-debitur';
      return '';
    },

    // ----- filter meta badge -----
    get filterMetaText() {
      if (this.activePanel === 'center') return '26 SME Banking Center · geografis order';
      if (this.activePanel === 'unit') {
        const n = this.unitsInCenter(this.selectedCenter).length;
        return `${n} Unit dalam ${this.selectedCenter}`;
      }
      return '';
    },

    // ----- target getters -----
    targetForCenter(center) {
      const row = this.targetsByRegion.find(r => r.region === center);
      return row ? row.target_count : 0;
    },
    targetForUnit(unit) {
      const row = this.targetsByArea.find(r => r.area === unit);
      return row ? row.target_count : 0;
    },
    targetDebiturForCenter(center) {
      const row = this.targetsDebiturByCenter.find(r => r.region === center);
      return row ? (row.target_debitur || 0) : 0;
    },
    targetNondebiturForUnit(unit) {
      const row = this.targetsNondebiturByUnit.find(r => r.area === unit);
      return row ? (row.target_nondebitur || 0) : 0;
    },
    targetNdForRegion(region) {
      const row = this.targetsNdByRegion.find(r => r.region === region);
      return row ? (row.target_nondebitur || 0) : 0;
    },
    targetNdForArea(region, area) {
      const rows = this.targetsNdByArea.filter(r => r.region === region && r.area === area);
      return rows.reduce((s, r) => s + (r.target_nondebitur || 0), 0);
    },

    // ----- aktual getters -----
    aktualForCenter(center) {
      return this.liveResponses.filter(r =>
        r.response_status === 'completed' && r.region === center
      ).length;
    },
    aktualForUnit(unit) {
      return this.liveResponses.filter(r =>
        r.area === unit && r.response_status === 'completed'
      ).length;
    },
    aktualDebiturForCenter(center) {
      return this.liveResponses.filter(r =>
        r.response_status === 'completed' && r.region === center && r.status_debitur === 'Debitur'
      ).length;
    },
    aktualNondebiturForUnit(unit) {
      return this.liveResponses.filter(r =>
        r.response_status === 'completed' && r.area === unit && r.status_debitur === 'Non-Debitur'
      ).length;
    },
    // Non-debitur actuals keyed by branch Region (survey Q291838127 dropdown label)
    aktualNdForRegion(region) {
      return this.liveResponses.filter(r =>
        r.response_status === 'completed' &&
        r.status_debitur === 'Non-Debitur' &&
        r.region === region
      ).length;
    },
    // Non-debitur actuals keyed by Area (free text from Q291838128)
    aktualNdForArea(region, area) {
      return this.liveResponses.filter(r =>
        r.response_status === 'completed' &&
        r.status_debitur === 'Non-Debitur' &&
        r.region === region &&
        r.area === area
      ).length;
    },
    // Non-debitur actuals keyed by Kode Cabang (free text from Q291838129)
    aktualNdForCabang(region, area, cabang) {
      return this.liveResponses.filter(r =>
        r.response_status === 'completed' &&
        r.status_debitur === 'Non-Debitur' &&
        r.region === region &&
        r.area === area &&
        r.cabang === cabang
      ).length;
    },

    unitsInCenter(center) {
      return this.unitsList.filter(u => u.new_center === center);
    },

    // ----- Skala Usaha summary -----
    skalaUsahaSummary(scope) {
      const result = SKALA_ORDER.map(s => ({ skala: s, target: 0, aktual: 0 }));

      let rows = this.targets;
      if (scope.mode === 'center') rows = rows.filter(r => r.region === scope.value);
      if (scope.mode === 'unit')   rows = rows.filter(r => r.area === scope.value);
      rows.forEach(r => {
        const idx = SKALA_ORDER.indexOf(r.skala_usaha);
        if (idx >= 0) result[idx].target += (r.target_count || 0);
      });

      let aktualRows = this.liveResponses.filter(r => r.response_status === 'completed');
      if (scope.mode === 'center') aktualRows = aktualRows.filter(r => r.region === scope.value);
      if (scope.mode === 'unit')   aktualRows = aktualRows.filter(r => r.area === scope.value);
      aktualRows.forEach(r => {
        const idx = SKALA_ORDER.indexOf(r.skala_usaha);
        if (idx >= 0) result[idx].aktual += 1;
      });

      return result.filter(r => r.target > 0 || r.aktual > 0);
    },

    // ----- Sektor summary -----
    sektorSummary(scope) {
      const result = SEKTOR_ORDER.map(s => ({ sektor: s, target: 0, aktual: 0 }));

      if (scope.mode === 'nasional' || scope.mode === 'hub') {
        this.targetsBySektor.forEach(r => {
          const idx = SEKTOR_ORDER.indexOf(r.sektor);
          if (idx >= 0) result[idx].target = r.target_count;
        });
      } else {
        let rows = this.targetsBySektorArea;
        if (scope.mode === 'center') rows = rows.filter(r => r.region === scope.value);
        if (scope.mode === 'unit')   rows = rows.filter(r => r.area === scope.value);
        rows.forEach(r => {
          const idx = SEKTOR_ORDER.indexOf(r.sektor);
          if (idx >= 0) result[idx].target += (r.target_count || 0);
        });
      }

      let aktualRows = this.liveResponses.filter(r => r.response_status === 'completed');
      if (scope.mode === 'center') aktualRows = aktualRows.filter(r => r.region === scope.value);
      if (scope.mode === 'unit')   aktualRows = aktualRows.filter(r => r.area === scope.value);
      aktualRows.forEach(r => {
        const idx = SEKTOR_ORDER.indexOf(r.sektor);
        if (idx >= 0) result[idx].aktual += 1;
      });

      return result.filter(r => r.target > 0 || r.aktual > 0);
    },

    // ----- Debitur summary -----
    debiturSummary(scope) {
      const result = DEBITUR_ORDER.map(s => ({ status: s, target: 0, aktual: 0 }));
      let rows = this.targetsByDebitur;
      if (scope.mode === 'center') rows = rows.filter(r => r.region === scope.value);
      if (scope.mode === 'unit')   rows = rows.filter(r => r.area === scope.value);
      rows.forEach(r => {
        const idx = DEBITUR_ORDER.indexOf(r.status_debitur);
        if (idx >= 0) result[idx].target += (r.target_count || 0);
      });
      let aktualRows = this.liveResponses.filter(r => r.response_status === 'completed');
      if (scope.mode === 'center') aktualRows = aktualRows.filter(r => r.region === scope.value);
      if (scope.mode === 'unit')   aktualRows = aktualRows.filter(r => r.area === scope.value);
      aktualRows.forEach(r => {
        const idx = DEBITUR_ORDER.indexOf(r.status_debitur);
        if (idx >= 0) result[idx].aktual += 1;
      });
      return result.filter(r => r.target > 0 || r.aktual > 0);
    },

    // ----- Tabel 1: Ringkasan Performa (Nasional / Center) -----
    summaryTableNasional() {
      return this.centersList.map(c => {
        const center = c.new_center;
        const target = this.targetForCenter(center);
        const aktual = this.aktualForCenter(center);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        return { center, display: center, target, aktual, defisit, pct };
      });
    },

    summaryTableCenter() {
      return this.unitsInCenter(this.selectedCenter).map(u => {
        const unit = u.new_unit;
        const target = this.targetForUnit(unit);
        const aktual = this.aktualForUnit(unit);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        return { center: u.new_center, unit, target, aktual, defisit, pct };
      }).sort((a, b) => b.target - a.target);
    },

    // ----- Tabel 2: Matriks Sektor -----
    matrixSkalaSektor() {
      let groups = [];
      if (this.activePanel === 'nasional') {
        groups = this.centersList.map(c => ({
          key: c.new_center, label: c.new_center,
          rows: this.targetsBySektorArea.filter(r => r.region === c.new_center),
          aktualFilter: (r) => r.response_status === 'completed' && r.region === c.new_center,
        }));
      } else if (this.activePanel === 'center') {
        const units = this.unitsInCenter(this.selectedCenter);
        groups = units.map(u => ({
          key: u.new_unit, label: u.new_unit,
          rows: this.targetsBySektorArea.filter(r => r.area === u.new_unit),
          aktualFilter: (r) => r.response_status === 'completed' && r.area === u.new_unit,
        }));
      } else if (this.activePanel === 'unit') {
        groups = [{
          key: this.selectedUnit, label: this.selectedUnit,
          rows: this.targetsBySektorArea.filter(r => r.area === this.selectedUnit),
          aktualFilter: (r) => r.response_status === 'completed' && r.area === this.selectedUnit,
        }];
      }

      return groups.map(g => {
        const cells = {};
        let rowTotalTarget = 0, rowTotalAktual = 0;
        SEKTOR_ORDER.forEach(sektor => {
          const target = g.rows.filter(r => r.sektor === sektor).reduce((s, r) => s + (r.target_count || 0), 0);
          const aktual = this.liveResponses.filter(r => g.aktualFilter(r) && r.sektor === sektor).length;
          const pct = target > 0 ? (aktual / target * 100) : 0;
          cells[sektor] = { target, aktual, pct };
          rowTotalTarget += target;
          rowTotalAktual += aktual;
        });
        const rowPct = rowTotalTarget > 0 ? (rowTotalAktual / rowTotalTarget * 100) : 0;
        return { key: g.key, label: g.label, cells, totalTarget: rowTotalTarget, totalAktual: rowTotalAktual, totalPct: rowPct };
      });
    },

    matrixSkalaSektorFlat() {
      return this.matrixSkalaSektor().map(item => {
        const flatCells = [];
        SEKTOR_ORDER.forEach(sektor => {
          const c = item.cells[sektor] || { target: 0, aktual: 0, pct: 0 };
          flatCells.push({ type: 'target', value: c.target });
          flatCells.push({ type: 'aktual', value: c.aktual });
          flatCells.push({ type: 'pct', value: c.pct });
        });
        return { ...item, flatCells };
      });
    },

    flatCellText(cell) {
      if (cell.type === 'target') return cell.value > 0 ? this.fmt(cell.value) : '—';
      if (cell.type === 'aktual') return this.liveReady ? (cell.value || 0) : '—';
      if (cell.type === 'pct') return this.liveReady ? this.fmtPct(cell.value, 0) : '—';
      return '';
    },

    // ----- Drill-down -----
    onSummaryRowClick(row) {
      if (this.activePanel === 'nasional') this.drillToCenter(row.center);
      else if (this.activePanel === 'center') this.drillToUnit(row.center, row.unit);
    },
    onMatrixRowClick(item) {
      if (this.activePanel === 'nasional') this.drillToCenter(item.key);
      else if (this.activePanel === 'center') this.drillToUnit(this.selectedCenter, item.key);
    },

    // ----- Debitur: table per center -----
    summaryTableDebitur() {
      return this.centersList.map(c => {
        const center = c.new_center;
        const target = this.targetDebiturForCenter(center);
        const aktual = this.aktualDebiturForCenter(center);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        return { center, target, aktual, defisit, pct };
      });
    },

    // ----- Non-debitur (old unit view — kept for legacy nondebitur_by_unit logic if needed) -----
    summaryTableNondebitur() {
      const centerOrder = this.centersList.map(c => c.new_center);
      const rows = this.unitsList.map(u => {
        const unit = u.new_unit;
        const center = u.new_center;
        const target = this.targetNondebiturForUnit(unit);
        const aktual = this.aktualNondebiturForUnit(unit);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        const centerIdx = centerOrder.indexOf(center);
        return { center, unit, target, aktual, defisit, pct, centerIdx };
      });
      rows.sort((a, b) => {
        if (a.centerIdx !== b.centerIdx) return a.centerIdx - b.centerIdx;
        return b.target - a.target;
      });
      return rows;
    },

    // ----- Non-debitur: Region overview table -----
    summaryTableNdRegion() {
      return this.targetsNdByRegion.map(r => {
        const region = r.region;
        const target = r.target_nondebitur || 0;
        const aktual = this.aktualNdForRegion(region);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        return { region, target, aktual, defisit, pct };
      });
    },

    // ----- Non-debitur: Area table within a Region -----
    summaryTableNdArea(region) {
      // Build from targetsNdByArea filtered by region
      const areaRows = this.targetsNdByArea.filter(r => r.region === region);
      return areaRows.map(r => {
        const area = r.area;
        const target = r.target_nondebitur || 0;
        const aktual = this.aktualNdForArea(region, area);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        return { area, target, aktual, defisit, pct };
      }).sort((a, b) => b.target - a.target);
    },

    // ----- Non-debitur: Cabang table within Region+Area (actuals only) -----
    ndCabangTableRows(region, area) {
      if (!this.liveReady) return [];
      // Group completed non-debitur responses by cabang for this region+area
      const filtered = this.liveResponses.filter(r =>
        r.response_status === 'completed' &&
        r.status_debitur === 'Non-Debitur' &&
        r.region === region &&
        r.area === area
      );
      const byKode = {};
      filtered.forEach(r => {
        const kode = (r.cabang || '(tanpa kode)').trim() || '(tanpa kode)';
        byKode[kode] = (byKode[kode] || 0) + 1;
      });
      return Object.entries(byKode)
        .map(([cabang, aktual]) => ({ cabang, aktual }))
        .sort((a, b) => b.aktual - a.aktual);
    },
  };
}
