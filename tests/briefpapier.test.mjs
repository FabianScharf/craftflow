import { test } from 'node:test'
import assert from 'node:assert/strict'
import { istEigenesBriefpapier } from '../src/lib/briefpapier.ts'

const SB = 'https://abcdefgh.supabase.co'
const UID = '11111111-2222-3333-4444-555555555555'
const EIGEN = `${SB}/storage/v1/object/public/briefpapier/${UID}/briefpapier.pdf`

test('Das eigene Briefpapier wird angenommen', () => {
  assert.equal(istEigenesBriefpapier(EIGEN, SB, UID), true)
})

test('Fremder Ordner wird abgelehnt', () => {
  const fremd = `${SB}/storage/v1/object/public/briefpapier/99999999-2222-3333-4444-555555555555/briefpapier.pdf`
  assert.equal(istEigenesBriefpapier(fremd, SB, UID), false)
})

test('Fremder Host wird abgelehnt — auch mit passendem Pfad', () => {
  const fremd = `https://boeser-host.example/storage/v1/object/public/briefpapier/${UID}/briefpapier.pdf`
  assert.equal(istEigenesBriefpapier(fremd, SB, UID), false)
})

test('Anderer Bucket wird abgelehnt', () => {
  const fremd = `${SB}/storage/v1/object/public/projektdateien/${UID}/briefpapier.pdf`
  assert.equal(istEigenesBriefpapier(fremd, SB, UID), false)
})

test('Interne Adressen und Metadaten-Endpunkte werden abgelehnt', () => {
  assert.equal(istEigenesBriefpapier('http://169.254.169.254/latest/meta-data/', SB, UID), false)
  assert.equal(istEigenesBriefpapier('http://localhost:3000/api/usage', SB, UID), false)
  assert.equal(istEigenesBriefpapier('file:///etc/passwd', SB, UID), false)
})

test('Zugangsdaten in der Adresse hebeln den Host-Vergleich nicht aus', () => {
  const trick = `https://abcdefgh.supabase.co@boeser-host.example/storage/v1/object/public/briefpapier/${UID}/x.pdf`
  assert.equal(istEigenesBriefpapier(trick, SB, UID), false)
})

test('Fehlende Angaben sind nie gültig', () => {
  assert.equal(istEigenesBriefpapier('', SB, UID), false)
  assert.equal(istEigenesBriefpapier(EIGEN, '', UID), false)
  assert.equal(istEigenesBriefpapier(EIGEN, SB, ''), false)
  assert.equal(istEigenesBriefpapier(null, SB, UID), false)
  assert.equal(istEigenesBriefpapier('kein-url', SB, UID), false)
})
