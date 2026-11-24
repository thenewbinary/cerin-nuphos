#!/bin/sh
# Runs install.sh against a fake local release, for zsh and bash users with
# ~/.local/bin off PATH: the profile gains one PATH line however often it runs,
# and a new login shell finds `cerin`, with `nuphos` linked to it.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

case "$(uname -s)" in
  Darwin) os=apple-darwin ;;
  *) os=unknown-linux-musl ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x86_64 ;;
  *) arch=aarch64 ;;
esac
asset=cerin-$arch-$os.tar.gz
mkdir "$work/release"
printf '#!/bin/sh\necho "cerin 0.0.0"\n' >"$work/cerin"
chmod 755 "$work/cerin"
tar -czf "$work/release/$asset" -C "$work" cerin
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$work/release/$asset" >"$work/release/$asset.sha256"
else
  shasum -a 256 "$work/release/$asset" >"$work/release/$asset.sha256"
fi

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# run_install HOME [VAR=VALUE...]: runs install.sh with a PATH lacking ~/.local/bin.
run_install() {
  user_home=$1
  shift
  env -i HOME="$user_home" PATH=/usr/bin:/bin "$@" \
    CERIN_VERSION=0.0.0 CERIN_DOWNLOAD_URL="file://$work/release" \
    sh "$here/install.sh" >/dev/null 2>&1 || fail "install.sh failed with $*"
}

# check SHELL PROFILE [SETUP]: installs twice, then asks a new login shell for cerin and nuphos.
check() {
  sh=$(command -v "$1") || fail "$1 is not installed"
  home=$(mktemp -d "$work/home.XXXXXX")
  if [ -n "${3:-}" ]; then touch "$home/$3"; fi
  run_install "$home" SHELL="$sh"
  run_install "$home" SHELL="$sh"
  n=$(grep -c 'export PATH=' "$home/$2" || true)
  [ "$n" = 1 ] || fail "$1: expected one PATH line in ~/$2, found $n"
  found=$(env -i HOME="$home" PATH=/usr/bin:/bin "$sh" -lc 'command -v cerin') || true
  [ "$found" = "$home/.local/bin/cerin" ] || fail "$1 -l found '$found', not ~/.local/bin/cerin"
  out=$(env -i HOME="$home" PATH=/usr/bin:/bin "$sh" -lc 'nuphos') || true
  [ "$out" = "cerin 0.0.0" ] || fail "$1: nuphos did not run cerin (got '$out')"
  echo "ok: $1 adds one line to ~/$2 and a login shell finds cerin and nuphos"
}

check zsh .zprofile
check bash .profile
check bash .bash_profile .bash_profile

home=$(mktemp -d "$work/home.XXXXXX")
run_install "$home" SHELL="$(command -v zsh)" CERIN_NO_MODIFY_PATH=1
[ ! -e "$home/.zprofile" ] || fail "CERIN_NO_MODIFY_PATH=1 still wrote ~/.zprofile"
echo "ok: CERIN_NO_MODIFY_PATH=1 leaves the profile alone"

home=$(mktemp -d "$work/home.XXXXXX")
run_install "$home" SHELL="$(command -v zsh)" NUPHOS_NO_MODIFY_PATH=1
[ ! -e "$home/.zprofile" ] || fail "NUPHOS_NO_MODIFY_PATH=1 still wrote ~/.zprofile"
echo "ok: NUPHOS_NO_MODIFY_PATH=1 still works"

# An install from before the rename: the old nuphos binary becomes a link to cerin.
home=$(mktemp -d "$work/home.XXXXXX")
mkdir -p "$home/.local/bin"
printf '#!/bin/sh\necho old\n' >"$home/.local/bin/nuphos"
chmod 755 "$home/.local/bin/nuphos"
run_install "$home" SHELL="$(command -v zsh)"
[ "$("$home/.local/bin/nuphos")" = "cerin 0.0.0" ] || fail "an old nuphos binary was not replaced by the link"
echo "ok: an old nuphos install now runs cerin"

# cron, systemd units and bare containers often have no SHELL at all.
home=$(mktemp -d "$work/home.XXXXXX")
run_install "$home"
grep -q 'export PATH=' "$home/.profile" || fail "without SHELL, ~/.profile got no PATH line"
echo "ok: without SHELL, ~/.profile gets the PATH line"
