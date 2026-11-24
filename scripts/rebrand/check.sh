#!/bin/sh
# Fails when person-visible "Nuphos" (the name, nuphos:// links, nuphos.ai
# hosts) shows up outside scripts/rebrand/keep.txt. Fix: run
# `python3 scripts/rebrand/rebrand.py`, or add a reasoned keep.txt line.
exec python3 "$(dirname "$0")/rebrand.py" --check
