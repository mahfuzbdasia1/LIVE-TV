// Shared by the server and the browser: turns a Jikan-style path into an
// AniList GraphQL request, and converts AniList's answer to Jikan's shape so
// the UI cards (title, images.jpg, score, year) work unchanged.

export function buildAnilistRequest(path) {
  const u = new URL(path, 'http://x')
  const limit = Math.min(Number(u.searchParams.get('limit')) || 24, 50)
  const page = Math.max(Number(u.searchParams.get('page')) || 1, 1)
  const search = u.searchParams.get('q')

  let args = 'sort: SCORE_DESC'
  if (u.pathname.startsWith('/seasons/now')) args = 'status: RELEASING, sort: POPULARITY_DESC'
  else if (search) args = 'search: $search, sort: SEARCH_MATCH'
  else if (!u.pathname.startsWith('/top/anime')) throw new Error('No fallback for this endpoint')

  // Only declare $search when it is used: GraphQL rejects unused variables.
  const decl = search ? '($search: String)' : ''
  const query = `query ${decl} { Page(page: ${page}, perPage: ${limit}) { pageInfo { hasNextPage } media(type: ANIME, isAdult: false, ${args}) { id idMal title { romaji english } coverImage { large extraLarge } averageScore seasonYear } } }`
  return { query, variables: search ? { search } : {} }
}

export function mapAnilistResponse(data) {
  const media = data?.data?.Page?.media
  if (!Array.isArray(media)) throw new Error(data?.errors?.[0]?.message || 'AniList returned no data')
  return {
    data: media.map(m => ({
      mal_id: m.idMal || m.id,
      title: m.title?.english || m.title?.romaji || 'Anime',
      images: { jpg: { image_url: m.coverImage?.large, large_image_url: m.coverImage?.extraLarge || m.coverImage?.large } },
      score: m.averageScore ? m.averageScore / 10 : null,
      year: m.seasonYear || null,
    })),
    pagination: { has_next_page: Boolean(data?.data?.Page?.pageInfo?.hasNextPage) },
    source: 'anilist',
  }
}
