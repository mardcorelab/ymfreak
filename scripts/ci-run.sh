#!/usr/bin/env bash
# Runs a CI command and turns its errors into GitHub annotations, so failures
# are readable from the run summary (not only from the raw log). GitHub keeps
# only ~10 annotations per step, so the details are packed into one of them.
set -o pipefail
name="$1"; shift
out="$("$@" 2>&1)"; code=$?
echo "$out"
if [ $code -ne 0 ]; then
  # TypeScript: path(line,col): error TSxxxx: message
  echo "$out" | grep -E "error TS[0-9]+" | head -9 | sed -E 's/^([^(]+)\(([0-9]+),([0-9]+)\): error (TS[0-9]+): (.*)$/::error file=\1,line=\2,col=\3::\4 \5/'
  details="$(echo "$out" | grep -vE "error TS[0-9]+|✓" | grep -iE "error|failed|cannot|not found|invalid|✖|✘|received|expected|locator|waiting for|[a-z]\.ts:[0-9]+|^ *> *[0-9]+ \|" | grep -v "Error Context" | head -60 | sed -E 's/%/%25/g' | awk '{printf "%s%%0A", $0}')"
  [ -n "$details" ] && echo "::error title=$name::$details"
fi
exit $code
