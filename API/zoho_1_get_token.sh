#!/bin/bash
# ============================================================
# ZOHO SCRIPT 1: Get a fresh access token
# Fill in your credentials below, then run:
#   chmod +x zoho_1_get_token.sh && ./zoho_1_get_token.sh
# ============================================================

CLIENT_ID="1000.ZPIB12IH3GLLE897K36TBMO2HLDWZZ"
CLIENT_SECRET="b5c79ee8ccf2af3842b87ed5a1fa3d9e6bb4bbeb88"
REFRESH_TOKEN="1000.8bdb79c6bce85a390841926b6b84d82b.d9cd63e754e65b49287b6250d4149848"
# Region options: zohoapis.com | zohoapis.eu | zohoapis.in | zohoapis.com.au
ZOHO_REGION="zoho.com"

echo "🔑 Requesting access token..."

RESPONSE=$(curl -s -X POST "https://accounts.${ZOHO_REGION}/oauth/v2/token" \
  -d "grant_type=refresh_token" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "refresh_token=${REFRESH_TOKEN}")

echo ""
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Extract and display the access token
ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','ERROR'))" 2>/dev/null)
echo ""
echo "✅ Access Token: $ACCESS_TOKEN"
echo ""
echo "Copy this token — you'll need it for scripts 2 and 3."
