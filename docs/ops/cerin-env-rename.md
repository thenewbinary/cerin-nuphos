# Cerin env and name cutover

Old names are written as `<OLD>` (the former product name, upper case for env
vars) so this file passes `scripts/check-brand.py`. There are no fallbacks:
a process started with only the old name set behaves as if the var is unset.

## Backend vars

Read by `apps/backend` (`src/config/**`, documented in `apps/backend/.env.example`).
Rename these in the backend env file / compose overlay at cutover.

| Old                                                | New                                                |
| -------------------------------------------------- | -------------------------------------------------- |
| `<OLD>_AUTH_BASE_URL`                              | `CERIN_AUTH_BASE_URL`                              |
| `<OLD>_BACKEND_URL`                                | `CERIN_BACKEND_URL`                                |
| `<OLD>_BILLING_URL`                                | `CERIN_BILLING_URL`                                |
| `<OLD>_BOX_`                                       | `CERIN_BOX_`                                       |
| `<OLD>_BOX_DOWNLOAD_URL`                           | `CERIN_BOX_DOWNLOAD_URL`                           |
| `<OLD>_CLAUDE_CONTROL_KEY`                         | `CERIN_CLAUDE_CONTROL_KEY`                         |
| `<OLD>_CODEX_CONTROL_KEY`                          | `CERIN_CODEX_CONTROL_KEY`                          |
| `<OLD>_COMPOSIO_API_KEY`                           | `CERIN_COMPOSIO_API_KEY`                           |
| `<OLD>_DEV_EMAIL_OTP_LOG`                          | `CERIN_DEV_EMAIL_OTP_LOG`                          |
| `<OLD>_DEV_HTTP_PORT`                              | `CERIN_DEV_HTTP_PORT`                              |
| `<OLD>_DEV_LAUNCHER_PID`                           | `CERIN_DEV_LAUNCHER_PID`                           |
| `<OLD>_DOCS_URL`                                   | `CERIN_DOCS_URL`                                   |
| `<OLD>_EMAIL_FROM`                                 | `CERIN_EMAIL_FROM`                                 |
| `<OLD>_FILE_TRANSFER_PROVIDER`                     | `CERIN_FILE_TRANSFER_PROVIDER`                     |
| `<OLD>_FILE_TRANSFER_S3_ACCESS_KEY_ID`             | `CERIN_FILE_TRANSFER_S3_ACCESS_KEY_ID`             |
| `<OLD>_FILE_TRANSFER_S3_BUCKET`                    | `CERIN_FILE_TRANSFER_S3_BUCKET`                    |
| `<OLD>_FILE_TRANSFER_S3_ENDPOINT`                  | `CERIN_FILE_TRANSFER_S3_ENDPOINT`                  |
| `<OLD>_FILE_TRANSFER_S3_PUBLIC_ENDPOINT`           | `CERIN_FILE_TRANSFER_S3_PUBLIC_ENDPOINT`           |
| `<OLD>_FILE_TRANSFER_S3_REGION`                    | `CERIN_FILE_TRANSFER_S3_REGION`                    |
| `<OLD>_FILE_TRANSFER_S3_SECRET_ACCESS_KEY`         | `CERIN_FILE_TRANSFER_S3_SECRET_ACCESS_KEY`         |
| `<OLD>_INTERNAL_TOKEN_GCP_KMS_KEY_VERSION`         | `CERIN_INTERNAL_TOKEN_GCP_KMS_KEY_VERSION`         |
| `<OLD>_INTERNAL_TOKEN_ISSUER`                      | `CERIN_INTERNAL_TOKEN_ISSUER`                      |
| `<OLD>_INTERNAL_TOKEN_KMS_KEY_ID`                  | `CERIN_INTERNAL_TOKEN_KMS_KEY_ID`                  |
| `<OLD>_INTERNAL_TOKEN_KMS_REGION`                  | `CERIN_INTERNAL_TOKEN_KMS_REGION`                  |
| `<OLD>_INTERNAL_TOKEN_PREVIOUS_PUBLIC_KEYS_BASE64` | `CERIN_INTERNAL_TOKEN_PREVIOUS_PUBLIC_KEYS_BASE64` |
| `<OLD>_INTERNAL_TOKEN_PRIVATE_KEY_BASE64`          | `CERIN_INTERNAL_TOKEN_PRIVATE_KEY_BASE64`          |
| `<OLD>_JWT_SECRET`                                 | `CERIN_JWT_SECRET`                                 |
| `<OLD>_LOCAL_STACK`                                | `CERIN_LOCAL_STACK`                                |
| `<OLD>_OAUTH_AUTHORIZE_BASE_URL`                   | `CERIN_OAUTH_AUTHORIZE_BASE_URL`                   |
| `<OLD>_PUBLIC_BACKEND_URL`                         | `CERIN_PUBLIC_BACKEND_URL`                         |
| `<OLD>_PUBLIC_URL`                                 | `CERIN_PUBLIC_URL`                                 |
| `<OLD>_RELAY_AGENT_ENDPOINT`                       | `CERIN_RELAY_AGENT_ENDPOINT`                       |
| `<OLD>_RELAY_AGENT_IMAGE`                          | `CERIN_RELAY_AGENT_IMAGE`                          |
| `<OLD>_RELAY_PROXY_ENDPOINT`                       | `CERIN_RELAY_PROXY_ENDPOINT`                       |
| `<OLD>_RELAY_STATUS_URL`                           | `CERIN_RELAY_STATUS_URL`                           |
| `<OLD>_RELAY_TOKEN_SECRET`                         | `CERIN_RELAY_TOKEN_SECRET`                         |
| `<OLD>_TELEMETRY_KEY`                              | `CERIN_TELEMETRY_KEY`                              |
| `<OLD>_TELEMETRY_URL`                              | `CERIN_TELEMETRY_URL`                              |

