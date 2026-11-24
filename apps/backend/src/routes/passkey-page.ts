import { randomBytes } from 'node:crypto'

import { Hono } from 'hono'

const SCRIPT = String.raw`
  const params = new URLSearchParams(location.hash.slice(1))
  history.replaceState(null, '', location.pathname + location.search)
  const status = document.getElementById('status')

  function decode(value) {
    return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))
  }

  function encode(value) {
    return btoa(Array.from(new Uint8Array(value), (byte) => String.fromCharCode(byte)).join(''))
      .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  }

  function parseOptions(mode, options) {
    if (mode === 'get' && typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function') {
      return PublicKeyCredential.parseRequestOptionsFromJSON(options)
    }
    if (mode === 'create' && typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function') {
      return PublicKeyCredential.parseCreationOptionsFromJSON(options)
    }
    const publicKey = { ...options, challenge: decode(options.challenge) }
    if (mode === 'create') publicKey.user = { ...options.user, id: decode(options.user.id) }
    for (const key of ['allowCredentials', 'excludeCredentials']) {
      if (options[key]) publicKey[key] = options[key].map((entry) => ({ ...entry, id: decode(entry.id) }))
    }
    return publicKey
  }

  function serialize(credential) {
    if (typeof credential.toJSON === 'function') return credential.toJSON()
    const response = credential.response
    const result = {
      id: credential.id,
      rawId: encode(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: { clientDataJSON: encode(response.clientDataJSON) },
    }
    if (response.attestationObject !== undefined) {
      result.response.attestationObject = encode(response.attestationObject)
      if (typeof response.getTransports === 'function') result.response.transports = response.getTransports()
    } else {
      result.response.authenticatorData = encode(response.authenticatorData)
      result.response.signature = encode(response.signature)
      result.response.userHandle = response.userHandle === null ? null : encode(response.userHandle)
    }
    return result
  }

  async function run() {
    const mode = params.get('mode')
    const redirect = params.get('redirect') || ''
    const state = params.get('state')
    // Check the raw spelling so URL normalization cannot widen the callback allowlist.
    const match = /^http:\/\/(127\.0\.0\.1|localhost):([0-9]{1,5})\/callback$/.exec(redirect)
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535 ||
        (mode !== 'get' && mode !== 'create') || !state) {
      status.textContent = 'Invalid passkey request.'
      return
    }
    const callback = new URL(redirect)
    callback.searchParams.set('state', state)

    function finish(credential) {
      if (credential) {
        const json = JSON.stringify(serialize(credential))
        callback.searchParams.set('credential', encode(new TextEncoder().encode(json)))
      }
      status.textContent = credential
        ? 'Done. You can return to the Cerin app.'
        : 'Passkey cancelled. You can close this tab.'
      location.replace(callback.href)
    }

    try {
      const options = JSON.parse(new TextDecoder().decode(decode(params.get('options') || '')))
      const publicKey = parseOptions(mode, options)
      const credential = mode === 'get'
        ? await navigator.credentials.get({ publicKey })
        : await navigator.credentials.create({ publicKey })
      finish(credential)
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
        finish(null)
      } else {
        status.textContent = 'Passkey failed. Please try again in the Cerin app.'
      }
    }
  }

  void run()
`

export const passkeyPageRoutes = new Hono()

passkeyPageRoutes.get('/', (c) => {
  const nonce = randomBytes(24).toString('base64')

  c.header(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  )
  c.header('Referrer-Policy', 'no-referrer')
  c.header('Cache-Control', 'no-store')

  return c.html(`<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Cerin</title>
<style nonce="${nonce}">
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1115;color:#e6e6e6;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center}
  main{background:#171a21;border:1px solid #262b36;border-radius:12px;padding:28px;max-width:360px;margin:20px}
  h1{font-size:18px;margin:0 0 12px}
  p{color:#9aa4b2;font-size:14px;line-height:1.5;margin:0}
</style></head>
<body><main><h1>Cerin</h1><p id="status" role="status">Waiting for your passkey…</p></main>
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`)
})
