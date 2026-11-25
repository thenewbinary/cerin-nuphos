#!/usr/bin/env bash
set -euo pipefail

checker="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-dco.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

tests=0
repo=
base=
head=
output=
result=

new_repo() {
  repo="$test_root/$1"
  git init -q -b main "$repo"
  git -C "$repo" config user.name "Test Committer"
  git -C "$repo" config user.email "committer@example.com"
  git -C "$repo" config commit.gpgsign false
  base="$(make_commit "base" "thenewbinary" "isaac.efik@gmail.com" \
    "Test Committer" "committer@example.com" "base.txt" \
    "Signed-off-by: thenewbinary <isaac.efik@gmail.com>")"
}

make_commit() {
  local subject="$1"
  local author_name="$2"
  local author_email="$3"
  local committer_name="$4"
  local committer_email="$5"
  local file="$6"
  local signoff="${7:-}"

  printf '%s\n' "$subject" > "$repo/$file"
  git -C "$repo" add "$file"
  if [[ -n "$signoff" ]]; then
    GIT_AUTHOR_NAME="$author_name" GIT_AUTHOR_EMAIL="$author_email" \
      GIT_COMMITTER_NAME="$committer_name" GIT_COMMITTER_EMAIL="$committer_email" \
      git -C "$repo" commit -q -m "$subject" -m "$signoff"
  else
    GIT_AUTHOR_NAME="$author_name" GIT_AUTHOR_EMAIL="$author_email" \
      GIT_COMMITTER_NAME="$committer_name" GIT_COMMITTER_EMAIL="$committer_email" \
      git -C "$repo" commit -q -m "$subject"
  fi
  git -C "$repo" rev-parse HEAD
}

run_checker() {
  set +e
  output="$(cd "$repo" && env -u DCO_HEAD_REF -u GITHUB_HEAD_REF "$@" \
    bash "$checker" "$base" "$head" 2>&1)"
  result=$?
  set -e
}

assert_status() {
  if [[ "$result" -ne "$1" ]]; then
    printf 'expected exit %s, got %s\noutput:\n%s\n' "$1" "$result" "$output" >&2
    exit 1
  fi
}

assert_contains() {
  if [[ "$output" != *"$1"* ]]; then
    printf 'expected output to contain: %s\noutput:\n%s\n' "$1" "$output" >&2
    exit 1
  fi
}

pass() {
  tests=$((tests + 1))
  printf 'ok %s - %s\n' "$tests" "$1"
}

test_sync_commit_is_skipped() {
  new_repo "sync-skip"
  head="$(make_commit "unsigned upstream sync" "Yuanlin Lin" "yuanlin@zeabur.com" \
    "thenewbinary" "isaac.efik@gmail.com" "upstream.txt")"

  run_checker DCO_HEAD_REF=sync/upstream-main

  assert_status 0
  assert_contains "All 0 commit(s) carry a sign-off matching their author."
  assert_contains "Skipped 1 commit(s) from upstream authors on sync/upstream-main."
  pass "an unsigned upstream commit rewritten by sync automation is skipped"
}

test_non_sync_branch_checks_same_commit() {
  new_repo "non-sync-branch"
  head="$(make_commit "unsigned upstream sync" "Yuanlin Lin" "yuanlin@zeabur.com" \
    "thenewbinary" "isaac.efik@gmail.com" "upstream.txt")"

  run_checker DCO_HEAD_REF=fix/dco-check

  assert_status 1
  assert_contains "unsigned upstream sync"
  assert_contains "Signed-off-by: Yuanlin Lin <yuanlin@zeabur.com>"
  pass "a non-sync branch does not skip the same commit"
}

test_cerin_author_name_is_checked() {
  new_repo "cerin-author-name"
  head="$(make_commit "Cerin author with mismatched sign-off" "thenewbinary" \
    "yuanlin@zeabur.com" "thenewbinary" "isaac.efik@gmail.com" "cerin-name.txt" \
    "Signed-off-by: Yuanlin Lin <yuanlin@zeabur.com>")"

  run_checker DCO_HEAD_REF=sync/upstream-main

  assert_status 1
  assert_contains "Cerin author with mismatched sign-off"
  assert_contains "Signed-off-by: thenewbinary <yuanlin@zeabur.com>"
  pass "the Cerin author name alone prevents the sync skip"
}

test_cerin_author_email_is_checked() {
  new_repo "cerin-author-email"
  head="$(make_commit "Cerin email with mismatched sign-off" "Yuanlin Lin" \
    "isaac.efik@gmail.com" "thenewbinary" "isaac.efik@gmail.com" "cerin-email.txt" \
    "Signed-off-by: Yuanlin Lin <yuanlin@zeabur.com>")"

  run_checker DCO_HEAD_REF=sync/upstream-main

  assert_status 1
  assert_contains "Cerin email with mismatched sign-off"
  assert_contains "Signed-off-by: Yuanlin Lin <isaac.efik@gmail.com>"
  pass "the Cerin author email alone prevents the sync skip"
}

test_other_committer_is_checked() {
  new_repo "other-committer"
  head="$(make_commit "upstream commit with mismatched sign-off" "Yuanlin Lin" \
    "yuanlin@zeabur.com" "thenewbinary" "other@example.com" "upstream.txt" \
    "Signed-off-by: thenewbinary <isaac.efik@gmail.com>")"

  run_checker DCO_HEAD_REF=sync/upstream-main

  assert_status 1
  assert_contains "upstream commit with mismatched sign-off"
  assert_contains "Signed-off-by: Yuanlin Lin <yuanlin@zeabur.com>"
  pass "a committer other than the exact sync identity prevents the skip"
}

test_missing_head_ref_checks_every_commit() {
  new_repo "missing-head-ref"
  head="$(make_commit "unsigned upstream sync" "Yuanlin Lin" "yuanlin@zeabur.com" \
    "thenewbinary" "isaac.efik@gmail.com" "upstream.txt")"

  run_checker

  assert_status 1
  assert_contains "unsigned upstream sync"
  assert_contains "Signed-off-by: Yuanlin Lin <yuanlin@zeabur.com>"
  pass "an unknown head branch fails closed and checks every commit"
}

test_github_head_ref_is_honored() {
  new_repo "github-head-ref"
  head="$(make_commit "unsigned upstream sync" "Yuanlin Lin" "yuanlin@zeabur.com" \
    "thenewbinary" "isaac.efik@gmail.com" "upstream.txt")"

  run_checker GITHUB_HEAD_REF=sync/upstream-main

  assert_status 0
  assert_contains "Skipped 1 commit(s) from upstream authors on sync/upstream-main."
  pass "GITHUB_HEAD_REF identifies a sync branch when DCO_HEAD_REF is unset"
}

test_dependabot_exception_is_preserved() {
  new_repo "dependabot"
  head="$(make_commit "dependabot update" "dependabot[bot]" \
    "49699333+dependabot[bot]@users.noreply.github.com" "Test Committer" \
    "committer@example.com" "dependabot.txt" \
    "Signed-off-by: dependabot[bot] <support@github.com>")"

  run_checker

  assert_status 0
  assert_contains "All 1 commit(s) carry a sign-off matching their author."
  pass "Dependabot's existing sign-off exception still passes"
}

test_sync_commit_is_skipped
test_non_sync_branch_checks_same_commit
test_cerin_author_name_is_checked
test_cerin_author_email_is_checked
test_other_committer_is_checked
test_missing_head_ref_checks_every_commit
test_github_head_ref_is_honored
test_dependabot_exception_is_preserved
printf 'All %s DCO checker tests passed.\n' "$tests"
