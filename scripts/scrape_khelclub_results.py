import re, json, time, os, csv
import requests
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

ORG = "6a1694b88c90b13d8df231c7"
TOUR = "6a1696258c90b13d8df233df"
BASE = "https://app.khelclub.co"
DATE = "2026-05-29"

CATS = [
    ("6a1696258c90b13d8df233e9", "U-12 Boys Doubles",   "9 AM"),
    ("6a1696258c90b13d8df233eb", "U-12 Girls Singles",  "9 AM"),
    ("6a1696258c90b13d8df233ef", "U-12 Mixed Doubles",  "9 AM"),
    ("6a1696258c90b13d8df233e7", "U-12 Boys Singles",   "11 AM"),
    ("6a1696258c90b13d8df233e5", "U-14 Girls Doubles",  "11 AM"),
    ("6a1696258c90b13d8df233e3", "U-14 Boys Doubles",   "12 PM"),
    ("6a1696258c90b13d8df233e2", "U-14 Boys Singles",   "1 PM"),
    ("6a1696258c90b13d8df233e4", "U-14 Girls Singles",  "1 PM"),
    ("6a1696258c90b13d8df233e6", "U-14 Mixed Doubles",  "2:30 PM"),
    ("6a1696258c90b13d8df233ea", "U-18 Boys Doubles",   "3 PM"),
    ("6a1696258c90b13d8df233ee", "U-18 Girls Doubles",  "3 PM"),
    ("6a1696258c90b13d8df233e8", "U-18 Boys Singles",   "5 PM"),
    ("6a1696258c90b13d8df233ec", "U-18 Girls Singles",  "5 PM"),
    ("6a1696258c90b13d8df233f0", "U-18 Mixed Doubles",  "7 PM"),
]

DEC = json.JSONDecoder()

def fetch_flight(cat_id):
    url = f"{BASE}/organizer-profile/{ORG}/tournament/{TOUR}/category/{cat_id}/fixtures?dateTab=date-{DATE}"
    html = requests.get(url, timeout=30).text
    pushes = re.findall(r'self\.__next_f\.push\(\[\d+,(.*?)\]\)</script>', html, re.S)
    parts = []
    for p in pushes:
        try: parts.append(json.loads(p))
        except Exception: pass
    return "".join(x for x in parts if isinstance(x, str))

def objects_with_key(blob, key, maxspan=30000):
    """Extract every self-contained JSON object that directly contains `key`."""
    out, pos = [], 0
    while True:
        k = blob.find('"%s"' % key, pos)
        if k < 0: break
        j, hit = k, False
        while True:
            j = blob.rfind('{', 0, j)
            if j < 0 or k - j > maxspan: break
            try:
                o, end = DEC.raw_decode(blob, j)
                if isinstance(o, dict) and key in o and end > k:
                    out.append(o); pos = end; hit = True; break
            except Exception:
                pass
        if not hit: pos = k + 1
    return out

def label(team, tmap):
    if not team or not isinstance(team, dict): return "TBD"
    tid = team.get('id') or team.get('_id')
    if tid and tmap.get(tid): return tmap[tid]
    return team.get('name', 'TBD')

def score_str(scores):
    if not scores: return ""
    if all((s.get('team1') or 0) == 0 and (s.get('team2') or 0) == 0 for s in scores):
        return ""  # not yet played
    return ", ".join(f"{s.get('team1')}-{s.get('team2')}"
                     for s in sorted(scores, key=lambda x: x.get('set', 0)))

def containers(blob):
    """Extract every self-contained object that holds a `matches` list
    (a round-robin pool or a knockout/elimination round)."""
    out, pos = [], 0
    while True:
        k = blob.find('"matches"', pos)
        if k < 0: break
        j, hit = k, False
        while True:
            j = blob.rfind('{', 0, j)
            if j < 0 or k - j > 80000: break
            try:
                o, end = DEC.raw_decode(blob, j)
                if isinstance(o, dict) and isinstance(o.get('matches'), list) and end > k:
                    out.append(o); pos = end; hit = True; break
            except Exception:
                pass
        if not hit: pos = k + 1
    return out

def stage_label(c):
    nm = c.get('name', '') or ''
    if c.get('roundTitle') == 'Elimination' or 'Final' in nm or 'Quarter' in nm or 'Semi' in nm:
        return nm or 'Knockout'              # e.g. "Quarter Finals", "Semi Finals", "Finals"
    if nm.lower().startswith('pool'):
        return f"Round Robin ({nm})"          # e.g. "Round Robin (Pool A)"
    return "Round Robin"

