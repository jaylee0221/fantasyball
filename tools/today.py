# Today's games, one file: data/today.json
#   python tools/today.py                # today (US Eastern)
#   python tools/today.py 2026-04-10     # any date
# (a) schedule for the date (ScoreboardV3)
# (b) each team's latest starting five: starters of its last game BEFORE the date (LeagueGameLog -> BoxScoreTraditionalV3)
# (c) yesterday's results (LeagueGameLog rows dated the day before)
import json, os, sys, time, datetime, collections
from zoneinfo import ZoneInfo
from nba_api.stats.endpoints import scoreboardv3, leaguegamelog, boxscoretraditionalv3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'today.json')
T = 40          # request timeout
PAUSE = 0.7     # between stats.nba.com calls

def season_of(d):  # 2026-04-10 -> 2025-26 ; the season turns over in August
    y = d.year if d.month >= 8 else d.year - 1
    return f'{y}-{str(y + 1)[-2:]}'

def call(fn, tries=3):
    for i in range(tries):
        try:
            r = fn(); time.sleep(PAUSE); return r
        except Exception as e:
            if i == tries - 1: raise
            print('  retry', i + 1, type(e).__name__, e); time.sleep(5 * (i + 1))

def schedule(d):
    g = call(lambda: scoreboardv3.ScoreboardV3(game_date=d.isoformat(), league_id='00', timeout=T)).get_dict()['scoreboard']['games']
    side = lambda t: {'teamId': t['teamId'], 'abbr': t['teamTricode'], 'name': f"{t['teamCity']} {t['teamName']}",
                      'record': f"{t.get('wins', 0)}-{t.get('losses', 0)}", 'score': t.get('score')}
    return [{'gameId': x['gameId'], 'status': x['gameStatus'], 'statusText': x['gameStatusText'].strip(), 'timeUTC': x['gameTimeUTC'],
             'label': x.get('gameLabel') or '', 'home': side(x['homeTeam']), 'away': side(x['awayTeam'])} for x in g]

def game_log(season):
    rows = []
    for kind in ('Regular Season', 'PlayIn', 'Playoffs'):
        try:
            df = call(lambda: leaguegamelog.LeagueGameLog(season=season, season_type_all_star=kind, player_or_team_abbreviation='T', timeout=T)).get_data_frames()[0]
            rows += [dict(r, KIND=kind) for r in df.to_dict('records')]
        except Exception as e:
            print('  game log', kind, 'failed:', e)
    return rows

def starters(game_id):
    b = call(lambda: boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id, timeout=T)).get_dict()['boxScoreTraditional']
    out = {}
    for side in ('homeTeam', 'awayTeam'):
        t = b[side]  # starters are the men with a position listed; the bench comes back with position ''
        out[t['teamId']] = [{'nbaId': p['personId'], 'name': f"{p['firstName']} {p['familyName']}".strip(), 'pos': p['position']}
                            for p in t['players'] if p.get('position')][:5]
    return out

def bundle_ids():
    """nbaId -> the game's player id for his latest season in the bundle, so the app can link a starter to a card."""
    fn = os.path.join(ROOT, 'data', 'bundle-full.json')
    if not os.path.exists(fn): return {}
    ids = {}
    for p in sorted(json.load(open(fn))['players'], key=lambda p: p['season']): ids[p['nbaId']] = p['id']
    return ids

def main():
    d = datetime.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else datetime.datetime.now(ZoneInfo('America/New_York')).date()
    y = d - datetime.timedelta(days=1); season = season_of(d)
    print('date', d, 'season', season)
    games = schedule(d); print('games', len(games))
    log = game_log(season); print('game log rows', len(log))
    # (c) yesterday: pair the two team rows of each game
    by_game = collections.defaultdict(list)
    for r in log:
        if r['GAME_DATE'] == y.isoformat(): by_game[r['GAME_ID']].append(r)
    results = []
    for gid, rs in sorted(by_game.items()):
        if len(rs) != 2: continue
        home = next((r for r in rs if ' vs. ' in r['MATCHUP']), rs[0]); away = rs[1] if home is rs[0] else rs[0]
        results.append({'gameId': gid, 'kind': home['KIND'], 'home': {'abbr': home['TEAM_ABBREVIATION'], 'pts': home['PTS']},
                        'away': {'abbr': away['TEAM_ABBREVIATION'], 'pts': away['PTS']},
                        'winner': home['TEAM_ABBREVIATION'] if home['WL'] == 'W' else away['TEAM_ABBREVIATION']})
    # (b) last game before the date, per team
    last = {}
    for r in log:
        if r['GAME_DATE'] < d.isoformat() and (r['TEAM_ID'] not in last or r['GAME_DATE'] > last[r['TEAM_ID']]['GAME_DATE']): last[r['TEAM_ID']] = r
    ids = bundle_ids(); box = {}; teams = {}
    for tid, r in sorted(last.items(), key=lambda kv: kv[1]['TEAM_ABBREVIATION']):
        if r['GAME_ID'] not in box:
            try: box[r['GAME_ID']] = starters(r['GAME_ID'])
            except Exception as e: print('  box', r['GAME_ID'], 'failed:', e); box[r['GAME_ID']] = {}
        five = box[r['GAME_ID']].get(tid, [])
        for p in five:
            if p['nbaId'] in ids: p['id'] = ids[p['nbaId']]
        teams[r['TEAM_ABBREVIATION']] = {'teamId': tid, 'lastGameId': r['GAME_ID'], 'lastGameDate': r['GAME_DATE'], 'lastMatchup': r['MATCHUP'], 'starters': five}
    out = {'meta': {'date': d.isoformat(), 'season': season, 'built': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
                    'source': 'stats.nba.com via nba_api'},
           'games': games, 'starters': teams, 'yesterday': {'date': y.isoformat(), 'games': results}}
    json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False)
    short = [a for a, t in teams.items() if len(t['starters']) != 5]
    print('wrote', OUT, '| games', len(games), '| teams with a five', len(teams) - len(short), 'short', short, '| yesterday', len(results))

if __name__ == '__main__':
    main()
