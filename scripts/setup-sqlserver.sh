#!/usr/bin/env bash

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
environment_file="$repo_dir/.env"
schema_file="$repo_dir/backend/database/SDK_Minimal_Schema.sql"

if [[ ! -f "$environment_file" ]]; then
  echo "Missing $environment_file. Copy .env.example to .env and set MSSQL_SA_PASSWORD." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$environment_file"
set +a

: "${MSSQL_SA_PASSWORD:?Set MSSQL_SA_PASSWORD in .env}"
export MSSQL_PORT="${MSSQL_PORT:-1433}"

compose=(docker compose --project-directory "$repo_dir" -f "$repo_dir/compose.yaml")

run_sqlcmd() {
  "${compose[@]}" exec -T \
    -e "SQLCMDPASSWORD=$MSSQL_SA_PASSWORD" \
    sqlserver \
    /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -C -b "$@"
}

"${compose[@]}" up -d sqlserver

for attempt in {1..60}; do
  if run_sqlcmd -Q "SELECT 1" >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" -eq 60 ]]; then
    echo "SQL Server did not become ready. Inspect it with: docker compose -f $repo_dir/compose.yaml logs sqlserver" >&2
    exit 1
  fi

  sleep 2
done

run_sqlcmd -d master -Q \
  "IF DB_ID(N'SdkProductCrud') IS NULL CREATE DATABASE [SdkProductCrud];"
run_sqlcmd -d master -i /dev/stdin < "$schema_file"

echo "SdkProductCrud is initialized on localhost:$MSSQL_PORT."
