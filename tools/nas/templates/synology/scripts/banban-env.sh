#!/bin/sh

BANBAN_DEFAULT_PORT="16666"

resolve_package_root() {
  echo "${SYNOPKG_PKGDEST:-$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)}"
}

resolve_runtime_dir() {
  echo "$(resolve_package_root)/var"
}

resolve_config_file() {
  echo "$(resolve_package_root)/config.json"
}

resolve_ui_runtime_env_file() {
  echo "$(resolve_package_root)/ui/runtime-config.env"
}

resolve_protocol_from_base_url() {
  protocol_from_url="$(trim_value "$1")"
  case "${protocol_from_url}" in
    https://*)
      printf '%s' "https"
      ;;
    *)
      printf '%s' "http"
      ;;
  esac
}

normalize_protocol() {
  case "$(trim_value "$1")" in
    https)
      printf '%s' "https"
      ;;
    *)
      printf '%s' "http"
      ;;
  esac
}

trim_value() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

normalize_port() {
  raw_port="$(trim_value "$1")"
  if [ -z "${raw_port}" ]; then
    printf '%s' "${BANBAN_DEFAULT_PORT}"
    return 0
  fi
  case "${raw_port}" in
    *[!0-9]*)
      return 1
      ;;
  esac
  if [ "${raw_port}" -lt 1 ] || [ "${raw_port}" -gt 65535 ]; then
    return 1
  fi
  printf '%s' "${raw_port}"
}

normalize_base_url() {
  raw_url="$(trim_value "$1")"
  if [ -z "${raw_url}" ]; then
    printf '%s' ""
    return 0
  fi
  case "${raw_url}" in
    http://*|https://*)
      printf '%s' "${raw_url%/}"
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_port_available() {
  target_port="$1"
  if command -v netstat >/dev/null 2>&1; then
    if netstat -tnl 2>/dev/null | grep -E "[:.]${target_port}[[:space:]]" >/dev/null 2>&1; then
      return 1
    fi
  elif command -v ss >/dev/null 2>&1; then
    if ss -tnl 2>/dev/null | grep -E "[:.]${target_port}[[:space:]]" >/dev/null 2>&1; then
      return 1
    fi
  fi
  return 0
}

resolve_available_port() {
  candidate_port="$1"
  while [ "${candidate_port}" -le 65535 ]; do
    if is_port_available "${candidate_port}"; then
      printf '%s' "${candidate_port}"
      return 0
    fi
    candidate_port=$((candidate_port + 1))
  done
  return 1
}

load_existing_runtime_values() {
  EXISTING_PORT=""
  EXISTING_PROTOCOL=""
  EXISTING_BASE_URL=""

  config_file="$(resolve_config_file)"
  if [ -f "${config_file}" ]; then
    EXISTING_PORT="$(sed -n '/"listen"[[:space:]]*:/ { s/.*"listen"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p; q; }' "${config_file}")"
    EXISTING_BASE_URL="$(sed -n '/"baseURL"[[:space:]]*:/ { s/.*"baseURL"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p; q; }' "${config_file}")"
  fi

  ui_runtime_env_file="$(resolve_ui_runtime_env_file)"
  if [ -f "${ui_runtime_env_file}" ]; then
    BANBAN_OPEN_PORT=""
    BANBAN_OPEN_PROTOCOL=""
    BANBAN_OPEN_BASE_URL=""
    . "${ui_runtime_env_file}"
    if [ -z "${EXISTING_PORT}" ]; then
      EXISTING_PORT="${BANBAN_OPEN_PORT:-}"
    fi
    if [ -z "${EXISTING_PROTOCOL}" ]; then
      EXISTING_PROTOCOL="${BANBAN_OPEN_PROTOCOL:-}"
    fi
    if [ -z "${EXISTING_BASE_URL}" ]; then
      EXISTING_BASE_URL="${BANBAN_OPEN_BASE_URL:-}"
    fi
  fi

  if [ -z "${EXISTING_PROTOCOL}" ]; then
    EXISTING_PROTOCOL="$(resolve_protocol_from_base_url "${EXISTING_BASE_URL}")"
  fi
}

load_wizard_values() {
  load_existing_runtime_values

  requested_port="$(normalize_port "${pkgwizard_service_port:-${EXISTING_PORT:-${BANBAN_DEFAULT_PORT}}}")" || return 1
  BANBAN_WIZARD_PORT="$(resolve_available_port "${requested_port}")" || return 1
  BANBAN_WIZARD_BASE_URL="$(normalize_base_url "${pkgwizard_external_url:-${EXISTING_BASE_URL:-}}")" || return 1
  if [ -n "${BANBAN_WIZARD_BASE_URL}" ]; then
    BANBAN_WIZARD_PROTOCOL="$(resolve_protocol_from_base_url "${BANBAN_WIZARD_BASE_URL}")"
  else
    BANBAN_WIZARD_PROTOCOL="$(normalize_protocol "${EXISTING_PROTOCOL:-http}")"
  fi
  return 0
}

sync_package_info_port() {
  service_port="$1"
  package_root="$(resolve_package_root)"
  package_meta_dir="$(dirname "${package_root}")"
  info_file="${package_meta_dir}/INFO"
  if [ ! -f "${info_file}" ]; then
    return 0
  fi

  temp_info_file="${info_file}.tmp"
  : > "${temp_info_file}"
  while IFS= read -r line || [ -n "${line}" ]; do
    case "${line}" in
      adminport=*)
        printf 'adminport="%s"\n' "${service_port}" >> "${temp_info_file}"
        ;;
      *)
        printf '%s\n' "${line}" >> "${temp_info_file}"
        ;;
    esac
  done < "${info_file}"
  mv "${temp_info_file}" "${info_file}"
}

write_ui_runtime_env_file() {
  ui_runtime_env_file="$1"
  escaped_base_url="$(printf '%s' "${BANBAN_WIZARD_BASE_URL}" | sed "s/'/'\\\\''/g")"

  if [ -d "$(dirname "${ui_runtime_env_file}")" ]; then
    cat > "${ui_runtime_env_file}" <<EOF
BANBAN_OPEN_PORT='${BANBAN_WIZARD_PORT}'
BANBAN_OPEN_PROTOCOL='${BANBAN_WIZARD_PROTOCOL}'
BANBAN_OPEN_BASE_URL='${escaped_base_url}'
EOF
    if [ -f "$(dirname "${ui_runtime_env_file}")/open.cgi" ]; then
      chmod 755 "$(dirname "${ui_runtime_env_file}")/open.cgi"
    fi
  fi
}

write_runtime_env() {
  load_wizard_values || return 1

  config_file="$(resolve_config_file)"
  ui_runtime_env_file="$(resolve_ui_runtime_env_file)"
  escaped_base_url="$(printf '%s' "${BANBAN_WIZARD_BASE_URL}" | sed 's/\\/\\\\/g;s/"/\\"/g')"

  if [ -n "${BANBAN_WIZARD_BASE_URL}" ]; then
    cat > "${config_file}" <<EOF
{
  "listen": ${BANBAN_WIZARD_PORT},
  "baseURL": "${escaped_base_url}"
}
EOF
  else
    cat > "${config_file}" <<EOF
{
  "listen": ${BANBAN_WIZARD_PORT}
}
EOF
  fi

  write_ui_runtime_env_file "${ui_runtime_env_file}"
  sync_package_info_port "${BANBAN_WIZARD_PORT}"
  return 0
}
