#!/bin/bash
# ============================================================
# get_lead_record.sh
# Fetches a single Lead record from Zoho CRM by ID
# Usage: ./get_lead_record.sh
# ============================================================

ACCESS_TOKEN="1000.b0ea647f9167cb2747bff4b102bf778b.fa3750067e92695a7cb128e23aa7244c"
LEAD_ID="CustomModule84/4258103003142636692"

OUTPUT_FILE="lead_dump.json"

echo "📋 Fetching Lead record: $LEAD_ID ..."

RESPONSE=$(curl -s -X GET "https://www.zohoapis.com/crm/v3/Leads/${LEAD_ID}" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}")

# Check for error
ERROR=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
# If 'data' key exists, it's a success
if 'data' in d:
    print('OK')
else:
    print(d.get('code', 'UNKNOWN_ERROR'))
" 2>/dev/null)

echo ""
if [ "$ERROR" = "OK" ]; then
  echo "$RESPONSE" | python3 -m json.tool > "$OUTPUT_FILE"
  echo "✅ Lead record saved to: $OUTPUT_FILE"
  echo ""
  echo "Field summary (non-null fields only):"
  echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
record = d['data'][0]
print(f'  Total fields: {len(record)}')
print()
print('  Non-null fields:')
for k, v in sorted(record.items()):
    if v is not None and v != [] and v != '':
        # Truncate long values for display
        display = str(v)
        if len(display) > 60:
            display = display[:60] + '...'
        print(f'    {k}: {display}')
"
else
  echo "❌ Error: $ERROR"
  echo ""
  echo "Full response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
fi
