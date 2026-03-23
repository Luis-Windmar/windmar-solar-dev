#!/bin/bash
# ============================================================
# test_zoho_write_read_compare.sh
#
# 1. Uses WRITE credentials to create a Commercial_Lead
#    with every non-picklist field filled
# 2. Uses READ credentials to GET that same record
# 3. Prints a side-by-side comparison table: sent vs. received
#
# Usage: ./test_zoho_write_read_compare.sh
# ============================================================

ENV_FILE=".env"

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

if [ -z "$WRITE_CLIENT_ID" ] || [ -z "$WRITE_CLIENT_SECRET" ] || [ -z "$WRITE_REFRESH_TOKEN" ]; then
  echo "❌ Write credentials missing. Need: ZOHO_WRITE_CLIENT_ID, ZOHO_WRITE_CLIENT_SECRET, ZOHO_WRITE_REFRESH_TOKEN"
  exit 1
fi

if [ -z "$READ_CLIENT_ID" ] || [ -z "$READ_CLIENT_SECRET" ] || [ -z "$READ_REFRESH_TOKEN" ]; then
  echo "❌ Read credentials missing. Need: ZOHO_READ_CLIENT_ID, ZOHO_READ_CLIENT_SECRET, ZOHO_READ_REFRESH_TOKEN"
  exit 1
fi

echo "✅ Credentials loaded from .env"
echo ""

# ── Helper: get access token ──────────────────────────────────
get_token() {
  local CLIENT_ID=$1
  local CLIENT_SECRET=$2
  local REFRESH_TOKEN=$3

  local RESPONSE=$(curl -s -X POST "https://accounts.zoho.com/oauth/v2/token" \
    -d "grant_type=refresh_token" \
    -d "client_id=${CLIENT_ID}" \
    -d "client_secret=${CLIENT_SECRET}" \
    -d "refresh_token=${REFRESH_TOKEN}")

  echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('access_token', ''))
" 2>/dev/null
}

# ── Step 1: Get write token ───────────────────────────────────
echo "🔑 Getting WRITE access token..."
WRITE_TOKEN=$(get_token "$WRITE_CLIENT_ID" "$WRITE_CLIENT_SECRET" "$WRITE_REFRESH_TOKEN")
if [ -z "$WRITE_TOKEN" ]; then
  echo "❌ Failed to get write token."
  exit 1
fi
echo "✅ Write token obtained."
echo ""

# ── Step 2: Create the lead ───────────────────────────────────
echo "📋 Creating test lead with ALL fields..."

if [ -n "$OWNER_USER_ID" ]; then
  OWNER_JSON=", \"Owner\": { \"id\": \"${OWNER_USER_ID}\" }"
else
  OWNER_JSON=""
fi

CREATE_RESPONSE=$(curl -s -X POST "https://www.zohoapis.com/crm/v3/Commercial_Lead" \
  -H "Authorization: Zoho-oauthtoken ${WRITE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": [{
      \"Primary_Contact\":    \"API TEST IGNORE ME\",
      \"Account_Name\":       \"API TEST IGNORE ME\",
      \"Phone_2\":            \"787-000-0000\",
      \"Phone_3\":            \"787-000-0001\",
      \"Email\":              \"apitest@ignoreme.com\",
      \"Address\":            \"API TEST IGNORE ME\",
      \"City\":               \"API TEST IGNORE ME\",
      \"Zip_Code\":           \"00000\",
      \"Tama_o_Estimado\":    9999,
      \"Consumo_Promedio\":   9999,
      \"PV_System_Size_kW1\": \"99\",
      \"Sales_Rep_Email\":    \"apitest@ignoreme.com\",
      \"Lead_Notes\":         \"API TEST IGNORE ME\",
      \"Lead_Status\":        \"New Lead\",
      \"Lead_Source\":        \"PreQual Wizard\"
      ${OWNER_JSON}
    }]
  }")

