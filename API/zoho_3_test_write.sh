#!/bin/bash
# ============================================================
# ZOHO SCRIPT 3: Verify WRITE access — create a test Lead
# Run Script 1 first, then paste your access token below.
#   chmod +x zoho_3_test_write.sh && ./zoho_3_test_write.sh
#
# NOTE: This will create a real Lead record in your CRM.
# Delete it manually afterward from Zoho CRM.
# ============================================================

ACCESS_TOKEN="PASTE_ACCESS_TOKEN_FROM_SCRIPT_1_HERE"
ZOHO_REGION="zohoapis.com"  # Match region from Script 1

echo "✍️  Testing WRITE access — creating a test Lead..."

RESPONSE=$(curl -s -X POST "https://www.${ZOHO_REGION}/crm/v3/Leads" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "Last_Name": "TEST_DELETE_ME",
        "First_Name": "Windmar PreQual",
        "Company": "Test Company",
        "Phone": "787-000-0000",
        "Lead_Source": "Web Site",
        "Description": "Automated test from PreQual wizard API verification. Safe to delete."
      }
    ]
  }')

echo ""
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Check result
STATUS=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d.get('data', [{}])
print(items[0].get('code', 'UNKNOWN'))
" 2>/dev/null)

echo ""
if [ "$STATUS" = "SUCCESS" ]; then
  LEAD_ID=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d['data'][0]['details']['id'])
" 2>/dev/null)
  echo "✅ WRITE access confirmed! Lead created with ID: $LEAD_ID"
  echo ""
  echo "⚠️  Remember to delete this test record from Zoho CRM."
  echo "    Lead ID to delete: $LEAD_ID"
else
  echo "❌ Write failed with status: $STATUS"
  echo "   Check the response above for details."
fi
