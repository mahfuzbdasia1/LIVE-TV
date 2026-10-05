import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeUnique, dedupeRows, normTitle } from '../shared/merge.js'

const m = (id, title, year, source, extra = {}) => ({ id, media_type: 'movie', title, release_date: `${year}-01-01`, sources: [source], ...extra })

test('same TMDB id from several APIs appears once and keeps all sources', () => {
  const out = mergeUnique([[m(1, 'Dune', 2021, 'tmdb')], [m(1, 'Dune', 2021, 'simkl', { poster_path: '/p.jpg' })], [m(1, 'Dune', 2021, 'watchmode')]])
  assert.equal(out.length, 1)
  assert.deepEqual(out[0].sources.sort(), ['simkl', 'tmdb', 'watchmode'])
  assert.equal(out[0].poster_path, '/p.jpg') // missing field filled from later source
})

test('same normalized title + year with different ids is still one entry', () => {
  const out = mergeUnique([[m(1, 'Spider-Man: No Way Home', 2021, 'tmdb')], [m(999, 'Spider Man  No Way Home', 2021, 'simkl')]])
  assert.equal(out.length, 1)
})

test('movie and tv with the same numeric id are kept apart', () => {
  const tv = { id: 1, media_type: 'tv', name: 'Show', first_air_date: '2020-01-01' }
  assert.equal(mergeUnique([[m(1, 'Film', 2020, 'tmdb')], [tv]]).length, 2)
})

test('anime merges by mal_id', () => {
  const a = { mal_id: 5, title: 'Cowboy Bebop', year: 1998 }
  const b = { mal_id: 5, title: 'Cowboy Bebop (EN)', year: 1998 }
  assert.equal(mergeUnique([[a], [b]], { ns: 'anime' }).length, 1)
})

test('dedupeRows removes titles already shown in an earlier row', () => {
  const rows = dedupeRows([
    { key: 'a', ns: 'movie', items: [m(1, 'A', 2020, 'x'), m(2, 'B', 2020, 'x')] },
    { key: 'b', ns: 'movie', items: [m(2, 'B', 2020, 'x'), m(3, 'C', 2020, 'x')] },
    { key: 'c', ns: '', items: [m(3, 'C', 2020, 'x'), m(4, 'D', 2020, 'x')] },
  ])
  assert.deepEqual(rows.b.map(x => x.id), [3])
  assert.deepEqual(rows.c.map(x => x.id), [4])
})

test('normTitle strips accents and punctuation', () => {
  assert.equal(normTitle('Amélie & Co.'), 'amelie and co')
})
