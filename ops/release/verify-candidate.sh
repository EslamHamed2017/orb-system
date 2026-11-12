#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"
exec ops/release/freeze-candidate.sh --verify "${1:?manifest path is required}"
