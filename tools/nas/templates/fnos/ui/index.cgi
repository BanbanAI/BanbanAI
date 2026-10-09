#!/bin/bash

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
RUNTIME_ENV_FILE="${SCRIPT_DIR}/runtime-config.env"

BANBAN_OPEN_PORT="16666"
BANBAN_OPEN_PROTOCOL="http"
BANBAN_OPEN_BASE_URL=""
BANBAN_OPEN_HOST=""

if [ -f "${RUNTIME_ENV_FILE}" ]; then
  . "${RUNTIME_ENV_FILE}"
fi

normalize_host_name() {
  host_candidate="$1"
  host_candidate="${host_candidate%%,*}"
  host_candidate="${host_candidate%%:*}"
  printf '%s' "${host_candidate}"
}

is_local_host_name() {
  case "$1" in
    ""|localhost|127.0.0.1|::1)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

primary_host_name="$(normalize_host_name "${HTTP_HOST}")"
forwarded_host_name="$(normalize_host_name "${HTTP_X_FORWARDED_HOST}")"
server_host_name="$(normalize_host_name "${SERVER_NAME}")"
configured_host_name="$(normalize_host_name "${BANBAN_OPEN_HOST}")"

host_name="${configured_host_name}"
if is_local_host_name "${host_name}"; then
  host_name="${primary_host_name}"
fi
if is_local_host_name "${host_name}"; then
  if ! is_local_host_name "${forwarded_host_name}"; then
    host_name="${forwarded_host_name}"
  elif ! is_local_host_name "${server_host_name}"; then
    host_name="${server_host_name}"
  fi
fi

if [ -n "${BANBAN_OPEN_BASE_URL}" ]; then
  redirect_url="${BANBAN_OPEN_BASE_URL}"
else
  if is_local_host_name "${host_name}"; then
    host_name="127.0.0.1"
  fi
  redirect_url="${BANBAN_OPEN_PROTOCOL:-http}://${host_name}:${BANBAN_OPEN_PORT:-16666}"
fi

echo "Status: 302 Found"
echo "Location: ${redirect_url}"
echo "Content-Type: text/plain; charset=utf-8"
echo ""
echo "Redirecting to ${redirect_url}"
