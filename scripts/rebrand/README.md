# Rebrand: Nuphos to Cerin

Cerin Platform is built from upstream Nuphos
([nuphos/nuphos](https://github.com/nuphos/nuphos)). These files turn upstream
code into Cerin code the same way every time, so upstream updates can be
merged and renamed without hand work.

| File         | What it is                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `map.json`   | The rename rules (regex, replacement, reason), the paths never touched (LICENSE, NOTICE, TRADEMARK.md, bun.lock) and the patterns the check looks for. |
| `keep.txt`   | Nuphos forms allowed to stay, each with a reason: legacy identifiers everywhere, and one-off lines such as the legacy `nuphos://` sign-in return.      |
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
variables, `nuphos.*` storage keys, `Nuphos*` type names, MCP tool and server
names (`nuphos_*`, `nuphos-tools`), paths on disk (`~/.config/nuphos`),
`X-Nuphos-*` headers, the `nuphos-agent` service the CLI installs, the
`nuphos-relay` namespace in customer clusters, the Helm chart name,
`ghcr.io/nuphos` and `zeabur/*` images, and the upstream repo name. Inbound
link handlers still accept `nuphos://` and `https://nuphos.ai` links from
older installs.

## What the check looks at

- `check_patterns` in `map.json` (the product name, `nuphos://`, `nuphos.ai`)
  on every line of every tracked text file.
- `visible_text`: `nuphos` in any case, but only in text people read. Docs,
  translation files and Android string resources count whole. In code, only
  string literals with a space in them (sentences, labels, shell commands)
  outside comment lines count. Tests and fixtures are skipped.

Each match must sit inside a `keep.txt` match on the same line, so a keep
entry for `NUPHOS_TOKEN` does not hide a stray `nuphos` next to it. The
global entries at the bottom of `keep.txt` describe the identifier forms
above; file entries cover one-off cases.

## When a check fails

Run `rebrand.py` and commit the result. If a line must keep the old form next to the new one (a legacy alias),
end it with a `rebrand:keep` comment and neither the script nor the check
touches it. If a file must keep it, add `<path glob> <regex>   # reason` to `keep.txt`.
If the rename needs a new kind of replacement, add a rule to `map.json`
rather than editing by hand, so the next upstream merge gets it too. A rule
can be limited with `paths` (only these globs) or `exclude_paths`.

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
