#!/bin/bash
# ============================================================
# ZOHO SCRIPT 2: Verify READ access — fetch Leads module fields
# Run Script 1 first, then paste your access token below.
#   chmod +x zoho_2_test_read.sh && ./zoho_2_test_read.sh
# ============================================================

ACCESS_TOKEN="PASTE_ACCESS_TOKEN_FROM_SCRIPT_1_HERE"
ZOHO_REGION="zohoapis.com"  # Match region from Script 1

echo "📋 Testing READ access — fetching Leads module fields..."

RESPONSE=$(curl -s -X GET "https://www.${ZOHO_REGION}/crm/v3/settings/fields?module=Leads" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}")

# Check for error
ERROR=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code','OK'))" 2>/dev/null)

if [ "$ERROR" = "OK" ]; then
  echo ""
  echo "✅ READ access confirmed!"
  echo ""
  echo "Available Lead fields (first 20):"
  echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
fields = d.get('fields', [])
for f in fields[:20]:
    print(f\"  - {f.get('api_name','?')} ({f.get('data_type','?')})\")
print(f'  ... and {max(0, len(fields)-20)} more fields')
"
else
  echo ""
  echo "❌ Error: $ERROR"
  echo "Full response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
fi
