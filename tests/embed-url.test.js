import test from 'node:test'
import assert from 'node:assert/strict'

import { movieEmbedUrl, tvEmbedUrl } from '../src/lib/api.js'

test('movieEmbedUrl rejects missing ids', () => {
  assert.equal(movieEmbedUrl(undefined), null)
  assert.equal(movieEmbedUrl(null), null)
  assert.equal(movieEmbedUrl(''), null)
})

test('tvEmbedUrl rejects missing season or episode', () => {
  assert.equal(tvEmbedUrl(123, undefined, 1), null)
  assert.equal(tvEmbedUrl(123, 1, undefined), null)
  assert.equal(tvEmbedUrl(null, 1, 1), null)
})

test('embed URL generation includes valid movie and tv paths', () => {
  assert.equal(movieEmbedUrl(456), 'https://api.codespecters.com/embed/movie/456?apikey=')
  assert.equal(tvEmbedUrl(789, 2, 4), 'https://api.codespecters.com/embed/tv/789/2/4?apikey=')
})


test('embed URLs reject unsafe IDs', () => {
  assert.equal(movieEmbedUrl('undefined'), null)
  assert.equal(movieEmbedUrl('550/extra'), null)
  assert.equal(tvEmbedUrl(789, '1/extra', 2), null)
})
