/* MBS 2026 Response Tracker - Plotly chart factories v6 (theme-aware, hub UX v2) */

// Get theme-aware colors at render time
function plotlyTheme() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  return {
    isDark,
    paper:    isDark ? '#142A4A' : '#FFFFFF',
    plot:     isDark ? '#142A4A' : '#FFFFFF',
    text:     isDark ? '#F4F8FC' : '#051C2C',
    textMute: isDark ? '#B6C8DE' : '#667085',
    grid:     'rgba(0,0,0,0)',
    axis:     isDark ? '#2C4868' : '#D5E3F0',
    hoverBg:  isDark ? '#00153A' : '#001F4D',
    hoverFg:  '#FFFFFF',
  };
}

function plotlyBaseLayout() {
  const t = plotlyTheme();
  return {
    paper_bgcolor: t.paper,
    plot_bgcolor: t.plot,
    font: { family: 'Inter, system-ui, sans-serif', size: 12, color: t.text },
    margin: { l: 60, r: 30, t: 30, b: 60 },
    hoverlabel: { bgcolor: t.hoverBg, font: { color: t.hoverFg, family: 'Inter, sans-serif', size: 12 }, bordercolor: '#003D79' },
  };
}

const PLOTLY_CONFIG = { displayModeBar: false, responsive: true };

function emptyNote(domId, msg) {
  const el = document.getElementById(domId);
  if (el) el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:280px;color:#667085;font-size:13px;letter-spacing:0.02em;">${msg}</div>`;
}

// ============ DONUT (target vs aktual; switches to aktual when live data exists) ============

function renderDonut(domId, items, colorMap, app, useShortLabel = false) {
  if (!items.length) { emptyNote(domId, 'Belum ada data'); return; }
  const useAktual = app.liveReady && items.some(i => i.aktual > 0);
  const values = items.map(i => useAktual ? i.aktual : i.target);
  const labels = items.map(i => i.label);
  drawDonut(domId, labels, values, colorMap, useAktual ? 'Aktual' : 'Target', useShortLabel);
}

// ============ DONUT (aktual-only, for segment profile) ============

function renderDonutAktual(domId, items, colorMap, emptyMsg, useShortLabel = false) {
  const rows = items.filter(i => i.aktual > 0);
  if (!rows.length) { emptyNote(domId, emptyMsg); return; }
  const values = rows.map(i => i.aktual);
  const labels = rows.map(i => i.label);
  drawDonut(domId, labels, values, colorMap, 'Aktual', useShortLabel);
}

function drawDonut(domId, labels, values, colorMap, centerLabel, useShortLabel) {
  const colors = labels.map(l => colorMap[l] || '#67B2E8');
  const total = values.reduce((a, b) => a + b, 0);

  const displayLabels = useShortLabel
    ? labels.map(l => SEKTOR_DISPLAY[l] || l)
    : labels;

  const textLabels = values.map((v, i) => {
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
    return `${displayLabels[i]}<br><b>${pct}%</b> · n=${v}`;
  });

  const theme = plotlyTheme();
  Plotly.newPlot(domId, [{
    values, labels: displayLabels,
    type: 'pie', hole: 0.55,
    marker: { colors, line: { color: theme.paper, width: 1 } },
    text: textLabels, textinfo: 'text', textposition: 'outside',
    textfont: { size: 11, family: 'Inter, sans-serif', color: theme.text },
    automargin: true,
    hovertemplate: '<b>%{label}</b><br>n = %{value}<br>%{percent}<extra></extra>',
    sort: false, direction: 'clockwise',
  }], {
    ...plotlyBaseLayout(),
    margin: { l: 20, r: 20, t: 30, b: 30 },
    showlegend: false,
    annotations: [{
      text: `<b>${total}</b><br><span style="font-size:10px;color:${theme.textMute};">${centerLabel}</span>`,
      x: 0.5, y: 0.5, font: { size: 18, family: 'Source Serif 4', color: theme.text },
      showarrow: false,
    }],
  }, PLOTLY_CONFIG);
}

// ============ BAR TARGET vs AKTUAL (generic) ============

