#!/bin/bash
# Simulate matches across all tournaments and verify TrueSkill ratings
BASE="https://yoiden-api-460478077750.asia-south1.run.app/api/v1"

# Get organizer token
ORG_TOKEN=$(curl -s -X POST "$BASE/auth/dev/login" -H "Content-Type: application/json" -d '{"email":"organizer@dev.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Helper: enter score for a match
enter_score() {
  local MATCH_ID="$1"
  local SCORES="$2"
  curl -s -X PATCH "$BASE/matches/$MATCH_ID/score" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ORG_TOKEN" \
    -d "{\"scores\":$SCORES}" > /dev/null 2>&1
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏓 SIMULATING MATCHES & TESTING RATINGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Chennai Coastal Classic — Mixed Doubles (already has draw) ────────────────
echo ""
echo "📍 Chennai Coastal Classic — Mixed Doubles"
echo "   (Draw already exists with 3 groups, 9 matches)"

CHENNAI="7e868565-cc30-420c-a44c-8ff877f6b387"
CAT_CHENNAI="8ff59c1f-ea77-4be1-aa9c-9f8754867bb6"

# Get all pool matches
MATCHES=$(curl -s "$BASE/tournaments/$CHENNAI/categories/$CAT_CHENNAI/bracket" \
  -H "Authorization: Bearer $ORG_TOKEN" | python3 -c "
import sys,json
d = json.load(sys.stdin).get('data',{})
for p in d.get('pools',[]):
    for m in p.get('matches',[]):
        if m['status'] != 'completed':
            print(m['id'])
")

# Enter scores for remaining matches (match 1 already scored)
COUNT=0
while IFS= read -r MID; do
  if [ -z "$MID" ]; then continue; fi
  COUNT=$((COUNT+1))
  # Alternate results: some close, some dominant
  case $((COUNT % 4)) in
    0) enter_score "$MID" '[{"gameNumber":1,"teamAScore":11,"teamBScore":7},{"gameNumber":2,"teamAScore":11,"teamBScore":5}]' ;;
    1) enter_score "$MID" '[{"gameNumber":1,"teamAScore":9,"teamBScore":11},{"gameNumber":2,"teamAScore":11,"teamBScore":8},{"gameNumber":3,"teamAScore":11,"teamBScore":9}]' ;;
    2) enter_score "$MID" '[{"gameNumber":1,"teamAScore":11,"teamBScore":4},{"gameNumber":2,"teamAScore":11,"teamBScore":6}]' ;;
    3) enter_score "$MID" '[{"gameNumber":1,"teamAScore":7,"teamBScore":11},{"gameNumber":2,"teamAScore":11,"teamBScore":9},{"gameNumber":3,"teamAScore":9,"teamBScore":11}]' ;;
  esac
  echo "   Match $COUNT scored ✓"
done <<< "$MATCHES"
echo "   Total matches scored: $COUNT"

# ── Pune Pickleball Open — Mixed Doubles Open (already has draw) ──────────────
echo ""
echo "📍 Pune Pickleball Open — Mixed Doubles Open"

PUNE="dc21f67b-63b6-49ee-bacd-0174d6455f19"
CAT_PUNE="7b858787-e50d-4bd6-a5dc-d42599fe6267"

MATCHES=$(curl -s "$BASE/tournaments/$PUNE/categories/$CAT_PUNE/bracket" \
  -H "Authorization: Bearer $ORG_TOKEN" | python3 -c "
import sys,json
d = json.load(sys.stdin).get('data',{})
for p in d.get('pools',[]):
    for m in p.get('matches',[]):
        if m['status'] != 'completed':
            print(m['id'])
")

COUNT=0
while IFS= read -r MID; do
  if [ -z "$MID" ]; then continue; fi
  COUNT=$((COUNT+1))
  case $((COUNT % 3)) in
    0) enter_score "$MID" '[{"gameNumber":1,"teamAScore":11,"teamBScore":8},{"gameNumber":2,"teamAScore":11,"teamBScore":6}]' ;;
    1) enter_score "$MID" '[{"gameNumber":1,"teamAScore":11,"teamBScore":9},{"gameNumber":2,"teamAScore":7,"teamBScore":11},{"gameNumber":3,"teamAScore":11,"teamBScore":7}]' ;;
    2) enter_score "$MID" '[{"gameNumber":1,"teamAScore":5,"teamBScore":11},{"gameNumber":2,"teamAScore":11,"teamBScore":9},{"gameNumber":3,"teamAScore":11,"teamBScore":8}]' ;;
  esac
  echo "   Match $COUNT scored ✓"
done <<< "$MATCHES"
echo "   Total matches scored: $COUNT"

# ── Now check ratings ────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 CHECKING PLAYER RATINGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check ratings for each player
for i in 1 2 3 4 5 6 7 8; do
  EMAIL="player${i}@dev.com"
  if [ "$i" -eq "1" ]; then EMAIL="player@dev.com"; fi

  TOKEN=$(curl -s -X POST "$BASE/auth/dev/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"password123\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

  RATINGS=$(curl -s "$BASE/my/ratings" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  echo "$RATINGS" | python3 -c "
import sys,json
try:
    data = json.load(sys.stdin).get('data',[])
    name = 'Player $i' if $i > 1 else 'Alex Player'
    if not data:
        print(f'  {name}: No ratings yet')
    for r in data:
        fmt = r.get('format','?')
        display = r.get('displayRating', r.get('rating','?'))
        mu = r.get('mu','?')
        sigma = r.get('sigma','?')
        matches = r.get('matchesPlayed',0)
        peak = r.get('peakRating','?')
        print(f'  {name} ({fmt}): {display} (mu={mu}, sigma={sigma}) | {matches} matches | peak: {peak}')
except:
    print(f'  Player $i: Error reading ratings')
" 2>/dev/null
done

# Also check organizer
TOKEN=$(curl -s -X POST "$BASE/auth/dev/login" -H "Content-Type: application/json" -d '{"email":"organizer@dev.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
RATINGS=$(curl -s "$BASE/my/ratings" -H "Authorization: Bearer $TOKEN")
echo "$RATINGS" | python3 -c "
import sys,json
try:
    data = json.load(sys.stdin).get('data',[])
    for r in data:
        fmt = r.get('format','?')
        display = r.get('displayRating', r.get('rating','?'))
        mu = r.get('mu','?')
        sigma = r.get('sigma','?')
        matches = r.get('matchesPlayed',0)
        print(f'  Alex Organizer ({fmt}): {display} (mu={mu}, sigma={sigma}) | {matches} matches')
except:
    print('  Organizer: Error')
"

# Check leaderboard
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏆 DOUBLES LEADERBOARD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s "$BASE/leaderboard?format=doubles" | python3 -c "
import sys,json
data = json.load(sys.stdin).get('data',[])
for i, r in enumerate(data):
    name = r.get('user',{}).get('fullName','?')
    display = r.get('displayRating','?')
    matches = r.get('matchesPlayed',0)
    print(f'  #{i+1} {name:20s} Rating: {display}  ({matches} matches)')
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 SIMULATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
