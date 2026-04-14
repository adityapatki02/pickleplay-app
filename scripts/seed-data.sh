#!/bin/bash
BASE="${1:-http://localhost:3000/api/v1}"

ORG_TOKEN=$(curl -s -X POST "$BASE/auth/dev/login" -H "Content-Type: application/json" -d '{"email":"organizer@dev.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
PLR_TOKEN=$(curl -s -X POST "$BASE/auth/dev/login" -H "Content-Type: application/json" -d '{"email":"player@dev.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
echo "✅ Got tokens"

ct() { curl -s -X POST "$BASE/tournaments" -H "Content-Type: application/json" -H "Authorization: Bearer $ORG_TOKEN" -d "$1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null; }
ac() { curl -s -X POST "$BASE/tournaments/$1/categories" -H "Content-Type: application/json" -H "Authorization: Bearer $ORG_TOKEN" -d "$2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null; }
co() { curl -s -X POST "$BASE/tournaments/$1/courts" -H "Content-Type: application/json" -H "Authorization: Bearer $ORG_TOKEN" -d "{\"name\":\"$2\",\"surfaceType\":\"$3\"}" > /dev/null; }
cs() { curl -s -X PATCH "$BASE/tournaments/$1/status" -H "Content-Type: application/json" -H "Authorization: Bearer $ORG_TOKEN" -d "{\"status\":\"$2\"}" > /dev/null; }
rp() { curl -s -X POST "$BASE/tournaments/$1/categories/$2/register" -H "Content-Type: application/json" -H "Authorization: Bearer $PLR_TOKEN" -d "{\"categoryId\":\"$2\",\"paymentMethod\":\"venue\"}" > /dev/null; }

echo ""; echo "📦 Seeding 6 tournaments..."

echo "  1. Pune Pickleball Open 2026"
T1=$(ct '{"name":"Pune Pickleball Open 2026","description":"The biggest pickleball tournament in Pune! Exciting weekend of competitive play. Open to all skill levels.","venueName":"Deccan Sports Complex","venueAddress":"123 Deccan Gymkhana, Pune","city":"Pune","state":"Maharashtra","startDate":"2026-05-01","endDate":"2026-05-02","registrationDeadline":"2026-04-26","contactPhone":"+919876543210","contactEmail":"pune@yoiden.com"}')
C1A=$(ac "$T1" '{"name":"Mixed Doubles Open","format":"doubles","gender":"mixed","entryFee":500,"maxTeams":16,"groupSize":4,"knockoutFormat":"single_elimination","paymentMode":"both"}')
C1B=$(ac "$T1" '{"name":"Mens Singles Advanced","format":"singles","gender":"male","entryFee":300,"maxTeams":32,"groupSize":4,"minRating":1200,"knockoutFormat":"single_elimination","paymentMode":"both"}')
C1C=$(ac "$T1" '{"name":"Womens Doubles Beginner","format":"doubles","gender":"female","entryFee":200,"maxTeams":8,"groupSize":4,"maxRating":1200,"knockoutFormat":"round_robin","paymentMode":"venue"}')
co "$T1" "Court 1" "concrete"; co "$T1" "Court 2" "concrete"; co "$T1" "Court 3" "concrete"
cs "$T1" "published"; cs "$T1" "registration_open"
rp "$T1" "$C1A"
echo "     → registration_open ✅ (3 cats, player registered)"

echo "  2. Mumbai Weekend Smash"
T2=$(ct '{"name":"Mumbai Weekend Smash","description":"Fun weekend doubles at Andheri Sports Club. Perfect for intermediate players. Prizes for top 3!","venueName":"Andheri Sports Club","venueAddress":"Andheri West, near DN Nagar Metro","city":"Mumbai","state":"Maharashtra","startDate":"2026-04-18","endDate":"2026-04-19","registrationDeadline":"2026-04-14","contactPhone":"+919876543211","contactEmail":"mumbai@yoiden.com"}')
C2A=$(ac "$T2" '{"name":"Open Doubles","format":"doubles","gender":"open","entryFee":400,"maxTeams":12,"groupSize":4,"knockoutFormat":"single_elimination","paymentMode":"online"}')
co "$T2" "Court A" "synthetic"; co "$T2" "Court B" "synthetic"
cs "$T2" "published"; cs "$T2" "registration_open"
rp "$T2" "$C2A"
echo "     → registration_open ✅ (1 cat, player registered)"

echo "  3. Bangalore Beginner Bash"
T3=$(ct '{"name":"Bangalore Beginner Bash","description":"Free entry for beginners! Playing less than 6 months? This is your chance for stress-free competitive pickleball.","venueName":"HSR Layout Community Courts","venueAddress":"HSR Layout Sector 7, Bangalore","city":"Bangalore","state":"Karnataka","startDate":"2026-04-25","endDate":"2026-04-25","registrationDeadline":"2026-04-22","contactPhone":"+919876543212","contactEmail":"blr@yoiden.com"}')
C3A=$(ac "$T3" '{"name":"Beginner Singles","format":"singles","gender":"open","entryFee":0,"maxTeams":16,"groupSize":4,"maxRating":1000,"knockoutFormat":"round_robin","paymentMode":"venue"}')
C3B=$(ac "$T3" '{"name":"Beginner Doubles","format":"doubles","gender":"open","entryFee":0,"maxTeams":8,"groupSize":4,"maxRating":1000,"knockoutFormat":"round_robin","paymentMode":"venue"}')
co "$T3" "Court 1" "concrete"
cs "$T3" "published"; cs "$T3" "registration_open"
echo "     → registration_open ✅ (2 cats, FREE)"

echo "  4. Hyderabad Pro Circuit (LIVE)"
T4=$(ct '{"name":"Hyderabad Pro Circuit","description":"Elite tournament. Best players from across India. Min rating 1500. Live streamed on YouTube.","venueName":"Gachibowli Indoor Stadium","venueAddress":"Gachibowli Sports Complex, Hyderabad","city":"Hyderabad","state":"Telangana","startDate":"2026-04-02","endDate":"2026-04-04","registrationDeadline":"2026-03-28","contactPhone":"+919876543213","contactEmail":"hyd@yoiden.com"}')
C4A=$(ac "$T4" '{"name":"Pro Mens Singles","format":"singles","gender":"male","entryFee":1000,"maxTeams":16,"groupSize":4,"minRating":1500,"knockoutFormat":"single_elimination","paymentMode":"online"}')
C4B=$(ac "$T4" '{"name":"Pro Mixed Doubles","format":"doubles","gender":"mixed","entryFee":1500,"maxTeams":8,"groupSize":4,"minRating":1500,"knockoutFormat":"single_elimination","paymentMode":"online"}')
co "$T4" "Center Court" "wooden"; co "$T4" "Court 2" "wooden"
cs "$T4" "published"; cs "$T4" "registration_open"; cs "$T4" "registration_closed"; cs "$T4" "in_progress"
echo "     → in_progress 🔴 LIVE (2 cats)"

echo "  5. Delhi NCR Championship (COMPLETED)"
T5=$(ct '{"name":"Delhi NCR Championship 2026","description":"Premier Delhi NCR pickleball championship. 200+ players. Congratulations to all winners!","venueName":"Siri Fort Sports Complex","venueAddress":"August Kranti Marg, New Delhi","city":"Delhi","state":"Delhi","startDate":"2026-03-15","endDate":"2026-03-16","registrationDeadline":"2026-03-10","contactPhone":"+919876543214","contactEmail":"delhi@yoiden.com"}')
C5A=$(ac "$T5" '{"name":"Open Singles","format":"singles","gender":"open","entryFee":500,"maxTeams":32,"groupSize":4,"knockoutFormat":"single_elimination","paymentMode":"both"}')
co "$T5" "Court 1" "concrete"; co "$T5" "Court 2" "concrete"
cs "$T5" "published"; cs "$T5" "registration_open"; cs "$T5" "registration_closed"; cs "$T5" "in_progress"; cs "$T5" "completed"
echo "     → completed ✅ (1 cat)"

echo "  6. Chennai Coastal Classic"
T6=$(ct '{"name":"Chennai Coastal Classic","description":"Pickleball by the beach! Unique tournament at Marina Beach sports facility. Limited spots!","venueName":"Marina Beach Sports Arena","venueAddress":"Marina Beach Road, Chennai","city":"Chennai","state":"Tamil Nadu","startDate":"2026-04-12","endDate":"2026-04-13","registrationDeadline":"2026-04-05","contactPhone":"+919876543215","contactEmail":"chennai@yoiden.com"}')
C6A=$(ac "$T6" '{"name":"Mixed Doubles","format":"doubles","gender":"mixed","entryFee":350,"maxTeams":12,"groupSize":4,"knockoutFormat":"single_elimination","paymentMode":"both"}')
C6B=$(ac "$T6" '{"name":"Mens Singles","format":"singles","gender":"male","entryFee":250,"maxTeams":16,"groupSize":4,"knockoutFormat":"single_elimination","paymentMode":"venue"}')
co "$T6" "Beach Court 1" "synthetic"; co "$T6" "Beach Court 2" "synthetic"
cs "$T6" "published"; cs "$T6" "registration_open"
echo "     → registration_open ✅ (2 cats, closing soon)"

echo ""
echo "🎉 Done! Player registered for Pune + Mumbai."