def stage_order(c):
    if c.get('roundTitle') == 'Elimination':
        return (1, c.get('roundNumber', 99))   # knockout after pools, ordered by round
    return (0, c.get('name', ''))              # round-robin pools first

def parse_category(blob):
    structure = (re.findall(r'"matchStructure":"(\w+)"', blob) or [""])[0]
    # team id -> "Player A & Player B"
    tmap = {}
    for t in objects_with_key(blob, 'players'):
        tid = t.get('id') or t.get('_id')
        names = [p.get('name', '') for p in t.get('players', []) if isinstance(p, dict) and p.get('name')]
        if tid and names:
            tmap[tid] = " & ".join(names)
    rows, seen = [], set()
    for c in sorted(containers(blob), key=stage_order):
        stage = stage_label(c)
        for m in c['matches']:
            if not isinstance(m, dict): continue
            mid = m.get('id') or m.get('_id')
            if mid and mid in seen: continue
            if mid: seen.add(mid)
            t1 = label(m.get('team1'), tmap)
            t2 = label(m.get('team2'), tmap)
            sc = score_str(m.get('scores') or [])
            win = label(m.get('winnerTeam'), tmap) if m.get('winnerTeam') else ""
            st = m.get('status', '') or ("SCHEDULED" if not sc else "")
            flags = []
            if m.get('isWalkover'): flags.append('Walkover')
            if m.get('isBye'): flags.append('Bye')
            if m.get('isForfeit'): flags.append('Forfeit')
            # skip empty knockout bracket placeholders (no teams decided, no score)
            if t1 == "TBD" and t2 == "TBD" and not sc:
                continue
            rows.append([stage, t1, t2, sc, win, st, ", ".join(flags)])
    return structure, rows

HEADERS = ["Stage", "Team 1", "Team 2", "Score", "Winner", "Status", "Notes"]

def main():
    results = {}
    for cid, name, tm in CATS:
        try:
            blob = fetch_flight(cid)
            structure, rows = parse_category(blob)
            results[name] = (structure, rows)
            comp = sum(1 for r in rows if str(r[5]).upper() == "COMPLETED")
            print(f"{name:24s} structure={structure:18s} matches={len(rows):3d} completed={comp}")
        except Exception as e:
            results[name] = ("ERROR", [])
            print(f"{name:24s} ERROR {e}")
        time.sleep(0.3)

    wb = Workbook()
    summary = wb.active
    summary.title = "Summary"
    summary.append(["West Zone Pickleball Championship 2026 — Musclebar Sports Club, Pune — 29 May 2026"])
    summary.append([])
    summary.append(["Category", "Time", "Format", "Matches", "Completed"])
    for cid, name, tm in CATS:
        structure, rows = results[name]
        comp = sum(1 for r in rows if str(r[5]).upper() == "COMPLETED")
        summary.append([name, tm, structure, len(rows), comp])
    summary["A1"].font = Font(bold=True, size=12)
    for c in range(1, 6):
        summary.cell(row=3, column=c).font = Font(bold=True)
    for col, w in zip("ABCDE", [22, 9, 20, 9, 11]):
        summary.column_dimensions[col].width = w

    cdir = "/home/user/pickleplay-app/match_results_csv"
    os.makedirs(cdir, exist_ok=True)
    for cid, name, tm in CATS:
        structure, rows = results[name]
        ws = wb.create_sheet(title=name[:31])
        ws.append([f"{name}  |  {tm}  |  {structure}  |  29 May 2026"])
        ws.append([])
        ws.append(HEADERS)
        for r in rows: ws.append(r)
        if not rows: ws.append(["(no match data available yet)"])
        ws["A1"].font = Font(bold=True, size=12)
        for c in range(1, len(HEADERS) + 1):
            cell = ws.cell(row=3, column=c)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="2E7D32")
        for col, w in zip("ABCDEFG", [20, 26, 26, 16, 26, 13, 14]):
            ws.column_dimensions[col].width = w
        # csv
        with open(os.path.join(cdir, name.replace(" ", "_") + ".csv"), "w", newline="") as f:
            wr = csv.writer(f); wr.writerow(HEADERS); wr.writerows(rows)

    out = "/home/user/pickleplay-app/west_zone_pickleball_2026_results.xlsx"
    wb.save(out)
    print("SAVED", out)

if __name__ == "__main__":
    main()
