# Sourced by every non-interactive bash through BASH_ENV (set in the runtime
# ConfigMap). Not executable on its own.

# The conversation token in the spawn-time env expires; OpenAB rewrites the
# current one into OPENAB_CREDENTIALS_DIR on every turn and deletes a revoked
# one, so a missing file must unset the stale value. Nested shells re-read it
# too.
if [ -n "${OPENAB_CREDENTIALS_DIR:-}" ]; then
  for cerin_credential in NUPHOS_TOKEN NUPHOS_PLAN_API_TOKEN; do
    cerin_credential_value=
    if [ -r "$OPENAB_CREDENTIALS_DIR/$cerin_credential" ]; then
      IFS= read -r cerin_credential_value <"$OPENAB_CREDENTIALS_DIR/$cerin_credential" || true
    fi
    if [ -n "$cerin_credential_value" ]; then
      export "$cerin_credential=$cerin_credential_value"
    else
      unset "$cerin_credential"
    fi
  done
  unset cerin_credential cerin_credential_value
fi
