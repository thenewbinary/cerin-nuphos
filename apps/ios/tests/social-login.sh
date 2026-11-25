#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
swiftc cerin-ios/Services/CerinWeb.swift tests/SocialLoginTests.swift -o "$test_dir/social-login"
"$test_dir/social-login"
