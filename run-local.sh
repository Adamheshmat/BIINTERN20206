#!/usr/bin/env bash

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
api_pid=""
web_pid=""

if [[ -z "${ConnectionStrings__DefaultConnection:-}" ]]; then
  if [[ ! -f "$repo_dir/.env" ]]; then
    echo "Missing $repo_dir/.env. Copy .env.example to .env, set MSSQL_SA_PASSWORD, and initialize SQL Server." >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1091
  source "$repo_dir/.env"
  set +a

  : "${MSSQL_SA_PASSWORD:?Set MSSQL_SA_PASSWORD in .env}"
  MSSQL_HOST="${MSSQL_HOST:-localhost}"
  MSSQL_PORT="${MSSQL_PORT:-1433}"
  connection_password="${MSSQL_SA_PASSWORD//\"/\"\"}"
  export ConnectionStrings__DefaultConnection="Server=$MSSQL_HOST,$MSSQL_PORT;Database=SdkProductCrud;User Id=sa;Password=\"$connection_password\";Encrypt=True;TrustServerCertificate=True"
fi

cleanup() {
  trap - EXIT INT TERM

  if [[ -n "$web_pid" ]]; then
    kill "$web_pid" 2>/dev/null || true
  fi

  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
  fi

  wait "$web_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT TERM

dotnet run \
  --project "$repo_dir/backend/SdkProductCrud.Api/SdkProductCrud.Api.csproj" \
  --urls http://localhost:5201 &
api_pid=$!

(
  cd "$repo_dir/frontend"
  npm start -- --host localhost --port 4200 --proxy-config proxy.conf.json
) &
web_pid=$!

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do
  sleep 1
done

status=0

if ! kill -0 "$api_pid" 2>/dev/null; then
  wait "$api_pid" || status=$?
fi

if ! kill -0 "$web_pid" 2>/dev/null; then
  wait "$web_pid" || status=$?
fi

exit "$status"
