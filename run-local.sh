#!/usr/bin/env bash

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
api_pid=""
web_pid=""

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
