/* MBS 2026 Response Tracker - Alpine store v6 (Hub UX v2) */
/* Landing hub -> Debitur page (Per Center / Per Unit) | Non-debitur page (Per Region / Per Area). */

const TARGET_N = 1400;
const TARGET_DEBITUR = 1031;
const TARGET_NONDEBITUR = 369;

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

// ============ VALID PANELS ============
const VALID_PANELS = ['home', 'debitur', 'nondebitur'];

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
    activePanel: 'home',     // 'home' | 'debitur' | 'nondebitur'
    debSub: 'center',        // debitur sub-tab: 'center' | 'unit'
    ndSub: 'region',         // non-debitur sub-tab: 'region' | 'area'
    selectedCenter: null,    // debitur Per Center drill (null = overview)
    ndRegionFilter: '',      // non-debitur Per Area region filter ('' = all)

    loading: true,
    theme: 'light',

    // ----- data -----
    centersList: [],
    unitsList: [],
    targets: [],                 // targets.csv (skala donut target, N=1400)
    targetsBySektor: [],         // targets_by_sektor.csv
    targetsByDebitur: [],        // targets_by_debitur.csv (per-unit debitur targets)
    targetsDebiturByCenter: [],  // targets_debitur_by_center.csv
    targetsNdByRegion: [],       // targets_nondebitur_by_region.csv
    targetsNdByArea: [],         // targets_nondebitur_by_area.csv
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
        targets, bySektor, byDebitur,
        debByCenter, ndByRegion, ndByArea,
        live, meta
      ] = await Promise.all([
        fetchCSV(`${base}/sme_banking_centers.csv`),
        fetchCSV(`${base}/sme_banking_units.csv`),
        fetchCSV(`${base}/targets.csv`),
        fetchCSV(`${base}/targets_by_sektor.csv`),
        fetchCSV(`${base}/targets_by_debitur.csv`),
        fetchCSV(`${base}/targets_debitur_by_center.csv`),
        fetchCSV(`${base}/targets_nondebitur_by_region.csv`),
        fetchCSV(`${base}/targets_nondebitur_by_area.csv`),
        fetchCSV(`${base}/mbs_live_realization.csv`),
        fetchJSON(`${base}/mbs_live_metadata.json`),
      ]);

      this.centersList = (centers || []).sort((a, b) => a.order_idx - b.order_idx);
      this.unitsList = units || [];
      this.targets = filterN1400(targets || []);
      this.targetsBySektor = bySektor || [];
      this.targetsByDebitur = filterN1400(byDebitur || []);
      this.targetsDebiturByCenter = debByCenter || [];
      this.targetsNdByRegion = ndByRegion || [];
      this.targetsNdByArea = ndByArea || [];
      // Live CSV schema: response_status, region, area, cabang, skala_usaha, sektor, status_debitur
      // (cabang column stays in the pipeline but is not displayed in the UI)
      this.liveResponses = (live || []).filter(r => r && r.response_status);
      this.liveMetadata = meta;
      this.liveReady = this.liveResponses.length > 0;

      this.loading = false;
      this.$nextTick(() => this.renderActivePanel());
    },

    // ----- routing -----
    handleHashRoute() {
      const hash = window.location.hash.replace('#', '');
      const params = new URLSearchParams(hash);
      let panel = params.get('panel') || 'home';
      let sub = params.get('sub');
      const center = params.get('center');
      const ndRegion = params.get('nd_region');

      // Legacy hash fallbacks (pre-v6 panels)
      if (panel === 'hub' || panel === 'nasional') {
        panel = 'home';
      } else if (panel === 'center' || panel === 'debitur_center') {
        panel = 'debitur'; sub = sub || 'center';
      } else if (panel === 'unit') {
        panel = 'debitur'; sub = sub || 'unit';
      } else if (['nd_region', 'nd_area', 'nd_cabang'].includes(panel)) {
        panel = 'nondebitur'; sub = 'area';
      }
      if (!VALID_PANELS.includes(panel)) panel = 'home';

      this.activePanel = panel;
      if (panel === 'debitur') {
        this.debSub = ['center', 'unit'].includes(sub) ? sub : 'center';
        this.selectedCenter = (this.debSub === 'center' && center) ? center : null;
      }
      if (panel === 'nondebitur') {
        this.ndSub = ['region', 'area'].includes(sub) ? sub : 'region';
        this.ndRegionFilter = (this.ndSub === 'area' && ndRegion) ? ndRegion : '';
      }
    },

    updateHash() {
      const parts = [`panel=${this.activePanel}`];
      if (this.activePanel === 'debitur') {
        parts.push(`sub=${this.debSub}`);
        if (this.debSub === 'center' && this.selectedCenter) {
          parts.push(`center=${encodeURIComponent(this.selectedCenter)}`);
        }
      }
      if (this.activePanel === 'nondebitur') {
        parts.push(`sub=${this.ndSub}`);
        if (this.ndSub === 'area' && this.ndRegionFilter) {
          parts.push(`nd_region=${encodeURIComponent(this.ndRegionFilter)}`);
        }
      }
      window.history.replaceState(null, '', `#${parts.join('&')}`);
    },

    switchPanel(panel) {
      this.activePanel = panel;
      // Reset segment state when entering a page fresh (nav / card / breadcrumb)
      if (panel === 'debitur') { this.debSub = 'center'; this.selectedCenter = null; }
      if (panel === 'nondebitur') { this.ndSub = 'region'; this.ndRegionFilter = ''; }
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    switchDebSub(sub) {
      this.debSub = sub;
      this.selectedCenter = null;
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    drillDebCenter(center) {
      this.debSub = 'center';
      this.selectedCenter = center;
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    backToCenters() {
      this.selectedCenter = null;
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    switchNdSub(sub) {
      this.ndSub = sub;
      if (sub === 'region') this.ndRegionFilter = '';
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    drillNdRegion(region) {
      this.ndSub = 'area';
      this.ndRegionFilter = region;
      this.updateHash();
      this.$nextTick(() => this.renderActivePanel());
    },

    onNdFilterChange() {
      this.updateHash();
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

    renderActivePanel() {
      if (this.activePanel === 'home') renderHome(this);
      else if (this.activePanel === 'debitur') renderDebiturPanel(this);
      else if (this.activePanel === 'nondebitur') renderNondebiturPanel(this);
    },

    // ----- page titles -----
    get pageTitle() {
      if (this.activePanel === 'debitur') return 'Mandiri Business Survey 2026: Tracking Debitur';
      if (this.activePanel === 'nondebitur') return 'Mandiri Business Survey 2026: Tracking Non-debitur';
      return 'Mandiri Business Survey 2026: Tracker Beranda';
    },

    // ----- last refresh -----
    get lastRefreshLabel() {
      if (!this.liveMetadata) return 'Belum ada respons';
      const ts = this.liveMetadata.last_refresh_wib || this.liveMetadata.last_refresh;
      if (!ts) return '-';
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
      if (n === null || n === undefined || isNaN(n)) return '-';
      return Number(n).toLocaleString('id-ID');
    },
    fmtPct(n, digits = 1) {
      if (n === null || n === undefined || isNaN(n)) return '-';
      return Number(n).toFixed(digits) + '%';
    },
    ndRegionShort(region) {
      return String(region || '').replace(/^Region\s+\w+\s+-\s+/, '');
    },
    // ----- color coding capaian (6-tier, palet Bank Mandiri) -----
    // 0% abu | <25% oranye | <50% gold | <75% biru muda | <100% biru Mandiri | >=100% hijau
    barClass(pct) {
      if (pct === null || pct === undefined || isNaN(pct)) return '';
      if (pct <= 0) return 't-zero';
      if (pct < 25) return 't-low';
      if (pct < 50) return 't-mid';
      if (pct < 75) return 't-ontrack';
      if (pct < 100) return 't-good';
      return 't-done';
    },

    // ----- live row helpers (completed-only counting, filter on response_status) -----
    completedRows() {
      return this.liveResponses.filter(r => r.response_status === 'completed');
    },
    completedSegment(status) {
      return this.completedRows().filter(r => r.status_debitur === status);
    },
    get aktualDebitur() { return this.completedSegment('Debitur').length; },
    get aktualNondebitur() { return this.completedSegment('Non-Debitur').length; },

    // ----- KPI strip (scoped per panel) -----
    get kpiTarget() {
      if (this.activePanel === 'debitur') {
        if (this.debSub === 'center' && this.selectedCenter) return this.targetDebiturForCenter(this.selectedCenter);
        return TARGET_DEBITUR;
      }
      if (this.activePanel === 'nondebitur') return TARGET_NONDEBITUR;
      return TARGET_N;
    },
    get kpiAktual() {
      if (!this.liveReady) return null;
      if (this.activePanel === 'debitur') {
        if (this.debSub === 'center' && this.selectedCenter) return this.aktualDebiturForCenter(this.selectedCenter);
        return this.aktualDebitur;
      }
      if (this.activePanel === 'nondebitur') return this.aktualNondebitur;
      return this.completedRows().length;
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
      if (this.activePanel === 'debitur') {
        if (this.debSub === 'center' && this.selectedCenter) return this.selectedCenter + ' · Debitur';
        return 'Debitur · 26 SME Banking Center';
      }
      if (this.activePanel === 'nondebitur') return 'Non-debitur · 12 Branch Region';
      return 'Nasional · N=1.400 · Debitur + Non-debitur';
    },

    // ----- target getters -----
    targetDebiturForCenter(center) {
      const row = this.targetsDebiturByCenter.find(r => r.region === center);
      return row ? (row.target_debitur || 0) : 0;
    },
    targetDebiturForUnit(unit) {
      return this.targetsByDebitur
        .filter(r => r.area === unit && r.status_debitur === 'Debitur')
        .reduce((s, r) => s + (r.target_count || 0), 0);
    },
    targetNdForRegion(region) {
      const row = this.targetsNdByRegion.find(r => r.region === region);
      return row ? (row.target_nondebitur || 0) : 0;
    },

    // ----- aktual getters -----
    aktualDebiturForCenter(center) {
      return this.completedSegment('Debitur').filter(r => r.region === center).length;
    },
    aktualDebiturForUnit(unit) {
      return this.completedSegment('Debitur').filter(r => r.area === unit).length;
    },
    aktualNdForRegion(region) {
      return this.completedSegment('Non-Debitur').filter(r => r.region === region).length;
    },
    aktualNdForArea(region, area) {
      return this.completedSegment('Non-Debitur').filter(r => r.region === region && r.area === area).length;
    },

    unitsInCenter(center) {
      return this.unitsList.filter(u => u.new_center === center);
    },

    // ----- HOME: profile donuts (target vs aktual, national) -----
    skalaUsahaSummaryNasional() {
      const result = SKALA_ORDER.map(s => ({ label: s, target: 0, aktual: 0 }));
      this.targets.forEach(r => {
        const idx = SKALA_ORDER.indexOf(r.skala_usaha);
        if (idx >= 0) result[idx].target += (r.target_count || 0);
      });
      this.completedRows().forEach(r => {
        const idx = SKALA_ORDER.indexOf(r.skala_usaha);
        if (idx >= 0) result[idx].aktual += 1;
      });
      return result.filter(r => r.target > 0 || r.aktual > 0);
    },

    sektorSummaryNasional() {
      const result = SEKTOR_ORDER.map(s => ({ label: s, target: 0, aktual: 0 }));
      this.targetsBySektor.forEach(r => {
        const idx = SEKTOR_ORDER.indexOf(r.sektor);
        if (idx >= 0) result[idx].target = r.target_count || 0;
      });
      this.completedRows().forEach(r => {
        const idx = SEKTOR_ORDER.indexOf(r.sektor);
        if (idx >= 0) result[idx].aktual += 1;
      });
      return result.filter(r => r.target > 0 || r.aktual > 0);
    },

    // ----- SEGMENT: profile donuts (aktual-only) -----
    skalaAktualBySegment(status) {
      const result = SKALA_ORDER.map(s => ({ label: s, aktual: 0 }));
      this.completedSegment(status).forEach(r => {
        const idx = SKALA_ORDER.indexOf(r.skala_usaha);
        if (idx >= 0) result[idx].aktual += 1;
      });
      return result.filter(r => r.aktual > 0);
    },

    sektorAktualBySegment(status) {
      const result = SEKTOR_ORDER.map(s => ({ label: s, aktual: 0 }));
      this.completedSegment(status).forEach(r => {
        const idx = SEKTOR_ORDER.indexOf(r.sektor);
        if (idx >= 0) result[idx].aktual += 1;
      });
      return result.filter(r => r.aktual > 0);
    },

    // ----- DEBITUR: Per Center table (26 centers) -----
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

    // ----- DEBITUR: center detail (units within one center) -----
    debiturUnitRowsForCenter(center) {
      const units = this.unitsInCenter(center);
      const unitNames = new Set(units.map(u => u.new_unit));
      const rows = units.map(u => {
        const unit = u.new_unit;
        const target = this.targetDebiturForUnit(unit);
        const aktual = this.aktualDebiturForUnit(unit);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        return { unit, target, aktual, defisit, pct, unmapped: false };
      }).sort((a, b) => b.target - a.target);
      // Bucket: completed debitur rows in this center whose area does not match any unit
      const unmappedCount = this.completedSegment('Debitur').filter(r =>
        r.region === center && !unitNames.has(String(r.area || '').trim())
      ).length;
      if (unmappedCount > 0) {
        rows.push({ unit: 'Belum terpetakan', target: null, aktual: unmappedCount, defisit: null, pct: null, unmapped: true });
      }
      return rows;
    },

    // ----- DEBITUR: Per Unit table (103 units + unmapped bucket) -----
    summaryTableDebiturUnit() {
      const centerOrder = this.centersList.map(c => c.new_center);
      const unitNames = new Set(this.unitsList.map(u => u.new_unit));
      const rows = this.unitsList.map(u => {
        const unit = u.new_unit;
        const center = u.new_center;
        const target = this.targetDebiturForUnit(unit);
        const aktual = this.aktualDebiturForUnit(unit);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        const centerIdx = centerOrder.indexOf(center);
        return { center, unit, target, aktual, defisit, pct, centerIdx, unmapped: false };
      });
      rows.sort((a, b) => {
        if (a.centerIdx !== b.centerIdx) return a.centerIdx - b.centerIdx;
        return b.target - a.target;
      });
      // Bucket: completed debitur rows whose area does not match any known unit name
      const unmappedCount = this.completedSegment('Debitur').filter(r =>
        !unitNames.has(String(r.area || '').trim())
      ).length;
      rows.push({ center: '-', unit: 'Belum terpetakan', target: null, aktual: unmappedCount, defisit: null, pct: null, centerIdx: 999, unmapped: true });
      return rows;
    },

    // ----- NON-DEBITUR: Per Region table (12 regions) -----
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

    // ----- NON-DEBITUR: Per Area table (optionally filtered by region) -----
    ndAreaRows() {
      let rows = this.targetsNdByArea;
      if (this.ndRegionFilter) rows = rows.filter(r => r.region === this.ndRegionFilter);
      return rows.map(r => {
        const region = r.region;
        const area = r.area;
        const target = r.target_nondebitur || 0;
        const aktual = this.aktualNdForArea(region, area);
        const defisit = Math.max(0, target - aktual);
        const pct = target > 0 ? (aktual / target * 100) : 0;
        return { region, area, target, aktual, defisit, pct };
      });
    },
  };
}