`MONGODB_DB` keeps its name; its default is now `cerin` (was `atlas`). Set
`MONGODB_DB=cerin` explicitly in prod.

## Runtime vars

Read inside the runtime image (`apps/runtime/image`, the openab gateway,
`deploy/railway/runtime`). Most are injected per session by the backend, so
they change automatically once backend and runtime are on this release; the
ones an operator sets on the runtime container itself are `CERIN_BACKEND_URL`,
`CERIN_PUBLIC_URL`, `CERIN_JOIN_TOKEN`, `CERIN_RUNTIME_AUTOGEN_PASSWORD`,
`CERIN_CODEX_AUTH_SOURCE` / `CERIN_CODEX_AUTH_DIRECTORY` and
`CERIN_RUNTIME_PREINSTALL`. Rename runtime vars only after the Cerin runtime
image (`ghcr.io/thenewbinary/cerin-runtime`) is published and pinned: an older
image only reads the old names.

| Old                                 | New                                 |
| ----------------------------------- | ----------------------------------- |
| `<OLD>_AGENT_EXECUTABLE`            | `CERIN_AGENT_EXECUTABLE`            |
| `<OLD>_AGENT_HOME`                  | `CERIN_AGENT_HOME`                  |
| `<OLD>_AGENT_VERSION`               | `CERIN_AGENT_VERSION`               |
| `<OLD>_AUTH_REVISION`               | `CERIN_AUTH_REVISION`               |
| `<OLD>_BACKEND_URL`                 | `CERIN_BACKEND_URL`                 |
| `<OLD>_CGROUP_ROOT`                 | `CERIN_CGROUP_ROOT`                 |
| `<OLD>_CLI_VERSION`                 | `CERIN_CLI_VERSION`                 |
| `<OLD>_CODEX_AUTH_DIRECTORY`        | `CERIN_CODEX_AUTH_DIRECTORY`        |
| `<OLD>_CODEX_AUTH_SOURCE`           | `CERIN_CODEX_AUTH_SOURCE`           |
| `<OLD>_DSH_SIGN_IN`                 | `CERIN_DSH_SIGN_IN`                 |
| `<OLD>_DSH_SIGN_IN_PORT`            | `CERIN_DSH_SIGN_IN_PORT`            |
| `<OLD>_DSH_VERSION`                 | `CERIN_DSH_VERSION`                 |
| `<OLD>_JOIN_TOKEN`                  | `CERIN_JOIN_TOKEN`                  |
| `<OLD>_LOCAL_RUNTIME_DIR`           | `CERIN_LOCAL_RUNTIME_DIR`           |
| `<OLD>_PLAN_API_BASE`               | `CERIN_PLAN_API_BASE`               |
| `<OLD>_PLAN_API_TOKEN`              | `CERIN_PLAN_API_TOKEN`              |
| `<OLD>_PUBLIC_URL`                  | `CERIN_PUBLIC_URL`                  |
| `<OLD>_RUNTIME_AUTOGEN_PASSWORD`    | `CERIN_RUNTIME_AUTOGEN_PASSWORD`    |
| `<OLD>_RUNTIME_PERSONAL_SKILLS_DIR` | `CERIN_RUNTIME_PERSONAL_SKILLS_DIR` |
| `<OLD>_RUNTIME_PREINSTALL`          | `CERIN_RUNTIME_PREINSTALL`          |
| `<OLD>_RUNTIME_SKILLS_TOKEN`        | `CERIN_RUNTIME_SKILLS_TOKEN`        |
| `<OLD>_RUNTIME_SKILLS_URL`          | `CERIN_RUNTIME_SKILLS_URL`          |
| `<OLD>_RUNTIME_WORKSPACE`           | `CERIN_RUNTIME_WORKSPACE`           |
| `<OLD>_SESSION_ACTOR`               | `CERIN_SESSION_ACTOR`               |
| `<OLD>_SESSION_HOME`                | `CERIN_SESSION_HOME`                |
| `<OLD>_SESSION_ID`                  | `CERIN_SESSION_ID`                  |
| `<OLD>_SKILLS_LOCK_WAIT_SECONDS`    | `CERIN_SKILLS_LOCK_WAIT_SECONDS`    |
| `<OLD>_TEAM_ID`                     | `CERIN_TEAM_ID`                     |
| `<OLD>_TOKEN`                       | `CERIN_TOKEN`                       |
| `<OLD>_TOOLS_DIR`                   | `CERIN_TOOLS_DIR`                   |

