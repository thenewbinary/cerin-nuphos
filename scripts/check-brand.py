#!/usr/bin/env python3
"""Fails when the former product name is left anywhere in the repo: in file
contents (any case) or in file and directory names.

The name is assembled below so this file does not contain it. The only files
allowed to contain it are the NOTICE files (Apache 2.0 attribution). Binary
files are checked too.
"""
import re, subprocess, sys

OLD = 'nu' + 'phos'
ALLOWED_FILES = {'NOTICE', 'apps/runtime/NOTICE'}
WORD = re.compile('(?i)' + OLD)
WORD_BYTES = re.compile(('(?i)' + OLD).encode())


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
            data = open(f'{root}/{f}', 'rb').read()
        except (IsADirectoryError, FileNotFoundError):
            continue
        if not WORD_BYTES.search(data):
            continue
        try:
            text = data.decode('utf-8')
        except UnicodeDecodeError:
            bad.append(f'{f}: binary content')
            continue
        for no, line in enumerate(text.splitlines(), 1):
            if WORD.search(line):
                bad.append(f'{f}:{no}: {line.strip()[:160]}')
    for b in bad:
        print(b)
    print(f'{len(bad)} occurrence(s) of the former name', file=sys.stderr)
    sys.exit(1 if bad else 0)


main()
