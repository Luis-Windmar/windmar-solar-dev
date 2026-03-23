#!/bin/bash
# ============================================================
# ZOHO SCRIPT 4: Verify FILE ATTACHMENT — attach a dummy file to a Lead
# Run Script 3 first and paste the Lead ID it returned below.
#   chmod +x zoho_4_test_attachment.sh && ./zoho_4_test_attachment.sh
# ============================================================

ACCESS_TOKEN="PASTE_ACCESS_TOKEN_FROM_SCRIPT_1_HERE"
LEAD_ID="PASTE_LEAD_ID_FROM_SCRIPT_3_HERE"
ZOHO_REGION="zohoapis.com"  # Match region from Script 1

# Create a small dummy "bill" file to attach
DUMMY_FILE="/tmp/test_luma_bill.txt"
echo "LUMA Bill Test File - Safe to delete. Created by Windmar PreQual API verification." > "$DUMMY_FILE"

echo "📎 Testing FILE ATTACHMENT — attaching dummy file to Lead $LEAD_ID..."

RESPONSE=$(curl -s -X POST "https://www.${ZOHO_REGION}/crm/v3/Leads/${LEAD_ID}/Attachments" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  -F "file=@${DUMMY_FILE};type=text/plain")

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
  echo "✅ FILE ATTACHMENT confirmed!"
  echo ""
  echo "🎉 All API scopes verified. Ready to build the integration."
  echo ""
  echo "Summary of what works:"
  echo "  ✅ OAuth token refresh"
  echo "  ✅ Read Leads module"
  echo "  ✅ Create Lead records"
  echo "  ✅ Attach files to Lead records"
else
  echo "❌ Attachment failed with status: $STATUS"
  echo "   This may mean the API scope does not include ZohoCRM.modules.attachments"
  echo "   Ask your admin to add: ZohoCRM.modules.attachments.CREATE"
fi

# Cleanup
rm -f "$DUMMY_FILE"
