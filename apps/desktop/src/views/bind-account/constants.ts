import { parseAtlasError } from '../../api'

export type Provider =
  | 'aws'
  | 'gcp'
  | 'cloudflare'
  | 'linode'
  | 'hetzner'
  | 'betterstack'
  | 'uptime-kuma'
  | 'tailscale'
  | 'zeabur'
  | 'vanta'
  | 'secureframe'
  | 'notion'
  | 'upstash'
  | 'resend'
  | 'instabox'
  | 'tencent'
  | 'aliyun'
  | 'volcengine'
  | 'huawei'
  | 'azure'

// Volcengine role TRN, e.g. trn:iam::2100000000:role/CerinConnector.
export const TRN_PATTERN = /^trn:iam::\d+:role\/.+$/
// Huawei Cloud account (IAM domain) id, the IAM identity provider name, and
// the trust agency name assigned to Cerin's audience.
export const HUAWEI_DOMAIN_ID_PATTERN = /^[0-9a-f]{32}$/i
export const HUAWEI_IDP_NAME_PATTERN = /^[\w.-]{1,64}$/
export const HUAWEI_AGENCY_NAME_PATTERN = /^[\w.-]{1,64}$/
// Azure tenant / client / subscription ids are all GUIDs.
// Alibaba Cloud RAM role ARN + OIDC provider ARN.
export const ALIYUN_ROLE_ARN_PATTERN = /^acs:ram::\d+:role\/.+$/
export const ALIYUN_OIDC_PROVIDER_ARN_PATTERN = /^acs:ram::\d+:oidc-provider\/.+$/
// Tencent CAM role ARN, e.g. qcs::cam::uin/123456789:roleName/Cerin.
export const TENCENT_ROLE_ARN_PATTERN = /^qcs::cam::uin\/\d+:roleName\/.+$/

export function errorMessage(e: unknown): string {
  // parseAtlasError unwraps the __ATLAS_API_ERROR__ sentinel the main process
  // wraps API failures in (returning the backend's clean message); the replace
  // strips the Electron IPC prefix from any plain, non-sentinel error.
  return parseAtlasError(e).message.replace(/^Error invoking remote method '[^']+':\s*/i, '')
}
