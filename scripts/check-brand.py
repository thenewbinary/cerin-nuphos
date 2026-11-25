#!/usr/bin/env python3
"""Fails when the former product name is left anywhere in the repo: in file
contents (any case) or in file and directory names.

The name is assembled below so this file does not contain it. Allowed:
- NOTICE files (Apache 2.0 attribution) and TRADEMARK.md (the upstream
  trademark policy).
- PENDING: forms a stacked Backend PR renames, which deletes them from this list:
  environment variables, X-...-* HTTP headers, the database name and user, and
  the published images, and the key-derivation labels those images share.
"""
import re, subprocess, sys

OLD = 'nu' + 'phos'
ALLOWED_FILES = {'NOTICE', 'apps/runtime/NOTICE', 'TRADEMARK.md'}
PENDING = [
    re.compile(r'(?:(?<=\\[nt])|(?<![A-Za-z0-9]))[A-Z0-9_]*(?:' + OLD.upper() + '_|_' + OLD.upper() + r')[A-Z0-9_]*(?![a-z])'),  # env vars
    re.compile(r'(?i)\bx-' + OLD + r'-[a-z0-9-]+'),  # HTTP headers
    re.compile(r'ghcr\.io/(?:' + OLD + r'|zeabur)\b[A-Za-z0-9_.:/${}-]*'),  # images
    re.compile(r'\bzeabur/' + OLD + r'-(?:runtime|openab-runtime)\b[A-Za-z0-9_.:${}-]*'),  # images
    re.compile(OLD + r'-(?:runtime-control|relay-status)-v1'),  # key-derivation labels the published runtime and relay images share
    re.compile(r"(?<=')" + OLD + r"/runtime(?=')"),  # image path in a test fixture
    re.compile(r'MONGODB_DB:\s*' + OLD + r'\w*'),  # database name
    re.compile(r'(?<=mongodb://)' + OLD + r'(?=:)'),  # database user
    re.compile(r'(?<=:27017/)' + OLD + r'\w*'),  # database name
]
WORD = re.compile('(?i)' + OLD)


def main():
    root = subprocess.check_output(['git', 'rev-parse', '--show-toplevel']).decode().strip()
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
    bad = []
    for f in filter(None, files):
        if WORD.search(f):
            bad.append(f'{f}: file name')
        if f in ALLOWED_FILES:
            continue
        try:
            text = open(f'{root}/{f}', encoding='utf-8').read()
        except (UnicodeDecodeError, IsADirectoryError, FileNotFoundError):
            continue
        if not WORD.search(text):
            continue
        for no, line in enumerate(text.splitlines(), 1):
            spans = [m.span() for p in PENDING for m in p.finditer(line)]
            for m in WORD.finditer(line):
                if not any(a <= m.start() and m.end() <= b for a, b in spans):
                    bad.append(f'{f}:{no}: {line.strip()[:160]}')
                    break
    for b in bad:
        print(b)
    print(f'{len(bad)} occurrence(s) of the former name', file=sys.stderr)
    sys.exit(1 if bad else 0)


main()
