#!/bin/sh

BANBAN_DEFAULT_PORT="16666"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
RUNTIME_ENV_FILE="${SCRIPT_DIR}/runtime-config.env"

BANBAN_OPEN_PORT="${BANBAN_DEFAULT_PORT}"
BANBAN_OPEN_PROTOCOL="http"
BANBAN_OPEN_BASE_URL=""

if [ -f "${RUNTIME_ENV_FILE}" ]; then
  . "${RUNTIME_ENV_FILE}"
fi

host_name="${HTTP_HOST%%:*}"
if [ -z "${host_name}" ]; then
  host_name="${SERVER_NAME:-localhost}"
fi

if [ -n "${BANBAN_OPEN_BASE_URL}" ]; then
  redirect_url="${BANBAN_OPEN_BASE_URL}"
else
  redirect_url="${BANBAN_OPEN_PROTOCOL}://${host_name}:${BANBAN_OPEN_PORT}"
fi

printf 'Status: 302 Found\r\n'
printf 'Location: %s\r\n' "${redirect_url}"
printf 'Cache-Control: no-store\r\n'
printf 'Content-Type: text/plain; charset=UTF-8\r\n'
printf '\r\n'
