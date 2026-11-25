#!/usr/bin/env bash
# Fails if any non-merge commit in the range lacks a DCO sign-off that matches
# its author exactly, except upstream commits rewritten by the sync automation.
# See DCO and CONTRIBUTING.md.
#
#   scripts/check-dco.sh <base-rev> <head-rev>
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <base-rev> <head-rev>" >&2
  exit 2
fi

# Dependabot authors with its noreply address but signs off with this one.
dependabot="dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>"
dependabot_signoff="dependabot[bot] <support@github.com>"

# Listed before the loop so a bad revision fails the check instead of
# checking nothing.
commits="$(git rev-list --no-merges "$1..$2")"

head_ref="${DCO_HEAD_REF:-${GITHUB_HEAD_REF:-}}"
sync_committer="thenewbinary <isaac.efik@gmail.com>"

status=0
checked=0
skipped=0
for sha in $commits; do
  author_name="$(git log -1 --format='%an' "$sha")"
  author_email="$(git log -1 --format='%ae' "$sha")"
  author="$author_name <$author_email>"
  if ! committer="$(git log -1 --format='%cn <%ce>' "$sha")"; then
    committer=
  fi

  if [[ "$head_ref" == sync/upstream-* &&
    "$author_name" != "thenewbinary" &&
    "$author_email" != "isaac.efik@gmail.com" &&
    "$committer" == "$sync_committer" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  checked=$((checked + 1))
  signoff="$author"
  if [[ "$author" == "$dependabot" ]]; then
    signoff="$dependabot_signoff"
  fi
  if ! git log -1 --format='%B' "$sha" | grep -qxF "Signed-off-by: $signoff"; then
    echo "error: $(git log -1 --format='%h %s' "$sha")" >&2
    echo "       is missing 'Signed-off-by: $signoff' (see CONTRIBUTING.md)" >&2
    status=1
  fi
done

if [[ $status -eq 0 ]]; then
  echo "All $checked commit(s) carry a sign-off matching their author."
  if [[ $skipped -gt 0 ]]; then
    echo "Skipped $skipped commit(s) from upstream authors on $head_ref."
  fi
fi
exit $status
