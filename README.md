# Fantasyball

One HTML file, three modes, one universe of 10,259 NBA player-seasons (1996–2026) with real stats and real salaries.

- **Tonight** — this season's games, pick a side, get graded vs the engine and the crew (lands when the nightly data job is live)
- **Packs** — spin five playoff-calibre clubs, sign one man each under a $100M cap, play 82 games against real fives. The record is the score.
- **Build** — any man, any season; History ranks every season 9-cat style (Marion was king in '04–'06); matchups are category head-to-head.

## Layout
- `src/shell.js` — brand bar, mode row, one host per mode
- `src/packs.js` — the pack game (engine-driven)
- `src/build.js` — Build / History / Matchup (9-cat, no engine)
- `src/engine.js` — rating engine v2 (fitted to 450 playoff series + 892 seasons)
- `src/style.css`, `src/fonts.css` — Barlow Condensed + Barlow, embedded (OFL)
- `data/bundle-full.json` — everything; `bundle-lite.json` — what ships (`node tools/lite.js`)
- `tools/salary.py` — salary backfill from basketball-reference; `tools/today.py` — tonight's schedule/lineups; `tools/flow.js` — end-to-end test
- `build.py` → `index.html`

## Build & test
```
python3 build.py && node tools/flow.js
```
## Ship
```
python3 build.py && node tools/flow.js && git add -A && git commit -m "build" && git push
```
