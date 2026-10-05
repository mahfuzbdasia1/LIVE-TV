# Cinescope

Netflix-style entertainment frontend for Movies, TV Shows, Anime, Live TV, Marvel Comics and Games.

## Security architecture

Third-party API credentials are **server-only**. React never imports API keys and all third-party requests go through `/api/proxy`.

Protected integrations:

- TMDB — movies and TV
- TheTVDB — series/episode data
- Jikan — anime, no API key required
- AniList — anime GraphQL, no API key required
- OMDb — IMDb / Rotten Tomatoes / Metascore / awards shown on the player, requires `OMDB_KEY` (optional)
- RAWG — games, requires `RAWG_KEY`
- Marvel — comics/characters, requires `MARVEL_PUBLIC_KEY` + `MARVEL_PRIVATE_KEY`
- Codespecters — existing movie/TV embed, server-side key
- Simkl — trending + search for movies/TV/anime, requires `SIMKL_CLIENT_ID` (optional)
- TasteDive — "More like this" / "Because you watched", requires `TASTEDIVE_KEY` (optional)
- Watchmode — "Also available on" streaming services + "New on Streaming", requires `WATCHMODE_KEY` (optional)

### How the extra APIs work together (no duplicates)

`server/providers.js` merges TMDB + Simkl + Watchmode (movies/TV) and Jikan + AniList + Simkl (anime).
Every title is resolved to a TMDB id (or MAL id for anime) and `shared/merge.js` keeps one entry per
title (same id, or same normalized title + year). The home page also removes a title from later rows
when an earlier row already shows it. A missing key or a failing API is simply skipped.

The server also has a basic IP rate limit and endpoint allowlist.

## Environment variables

Copy `.env.example` to `.env` and fill in your credentials. Do not use the `VITE_` prefix for server secrets.

```bash
TMDB_KEY=...
TVDB_KEY=...
TVDB_PIN=
EMBED_API_KEY=...
OMDB_KEY=...
RAWG_KEY=...
MARVEL_PUBLIC_KEY=...
MARVEL_PRIVATE_KEY=...
SIMKL_CLIENT_ID=...
TASTEDIVE_KEY=...
WATCHMODE_KEY=...
WATCHMODE_REGION=US
```

If RAWG or Marvel credentials are missing, those sections show a configuration message instead of exposing or inventing credentials.

## Local development

```bash
npm install
npm run dev
```

This starts the API server on port `8787` and Vite on its normal development port.

## Production / Vercel

Deploy the project as a normal Vite app. Vercel will detect `api/proxy.js` as a serverless function. Add the same environment variables in the Vercel project settings.

Do **not** commit `.env`.

## Important

No browser-side implementation can make a credential literally impossible to observe if that credential is sent to the browser. This project avoids that problem by keeping the credentials on the server and never returning them to React.


## API diagnostics

Open `/api/health` after starting the app. It reports only whether server-side credentials are configured; it never returns the actual keys.

Examples:
- `http://localhost:5173/api/health`
- `http://localhost:8787/api/health`

For a local setup, make sure `.env` exists beside `package.json` and restart the server after editing it.
