#!/bin/bash
# ============================================================
# test_zoho_write.sh
# Reads credentials from .env file, gets a fresh token,
# and updates the Account_Name field on a test lead record.
# Usage: ./test_zoho_write.sh
# ============================================================

ENV_FILE=".env"
LEAD_ID="4258103003143818527"

# Read credentials from .env file
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found. Run this script from your project root."
  exit 1
fi

CLIENT_ID=$(grep "^ZOHO_CLIENT_ID=" "$ENV_FILE" | cut -d '=' -f2)
CLIENT_SECRET=$(grep "^ZOHO_CLIENT_SECRET=" "$ENV_FILE" | cut -d '=' -f2)
REFRESH_TOKEN=$(grep "^ZOHO_REFRESH_TOKEN=" "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$REFRESH_TOKEN" ]; then
  echo "❌ One or more Zoho credentials missing from .env file."
  echo "   Make sure ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN are set."
  exit 1
fi

echo "✅ Credentials loaded from .env"
echo ""

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
  echo "❌ Failed to get access token."
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token obtained."
echo ""

# Step 2: Update the Account_Name field
echo "✍️  Updating Account_Name to 'API Success' on lead $LEAD_ID ..."

RESPONSE=$(curl -s -X PUT "https://www.zohoapis.com/crm/v3/Commercial_Lead/${LEAD_ID}" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "Account_Name": "API Success"
    }]
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
  echo "✅ Account_Name updated successfully!"
  echo "   Check the record in Zoho CRM to confirm."
else
  echo "❌ Update failed with status: $STATUS"
fi
