#!/bin/bash
# ============================================================
# test_zoho_attach_both.sh
#
# Attaches both test files to an existing lead using READ
# credentials (confirmed working in previous test).
#
# Target lead: 4258103003145769301 (CL1069 API TEST IGNORE ME — READ new lead)
#
# Usage: ./test_zoho_attach_both.sh
# ============================================================

ENV_FILE=".env"
FILE_ESTIMADO="./test/Zoho_estimado_test.pdf"
FILE_FACTURA="./test/Zoho_factura_test.pdf"
LEAD_ID="4258103003145769301"

# ── Verify test files ─────────────────────────────────────────
if [ ! -f "$FILE_ESTIMADO" ]; then
  echo "❌ Test file not found: $FILE_ESTIMADO"
  exit 1
fi
if [ ! -f "$FILE_FACTURA" ]; then
  echo "❌ Test file not found: $FILE_FACTURA"
  exit 1
fi
echo "✅ Both test files found."
echo ""

# ── Load READ credentials ─────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found. Run this from your project root."
  exit 1
fi

READ_CLIENT_ID=$(grep "^ZOHO_READ_CLIENT_ID=" "$ENV_FILE" | cut -d '=' -f2)
READ_CLIENT_SECRET=$(grep "^ZOHO_READ_CLIENT_SECRET=" "$ENV_FILE" | cut -d '=' -f2)
READ_REFRESH_TOKEN=$(grep "^ZOHO_READ_REFRESH_TOKEN=" "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$READ_CLIENT_ID" ] || [ -z "$READ_CLIENT_SECRET" ] || [ -z "$READ_REFRESH_TOKEN" ]; then
  echo "❌ READ credentials missing from .env."
  exit 1
fi

echo "✅ READ credentials loaded."
echo ""

# ── Get READ token ────────────────────────────────────────────
echo "🔑 Getting READ access token..."
TOKEN_RESPONSE=$(curl -s -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "grant_type=refresh_token" \
  -d "client_id=${READ_CLIENT_ID}" \
  -d "client_secret=${READ_CLIENT_SECRET}" \
  -d "refresh_token=${READ_REFRESH_TOKEN}")

READ_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('access_token', ''))
" 2>/dev/null)

if [ -z "$READ_TOKEN" ]; then
  echo "❌ Failed to get READ token."
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi
echo "✅ Token obtained."
echo ""

# ── Helper: attach a file ─────────────────────────────────────
attach_file() {
  local FILE_PATH=$1
  local FILE_NAME=$(basename "$FILE_PATH")
  echo "📎 Attaching: $FILE_NAME ..."

  RESPONSE=$(curl -s -X POST \
    "https://www.zohoapis.com/crm/v3/Commercial_Lead/${LEAD_ID}/Attachments" \
    -H "Authorization: Zoho-oauthtoken ${READ_TOKEN}" \
    -F "file=@${FILE_PATH};type=application/pdf")

  STATUS=$(echo "$RESPONSE" | python3 -c "
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw)
    items = d.get('data', [{}])
    code = items[0].get('code', d.get('code', 'UNKNOWN')) if items else d.get('code', 'UNKNOWN')
    print(code)
except:
    print('PARSE_ERROR')
" 2>/dev/null)

  if [ "$STATUS" = "SUCCESS" ]; then
    ATTACH_ID=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d['data'][0]['details']['id'])
" 2>/dev/null)
    echo "   ✅ Attached successfully. Attachment ID: $ATTACH_ID"
  else
    echo "   ❌ Failed: $STATUS"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | sed 's/^/      /'
  fi
  echo "$STATUS"
}

# ── Attach both files ─────────────────────────────────────────
echo "════════════════════════════════════════"
echo "Attaching files to lead $LEAD_ID"
echo "════════════════════════════════════════"
STATUS_ESTIMADO=$(attach_file "$FILE_ESTIMADO")
echo ""
STATUS_FACTURA=$(attach_file "$FILE_FACTURA")

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "SUMMARY"
echo "════════════════════════════════════════"
echo "Zoho_estimado_test.pdf:  $(echo "$STATUS_ESTIMADO" | tail -1)"
echo "Zoho_factura_test.pdf:   $(echo "$STATUS_FACTURA" | tail -1)"
echo ""
echo "Lead ID: $LEAD_ID"
echo "→ Open Zoho CRM and check the Attachments section on this record."
echo "→ You should see both files: estimado + factura."
echo "→ Delete the record when done."
echo "════════════════════════════════════════"
