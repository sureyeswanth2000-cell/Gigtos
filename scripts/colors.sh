#!/bin/bash
# colors.sh - Terminal color definitions for Gigtos deployment scripts

# Reset
RESET='\033[0m'

# Regular Colors
BLACK='\033[0;30m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[0;37m'

# Bold Colors
BOLD_BLACK='\033[1;30m'
BOLD_RED='\033[1;31m'
BOLD_GREEN='\033[1;32m'
BOLD_YELLOW='\033[1;33m'
BOLD_BLUE='\033[1;34m'
BOLD_PURPLE='\033[1;35m'
BOLD_CYAN='\033[1;36m'
BOLD_WHITE='\033[1;37m'

# Underline
UNDERLINE='\033[4m'
BOLD='\033[1m'

# Status Icons
ICON_CHECK="✓"
ICON_CROSS="✗"
ICON_WARN="⚠"
ICON_INFO="ℹ"
ICON_ARROW="→"
ICON_ROCKET="🚀"
ICON_FIRE="🔥"
ICON_CHECK_MARK="✅"
ICON_CROSS_MARK="❌"
ICON_WARNING="⚠️"

# Helper print functions
print_success() {
    echo -e "${GREEN}${ICON_CHECK}${RESET} $1"
}

print_error() {
    echo -e "${RED}${ICON_CROSS}${RESET} $1"
}

print_warning() {
    echo -e "${YELLOW}${ICON_WARN}${RESET} $1"
}

print_info() {
    echo -e "${CYAN}${ICON_INFO}${RESET} $1"
}

print_section() {
    echo ""
    echo -e "${BOLD_BLUE}═══════════════════════════════════════════════════════════════${RESET}"
    echo -e "${BOLD_WHITE}  $1${RESET}"
    echo -e "${BOLD_BLUE}═══════════════════════════════════════════════════════════════${RESET}"
}

print_subsection() {
    echo ""
    echo -e "${BOLD_CYAN}  ── $1 ──${RESET}"
}

print_step() {
    echo -e "${BLUE}${ICON_ARROW}${RESET} $1"
}

print_result() {
    local status=$1
    local message=$2
    if [ "$status" = "pass" ]; then
        echo -e "   ${GREEN}${ICON_CHECK_MARK}${RESET} $message"
    elif [ "$status" = "fail" ]; then
        echo -e "   ${RED}${ICON_CROSS_MARK}${RESET} $message"
    else
        echo -e "   ${YELLOW}${ICON_WARNING}${RESET} $message"
    fi
}