## Other renamed vars (CLI, desktop, dev, e2e, CI)

No prod action. Listed so local `.env` files and CI secrets can be updated.

| Old                                    | New                                    |
| -------------------------------------- | -------------------------------------- |
| `ATLAS_REGISTER_<OLD>_PROTOCOL`        | `ATLAS_REGISTER_CERIN_PROTOCOL`        |
| `LINEAR_<OLD>_TEAM_ID`                 | `LINEAR_CERIN_TEAM_ID`                 |
| `<OLD>_AGENT_OWNER_ID`                 | `CERIN_AGENT_OWNER_ID`                 |
| `<OLD>_API_URL`                        | `CERIN_API_URL`                        |
| `<OLD>_AUTO_UPDATE_CHECK_SECONDS`      | `CERIN_AUTO_UPDATE_CHECK_SECONDS`      |
| `<OLD>_AUTO_UPDATE_IDLE_SECONDS`       | `CERIN_AUTO_UPDATE_IDLE_SECONDS`       |
| `<OLD>_BACKEND_URL_LOCAL`              | `CERIN_BACKEND_URL_LOCAL`              |
| `<OLD>_CLI_CONFIG`                     | `CERIN_CLI_CONFIG`                     |
| `<OLD>_CLI_EXE`                        | `CERIN_CLI_EXE`                        |
| `<OLD>_CLI_TOKEN`                      | `CERIN_CLI_TOKEN`                      |
| `<OLD>_CODEX_PROVIDER_KEY`             | `CERIN_CODEX_PROVIDER_KEY`             |
| `<OLD>_CUA_PERMISSION_CLIENT`          | `CERIN_CUA_PERMISSION_CLIENT`          |
| `<OLD>_DEBUG`                          | `CERIN_DEBUG`                          |
| `<OLD>_DEBUG_FRAMES`                   | `CERIN_DEBUG_FRAMES`                   |
| `<OLD>_DESKTOP_POOL`                   | `CERIN_DESKTOP_POOL`                   |
| `<OLD>_DESKTOP_POOL_SIZE`              | `CERIN_DESKTOP_POOL_SIZE`              |
| `<OLD>_DESKTOP_SESSION`                | `CERIN_DESKTOP_SESSION`                |
| `<OLD>_DEV_INSTANCE`                   | `CERIN_DEV_INSTANCE`                   |
| `<OLD>_DEV_NO_DESKTOP`                 | `CERIN_DEV_NO_DESKTOP`                 |
| `<OLD>_DOWNLOAD_URL`                   | `CERIN_DOWNLOAD_URL`                   |
| `<OLD>_E2E_`                           | `CERIN_E2E_`                           |
| `<OLD>_E2E_AGENT_INSTALLER`            | `CERIN_E2E_AGENT_INSTALLER`            |
| `<OLD>_E2E_ALLOW_LOGIN`                | `CERIN_E2E_ALLOW_LOGIN`                |
| `<OLD>_E2E_DEVICE_SERIAL`              | `CERIN_E2E_DEVICE_SERIAL`              |
| `<OLD>_E2E_EXPECTED_EMAIL`             | `CERIN_E2E_EXPECTED_EMAIL`             |
| `<OLD>_E2E_LOGIN_MODE`                 | `CERIN_E2E_LOGIN_MODE`                 |
| `<OLD>_E2E_MAC_SCREEN_BLANK`           | `CERIN_E2E_MAC_SCREEN_BLANK`           |
| `<OLD>_E2E_MAC_SCREEN_HOST`            | `CERIN_E2E_MAC_SCREEN_HOST`            |
| `<OLD>_E2E_MAC_SCREEN_LOG`             | `CERIN_E2E_MAC_SCREEN_LOG`             |
| `<OLD>_E2E_PASSWORD`                   | `CERIN_E2E_PASSWORD`                   |
| `<OLD>_E2E_STAGED_UPDATE`              | `CERIN_E2E_STAGED_UPDATE`              |
| `<OLD>_E2E_TEAM_ID`                    | `CERIN_E2E_TEAM_ID`                    |
| `<OLD>_EVIDENCE_BASELINE`              | `CERIN_EVIDENCE_BASELINE`              |
| `<OLD>_GITHUB_BRANCH`                  | `CERIN_GITHUB_BRANCH`                  |
| `<OLD>_GITHUB_REPO`                    | `CERIN_GITHUB_REPO`                    |
| `<OLD>_INSTALL_DIR`                    | `CERIN_INSTALL_DIR`                    |
| `<OLD>_INTERRUPT_OK`                   | `CERIN_INTERRUPT_OK`                   |
| `<OLD>_LATEST_URL`                     | `CERIN_LATEST_URL`                     |
| `<OLD>_LAUNCHER_HEALTH`                | `CERIN_LAUNCHER_HEALTH`                |
| `<OLD>_LINT_UNLOCK`                    | `CERIN_LINT_UNLOCK`                    |
| `<OLD>_LOGIN_URL`                      | `CERIN_LOGIN_URL`                      |
| `<OLD>_MAC_SCREEN_PARENT`              | `CERIN_MAC_SCREEN_PARENT`              |
| `<OLD>_MCP_BRIDGE`                     | `CERIN_MCP_BRIDGE`                     |
| `<OLD>_MONGO_HOST`                     | `CERIN_MONGO_HOST`                     |
| `<OLD>_MOVED_OK`                       | `CERIN_MOVED_OK`                       |
| `<OLD>_NO_MODIFY_PATH`                 | `CERIN_NO_MODIFY_PATH`                 |
| `<OLD>_NO_UPDATE_CHECK`                | `CERIN_NO_UPDATE_CHECK`                |
| `<OLD>_OK`                             | `CERIN_OK`                             |
| `<OLD>_OPENAB_BINARY`                  | `CERIN_OPENAB_BINARY`                  |
| `<OLD>_OPENAPI_CACHE`                  | `CERIN_OPENAPI_CACHE`                  |
| `<OLD>_PREVIEW_REQUESTS`               | `CERIN_PREVIEW_REQUESTS`               |
| `<OLD>_PREVIEW_RESPONSES`              | `CERIN_PREVIEW_RESPONSES`              |
| `<OLD>_PTY_OK`                         | `CERIN_PTY_OK`                         |
| `<OLD>_RELAY_ENDPOINT`                 | `CERIN_RELAY_ENDPOINT`                 |
| `<OLD>_RELAY_TOKEN`                    | `CERIN_RELAY_TOKEN`                    |
| `<OLD>_RUNTIME`                        | `CERIN_RUNTIME`                        |
| `<OLD>_RUNTIME_REPOSITORY`             | `CERIN_RUNTIME_REPOSITORY`             |
| `<OLD>_SESSION_TOKEN`                  | `CERIN_SESSION_TOKEN`                  |
| `<OLD>_SHARE_EXTENSION`                | `CERIN_SHARE_EXTENSION`                |
| `<OLD>_SHARE_PREVIEW_CONDITION`        | `CERIN_SHARE_PREVIEW_CONDITION`        |
| `<OLD>_SHOTS`                          | `CERIN_SHOTS`                          |
| `<OLD>_SMOKE_ACTOR`                    | `CERIN_SMOKE_ACTOR`                    |
| `<OLD>_SMOKE_RECORD`                   | `CERIN_SMOKE_RECORD`                   |
| `<OLD>_TAILNET_AUTH_KEY`               | `CERIN_TAILNET_AUTH_KEY`               |
| `<OLD>_TAILNET_HOSTNAME`               | `CERIN_TAILNET_HOSTNAME`               |
| `<OLD>_TAILNET_SOCKS_PORT`             | `CERIN_TAILNET_SOCKS_PORT`             |
| `<OLD>_TAILNET_TAG`                    | `CERIN_TAILNET_TAG`                    |
| `<OLD>_TAILSCALE_DIALER_ADDR`          | `CERIN_TAILSCALE_DIALER_ADDR`          |
| `<OLD>_TAILSCALE_DIALER_TOKEN`         | `CERIN_TAILSCALE_DIALER_TOKEN`         |
| `<OLD>_TEAM`                           | `CERIN_TEAM`                           |
| `<OLD>_TEST`                           | `CERIN_TEST`                           |
| `<OLD>_TEST_JS`                        | `CERIN_TEST_JS`                        |
| `<OLD>_TEST_RECORD`                    | `CERIN_TEST_RECORD`                    |
| `<OLD>_TRANSFER_WAIT_SECONDS`          | `CERIN_TRANSFER_WAIT_SECONDS`          |
| `<OLD>_VERSION`                        | `CERIN_VERSION`                        |
| `<OLD>_WEB_URL`                        | `CERIN_WEB_URL`                        |
| `SIMCTL_CHILD_<OLD>_PREVIEW_RESPONSES` | `SIMCTL_CHILD_CERIN_PREVIEW_RESPONSES` |
| `__<OLD>_QUOTA__`                      | `__CERIN_QUOTA__`                      |
| `__<OLD>_SHELL_ENV_MARKER__`           | `__CERIN_SHELL_ENV_MARKER__`           |
| `__<OLD>_SKILLS_DIR__`                 | `__CERIN_SKILLS_DIR__`                 |

