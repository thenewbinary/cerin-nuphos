import assert from 'node:assert/strict'
import test from 'node:test'

import { setAvatarApiOrigin, trustedAvatarURL } from './avatarUrl.ts'

const uploaded = `/avatars/0123456789abcdef01234567/${'a'.repeat(64)}.webp`

test('shared-message avatars reject untrusted and disguised image hosts', () => {
  assert.equal(
    trustedAvatarURL('https://lh3.googleusercontent.com/a'),
    'https://lh3.googleusercontent.com/a',
  )
  for (const value of [
    'https://tracker.example/pixel',
    'https://lh3.googleusercontent.com.evil.example/a',
    'https://user@lh3.googleusercontent.com/a',
    'http://lh3.googleusercontent.com/a',
    'https://lh3.googleusercontent.com:8443/a',
    '',
  ]) {
    assert.equal(trustedAvatarURL(value), undefined)
  }
})

test('uploaded photos are trusted only on the backend this app talks to', () => {
  setAvatarApiOrigin('https://platform.cerin.ai')
  assert.equal(
    trustedAvatarURL(`https://platform.cerin.ai${uploaded}`),
    `https://platform.cerin.ai${uploaded}`,
  )
  for (const value of [
    `https://evil.example${uploaded}`,
    `http://platform.cerin.ai${uploaded}`,
    `https://platform.cerin.ai${uploaded}?track=1`,
    `https://platform.cerin.ai${uploaded.replace('.webp', '.svg')}`,
    'https://platform.cerin.ai/avatars/me/pixel.webp',
  ]) {
    assert.equal(trustedAvatarURL(value), undefined)
  }
  setAvatarApiOrigin('http://localhost:3720')
  assert.equal(
    trustedAvatarURL(`http://localhost:3720${uploaded}`),
    `http://localhost:3720${uploaded}`,
  )
  assert.equal(trustedAvatarURL(`https://platform.cerin.ai${uploaded}`), undefined)
})