CREATE_STATUS=$(echo "$CREATE_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('data', [{}])[0].get('code', 'UNKNOWN'))
" 2>/dev/null)

if [ "$CREATE_STATUS" != "SUCCESS" ]; then
  echo "❌ Lead creation failed: $CREATE_STATUS"
  echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null
  exit 1
fi

LEAD_ID=$(echo "$CREATE_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d['data'][0]['details']['id'])
" 2>/dev/null)

echo "✅ Lead created. ID: $LEAD_ID"
echo ""

# ── Step 3: Get read token ────────────────────────────────────
echo "🔑 Getting READ access token..."
READ_TOKEN=$(get_token "$READ_CLIENT_ID" "$READ_CLIENT_SECRET" "$READ_REFRESH_TOKEN")
if [ -z "$READ_TOKEN" ]; then
  echo "❌ Failed to get read token."
  exit 1
fi
echo "✅ Read token obtained."
echo ""

# ── Step 4: Read the record back ──────────────────────────────
echo "📖 Reading lead back from Zoho..."
READ_RESPONSE=$(curl -s -X GET "https://www.zohoapis.com/crm/v3/Commercial_Lead/${LEAD_ID}" \
  -H "Authorization: Zoho-oauthtoken ${READ_TOKEN}")

READ_OK=$(echo "$READ_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('YES' if 'data' in d else 'NO')
" 2>/dev/null)

if [ "$READ_OK" != "YES" ]; then
  echo "❌ Failed to read lead back."
  echo "$READ_RESPONSE" | python3 -m json.tool 2>/dev/null
  exit 1
fi

echo "✅ Lead read successfully."
echo ""

# ── Step 5: Side-by-side comparison ──────────────────────────
echo "════════════════════════════════════════════════════════════════════════"
echo "COMPARISON: Sent vs. Received"
echo "════════════════════════════════════════════════════════════════════════"

python3 << PYEOF
import json

sent = {
    "Primary_Contact":    "API TEST IGNORE ME",
    "Account_Name":       "API TEST IGNORE ME",
    "Phone_2":            "787-000-0000",
    "Phone_3":            "787-000-0001",
    "Email":              "apitest@ignoreme.com",
    "Address":            "API TEST IGNORE ME",
    "City":               "API TEST IGNORE ME",
    "Zip_Code":           "00000",
    "Tama_o_Estimado":    9999,
    "Consumo_Promedio":   9999,
    "PV_System_Size_kW1": "99",
    "Sales_Rep_Email":    "apitest@ignoreme.com",
    "Lead_Notes":         "API TEST IGNORE ME",
    "Lead_Status":        "New Lead",
    "Lead_Source":        "PreQual Wizard",
}

raw = '''$READ_RESPONSE'''
received_full = json.loads(raw)
received = received_full.get("data", [{}])[0]

col1 = 24  # field name width
col2 = 26  # sent value width
col3 = 26  # received value width

header = f"{'Field':<{col1}} {'Sent':<{col2}} {'Received':<{col3}} Status"
divider = "-" * (col1 + col2 + col3 + 12)

print(header)
print(divider)

all_ok = True
for field, sent_val in sent.items():
    recv_val = received.get(field, "⚠️  NOT IN RESPONSE")
    sent_str = str(sent_val)
    recv_str = str(recv_val) if recv_val is not None else "null"

    if recv_val is None or recv_val == "" or recv_val == "⚠️  NOT IN RESPONSE":
        status = "❌ BLANK/MISSING"
        all_ok = False
    elif str(recv_val) == str(sent_val):
        status = "✅"
    else:
        status = "⚠️  DIFFERS"
        all_ok = False

    print(f"{field:<{col1}} {sent_str:<{col2}} {recv_str:<{col3}} {status}")

print(divider)
if all_ok:
    print("✅ All fields matched perfectly.")
else:
    print("⚠️  Some fields need attention — see above.")

print()
print("Full received record (all fields Zoho returned):")
print(json.dumps(received, indent=2, ensure_ascii=False))
PYEOF

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "Cleanup: Delete lead ID $LEAD_ID from Zoho CRM when done."
echo "════════════════════════════════════════════════════════════════════════"
