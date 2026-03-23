#!/bin/bash
# ============================================================
# test_zoho_file_attach.sh
#
# Tests file attachment using both WRITE and READ credentials:
#
#   PART A — WRITE credentials
#     A1. Attach to existing lead (from previous test run)
#     A2. Create new lead, attach to it
#
#   PART B — READ credentials
#     B1. Attach to existing lead (from previous test run)
#     B2. Create new lead with READ credentials, attach to it
#
# Usage: ./test_zoho_file_attach.sh
# ============================================================

ENV_FILE=".env"
FILE_TEST="./test/Zoho_estimado_test.pdf"
EXISTING_LEAD_ID="4258103003145639896"   # Lead from previous test run

# ── Verify test file ──────────────────────────────────────────
if [ ! -f "$FILE_TEST" ]; then
  echo "❌ Test file not found: $FILE_TEST"
  exit 1
fi
echo "✅ Test file found."
echo ""

# ── Load credentials ──────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found. Run this from your project root."
  exit 1
fi

WRITE_CLIENT_ID=$(grep "^ZOHO_WRITE_CLIENT_ID=" "$ENV_FILE" | cut -d '=' -f2)
WRITE_CLIENT_SECRET=$(grep "^ZOHO_WRITE_CLIENT_SECRET=" "$ENV_FILE" | cut -d '=' -f2)
WRITE_REFRESH_TOKEN=$(grep "^ZOHO_WRITE_REFRESH_TOKEN=" "$ENV_FILE" | cut -d '=' -f2)

READ_CLIENT_ID=$(grep "^ZOHO_READ_CLIENT_ID=" "$ENV_FILE" | cut -d '=' -f2)
READ_CLIENT_SECRET=$(grep "^ZOHO_READ_CLIENT_SECRET=" "$ENV_FILE" | cut -d '=' -f2)
READ_REFRESH_TOKEN=$(grep "^ZOHO_READ_REFRESH_TOKEN=" "$ENV_FILE" | cut -d '=' -f2)

OWNER_USER_ID=$(grep "^ZOHO_OWNER_USER_ID=" "$ENV_FILE" | cut -d '=' -f2)

echo "✅ Credentials loaded from .env"
echo ""

# ── Helper: get access token ──────────────────────────────────
get_token() {
  local CLIENT_ID=$1
  local CLIENT_SECRET=$2
  local REFRESH_TOKEN=$3
  curl -s -X POST "https://accounts.zoho.com/oauth/v2/token" \
    -d "grant_type=refresh_token" \
    -d "client_id=${CLIENT_ID}" \
    -d "client_secret=${CLIENT_SECRET}" \
    -d "refresh_token=${REFRESH_TOKEN}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('access_token', ''))
" 2>/dev/null
}

# ── Helper: try attaching a file ──────────────────────────────
try_attach() {
  local LABEL=$1
  local LEAD_ID=$2
  local TOKEN=$3
  local RESPONSE
  RESPONSE=$(curl -s -X POST \
    "https://www.zohoapis.com/crm/v3/Commercial_Lead/${LEAD_ID}/Attachments" \
    -H "Authorization: Zoho-oauthtoken ${TOKEN}" \
    -F "file=@${FILE_TEST};type=application/pdf")
  local STATUS
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
    echo "   ✅ $LABEL → SUCCESS"
  else
    echo "   ❌ $LABEL → $STATUS"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | sed 's/^/      /'
  fi
  echo "$STATUS"
}

# ── Helper: create a lead ─────────────────────────────────────
create_lead() {
  local LABEL=$1
  local TOKEN=$2
  local OWNER_JSON=""
  if [ -n "$OWNER_USER_ID" ]; then
    OWNER_JSON=", \"Owner\": { \"id\": \"${OWNER_USER_ID}\" }"
  fi
  local RESPONSE
  RESPONSE=$(curl -s -X POST "https://www.zohoapis.com/crm/v3/Commercial_Lead" \
    -H "Authorization: Zoho-oauthtoken ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"data\": [{
        \"Primary_Contact\": \"File Attach Test\",
        \"Account_Name\":    \"API TEST IGNORE ME — ${LABEL}\",
        \"Lead_Status\":     \"New Lead\",
        \"Lead_Source\":     \"PreQual Wizard\",
        \"Lead_Notes\":      \"Created by test_zoho_file_attach.sh — safe to delete\"
        ${OWNER_JSON}
      }]
    }")
  local STATUS
  STATUS=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('data', [{}])[0].get('code', 'UNKNOWN'))