## Other names that changed

| What                                        | Old                                  | New                                                     |
| ------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| HTTP headers                                | `X-<Old>-*` / `x-<old>-*`            | `X-Cerin-*` / `x-cerin-*` (no old-header acceptance)    |
| Mongo database                              | `<old>`                              | `cerin` (`MONGODB_DB`)                                  |
| Mongo user (compose, helm, railway)         | `<old>`                              | `cerin`                                                 |
| CI test database                            | `<old>_test`                         | `cerin_test`                                            |
| Buckets                                     | (already Cerin in #10)               | `cerin-file-transfers`, `cerin-skills`, `cerin-journal` |
| Backend image                               | `ghcr.io/<old>/backend`              | `ghcr.io/thenewbinary/cerin-backend`                    |
| Runtime image                               | `ghcr.io/<old>/runtime`              | `ghcr.io/thenewbinary/cerin-runtime`                    |
| Runtime state dir (consumers of the image)  | `/home/node/.<old>-runtime`          | `/home/node/.cerin-runtime`                             |
| Runtime entrypoint (consumers of the image) | `/usr/local/bin/<old>-runtime-start` | `/usr/local/bin/cerin-runtime-start`                    |
| Runtime control key label (HMAC)            | `<old>-runtime-control-v1`           | `cerin-runtime-control-v1`                              |
| Relay status credential label (HMAC)        | `<old>-relay-status-v1`              | `cerin-relay-status-v1`                                 |
| Compose project (base file, local dev only) | `name: <old>-local`                  | `name: cerin-local`                                     |

## Only after the renamed images are published

These refs point at images or in-image paths that exist only once CI publishes
`ghcr.io/thenewbinary/cerin-runtime` and `ghcr.io/thenewbinary/cerin-backend`
from this branch (`runtime-build.yml`, `release-backend.yml`). Until then they
will not pull or will not match an older image:

- `deploy/compose`, `deploy/railway`, `deploy/helm`: repinned to the first
  published Cerin images. Runtime
  `ghcr.io/thenewbinary/cerin-runtime:commit-45f3647f283b1c6d54d8b942ae0a02d456f67472-claude-code`
  (`sha256:4d6e77e6ec01aaa39f0c1ca0fe5315f5fab267427c4ce5521a05a00cdca0656c`), backend
  `ghcr.io/thenewbinary/cerin-backend:v0.145.7`
  (`sha256:059beab3a3fd09cfad9d0d4f4d5d5a58d5f369bef443131188567a7fede70f5c`).
- `deploy/railway/runtime/start.sh`, `deploy/compose/smoke.py`,
  `scripts/dev-compose.ts`: the `cerin-runtime-start` entrypoint and
  `.cerin-runtime/auth-key` path exist only in the new image.
- The runtime control key label and relay status label: backend, desktop and
  runtime must all be on this release together, or runtime control calls and
  relay status checks fail authentication. Roll the runtime image and backend
  in the same window.
- Runtime env renames (section above).
- Backend update discovery follows only `runtime-v*` releases on
  `thenewbinary/cerin-platform` that advertise `ghcr.io/thenewbinary/cerin-runtime`;
  managed runtimes are offered no update until the first such release exists.

## Prod cutover order (Ops)

1. Publish runtime and backend images from `main` after merge; record tag and digest.
2. `mongodump` the old database, restore as `cerin`; keep the old database for rollback.
3. Swap the backend env file and compose overlay (backend vars above, `MONGODB_DB=cerin`,
   new image refs, `-p cerin` on every compose command).
4. Start the backend; its startup migration rewrites stored old-name values
   (idempotent, safe to re-run).
5. Rename runtime vars and roll runtimes to the published Cerin runtime image.
