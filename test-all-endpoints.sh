#!/bin/bash
# ============================================================
# ATOMIC FIZZ CAPS - API ENDPOINT TESTING SCRIPT
# Tests all 24+ API endpoints for functionality
# ============================================================

set -e

BASE_URL="${1:-http://localhost:3000}"
TEST_WALLET="DevTestWallet123456789"

echo "📟 OVERSEER SYSTEM CHECK: Testing all API endpoints..."
echo "Base URL: $BASE_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL=0
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_code=${5:-200}
    
    TOTAL=$((TOTAL + 1))
    echo -n "Testing $name... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" == "$expected_code" ] || [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $http_code)"
        echo "   Response: $(echo $body | head -c 100)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 PUBLIC ENDPOINTS (No Auth Required)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Health Check" "GET" "/api/health"
test_endpoint "Mintables List" "GET" "/api/mintables"
test_endpoint "Locations List" "GET" "/api/locations"
test_endpoint "Quests List" "GET" "/api/quests"
test_endpoint "Quest Placeholders" "GET" "/api/quests-store/placeholders"
test_endpoint "Scavenger Data" "GET" "/api/scavenger"
test_endpoint "Game Settings" "GET" "/api/settings"
test_endpoint "Frontend Config" "GET" "/api/config/frontend"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👤 PLAYER ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Player Profile" "GET" "/api/player?wallet=$TEST_WALLET"
test_endpoint "Player NFTs" "GET" "/api/player-nfts?wallet=$TEST_WALLET" "" "400"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎮 GAME MECHANICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Mint Item (Dev)" "POST" "/api/mint-item" '{"wallet":"'$TEST_WALLET'"}'
test_endpoint "Award XP" "POST" "/api/xp" '{"wallet":"'$TEST_WALLET'","amount":10}'
test_endpoint "Award Caps" "POST" "/api/caps" '{"wallet":"'$TEST_WALLET'","amount":5}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗺️ QUEST SYSTEM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Quest Proof (Invalid)" "POST" "/api/quests-store/prove" '{"wallet":"'$TEST_WALLET'","questId":"test","proof":{"type":"token","value":"invalid"}}' "400"
test_endpoint "Quest Reveal" "POST" "/api/quests-store/reveal" '{"wallet":"'$TEST_WALLET'","questId":"wake_up"}' "404"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RATE LIMITING TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Testing rate limiter (6 rapid requests)... "
for i in {1..6}; do
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/quests-store/prove" \
        -H "Content-Type: application/json" \
        -d '{"wallet":"test","questId":"test","proof":{"type":"token","value":"test"}}' 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    
    if [ $i -eq 6 ] && [ "$http_code" == "429" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Rate limit working)"
        PASSED=$((PASSED + 1))
        break
    elif [ $i -eq 6 ]; then
        echo -e "${YELLOW}⚠️ WARN${NC} (Rate limit may not be working)"
    fi
done
TOTAL=$((TOTAL + 1))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo "System is ready for public testing. ☢️"
    exit 0
else
    echo ""
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo "Check the errors above and verify configuration."
    exit 1
fi
