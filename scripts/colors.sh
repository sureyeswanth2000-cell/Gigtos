#!/usr/bin/env bash
# scripts/colors.sh
# Terminal color constants, status symbols, and formatting helpers.
# Source this file in other scripts: source "$(dirname "$0")/colors.sh"

# ── Color codes ───────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'   # No Color / Reset

# ── Status symbols ────────────────────────────────────────────────────────────
SYM_OK="✓"
SYM_FAIL="✗"
SYM_WARN="⚠"
SYM_INFO="ℹ"
SYM_SPIN="🔄"
SYM_CHECK="✅"
SYM_CROSS="❌"
SYM_ARROW="→"
SYM_BULLET="•"

# ── Divider helpers ───────────────────────────────────────────────────────────
DIVIDER="═══════════════════════════════════════════════════════════════"
THIN_DIV="───────────────────────────────────────────────────────────────"

print_divider() {
  echo -e "${BLUE}${DIVIDER}${NC}"
}

print_thin_divider() {
  echo -e "${DIM}${THIN_DIV}${NC}"
}

print_section() {
  local title="$1"
  echo ""
  echo -e "${BLUE}${DIVIDER}${NC}"
  echo -e "${BOLD}${WHITE}  ${title}${NC}"
  echo -e "${BLUE}${DIVIDER}${NC}"
}

print_header() {
  local title="$1"
  local subtitle="${2:-}"
  clear_line
  echo ""
  print_divider
  echo -e "${BOLD}${WHITE}  ${title}${NC}"
  [[ -n "$subtitle" ]] && echo -e "${DIM}  ${subtitle}${NC}"
  print_divider
  echo ""
}

# ── Colored output helpers ────────────────────────────────────────────────────
print_ok()   { echo -e "   ${GREEN}${SYM_OK}${NC} $*"; }
print_fail() { echo -e "   ${RED}${SYM_FAIL}${NC} $*"; }
print_warn() { echo -e "   ${YELLOW}${SYM_WARN}${NC} $*"; }
print_info() { echo -e "   ${CYAN}${SYM_INFO}${NC} $*"; }

print_check_header() { echo -e "\n${GREEN}${SYM_CHECK} ${BOLD}$*${NC}"; }
print_fail_header()  { echo -e "\n${RED}${SYM_CROSS} ${BOLD}$*${NC}"; }
print_warn_header()  { echo -e "\n${YELLOW}${SYM_WARN}  ${BOLD}$*${NC}"; }

clear_line() {
  printf '\r\033[K'
}

# ── Spinner ───────────────────────────────────────────────────────────────────
# Usage: spinner $! "Loading message..."
spinner() {
  local pid="$1"
  local msg="${2:-Working...}"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  tput civis 2>/dev/null || true   # hide cursor
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r   ${CYAN}%s${NC} %s" "${frames[$((i % ${#frames[@]}))]}" "$msg"
    sleep 0.1
    i=$((i + 1))
  done
  tput cnorm 2>/dev/null || true   # restore cursor
  printf '\r\033[K'
}
