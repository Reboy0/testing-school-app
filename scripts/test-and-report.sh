#!/usr/bin/env bash
# Runs every test suite the way CI does, writes one JUnit report per suite to
# reports/, then posts each report to OpenCards (POST /api/ci/junit — the
# request the CI reporter makes, done with curl).
#
# Needs OPENCARDS_TOKEN in .env at the repository root (gitignored). The token
# is read from that file and handed to curl on stdin — never printed and
# never on a command line. Needs the API on :4000, the web app on :3000,
# Postgres and Maildev up, as for `pnpm test`. NO_SEND=1 writes the reports
# and stops there.
set -uo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
mkdir -p reports

export JEST_JUNIT_CLASSNAME="{classname}" JEST_JUNIT_TITLE="{title}" JEST_JUNIT_ADD_FILE_ATTRIBUTE=true
: "${PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:=ubuntu24.04-x64}"
export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE

JEST_JUNIT_OUTPUT_FILE="$root/reports/shared-unit.xml" pnpm --filter @school/shared exec jest --ci --reporters=default --reporters=jest-junit
JEST_JUNIT_OUTPUT_FILE="$root/reports/api-unit.xml" pnpm --filter @school/api exec jest --ci --reporters=default --reporters=jest-junit
JEST_JUNIT_OUTPUT_FILE="$root/reports/api-integration.xml" pnpm --filter @school/api exec jest --config test/jest-e2e.json --runInBand --ci --reporters=default --reporters=jest-junit
pnpm --filter @school/web exec vitest run --reporter=default --reporter=junit "--outputFile.junit=$root/reports/web-component.xml"
PLAYWRIGHT_JUNIT_OUTPUT_FILE="$root/reports/e2e.xml" pnpm --filter @school/e2e exec playwright test

if [ -n "${NO_SEND:-}" ]; then echo "NO_SEND is set — reports are in reports/, not sent"; exit 0; fi

token="$(grep -E '^OPENCARDS_TOKEN=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d "\"' \r")"
if [ -z "$token" ]; then echo "OPENCARDS_TOKEN is not set in $root/.env — reports are in reports/, not sent"; exit 0; fi

base="${OPENCARDS_URL:-https://yurii-org.opencards.dev}"
build="local-$(date +%Y%m%d%H%M%S)"
branch="$(git rev-parse --abbrev-ref HEAD)"
commit="$(git rev-parse HEAD)"

for suite in shared-unit api-unit api-integration web-component e2e; do
  query="productId=school-app&suite=$suite&buildId=$build&branch=$(printf %s "$branch" | sed 's|/|%2F|g')&commit=$commit"
  printf 'Authorization: Bearer %s\n' "$token" |
    curl -sS -X POST "$base/api/ci/junit?$query" -H @- -H 'Content-Type: application/xml' \
      --data-binary "@reports/$suite.xml" -o /dev/null -w "opencards $suite: HTTP %{http_code}\n"
done
unset token
