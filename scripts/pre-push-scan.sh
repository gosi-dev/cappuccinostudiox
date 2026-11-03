#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pre-push secret scan.  Exits non-zero to block the push.
#
# Why this exists: on the first attempt to publish this repo, a scan for
# token-shaped strings (sk-…, ghp_…, AKIA…, JWTs, private keys) came back clean
# while a burned admin password sat in SECURITY_REPORT.md as a quoted example.
# An arbitrary word matches none of those patterns.  So the scan now ALSO greps
# for known-burnt literals by value.
#
# Those literals are deliberately NOT in this file — committing them here would
# re-publish exactly what we are trying to erase.  They live in
#   .git/burnt-literals.txt
# one per line (blank lines and #comments ignored), local-only and never tracked.
#
# Install:  ln -sf ../../scripts/pre-push-scan.sh .git/hooks/pre-push
#           (on Windows this repo is not used; hooks are local-only by design)
# Bypass:   git push --no-verify   ← only when you have read what it flagged
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

fail=0

# Search every file we would be able to publish — never .git (that is where the
# local literal list lives), never deps, never local CLI state.
scan_files() { # $1 = grep pattern, $2 = extra flags ("-F" for literals, "" for ERE)
    find . -type f \
        -not -path './.git/*' -not -path './node_modules/*' -not -path './.netlify/*' \
        -print0 2>/dev/null \
    | xargs -0 grep -lI ${2:-} -e "$1" 2>/dev/null
}

# ── 1. Known-burnt literals, straight out of the local list ───────────────────
list="$(git rev-parse --git-dir)/burnt-literals.txt"
if [ -f "$list" ]; then
    while IFS= read -r lit; do
        [ -z "$lit" ] && continue
        case "$lit" in \#*) continue ;; esac
        hits=$(scan_files "$lit" -Fa)
        if [ -n "$hits" ]; then
            echo "BLOCKED — burnt literal still present in:"
            echo "$hits" | sed 's/^/    /'
            fail=1
        fi
    done < "$list"
else
    echo "note: no .git/burnt-literals.txt — value scan skipped (pattern scan still runs)"
fi

# ── 2. Credential shapes ──────────────────────────────────────────────────────
# Written with repetition counts so this file does not match its own pattern.
PAT='sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}'
PAT+='|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}'
PAT+='|eyJhbGciOi[A-Za-z0-9_-]{10,}|BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY'
PAT+='|xox[baprs]-[A-Za-z0-9-]{10,}|-{5}BEGIN CERTIFICATE-{5}'
hits=$(scan_files "$PAT" -E)
if [ -n "$hits" ]; then
    echo "BLOCKED — credential-shaped string found:"
    echo "$hits" | head -20 | sed 's/^/    /'
    fail=1
fi

# ── 3. Files that must never be tracked ───────────────────────────────────────
bad=$(git ls-files 2>/dev/null | grep -E '(^|/)(\.env($|\.)|[^/]*\.(pem|key|p12|pfx)|secrets\.json)$' \
      | grep -v '\.env\.example' || true)
if [ -n "$bad" ]; then
    echo "BLOCKED — secret-bearing files are staged/tracked:"
    echo "$bad" | sed 's/^/    /'
    fail=1
fi

# ── 4. Runtime data with customer PII must stay out (see .gitignore) ──────────
pii=$(git ls-files 2>/dev/null | grep -E '^src/data/(bookings|waitlist)\.json$' || true)
if [ -n "$pii" ]; then
    echo "BLOCKED — customer data is tracked:"
    echo "$pii" | sed 's/^/    /'
    fail=1
fi

if [ "$fail" -ne 0 ]; then
    echo
    echo "Push blocked. Fix the above, or bypass with: git push --no-verify"
    exit 1
fi
echo "pre-push scan: clean"
