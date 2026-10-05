// Movie browse presets + filters -> TMDB /discover/movie query.

export const DEFAULT_FILTERS = { preset: 'trending', genre: null, decade: null, sort: 'popular', mature: false }

// minVotes: vote threshold used for "Top Rated" so tiny/obscure titles don't win.
export const PRESET_GROUPS = [
  {
    title: 'Collections',
    items: [
      { id: 'trending', label: 'Trending Now', icon: '🔥' },
      { id: 'latest', label: 'Latest Releases', icon: '🆕' },
      { id: 'all', label: 'All Movies', icon: '🎬' },
    ],
  },
  {
    title: 'Language',
    items: [
      { id: 'bangla', label: 'Bangla', icon: '🇧🇩', lang: 'bn', minVotes: 10 },
      { id: 'english', label: 'English', icon: '🇺🇸', lang: 'en', minVotes: 300 },
      { id: 'hindi', label: 'Hindi', icon: '🇮🇳', lang: 'hi', minVotes: 100 },
      {
        id: 'hindi_dubbed', label: 'Hindi Dubbed*', icon: '🎙️', lang: 'te|ta|ml|kn', minVotes: 50,
        note: '*TMDB has no "dubbed" tag. This shows South Indian films (Telugu, Tamil, Malayalam, Kannada) that are commonly released in Hindi. Audio depends on the player.',
      },
      { id: 'tamil', label: 'Tamil', icon: '🎞️', lang: 'ta', minVotes: 30 },
      { id: 'telugu', label: 'Telugu', icon: '🎞️', lang: 'te', minVotes: 30 },
      { id: 'malayalam', label: 'Malayalam', icon: '🎞️', lang: 'ml', minVotes: 30 },
      { id: 'kannada', label: 'Kannada', icon: '🎞️', lang: 'kn', minVotes: 30 },
      { id: 'korean', label: 'Korean', icon: '🇰🇷', lang: 'ko', minVotes: 100 },
      { id: 'japanese', label: 'Japanese', icon: '🇯🇵', lang: 'ja', minVotes: 100 },
      { id: 'chinese', label: 'Chinese', icon: '🇨🇳', lang: 'zh|cn', minVotes: 100 },
      { id: 'spanish', label: 'Spanish', icon: '🇪🇸', lang: 'es', minVotes: 100 },
      { id: 'french', label: 'French', icon: '🇫🇷', lang: 'fr', minVotes: 100 },
      { id: 'turkish', label: 'Turkish', icon: '🇹🇷', lang: 'tr', minVotes: 50 },
      { id: 'thai', label: 'Thai', icon: '🇹🇭', lang: 'th', minVotes: 50 },
    ],
  },
]

export const PRESETS = PRESET_GROUPS.flatMap(g => g.items)

export const GENRES = [
  { id: 28, label: 'Action' }, { id: 12, label: 'Adventure' }, { id: 16, label: 'Animation' },
  { id: 35, label: 'Comedy' }, { id: 80, label: 'Crime' }, { id: 99, label: 'Documentary' },
  { id: 18, label: 'Drama' }, { id: 10751, label: 'Family' }, { id: 14, label: 'Fantasy' },
  { id: 36, label: 'History' }, { id: 27, label: 'Horror' }, { id: 10402, label: 'Music' },
  { id: 9648, label: 'Mystery' }, { id: 10749, label: 'Romance' }, { id: 878, label: 'Sci-Fi' },
  { id: 53, label: 'Thriller' }, { id: 10752, label: 'War' }, { id: 37, label: 'Western' },
]

export const DECADES = [
  { id: '2020s', label: '2020s', from: 2020, to: 2029 },
  { id: '2010s', label: '2010s', from: 2010, to: 2019 },
  { id: '2000s', label: '2000s', from: 2000, to: 2009 },
  { id: '1990s', label: '1990s', from: 1990, to: 1999 },
  { id: '1980s', label: '1980s', from: 1980, to: 1989 },
  { id: 'classic', label: 'Classic', from: 1900, to: 1979 },
]

export const SORTS = [
  { id: 'popular', label: 'Most Popular', sortBy: 'popularity.desc' },
  { id: 'rated', label: 'Top Rated', sortBy: 'vote_average.desc' },
  { id: 'newest', label: 'Newest First', sortBy: 'primary_release_date.desc' },
]

const iso = d => d.toISOString().slice(0, 10)

export function getPreset(id) {
  return PRESETS.find(p => p.id === id) || PRESETS[0]
}

export function activeFilterCount(f) {
  return (f.genre ? 1 : 0) + (f.decade ? 1 : 0) + (f.mature ? 1 : 0)
}

export function describeFilters(f) {
  const parts = [getPreset(f.preset).label.replace('*', '')]
  if (f.mature) parts.push('18+')
  if (f.genre) parts.push(GENRES.find(g => g.id === f.genre)?.label)
  if (f.decade) parts.push(DECADES.find(d => d.id === f.decade)?.label)
  return parts.filter(Boolean).join(' · ')
}

// "18+" = mature-rated movies (NOT explicit adult films; include_adult stays false).
// Age-certification data differs per country, so pick the country that matches the language.
function matureCertification(preset) {
  const lang = preset.lang || ''
  if (/\b(bn|hi|ta|te|ml|kn)\b/.test(lang)) return { country: 'IN', certification: 'A' }
  if (lang === 'ko') return { country: 'KR', certification: '18' }
  return { country: 'US', gte: 'R' } // R and NC-17
}

export function buildDiscoverQuery(f) {
  const preset = getPreset(f.preset)
  const sort = SORTS.find(s => s.id === f.sort) || SORTS[0]
  const p = new URLSearchParams()
  p.set('sort_by', sort.sortBy)
  p.set('include_adult', 'false')
  if (preset.lang) p.set('with_original_language', preset.lang)
  if (f.genre) p.set('with_genres', String(f.genre))
  if (f.mature) {
    const c = matureCertification(preset)
    p.set('certification_country', c.country)
    if (c.certification) p.set('certification', c.certification)
    if (c.gte) p.set('certification.gte', c.gte)
  }

  // Only released movies; "Latest" = last 90 days; decade narrows further.
  const today = new Date()
  let lte = iso(today)
  let gte = null
  if (f.decade) {
    const d = DECADES.find(x => x.id === f.decade)
    if (d) {
      gte = `${d.from}-01-01`
      const end = `${d.to}-12-31`
      if (end < lte) lte = end
    }
  }
  if (preset.id === 'latest') {
    const from = new Date(today.getTime() - 90 * 86400000)
    const latestFrom = iso(from)
    if (!gte || latestFrom > gte) gte = latestFrom
  }
  p.set('primary_release_date.lte', lte)
  if (gte) p.set('primary_release_date.gte', gte)

  if (f.sort === 'rated') p.set('vote_count.gte', String(preset.minVotes || 200))
  else if (f.sort === 'newest') p.set('vote_count.gte', '3')
  return p.toString()
}
