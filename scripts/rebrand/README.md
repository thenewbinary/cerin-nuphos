# Rebrand: Nuphos to Cerin

Cerin Platform is built from upstream Nuphos
([nuphos/nuphos](https://github.com/nuphos/nuphos)). These files turn upstream
code into Cerin code the same way every time, so upstream updates can be
merged and renamed without hand work.

| File         | What it is                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `map.json`   | The rename rules (regex, replacement, reason), the paths never touched (LICENSE, NOTICE, TRADEMARK.md, bun.lock) and the patterns the check looks for. |
| `keep.txt`   | Lines allowed to keep a checked Nuphos form, each with a reason (legacy `nuphos://` sign-in return, upstream telemetry host).                          |
| `rebrand.py` | Applies `map.json` to every tracked text file. Idempotent: a second run changes nothing.                                                               |
| `check.sh`   | Exits 1 if a rule would still change a file, or a checked form is left that `keep.txt` does not allow. Prints each offending file or line.             |

```sh
python3 scripts/rebrand/rebrand.py   # rename in place
./scripts/rebrand/check.sh           # fail on leftovers
```

Both need only Python 3 and git, and run from anywhere in the checkout.

## What is renamed, what is kept

Renamed: the product name `Nuphos`, `nuphos://` links, and `nuphos.ai` hosts
(`nuphos.ai` and `api.nuphos.ai` become `platform.cerin.ai`, other
subdomains keep their prefix).

Kept on purpose, because saved data, installed apps or deployments depend on
them: bundle and package ids (`ai.nuphos.*`), `NUPHOS_*` environment
variables, `nuphos.*` storage keys, `Nuphos*` type names, database names,
`ghcr.io/nuphos` and `zeabur/*` images, and the upstream repo name. Inbound
link handlers still accept `nuphos://` and `https://nuphos.ai` links from
older installs. The check only looks at the person-visible forms, so these
need no `keep.txt` entry.

## When a check fails

Run `rebrand.py` and commit the result. If the line really must keep the old
form, add `<path glob> <regex>   # reason` to `keep.txt`. If the rename needs a
new kind of replacement, add a rule to `map.json` rather than editing by hand,
so the next upstream merge gets it too.

## Calling them from CI

A pull-request check needs one step after checkout:

```yaml
- uses: actions/checkout@v7
- run: ./scripts/rebrand/check.sh
```

A job that brings in upstream Nuphos should merge raw upstream first, then
rename, then check, and commit the rename as its own commit so the merge stays
reviewable:

```sh
git fetch https://github.com/nuphos/nuphos.git main
git merge --no-edit FETCH_HEAD          # resolve or flag conflicts here
python3 scripts/rebrand/rebrand.py
git add -A && git commit -m 'Rename upstream changes to Cerin (scripts/rebrand)'
./scripts/rebrand/check.sh              # must exit 0 before the PR is ready
```

Renaming upstream before merging sounds cleaner but conflicts more: in a
trial against upstream `1eef19623` (654 commits ahead of the shared base),
merging raw upstream left 191 conflicted files and merging renamed upstream
left 290, because parts of the Cerin rebrand were done by hand before this
script existed.

`rebrand.py` prints `left (add a rule or a keep.txt line): ...` for anything
the rules can't rename; `check.sh` turns those into a failure.
