# How the Khel Club Match Data Was Extracted

This document explains, in detail, how the West Zone Pickleball Championship 2026
match data was obtained from the public Khel Club portal and turned into the
spreadsheet/CSV exports in this repo. It includes the full working Python code.

- **Source portal:** `https://app.khelclub.co/233df`
- **Tournament:** West Zone Pickleball Championship 2026 — Musclebar Sports Club, Pune (29–31 May 2026)
- **Outputs:** `west_zone_pickleball_2026_results.xlsx` (one tab per category) and
  per-category CSVs in `match_results_csv/` (plus a combined `ALL_categories_combined.csv`)
- **Extractor script:** [`scripts/scrape_khelclub_results.py`](../scripts/scrape_khelclub_results.py)

---

## TL;DR

The site is a **Next.js (App Router) application** that **server-side renders** its
tournament data into the page HTML as a **React Server Components (RSC) "flight"
payload**. We extract that embedded JSON straight from the public page source and
reshape it into spreadsheets. No login, no headless browser, and no use of the
site's auth-protected API.

---

## 1. Reconnaissance — what kind of site is it?

The landing page (`/233df`) is a **public tournament page** (no login required).
It lists 14 categories, each linking to a "fixtures" page that follows a fixed URL
pattern:

```
https://app.khelclub.co/organizer-profile/<orgId>/tournament/<tournamentId>/category/<categoryId>/fixtures?dateTab=date-2026-05-29
```

From the landing page we collected:

| Value | ID |
|-------|----|
| Organizer | `6a1694b88c90b13d8df231c7` |
| Tournament | `6a1696258c90b13d8df233df` |
| 14 category IDs | see `CATS` in the script |

So we had a stable URL template + the 14 category IDs to iterate over.

## 2. Where does the data actually live?

Downloading one fixtures page with `curl` and inspecting the raw HTML revealed:

- **It's a Next.js app** — the HTML contained `__NEXT_DATA__` and `/_next/static/...`
  chunk references.
- **Player names were already present in the static HTML** (e.g. `Needhish Patil`),
  but **scores were not present as `11-8`** — they were split across separate DOM
  elements during render.

Conclusion: the page is **server-side rendered**. The server fetches the match data
and bakes it into the HTML before sending it, so a real browser is unnecessary — the
data is in the page source, just encoded.

## 3. The key: the RSC "flight" payload

Next.js App Router ships server-rendered data as **RSC flight data** — a series of
JavaScript calls embedded in the HTML:

```js
self.__next_f.push([1, "...escaped JSON string..."])
```

By extracting every `self.__next_f.push([...])` chunk, JSON-decoding each string
fragment (to unescape `\"` etc.), and concatenating them, we recover one large blob
containing the **complete structured data** for the category:

```json
"roundRobin": {"pools": [{
  "name": "Pool A",
  "teams": [{"id": "...", "players": [
      {"name": "Needhish Patil"}, {"name": "Prathamesh Lohar"}]}, ...],
  "matches": [{
      "team1": {"id": "..."}, "team2": {"id": "..."},
      "scores": [{"team1": 11, "team2": 8, "set": 1}],
      "status": "COMPLETED",
      "winnerTeam": {"id": "..."}}]}]},
"elimination": {"rounds": [
  {"name": "Quarter Finals", "roundNumber": 1, "matches": [...]},
  {"name": "Semi Finals",    "roundNumber": 2, "matches": [...]},
  {"name": "Finals",         "roundNumber": 3, "matches": [...]}]}
```

This is the site's own backend data, embedded in the page it serves to every visitor.

## 4. Why we did NOT use their API

While grepping the JavaScript bundles we found the backend API base:
`https://api-v3.khelclub.co/v1/...`. Hitting the relevant endpoints directly returned:

```json
{"message": "No token, authorization denied"}   // HTTP 401
```

Those endpoints require an authenticated token. So we deliberately stayed with the
**public, already-rendered page data** — the same information any visitor sees —
rather than the protected API.

## 5. Parsing the blob reliably

One wrinkle: the *entire* top-level JSON object won't cleanly parse, because the RSC
format sprinkles non-JSON reference markers (`$L1b`, `$undefined`, …) between objects.

Instead of decoding the whole blob, we use a small **"nearest enclosing object"
extractor**:

