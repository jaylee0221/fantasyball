# Salaries

`capPct` = a player's salary that season ÷ that season's salary cap. The game's price is `max(1, round(capPct*100))` in $M of a $100M cap.

## Sources
- **Old** (`data/salary-old.json`, merged by `tools/bundle.py`): hand-built file, keyed `nbaId:season`.
- **New** (`data/salary-new.json`, `tools/salary.py`): basketball-reference team pages (the "Salaries" table) and the salary-cap history page. It only fills a `capPct` that is still null; it never overwrites the old file.
  - Seasons scraped: all 30 (1996-97 – 2025-26), 892 team pages, 4s apart, cached in `tools/.cache/bbref/` (gitignored). It fills every player-season that isn't in `salary-old.json`.
  - Matching (bbref has no nbaId), in order:
    1. name + team + season (6,473)
    2. name + season, when only one player with that name played that season (traded players; the highest figure wins) (262)
    3. surname + first initial + team + season, when exactly one player on each side (Steven/Steve Smith, Mo/Mohamed Bamba, GG/Gregory Jackson, Patty/Patrick Mills, J.J./Jose Barea) (55; all checked by hand)
  - Names are compared without accents, punctuation, or Jr/II/III suffixes. Aliases for name changes: Enes Freedom = Enes Kanter, Nene = Nene Hilario. Cyrillic ё/е (Egor Dёmin) is read as e.
  - Unmatched: `data/salary-unmatched.csv` (141 player-seasons, 9 of them starters). In every case bbref's table has no row for the player.

## Rebuild
```
~/.venvs/beatball/bin/python tools/salary.py fetch   # only fetches what isn't cached
~/.venvs/beatball/bin/python tools/salary.py build   # -> data/salary-new.json, data/salary-unmatched.csv
~/.venvs/beatball/bin/python tools/salary.py apply   # fill data/bundle-full.json (tools/bundle.py does the same when rebuilding from raw pulls)
node tools/lite.js
```

## Salary caps used
| Season | Cap |
|---|---:|
| 1996-97 | $24,363,000 |
| 1997-98 | $26,900,000 |
| 1998-99 | $30,000,000 |
| 1999-00 | $34,000,000 |
| 2000-01 | $35,500,000 |
| 2001-02 | $42,500,000 |
| 2002-03 | $40,271,000 |
| 2003-04 | $43,840,000 |
| 2004-05 | $43,870,000 |
| 2005-06 | $49,500,000 |
| 2006-07 | $53,135,000 |
| 2007-08 | $55,630,000 |
| 2008-09 | $58,680,000 |
| 2009-10 | $57,700,000 |
| 2010-11 | $58,044,000 |
| 2011-12 | $58,044,000 |
| 2012-13 | $58,044,000 |
| 2013-14 | $58,679,000 |
| 2014-15 | $63,065,000 |
| 2015-16 | $70,000,000 |
| 2016-17 | $94,143,000 |
| 2017-18 | $99,093,000 |
| 2018-19 | $101,869,000 |
| 2019-20 | $109,140,000 |
| 2020-21 | $109,140,000 |
| 2021-22 | $112,414,000 |
| 2022-23 | $123,655,000 |
| 2023-24 | $136,021,000 |
| 2024-25 | $140,588,000 |
| 2025-26 | $154,647,000 |

## Players with a salary, by season
"Before" is `bundle-full.json` before this merge. "Lite" is `bundle-lite.json`, which keeps every starter plus everyone with a salary.

| Season | Before (full) | After (full) | Coverage | Lite players | Lite with salary |
|---|---:|---:|---:|---:|---:|
| 1996-97 | 0 | 304 / 313 | 97% | 305 | 304 |
| 1997-98 | 0 | 302 / 312 | 97% | 305 | 302 |
| 1998-99 | 0 | 280 / 295 | 95% | 284 | 280 |
| 1999-00 | 21 | 312 / 314 | 99% | 312 | 312 |
| 2000-01 | 175 | 312 / 314 | 99% | 312 | 312 |
| 2001-02 | 193 | 306 / 311 | 98% | 307 | 306 |
| 2002-03 | 101 | 318 / 319 | 100% | 318 | 318 |
| 2003-04 | 27 | 320 / 325 | 98% | 320 | 320 |
| 2004-05 | 27 | 331 / 340 | 97% | 331 | 331 |
| 2005-06 | 186 | 319 / 321 | 99% | 319 | 319 |
| 2006-07 | 173 | 312 / 313 | 100% | 312 | 312 |
| 2007-08 | 186 | 319 / 320 | 100% | 319 | 319 |
| 2008-09 | 191 | 325 / 327 | 99% | 325 | 325 |
| 2009-10 | 193 | 330 / 332 | 99% | 330 | 330 |
| 2010-11 | 195 | 342 / 344 | 99% | 342 | 342 |
| 2011-12 | 217 | 352 / 357 | 99% | 352 | 352 |
| 2012-13 | 190 | 347 / 349 | 99% | 347 | 347 |
| 2013-14 | 172 | 332 / 343 | 97% | 332 | 332 |
| 2014-15 | 200 | 375 / 376 | 100% | 375 | 375 |
| 2015-16 | 203 | 352 / 352 | 100% | 352 | 352 |
| 2016-17 | 208 | 360 / 360 | 100% | 360 | 360 |
| 2017-18 | 180 | 381 / 381 | 100% | 381 | 381 |
| 2018-19 | 217 | 378 / 379 | 100% | 378 | 378 |
| 2019-20 | 197 | 371 / 371 | 100% | 371 | 371 |
| 2020-21 | 0 | 384 / 384 | 100% | 384 | 384 |
| 2021-22 | 0 | 393 / 393 | 100% | 393 | 393 |
| 2022-23 | 8 | 372 / 381 | 98% | 372 | 372 |
| 2023-24 | 0 | 365 / 374 | 98% | 365 | 365 |
| 2024-25 | 0 | 377 / 394 | 96% | 377 | 377 |
| 2025-26 | 0 | 379 / 397 | 95% | 379 | 379 |
| **Total** | 3460 | 10250 / 10391 | 99% | 10259 | 10250 |

Coverage is 95–100% in every season. The gaps are mostly late-'90s players missing from bbref's old tables and current-season players on 10-day or two-way deals.

## Notes
- capPct above 1 is real: Michael Jordan 1996-97 $30.14M on a $24.36M cap (1.24), 1997-98 $33.14M (1.23). Ewing, Garnett, O'Neal, and Grant Hill are 0.51–0.76 in the late '90s. Not capped on purpose: Jordan's price is over the $100M cap, so he can't be signed.
- 428 new player-seasons are under 1% of the cap: 10-day, two-way, or waived deals where bbref lists the prorated amount paid (e.g. Mo Bamba 2024-25 $119,972). The game prices them at the $1M floor (confirmed: keep as is).
