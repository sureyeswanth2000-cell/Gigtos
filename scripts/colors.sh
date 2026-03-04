#!/usr/bin/env bash
# =============================================================================
# colors.sh — Terminal output formatting for Gigtos CI/CD scripts
# =============================================================================
# Provides color codes, status symbols, progress indicators,
# header/separator formatting, and status badges.
# =============================================================================

# ── Color codes ───────────────────────────────────────────────────────────────
# Detect whether the terminal supports colors; fall back to empty strings
if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null)" -ge 8 ] 2>/dev/null; then
  COLOR_RESET="\033[0m"
  COLOR_RED="\033[0;31m"
  COLOR_GREEN="\033[0;32m"
  COLOR_YELLOW="\033[0;33m"
  COLOR_BLUE="\033[0;34m"
  COLOR_MAGENTA="\033[0;35m"
  COLOR_CYAN="\033[0;36m"
  COLOR_WHITE="\033[1;37m"
  COLOR_BOLD="\033[1m"
  COLOR_DIM="\033[2m"
else
  COLOR_RESET=""
  COLOR_RED=""
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_BLUE=""
  COLOR_MAGENTA=""
  COLOR_CYAN=""
  COLOR_WHITE=""
  COLOR_BOLD=""
  COLOR_DIM=""
fi

# ── Status symbols ────────────────────────────────────────────────────────────
SYMBOL_OK="${COLOR_GREEN}✓${COLOR_RESET}"
SYMBOL_FAIL="${COLOR_RED}✗${COLOR_RESET}"
SYMBOL_WARN="${COLOR_YELLOW}⚠${COLOR_RESET}"
SYMBOL_INFO="${COLOR_BLUE}ℹ${COLOR_RESET}"
SYMBOL_ARROW="${COLOR_CYAN}➜${COLOR_RESET}"
SYMBOL_BULLET="${COLOR_WHITE}•${COLOR_RESET}"

# ── Badge helpers ─────────────────────────────────────────────────────────────
badge_pass()    { printf "${COLOR_GREEN}[PASS]${COLOR_RESET}"; }
badge_fail()    { printf "${COLOR_RED}[FAIL]${COLOR_RESET}"; }
badge_warn()    { printf "${COLOR_YELLOW}[WARN]${COLOR_RESET}"; }
badge_info()    { printf "${COLOR_BLUE}[INFO]${COLOR_RESET}"; }
badge_running() { printf "${COLOR_CYAN}[RUNNING]${COLOR_RESET}"; }
badge_skip()    { printf "${COLOR_DIM}[SKIP]${COLOR_RESET}"; }

# ── Header / separator formatting ─────────────────────────────────────────────
SEPARATOR_CHAR="═"
SEPARATOR_LENGTH=65

print_separator() {
  printf "${COLOR_DIM}"
  printf '%0.s'"${SEPARATOR_CHAR}" $(seq 1 "${SEPARATOR_LENGTH}")
  printf "${COLOR_RESET}\n"
}

print_header() {
  local title="$1"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  print_separator
  printf "  ${COLOR_BOLD}${COLOR_WHITE}%-40s${COLOR_RESET}  ${COLOR_DIM}%s${COLOR_RESET}\n" \
    "${title}" "${timestamp}"
  print_separator
  echo ""
}

print_section() {
  local section="$1"
  echo ""
  printf "${COLOR_BOLD}${COLOR_CYAN}%s${COLOR_RESET}\n" "${section}"
}

print_subsection() {
  local label="$1"
  printf "   ${COLOR_BOLD}%s${COLOR_RESET}\n" "${label}"
}

# ── Progress indicator (spinner) ──────────────────────────────────────────────
# Usage:
#   start_spinner "Doing something…"
#   … do work …
#   stop_spinner 0   # 0 = success, non-zero = failure
_SPINNER_PID=""
_SPINNER_MSG=""

start_spinner() {
  _SPINNER_MSG="${1:-Working…}"
  local frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0
  (
    while true; do
      local frame="${frames:$((i % ${#frames})):1}"
      printf "\r   ${COLOR_CYAN}%s${COLOR_RESET} %s   " "${frame}" "${_SPINNER_MSG}"
      sleep 0.12
      i=$((i + 1))
    done
  ) &
  _SPINNER_PID=$!
  disown "${_SPINNER_PID}" 2>/dev/null || true
}

stop_spinner() {
  local exit_code="${1:-0}"
  if [ -n "${_SPINNER_PID}" ]; then
    kill "${_SPINNER_PID}" 2>/dev/null || true
    wait "${_SPINNER_PID}" 2>/dev/null || true
    _SPINNER_PID=""
  fi
  printf "\r%${SEPARATOR_LENGTH}s\r" ""  # clear line
  if [ "${exit_code}" -eq 0 ]; then
    printf "   ${SYMBOL_OK} %s\n" "${_SPINNER_MSG}"
  else
    printf "   ${SYMBOL_FAIL} %s\n" "${_SPINNER_MSG}"
  fi
}
