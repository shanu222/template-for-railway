#!/bin/sh
set -e

API_URL="${API_URL:-http://localhost:4000}"
EMAIL="smoke-$(date +%s)@example.com"
PASSWORD="SmokeTest123!"
NAME="Smoke Tester"

echo "Health check..."
curl -fsS "$API_URL/api/health" | grep -q '"status":"ok"'

echo "Register..."
REGISTER=$(curl -fsS -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(printf '%s' "$REGISTER" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"

echo "Protected /me..."
curl -fsS "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN" | grep -q "$EMAIL"

echo "Login..."
curl -fsS -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | grep -q '"accessToken"'

echo "Logout..."
curl -fsS -X POST "$API_URL/api/auth/logout" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | grep -q 'Logged out'

echo "Smoke tests passed."
