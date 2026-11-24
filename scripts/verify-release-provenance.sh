#!/usr/bin/env bash
# Fails unless a commit is on main. This repository has no merge queue, so the
# upstream checks for a GitHub-signed merge_group commit are not made. Every
# release workflow runs this before it builds or reaches a release environment.
#
#   bash scripts/verify-release-provenance.sh <commit>
#
# Needs GH_TOKEN (actions: read), GITHUB_REPOSITORY and a full clone with origin/main.
set -euo pipefail

commit="$(git rev-parse --verify "${1:?usage: verify-release-provenance.sh <commit>}^{commit}")"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"
fail() { echo "::error::Release commit $commit $1"; exit 1; }

git merge-base --is-ancestor "$commit" origin/main || fail "is not on main"

echo "Release commit $commit of $repo is on main"
