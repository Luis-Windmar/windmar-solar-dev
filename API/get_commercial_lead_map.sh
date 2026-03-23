#!/bin/bash
# ============================================================
# get_commercial_lead.sh
# Auto-refreshes access token and fetches a Commercial Lead record
# Outputs two files:
#   commercial_lead_dump.json     — full raw record
#   commercial_lead_fieldmap.json — clean API name -> UI value map
# Usage: ./get_commercial_lead.sh
# ============================================================

# --- YOUR WRITE  CREDENTIALS (fill these in once) ---
#CLIENT_ID="1000.ZPIB12IH3GLLE897K36TBMO2HLDWZZ"
#CLIENT_SECRET="b5c79ee8ccf2af3842b87ed5a1fa3d9e6bb4bbeb88"
#REFRESH_TOKEN="1000.8bdb79c6bce85a390841926b6b84d82b.d9cd63e754e65b49287b6250d4149848"

# --- WRITE CREDENTIALS ---- 
CLIENT_ID="1000.JM0DSHJNUTC6BZ7US8F9L2VYPTDM6N"
CLIENT_SECRET="2585226ae1799280a3d520b683ba73046969ed2658"
REFRESH_TOKEN="1000.2b8b2581fca30284a785e5a14dfe41e5.aefe5f98a0fb102072faabd170593bc8"



# --- LEAD ID TO FETCH ---
LEAD_ID="4258103003143818527"

# Step 1: Get fresh access token
echo "🔑 Getting fresh access token..."
TOKEN_RESPONSE=$(curl -s -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "grant_type=refresh_token" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "refresh_token=${REFRESH_TOKEN}")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('access_token', ''))
" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token. Check your credentials."
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token obtained."
echo ""

# Step 2: Fetch the full lead record by ID
echo "📋 Fetching Commercial Lead: $LEAD_ID ..."

RESPONSE=$(curl -s -X GET "https://www.zohoapis.com/crm/v3/Commercial_Lead/${LEAD_ID}" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}")

# Check for error
STATUS=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'data' in d:
    print('OK')
else:
    print(d.get('code', 'UNKNOWN_ERROR'))
" 2>/dev/null)

echo ""
if [ "$STATUS" = "OK" ]; then

  # Save full raw dump
  echo "$RESPONSE" | python3 -m json.tool > "commercial_lead_dump.json"
  echo "✅ Full record saved to: commercial_lead_dump.json"

  # Save clean field map (API name -> UI value, populated fields only)
  echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
record = d['data'][0]
fieldmap = {}
for k, v in sorted(record.items()):
    if v is not None and v != [] and v != '':
        fieldmap[k] = v
print(json.dumps(fieldmap, indent=2, ensure_ascii=False))
" > "commercial_lead_fieldmap.json"
  echo "✅ Field map saved to: commercial_lead_fieldmap.json"

  # Print summary
  echo ""
  FIELD_COUNT=$(python3 -c "import json; d=json.load(open('commercial_lead_fieldmap.json')); print(len(d))")
  echo "📊 $FIELD_COUNT populated fields found."

else
  echo "❌ Error: $STATUS"
  echo ""
  echo "Full response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
fi
