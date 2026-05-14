/* MBS 2026 Response Tracker — Plotly chart factories v3 (SME Banking Center) */

const PLOTLY_BASE_LAYOUT = {
  paper_bgcolor: '#FFFFFF',
  plot_bgcolor: '#FFFFFF',
  font: { family: 'Inter, system-ui, sans-serif', size: 12, color: '#051C2C' },
  margin: { l: 60, r: 30, t: 30, b: 60 },
  hoverlabel: { bgcolor: '#001F4D', font: { color: '#FFFFFF', family: 'Inter, sans-serif', size: 12 }, bordercolor: '#003D79' },
};
const PLOTLY_CONFIG = { displayModeBar: false, responsive: true };

function emptyNote(domId, msg) {
  const el = document.getElementById(domId);
  if (el) el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:280px;color:#667085;font-size:13px;letter-spacing:0.02em;">${msg}</div>`;
}

// ============ BAGIAN A: 3 DONUT (Skala, Sektor, Debitur) ============

function renderDonut(domId, items, colorMap, app, useShortLabel = false) {
  if (!items.length) { emptyNote(domId, 'Belum ada data'); return; }
  const useAktual = app.liveReady && items.some(i => i.aktual > 0);
  const values = items.map(i => useAktual ? i.aktual : i.target);
  // first key dynamically: 'skala' / 'sektor' / 'status'
  const labels = items.map(i => Object.values(i)[0]);
  const colors = labels.map(l => colorMap[l] || '#67B2E8');
  const total = values.reduce((a, b) => a + b, 0);

  const displayLabels = useShortLabel
    ? labels.map(l => SEKTOR_DISPLAY[l] || l)
    : labels;

  const textLabels = items.map((it, i) => {
    const v = values[i];
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
    return `${displayLabels[i]}<br><b>${pct}%</b> · n=${v}`;
  });

  Plotly.newPlot(domId, [{
    values, labels: displayLabels,
    type: 'pie', hole: 0.55,
    marker: { colors, line: { color: '#FFFFFF', width: 1 } },
    text: textLabels, textinfo: 'text', textposition: 'outside',
    textfont: { size: 11, family: 'Inter, sans-serif', color: '#003D79' },
    automargin: true,
    hovertemplate: '<b>%{label}</b><br>n = %{value}<br>%{percent}<extra></extra>',
    sort: false, direction: 'clockwise',
  }], {
    ...PLOTLY_BASE_LAYOUT,
    margin: { l: 20, r: 20, t: 30, b: 30 },
    showlegend: false,
    annotations: [{
      text: `<b>${total}</b><br><span style="font-size:10px;color:#667085;">${useAktual ? 'Aktual' : 'Target'}</span>`,
      x: 0.5, y: 0.5, font: { size: 18, family: 'Source Serif 4', color: '#002852' },
      showarrow: false,
    }],
  }, PLOTLY_CONFIG);
}

function renderDonutSkala(app, scope) {
  renderDonut('chart-donut-skala', app.skalaUsahaSummary(scope), SKALA_COLORS, app);
}
function renderDonutSektor(app, scope) {
  renderDonut('chart-donut-sektor', app.sektorSummary(scope), SEKTOR_COLORS, app, /* short label */ true);
}
function renderDonutDebitur(app, scope) {
  renderDonut('chart-donut-debitur', app.debiturSummary(scope), DEBITUR_COLORS, app);
}

// ============ BAGIAN B: BAR TARGET vs AKTUAL ============