function renderBarTargetVsAktual(domId, items, labelKey) {
  const el = document.getElementById(domId);
  if (!items.length) { emptyNote(domId, 'Belum ada data'); return; }
  const labels = items.map(i => i[labelKey]);
  const targets = items.map(i => i.target);
  const aktuals = items.map(i => i.aktual);

  const targetTextLabels = targets.map(v => v > 0 ? String(v) : '');
  const aktualTextLabels = aktuals.map(v => v > 0 ? String(v) : '');

  const maxLabelLen = Math.max(...labels.map(l => String(l).length));
  const labelSpace = Math.min(280, Math.max(160, maxLabelLen * 7.5));
  const legendSpace = 70;
  const bottomMargin = labelSpace + legendSpace;

  const chartHeight = 320 + 50 + bottomMargin;
  if (el) { el.style.minHeight = chartHeight + 'px'; }

  const plotHeight = 320;
  const legendY = -(labelSpace + 25) / plotHeight;

  const maxY = Math.max(...targets, ...aktuals, 1);
  const yMax = maxY * 1.18;

  const theme = plotlyTheme();
  const targetBar  = theme.isDark ? '#4A8BC4' : '#A9C4DF';
  const targetBorder = theme.isDark ? '#67B2E8' : '#4A8BC4';
  const aktualBar  = theme.isDark ? '#67B2E8' : '#002852';
  const dataLabelColor = theme.text;
  const dataLabelAktualColor = theme.isDark ? '#FFFFFF' : '#001F4D';

  Plotly.newPlot(domId, [
    {
      x: labels, y: targets, type: 'bar', name: 'Target',
      marker: { color: targetBar, line: { color: targetBorder, width: 1 } },
      text: targetTextLabels, textposition: 'outside',
      textfont: { size: 10, family: 'Inter, sans-serif', color: dataLabelColor },
      cliponaxis: false,
      hovertemplate: '<b>%{x}</b><br>Target: %{y}<extra></extra>',
    },
    {
      x: labels, y: aktuals, type: 'bar', name: 'Aktual',
      marker: { color: aktualBar },
      text: aktualTextLabels, textposition: 'outside',
      textfont: { size: 10, family: 'Inter, sans-serif', color: dataLabelAktualColor, weight: 600 },
      cliponaxis: false,
      hovertemplate: '<b>%{x}</b><br>Aktual: %{y}<extra></extra>',
    },
  ], {
    ...plotlyBaseLayout(),
    barmode: 'group', bargap: 0.25, bargroupgap: 0.08,
    xaxis: {
      tickangle: -45, showgrid: false, showline: false,
      tickfont: { size: 10, color: plotlyTheme().text }, automargin: false,
    },
    yaxis: {
      title: { text: 'Respons', font: { size: 12, color: plotlyTheme().textMute } },
      showgrid: false, showline: false, zeroline: true,
      zerolinecolor: plotlyTheme().axis, zerolinewidth: 1,
      tickformat: ',d', rangemode: 'tozero', range: [0, yMax],
      tickfont: { size: 10, color: plotlyTheme().text },
    },
    legend: {
      orientation: 'h', x: 0.5, xanchor: 'center', y: legendY, yanchor: 'top',
      font: { size: 12, color: plotlyTheme().text },
      bgcolor: 'rgba(0,0,0,0)', itemsizing: 'constant',
    },
    height: chartHeight,
    margin: { l: 60, r: 40, t: 50, b: bottomMargin },
  }, PLOTLY_CONFIG);
}

// ============ PANEL RENDERERS ============

// HOME: national profile donuts (target vs aktual)
function renderHome(app) {
  renderDonut('chart-donut-skala', app.skalaUsahaSummaryNasional(), SKALA_COLORS, app);
  renderDonut('chart-donut-sektor', app.sektorSummaryNasional(), SEKTOR_COLORS, app, true);
}

// DEBITUR page: aktual-only profile donuts + Per Center bar (overview or center drill)
function renderDebiturPanel(app) {
  renderDonutAktual('chart-donut-deb-skala', app.skalaAktualBySegment('Debitur'), SKALA_COLORS, 'Belum ada respons Debitur');
  renderDonutAktual('chart-donut-deb-sektor', app.sektorAktualBySegment('Debitur'), SEKTOR_COLORS, 'Belum ada respons Debitur', true);

  if (app.debSub === 'center') {
    if (app.selectedCenter) {
      const barData = app.debiturUnitRowsForCenter(app.selectedCenter)
        .filter(r => !r.unmapped)
        .map(r => ({ label: r.unit, target: r.target, aktual: r.aktual }));
      renderBarTargetVsAktual('chart-bar-deb-units', barData, 'label');
    } else {
      const barData = app.summaryTableDebitur().map(r => ({
        label: r.center, target: r.target, aktual: r.aktual,
      }));
      renderBarTargetVsAktual('chart-bar-debitur', barData, 'label');
    }
  }
  // debSub === 'unit' is table-only, no chart
}

// NON-DEBITUR page: aktual-only profile donuts + Per Region bar
function renderNondebiturPanel(app) {
  renderDonutAktual('chart-donut-nd-skala', app.skalaAktualBySegment('Non-Debitur'), SKALA_COLORS, 'Menunggu respons Non-debitur pertama');
  renderDonutAktual('chart-donut-nd-sektor', app.sektorAktualBySegment('Non-Debitur'), SEKTOR_COLORS, 'Menunggu respons Non-debitur pertama', true);

  if (app.ndSub === 'region') {
    const barData = app.summaryTableNdRegion().map(r => ({
      label: app.ndRegionShort(r.region), target: r.target, aktual: r.aktual,
    }));
    renderBarTargetVsAktual('chart-bar-nondebitur-region', barData, 'label');
  }
  // ndSub === 'area' is table-only, no chart
}
