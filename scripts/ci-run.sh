#!/usr/bin/env bash
# Runs a CI command and turns its errors into GitHub annotations, so failures
# are readable from the run summary (not only from the raw log).
set -o pipefail
name="$1"; shift
out="$("$@" 2>&1)"; code=$?
echo "$out"
if [ $code -ne 0 ]; then
  # TypeScript: path(line,col): error TSxxxx: message
  echo "$out" | grep -E "error TS[0-9]+" | head -40 | sed -E 's/^([^(]+)\(([0-9]+),([0-9]+)\): error (TS[0-9]+): (.*)$/::error file=\1,line=\2,col=\3::\4 \5/'
  # ESLint / Next / Prisma / generic: last meaningful lines
  echo "$out" | grep -vE "error TS[0-9]+" | grep -iE "error|failed|cannot|not found|invalid|✖|received|expected" | head -25 | sed -E 's/^/::error title='"$name"'::/'
fi
exit $code