function renderBarTargetVsAktual(domId, items, labelKey) {
  const el = document.getElementById(domId);
  if (!items.length) { emptyNote(domId, 'Belum ada data'); return; }
  const labels = items.map(i => i[labelKey]);
  const targets = items.map(i => i.target);
  const aktuals = items.map(i => i.aktual);

  const targetTextLabels = targets.map(v => v > 0 ? String(v) : '');
  const aktualTextLabels = aktuals.map(v => v > 0 ? String(v) : '');

  // Bottom margin = x-axis labels (rotated) + extra ruang untuk legend di bawah
  const maxLabelLen = Math.max(...labels.map(l => String(l).length));
  const labelSpace = Math.min(280, Math.max(160, maxLabelLen * 7.5));
  const legendSpace = 70;
  const bottomMargin = labelSpace + legendSpace;

  // Chart tinggi: plot area 320px + top margin 50 + bottomMargin
  const chartHeight = 320 + 50 + bottomMargin;
  if (el) { el.style.minHeight = chartHeight + 'px'; }

  // Plot area height = chartHeight - topMargin - bottomMargin = 320
  // Legend Y dalam normalized coords (plot fraction): position right below labels
  // labelSpace / plotHeight = position of label bottom (negative)
  // Add small buffer untuk spacing legend dari label
  const plotHeight = 320;
  const legendY = -(labelSpace + 25) / plotHeight;  // 25px buffer

  // Y-axis padding — kasih headroom 15% di atas max value supaya data label tidak kepotong
  const maxY = Math.max(...targets, ...aktuals, 1);
  const yMax = maxY * 1.18;

  Plotly.newPlot(domId, [
    {
      x: labels, y: targets, type: 'bar', name: 'Target',
      marker: { color: MI_BLUE.b9, line: { color: MI_BLUE.b7, width: 1 } },
      text: targetTextLabels, textposition: 'outside',
      textfont: { size: 10, family: 'Inter, sans-serif', color: MI_BLUE.b5 },
      cliponaxis: false,
      hovertemplate: '<b>%{x}</b><br>Target: %{y}<extra></extra>',
    },
    {
      x: labels, y: aktuals, type: 'bar', name: 'Aktual',
      marker: { color: MI_BLUE.b3 },
      text: aktualTextLabels, textposition: 'outside',
      textfont: { size: 10, family: 'Inter, sans-serif', color: MI_BLUE.b2, weight: 600 },
      cliponaxis: false,
      hovertemplate: '<b>%{x}</b><br>Aktual: %{y}<extra></extra>',
    },
  ], {
    ...PLOTLY_BASE_LAYOUT,
    barmode: 'group', bargap: 0.25, bargroupgap: 0.08,
    xaxis: {
      tickangle: -45,
      gridcolor: MI_BLUE.b11,
      tickfont: { size: 10, color: MI_BLUE.b3 },
      automargin: false,
    },
    yaxis: {
      title: { text: 'Respons', font: { size: 12, color: MI_BLUE.b5 } },
      gridcolor: MI_BLUE.b11, zerolinecolor: MI_BLUE.b10,
      tickformat: ',d', rangemode: 'tozero',
      range: [0, yMax],
    },
    // Legend di paling bawah (di bawah x-axis labels)
    legend: {
      orientation: 'h',
      x: 0.5, xanchor: 'center',
      y: legendY,
      yanchor: 'top',
      font: { size: 12, color: MI_BLUE.b3 },
      bgcolor: 'rgba(255,255,255,0)',
      itemsizing: 'constant',
    },
    height: chartHeight,
    margin: { l: 60, r: 40, t: 50, b: bottomMargin },
  }, PLOTLY_CONFIG);
}

// ============ PANEL RENDERERS ============

function renderNasional(app) {
  const scope = { mode: 'nasional' };
  renderDonutSkala(app, scope);
  renderDonutSektor(app, scope);
  renderDonutDebitur(app, scope);
  const barData = app.summaryTableNasional().map(r => ({
    label: r.display, target: r.target, aktual: r.aktual,
  }));
  renderBarTargetVsAktual('chart-bar-comparison', barData, 'label');
}

function renderCenter(app) {
  const scope = { mode: 'center', value: app.selectedCenter };
  renderDonutSkala(app, scope);
  renderDonutSektor(app, scope);
  renderDonutDebitur(app, scope);
  const barData = app.summaryTableCenter().map(r => ({
    label: r.unit, target: r.target, aktual: r.aktual,
  }));
  renderBarTargetVsAktual('chart-bar-comparison', barData, 'label');
}

function renderUnit(app) {
  const scope = { mode: 'unit', value: app.selectedUnit };
  renderDonutSkala(app, scope);
  renderDonutSektor(app, scope);
  renderDonutDebitur(app, scope);
}
