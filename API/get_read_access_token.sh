#!/bin/bash
# ============================================================
# get_read_access_token.sh
# Gets a fresh Zoho access token using your read credentials
# Usage: ./get_read_access_token.sh
# ============================================================

CLIENT_ID="1000.JM0DSHJNUTC6BZ7US8F9L2VYPTDM6N"
CLIENT_SECRET="2585226ae1799280a3d520b683ba73046969ed2658"
REFRESH_TOKEN="1000.2b8b2581fca30284a785e5a14dfe41e5.aefe5f98a0fb102072faabd170593bc8"

echo "🔑 Requesting read access token..."

RESPONSE=$(curl -s -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "grant_type=refresh_token" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "refresh_token=${REFRESH_TOKEN}")

echo ""
echo "Full response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('access_token', 'ERROR'))
" 2>/dev/null)

echo ""
if [ "$ACCESS_TOKEN" = "ERROR" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token. Check your credentials and region."
else
  echo "✅ Access Token: $ACCESS_TOKEN"
  echo ""
  echo "Copy this token and use it in get_lead_record.sh"
fi
