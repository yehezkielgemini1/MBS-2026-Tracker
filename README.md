# MBS 2026 Response Tracker Dashboard

Live monitoring pengumpulan respons **Mandiri Business Survey 2026** (Survey ID `422412181`, target **N=1.400**).
Fieldwork window: **May–Jun 2026**.

---

## Stack

- **SPA single-page**: `index.html` + 3 panel toggle (Nasional · Region · Area)
- **Alpine.js 3** untuk state management & reactivity
- **Plotly.js 2** untuk semua chart (responsive, hover, zoom)
- **Tailwind-style** via CSS custom (`assets/styles.css`, canon Mandiri Institute)
- **PapaParse 5** untuk CSV parsing client-side
- All deps via CDN — no build step, no npm

## Struktur Folder

```
Dashboard/
├── index.html                  # Main SPA shell, 3 panel
├── assets/
│   ├── app.js                  # Alpine store + data loader + helpers
│   ├── charts.js               # Plotly factory functions
│   └── styles.css              # Canon MI design tokens & components
├── data/                       # OWNED by Data Agent — read-only buat dashboard
│   ├── targets.csv             # 298 rows, region × area × skala × scenario
│   ├── targets_by_region.csv   # 12 rows (sudah N=1400 only, total =1400)
│   ├── targets_by_area.csv     # 83 rows
│   ├── targets_by_sektor.csv   # 6 rows (Industri, Perdagangan, ...)
│   ├── targets_by_debitur.csv  # 332 rows, scenario column
│   ├── targets_by_sektor_area.csv  # 1021 rows, scenario column
│   ├── mbs_live_realization.csv   # AUTO-UPDATE 3x/hari oleh Data Agent (BELUM ADA saat empty state)
│   └── mbs_live_metadata.json     # AUTO-UPDATE (BELUM ADA saat empty state)
├── publish/                    # Build artifact untuk GitHub Pages (sanitized, no PII)
├── _scripts_publish.py         # Sanitize + (optional) git push
└── README.md
```

## Cara Akses Lokal

```bash
# Dari folder Dashboard/
cd "Riset Initiatives/Mandiri Business Survey (MBS)/2026/Tracker/Dashboard"

# Option 1: Python
python -m http.server 8765

# Option 2: Node (kalau Python belum di PATH)
node -e "require('http').createServer((q,r)=>{const f=require('fs'),p=require('path');let u=q.url.split('?')[0];if(u==='/')u='/index.html';f.readFile(p.join(process.cwd(),u),(e,d)=>{if(e){r.writeHead(404);r.end()}else{r.writeHead(200);r.end(d)}})}).listen(8765)"

# Buka di browser
# http://localhost:8765/
```

Dashboard akan tampil dalam **Preview Mode** (banner kuning) selama `mbs_live_realization.csv` belum ada. Target distribution tetap render dari `targets_*.csv` sebagai preview struktur final.

## Refresh Schedule

Data Agent pull SurveyMonkey API 3× sehari via Windows Task Scheduler:
- **07:00 WIB** (morning snapshot)
- **12:00 WIB** (mid-day)
- **17:00 WIB** (closing)

Output: overwrite `data/mbs_live_realization.csv` + `mbs_live_metadata.json`. Dashboard auto-aktif saat data masuk (refresh halaman).

Status freshness indicator di top-nav:
- 🟢 Hijau: <6 jam
- 🟡 Kuning: 6–12 jam
- 🔴 Merah: >24 jam (Data Agent stuck → ping data team)

## Hardcoded Constants (Tidak Boleh Diubah Tanpa Re-Build)

| Konstanta | Nilai | Lokasi |
|---|---|---|
| `TARGET_N` | 1.400 | `assets/app.js` |
| `FIELDWORK_START` | 2026-05-13 | `assets/app.js` (update saat survey resmi mulai) |
| `NEAR_COMPLETE_THRESHOLD` | 7 dari 8 pages | `assets/app.js` |
| Scenario filter | `N=1400` only (drop N=3000 rows) | `filterN1400()` in `app.js` |

## URL Hash Routing

Share-able URL per state:

- `#panel=nasional`
- `#panel=region&region=Jakarta%201`
- `#panel=area&region=Jakarta%201&area=Jakarta%20Pluit%20Selatan`

Drill-down click di tabel/region langsung update hash.

## Publish ke GitHub Pages

Repo: `https://github.com/yehezkielgemini1/MBS-2026-Tracker`
Live URL: `https://yehezkielgemini1.github.io/MBS-2026-Tracker/`

### Setup pertama kali

```bash
cd publish
python ../_scripts_publish.py
git init
git remote add origin https://github.com/yehezkielgemini1/MBS-2026-Tracker.git
git checkout -b main
git add -A
git commit -m "Initial publish MBS 2026 Tracker dashboard"
git push -u origin main
```

### Refresh publish (manual atau scheduled)

```bash
python _scripts_publish.py --push
```

Script melakukan:
1. **Clean** `publish/` folder
2. **Copy** `index.html` + `assets/` apa adanya
3. **Copy** target CSVs (no PII)
4. **Sanitize live data**:
   - `mbs_live_realization.csv` → `mbs_live_aggregated.csv` (counts per region × area × sektor × skala × debitur)
   - Velocity per hari → `mbs_velocity_by_day.csv`
   - Strip PII fields: `respondent_id`, `ip_address`, `kabkota`, `collector_id`, granular timestamps
5. **Sanitize** `mbs_live_metadata.json` (keep counts only)
6. **Git commit + push** ke MBS-2026-Tracker (jika `--push` flag)

⚠️ **PII Guard**: Verifikasi sekali manual di Network tab Chrome setelah deploy pertama bahwa tidak ada `ip_address` / `respondent_id` granular di payload yang dikirim.

## Boundary: Apa Yang Bukan Domain Dashboard Agent

- **JANGAN** sentuh folder `_scripts/` (Python extractor SurveyMonkey)
- **JANGAN** edit file di `data/` — itu di-overwrite Data Agent 3×/hari
- **JANGAN** ubah target_n=1400 logic (sudah hardcoded sesuai keputusan research)
- **JANGAN** publish full data ke public — selalu lewat `_scripts_publish.py`

## Verifikasi (Sebelum Hand-Off ke RM)

1. ✅ **Empty state**: `index.html` open di Chrome tanpa `mbs_live_realization.csv` → banner kuning muncul, KPI cards show `—`, target charts render
2. ⏳ **Mock populated**: Buat fake `mbs_live_realization.csv` (50 rows) → semua chart populate, KPI hidup, velocity 1-poin line
3. ✅ **Drill-down**: Klik row region → switch ke panel Region, hash update, filter applied
4. ✅ **Responsive**: Chrome DevTools 1440 / 1024 / 768 / 375 — KPI stack, chart responsive (Plotly `responsive:true`)
5. ⏳ **Cross-browser**: Edge + Chrome (RM browsers)
6. ⏳ **GitHub deploy**: Push → check live URL render aggregated only, no PII
7. ⏳ **QA review**: Jalankan `/qa-review` skill

## Changelog

- **2026-05-13**: v1 build — empty state preview mode, 3 panel, canon MI styling, Alpine SPA, Plotly charts, sanitize script. Belum push GitHub (tunggu data masuk dulu).
