#!/usr/bin/env python3
"""Apply the Nuphos -> Cerin rename map to the repo (idempotent).

  python3 scripts/rebrand/rebrand.py           # rewrite files in place
  python3 scripts/rebrand/rebrand.py --check   # exit 1 if a rule would change
                                               # anything, or a person-visible
                                               # Nuphos form is left that
                                               # keep.txt does not allow
"""
import fnmatch, json, os, re, subprocess, sys
from collections import Counter

MARKER = 'rebrand:keep'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=HERE).decode().strip()


def load():
    m = json.load(open(os.path.join(HERE, 'map.json')))
    for r in m['rules']:
        r['re'] = re.compile(r['pattern'])
    keep = []
    for line in open(os.path.join(HERE, 'keep.txt')):
        line = line.split(' #', 1)[0].strip() if not line.startswith('#') else ''
        if line:
            glob, _, rx = line.partition(' ')
            keep.append((glob, re.compile(rx.strip() or '.*')))
    return m, keep


def match(path, globs):
    return any(fnmatch.fnmatch(path, g) for g in globs)


def files():
    out = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    for f in filter(None, out):
        p = os.path.join(ROOT, f)
        if os.path.islink(p) or not os.path.isfile(p):
            continue
        try:
            yield f, open(p, encoding='utf-8').read()
        except UnicodeDecodeError:
            continue


def main():
    check = '--check' in sys.argv
    m, keep = load()
    stats, changed, leftovers = Counter(), [], []
    checks = [re.compile(p) for p in m['check_patterns']]
    for f, text in files():
        if match(f, m['exclude_paths']):
            continue
        # A line carrying the marker `rebrand:keep` is never rewritten (a legacy
        # alias next to its Cerin name, for instance).
        lines = text.splitlines(keepends=True) if MARKER in text else [text]
        out = []
        for line in lines:
            if MARKER in line and len(lines) > 1:
                out.append(line)
                continue
            for r in m['rules']:
                if match(f, r.get('exclude_paths', [])):
                    continue
                line, n = r['re'].subn(r['replace'], line)
                stats[r['name']] += n
            out.append(line)
        new = ''.join(out)
        if new != text:
            changed.append(f)
            if not check:
                open(os.path.join(ROOT, f), 'w', encoding='utf-8').write(new)
        for no, line in enumerate(new.splitlines(), 1):
            if MARKER in line:
                continue
            if any(c.search(line) for c in checks) and not any(
                fnmatch.fnmatch(f, g) and rx.search(line) for g, rx in keep
            ):
                leftovers.append(f'{f}:{no}: {line.strip()[:160]}')
    print('rules:', dict(stats), '| files changed:', len(changed))
    if check:
        for f in changed:
            print('would rename:', f)
        for l in leftovers:
            print('not in keep.txt:', l)
        sys.exit(1 if changed or leftovers else 0)
    for l in leftovers:
        print('left (add a rule or a keep.txt line):', l)


main()
