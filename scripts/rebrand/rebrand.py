#!/usr/bin/env python3
"""Apply the Nuphos -> Cerin rename map to the repo (idempotent).

  python3 scripts/rebrand/rebrand.py           # rewrite files in place
  python3 scripts/rebrand/rebrand.py --check   # exit 1 if a rule would change
                                               # anything, or a person-visible
                                               # Nuphos form is left that
                                               # keep.txt does not allow

Two kinds of leftover are checked: `check_patterns` on every line, and
`visible_text.pattern` (any case) on text people read: docs and translation
files whole, and in code only sentence-like string literals outside comments.
Each match must sit inside a keep.txt match on the same line.
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
    v = m['visible_text']
    v['re'] = re.compile(v['pattern'])
    return m, keep


# A quoted literal with whitespace in it: a sentence, label or shell command.
SENTENCE = re.compile(r"""(['"`])((?:(?!\1).)*?\s(?:(?!\1).)*?)\1""")
COMMENT = ('//', '/*', '*', '#', '<!--', '--')


def visible_spans(f, line, v):
    """Spans of the visible-text pattern a reader of `f` can see on `line`."""
    if match(f, v['exclude_paths']):
        return []
    hits = [h.span() for h in v['re'].finditer(line)]
    if not hits or match(f, v['text_paths']):
        return hits
    if not match(f, v['code_paths']) or line.lstrip().startswith(COMMENT):
        return []
    lits = [s.span(2) for s in SENTENCE.finditer(line)]
    return [h for h in hits if any(a <= h[0] and h[1] <= b for a, b in lits)]


def kept(f, line, span, keep):
    return any(
        fnmatch.fnmatch(f, g) and any(k.start() <= span[0] and span[1] <= k.end() for k in rx.finditer(line))
        for g, rx in keep
    )


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
                if match(f, r.get('exclude_paths', [])) or (
                    'paths' in r and not match(f, r['paths'])
                ):
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
            spans = [h.span() for c in checks for h in c.finditer(line)]
            spans += visible_spans(f, line, m['visible_text'])
            if any(not kept(f, line, s, keep) for s in spans):
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
