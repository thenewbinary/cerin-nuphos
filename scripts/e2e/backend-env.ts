// The backend as the e2e stack runs it, on `port` and `mongoUri`; nothing here is a real credential.
import { connect } from 'node:net'
import { networkInterfaces } from 'node:os'

import { E2E_JWT_SECRET } from './slack-stub.ts'

export function backendEnv(port: number, apiUrl: string, mongoUri: string) {
  return {
    NODE_ENV: 'development',
    PORT: String(port),
    // Loopback only, as MongoDB is: other machines on the network cannot reach the stack.
    CERIN_LISTEN_HOST: '127.0.0.1',
    CERIN_JWT_SECRET: E2E_JWT_SECRET,
    MONGODB_URI: mongoUri,
    MONGODB_DB: 'cerin_e2e',
    ATLAS_REDIS_ENABLED: 'false',
    CERIN_DEV_EMAIL_OTP_LOG: 'true',
    CERIN_LOCAL_STACK: 'true',
    OUTBOUND_ALLOW_PRIVATE_HOSTS: 'true',
    // Seals two-factor secrets (sealers.mfa).
    LINODE_BYOK_ENCRYPTION_KEY: 'bG9jYWwtZTJlLWxpbm9kZS1rZXktbm90LXByb2R1Y3Q=',
    SONARQUBE_BYOK_ENCRYPTION_KEY: 'bG9jYWwtZTJlLXNvbmFycXViZS1rZXktbm90LXByb2Q=',
    // Where the agent reaches the backend's tools, as a runtime on this computer would.
    CERIN_BACKEND_URL: apiUrl,
    // Connect Link callbacks must name a public HTTPS backend; scenarios drive them locally instead.
    CERIN_PUBLIC_BACKEND_URL: 'https://api.cerin.test',
    // Voice input as on Cerin Cloud, for a subscription the e2e team lacks; never reached.
    CERIN_BILLING_URL: `${apiUrl}/e2e-billing`,
    OPENAI_API_KEY: 'e2e-openai-key-not-a-production-credential',
  }
}

// Throws if the backend on `port` also answers on this computer's network address.
export async function assertLoopbackOnly(port: number) {
  const address = Object.values(networkInterfaces())
    .flat()
    .find((nic) => nic?.family === 'IPv4' && !nic.internal)?.address

  if (!address) return
  const reached = await new Promise<boolean>((done) => {
    const socket = connect(port, address, () => {
      socket.destroy()
      done(true)
    })

    socket.once('error', () => done(false))
  })

  if (reached) {
    throw new Error(`The backend answers on ${address}:${String(port)}, not only on 127.0.0.1`)
  }
}