1. Search the blob for a known key (e.g. `"team1"`, `"matches"`, `"players"`).
2. Scan backward to the nearest `{` and try `json.JSONDecoder().raw_decode` from there.
3. Individual match / team / pool objects are clean JSON, so they decode perfectly
   even though the giant wrapper doesn't.

From that we build:

- a **team-ID → player-names map** (so `Team 0f14` becomes `Needhish Patil & Prathamesh Lohar`),
- a list of **match containers** — each round-robin pool or each elimination round
  (Quarter/Semi/Finals) — which drives the **Stage** column,
- and per match: teams, score (`scores[]` joined as `11-8`), winner (mapped from
  `winnerTeam.id`), status, and walkover/bye/forfeit flags.

We loop this over all 14 category URLs, drop empty `TBD vs TBD` knockout placeholders,
and write the Excel workbook (one tab per category) plus the CSVs.

## 6. Correctness check

The parsed output was cross-checked against an independent fetch-and-summarize of the
same rendered page. For **U-12 Boys Doubles** both methods produced `11-8, 11-8, 11-5`
with identical winners, giving confidence the parser is faithful.

---

## Output schema

Each category sheet / CSV has these columns:

| Column | Meaning |
|--------|---------|
| `Stage` | `Round Robin (Pool X)`, or knockout round name (`Quarter Finals`, `Semi Finals`, `Finals`) |
| `Team 1` / `Team 2` | Player name (singles) or `A & B` (doubles); `TBD` if not yet seeded |
| `Score` | e.g. `11-8` (blank if not yet played) |
| `Winner` | Winning player/team (authoritative; blank if unplayed) |
| `Status` | `COMPLETED`, `IN_PROGRESS`, `READY`, `PENDING`, `SCHEDULED` |
| `Notes` | `Walkover` / `Bye` / `Forfeit` flags |

The `Summary` tab lists every category with its time, format
(`roundRobin` vs `roundRobinKnockout`), match count, and completed count.

---

## How to run

```bash
pip install requests openpyxl
python scripts/scrape_khelclub_results.py
```

This regenerates `west_zone_pickleball_2026_results.xlsx` and the CSVs under
`match_results_csv/` with whatever is currently live on the portal. To target a
different day, change the `DATE` constant; to target a different tournament, update
`ORG`, `TOUR`, and the `CATS` list (all discoverable from the tournament's landing page).

---

## Full extractor code

> The canonical, maintained copy lives at
> [`scripts/scrape_khelclub_results.py`](../scripts/scrape_khelclub_results.py).
> It is reproduced here for convenience.

```python
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
    """Download a category fixtures page and return the concatenated RSC flight blob."""
    url = f"{BASE}/organizer-profile/{ORG}/tournament/{TOUR}/category/{cat_id}/fixtures?dateTab=date-{DATE}"
    html = requests.get(url, timeout=30).text
    pushes = re.findall(r'self\.__next_f\.push\(\[\d+,(.*?)\]\)</script>', html, re.S)
    parts = []
    for p in pushes:
        try: parts.append(json.loads(p))   # decode JS string literal -> unescaped python str
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
    """Resolve a team object to a readable player/team name."""
    if not team or not isinstance(team, dict): return "TBD"
    tid = team.get('id') or team.get('_id')
    if tid and tmap.get(tid): return tmap[tid]
    return team.get('name', 'TBD')

def score_str(scores):
    """Format the scores list as '11-8' / '11-8, 9-11' (blank if not yet played)."""
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
    """Return (structure, rows) for one category's flight blob."""
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

    cdir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "match_results_csv")
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
        with open(os.path.join(cdir, name.replace(" ", "_") + ".csv"), "w", newline="") as f:
            wr = csv.writer(f); wr.writerow(HEADERS); wr.writerows(rows)

    out = "west_zone_pickleball_2026_results.xlsx"
    wb.save(out)
    print("SAVED", out)

if __name__ == "__main__":
    main()
```

---

## Notes & caveats

- **Snapshot in time.** The portal is live; counts change as matches finish. Re-run
  the script to refresh.
- **Public data only.** Everything extracted is what the public page renders. The
  auth-protected API was intentionally not used.
- **Format dependency.** The parser keys off Next.js RSC flight (`self.__next_f`) and
  Khel Club's current field names (`scores`, `winnerTeam`, `roundTitle`, …). If the
  site changes its rendering or schema, the extractor may need updating.
