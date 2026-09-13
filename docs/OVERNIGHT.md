# Overnight — 2026-09-13

Branch `overnight` (not merged into main). One commit per step.

| Step | Result | Commit |
|---|---|---|
| 1. Salary backfill | Done: 4,252 player-seasons filled | `3965d77` |
| 2. Today pipeline draft | Done: tested on 2026-04-10 | `de7689d` |
| 3. Tests | `build.py` and `flow.js` pass; the fantasy commands fail because the files don't exist | `d089763` |
| 1b. Salary backfill, all seasons (after your answers) | Done: 6,790 filled in total, 99% coverage | this commit |

---

## 1. Salary backfill

**Done**
- `tools/salary.py` (`fetch` / `build` / `apply`):
  - Fetched all 30 seasons: 892 basketball-reference team pages plus the salary-cap page, one every 4s. Cached in `tools/.cache/bbref/` (gitignored).
  - capPct = salary ÷ that season's cap. The cap values match the known figures (1996-97 $24.363M … 2025-26 $154.647M).
- Matched 6,790 of the 6,931 player-seasons not in `salary-old.json`:
  - name+team+season: 6,473
  - name+season for traded players: 262
  - surname+initial+team for nicknames: 55, all checked by hand
  - Aliases: Enes Freedom = Enes Kanter, Nene = Nene Hilario. Cyrillic ё (Egor Dёmin) is read as e.
- Unmatched: `data/salary-unmatched.csv`, 141 rows, 9 of them starters (mostly late '90s). In every case bbref's table simply has no row.
- Coverage by season: 95–100% (3,460 → 10,250 of 10,391). Table in `docs/SALARY.md`.
- `tools/bundle.py` merges `data/salary-new.json` too, and fills only null values.
- Filled `bundle-full.json` with the same rule and rebuilt `bundle-lite.json` (`node tools/lite.js`).

**Not done / changed from the plan**
- **`tools/bundle.py` wasn't run.** It reads raw pulls that aren't in the repo (`v2.json`, `bio.json`, `old-cap.json`, …). I added the merge code but couldn't run it, so `bundle-full.json` was filled with `salary.py apply`, which uses the same rule.
- **Wait between requests:** 4s instead of 3s, because Sports-Reference's limit is 20 requests a minute.
- **Encoding bug:** bbref sends no charset, and the first pass broke accented names (Jokić, Dončić, …). Fixed in code, and old cache files are repaired when read.
- **Re-run bug (fixed):** `build` used to look only at null capPct values, so running it again after `apply` would have dropped earlier results. It now fills "every player-season not in `salary-old.json`". That set matches the originally non-null values exactly (3,460 = 3,460).

**Your answers (applied)**
1. Other seasons: fetched → done above.
2. Lite rule: keep it. Lite is now 2.99MB → 4.39MB, and `index.html` is 3.89MB → 5.47MB.
3. Michael Jordan 1996-97 and 1997-98 ($124M / $123M): not capped. Over the $100M cap, so he can't be signed.
4. Player-seasons under 1% of the cap (now 428): keep the $1M floor price.
5. `data/salary-new.json` (now 1.37MB, indent=1): no answer yet, left as is.

---

## 2. Today pipeline draft

**Done**
- `tools/today.py [YYYY-MM-DD]` writes `data/today.json`. With no date it uses today in US Eastern.
  - (a) Schedule: `ScoreboardV3`
  - (b) Each team's latest starting five: last game before the date from `LeagueGameLog` (Regular Season, PlayIn, Playoffs), then the players with a position listed in `BoxScoreTraditionalV3`. The bundle `id` is attached when found.
  - (c) Yesterday's results: from `LeagueGameLog` rows dated the day before.
- Test on 2026-04-10:
  - 15 games
  - A five for all 30 teams, with last games dated 04-07 to 04-09
  - 6 results for 04-09
  - The committed `data/today.json` is that output.
- `.github/workflows/today.yml`: manual `workflow_dispatch` only. The `schedule` is commented out.

**Decisions for you** (all confirmed: test manual runs first, 10:00 UTC is fine, run after the workflow reaches main)
1. **stats.nba.com often blocks GitHub Actions IPs.** It worked locally, but it may time out on a runner. Try a few manual runs first. If it's blocked, the options are the `cdn.nba.com` live endpoints (today's games only), a proxy, or running it on your Mac.
2. **Cron has no DST.** ET 6am is 10:00 UTC during EDT and 11:00 UTC during EST. The draft has `0 10 * * *` commented out, which lands at 5am in winter.
3. **Manual runs only appear in the Actions tab once the workflow file is on main.** While it's only on this branch, you can't press the Run button.
4. Does the app need all 30 teams' starters, or only the teams playing that day? Right now it's all 30, about 15–30 box score requests.

---

## 3. Tests

| Command | Result |
|---|---|
| `python3 build.py` | ✅ exit 0 (`index.html` rebuilt with the new salaries; rebuilt again and re-tested after 1b) |
| `node tools/flow.js` | ✅ 14 ok, 0 fail, ALL PASS (same after 1b) |
| `python3 build_fantasy.py` | ❌ exit 2: the file doesn't exist |
| `node tools/flow-fantasy.js` | ❌ exit 1: the file doesn't exist |

Neither `build_fantasy.py` nor `tools/flow-fantasy.js` is in the repo, on any branch in git history, or in `~/Downloads`. As instructed, I didn't fix or create anything. If they're on another machine, or in a `repo N` folder that hasn't been copied over yet, they need to be added.

<details><summary>Logs</summary>

```
$ python3 build_fantasy.py
/opt/homebrew/Cellar/python@3.13/3.13.4/Frameworks/Python.framework/Versions/3.13/Resources/Python.app/Contents/MacOS/Python: can't open file '/Users/jaylee/beatball/build_fantasy.py': [Errno 2] No such file or directory

$ node tools/flow-fantasy.js
node:internal/modules/cjs/loader:1424
  throw err;
  ^

Error: Cannot find module '/Users/jaylee/beatball/tools/flow-fantasy.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1421:15)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1059:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1064:22)

$ node tools/flow.js
ok   start: Build a five, 73-9, no daily
ok   draft: wheel landed, board + dock
ok   five signed → best line-up → season: 38-44
ok   line-up is the five picked
ok   82 games
ok   ladder with your rank
ok   loss lessons header
ok   build again + share
ok   share button
ok   player sheet from the five strip (no footer outside the draft)
ok   you: best + history
ok   build tab shows your best
ok   reset
ok   no NaN/undefined
ALL PASS
```
</details>

---

## Other notes
- Python deps are in `~/.venvs/beatball` (requests, beautifulsoup4, lxml, nba_api), outside the repo. Homebrew Python blocks `pip install` (PEP 668).
- GitHub Pages serves main, so none of this is live.
- **Push:** I tried `git push -u origin overnight` and it was rejected. The GitHub token lacks the `workflow` scope, so it can't push `.github/workflows/today.yml`. The commits are on the local `overnight` branch only. To push: run `gh auth refresh -s workflow` and push again, or push without the workflow file.
