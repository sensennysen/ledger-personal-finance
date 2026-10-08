import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { blockedSupabaseDirectives, cspAllows } from '../src/lib/cspCheck.ts'

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value

test('the shipped CSP allows a hosted Supabase project (LED-325)', () => {
  assert.deepEqual(blockedSupabaseDirectives(CSP, 'https://abcd.supabase.co'), [])
  assert.deepEqual(blockedSupabaseDirectives(CSP, 'https://abcd.supabase.in'), [])
})

test('a self-hosted Supabase domain is reported as blocked (LED-325)', () => {
  assert.deepEqual(blockedSupabaseDirectives(CSP, 'https://db.example.com'), ['connect-src', 'img-src'])
  // A wildcard does not match the bare domain, nor a look-alike suffix.
  assert.equal(cspAllows(CSP, 'connect-src', 'https://supabase.co'), false)
  assert.equal(cspAllows(CSP, 'connect-src', 'https://evilsupabase.co'), false)
  assert.equal(cspAllows(CSP, 'connect-src', 'http://abcd.supabase.co'), false)
})

test('cspAllows honours ports and falls back to default-src', () => {
  assert.equal(cspAllows("default-src https://db.example.com:8443", 'connect-src', 'https://db.example.com:8443'), true)
  assert.equal(cspAllows("default-src https://db.example.com:8443", 'connect-src', 'https://db.example.com'), false)
  assert.equal(cspAllows("connect-src 'self'", 'connect-src', 'not a url'), false)
})