" 2>/dev/null)
  if [ "$STATUS" = "SUCCESS" ]; then
    local NEW_ID
    NEW_ID=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d['data'][0]['details']['id'])
" 2>/dev/null)
    echo "   ✅ Lead created. ID: $NEW_ID"
    echo "$NEW_ID"
  else
    echo "   ❌ Lead creation failed: $STATUS"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | sed 's/^/      /'
    echo ""
  fi
}

# ══════════════════════════════════════════════════════════════
echo "════════════════════════════════════════"
echo "PART A: WRITE credentials"
echo "════════════════════════════════════════"
echo "🔑 Getting WRITE token..."
WRITE_TOKEN=$(get_token "$WRITE_CLIENT_ID" "$WRITE_CLIENT_SECRET" "$WRITE_REFRESH_TOKEN")
if [ -z "$WRITE_TOKEN" ]; then
  echo "❌ Failed to get WRITE token."
else
  echo "✅ WRITE token obtained."
  echo ""

  echo "── A1: Attach to EXISTING lead (${EXISTING_LEAD_ID}) using WRITE ──"
  STATUS_A1=$(try_attach "WRITE → existing lead" "$EXISTING_LEAD_ID" "$WRITE_TOKEN")
  echo ""

  echo "── A2: Create NEW lead with WRITE, then attach ──"
  NEW_LEAD_WRITE=$(create_lead "WRITE new lead" "$WRITE_TOKEN")
  NEW_ID_WRITE=$(echo "$NEW_LEAD_WRITE" | tail -1)
  if [ -n "$NEW_ID_WRITE" ] && [ "$NEW_ID_WRITE" != "" ]; then
    STATUS_A2=$(try_attach "WRITE → new lead" "$NEW_ID_WRITE" "$WRITE_TOKEN")
  else
    STATUS_A2="SKIPPED (lead creation failed)"
  fi
fi

# ══════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════"
echo "PART B: READ credentials"
echo "════════════════════════════════════════"
echo "🔑 Getting READ token..."
READ_TOKEN=$(get_token "$READ_CLIENT_ID" "$READ_CLIENT_SECRET" "$READ_REFRESH_TOKEN")
if [ -z "$READ_TOKEN" ]; then
  echo "❌ Failed to get READ token."
else
  echo "✅ READ token obtained."
  echo ""

  echo "── B1: Attach to EXISTING lead (${EXISTING_LEAD_ID}) using READ ──"
  STATUS_B1=$(try_attach "READ → existing lead" "$EXISTING_LEAD_ID" "$READ_TOKEN")
  echo ""

  echo "── B2: Create NEW lead with READ, then attach ──"
  NEW_LEAD_READ=$(create_lead "READ new lead" "$READ_TOKEN")
  NEW_ID_READ=$(echo "$NEW_LEAD_READ" | tail -1)
  if [ -n "$NEW_ID_READ" ] && [ "$NEW_ID_READ" != "" ]; then
    STATUS_B2=$(try_attach "READ → new lead" "$NEW_ID_READ" "$READ_TOKEN")
  else
    STATUS_B2="SKIPPED (lead creation failed)"
  fi
fi

# ══════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════"
echo "SUMMARY"
echo "════════════════════════════════════════"
echo "A1 WRITE → existing lead:  ${STATUS_A1:-not run}"
echo "A2 WRITE → new lead:       ${STATUS_A2:-not run}"
echo "B1 READ  → existing lead:  ${STATUS_B1:-not run}"
echo "B2 READ  → new lead:       ${STATUS_B2:-not run}"
echo ""
echo "Existing lead ID: $EXISTING_LEAD_ID"
[ -n "$NEW_ID_WRITE" ] && echo "WRITE new lead ID: $NEW_ID_WRITE"
[ -n "$NEW_ID_READ" ]  && echo "READ new lead ID:  $NEW_ID_READ"
echo ""
echo "→ Delete all test records from Zoho CRM when done."
echo "════════════════════════════════════════"
