import React, { useState } from 'react'
import { trackEvent } from './lib/track.js'

class TabBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.error('Tab crashed:', err) }
  render() {
    if (!this.state.failed) return this.props.children
    return <div style={{ padding: 40, textAlign: 'center' }}><p>Something went wrong on this page.</p><button onClick={() => { sessionStorage.removeItem('cs_tab'); this.props.onReset() }}>Back to Home</button></div>
  }
}

import Movies from './pages/Movies.jsx'
import TV from './pages/TV.jsx'
import LiveTV from './pages/LiveTV.jsx'
import Home from './pages/Home.jsx'
import Anime from './pages/Anime.jsx'
import Games from './pages/Games.jsx'
import Comics from './pages/Comics.jsx'
import AdNotice from './components/AdNotice.jsx'
import { movieEmbedUrl, formatRating, getYear } from './lib/api.js'
import styles from './App.module.css'

function clearMovieSession() { ['mv_query','mv_player'].forEach(k => sessionStorage.removeItem(k)) }

export default function App() {
  const [tab,setTab]=useState(()=>sessionStorage.getItem('cs_tab')||'home')
  const [homeKey,setHomeKey]=useState(0)
  function goTab(t){
  setTab(t);
  sessionStorage.setItem('cs_tab',t);
  window.scrollTo({top:0,behavior:'smooth'})
  trackEvent('tab_view', { tab_name: t })
}
  function goHome(){clearMovieSession();goTab('home');setHomeKey(k=>k+1)}
  function playMovie(item){
    const p={src:movieEmbedUrl(item.id),title:item.title,year:getYear(item.release_date),rating:formatRating(item.vote_average),overview:item.overview?.slice(0,220),selectedId:item.id,mediaKind:'movie',tmdbId:item.id}
    sessionStorage.setItem('mv_player',JSON.stringify(p)); sessionStorage.removeItem('mv_query'); goTab('movies')
  }
  const nav=[['home','Home'],['movies','Movies'],['tv','TV Shows'],['anime','Anime'],['live','Live TV'],['comics','Marvel'],['games','Games']]
  return <div className={styles.app}>
    <AdNotice/>
    <header className={styles.header}>
      <button className={styles.logo} onClick={goHome}><span>CINE</span>scope</button>
      <nav className={styles.tabs}>{nav.map(([id,label])=><button key={id} className={`${styles.tab} ${tab===id?styles.active:''}`} onClick={()=>goTab(id)}>{label}</button>)}</nav>
      <button className={styles.searchButton} onClick={()=>goTab('movies')} aria-label="Search">⌕</button>
    </header>
    <main className={styles.main}>
      <TabBoundary key={tab} onReset={goHome}>
      {tab==='home'&&<Home key={homeKey} goTab={goTab} playMovie={playMovie}/>} 
      {tab==='movies'&&<Movies/>}
      {tab==='tv'&&<TV/>}
      {tab==='anime'&&<Anime/>}
      {tab==='live'&&<LiveTV/>}
      {tab==='comics'&&<Comics/>}
      {tab==='games'&&<Games/>}
      </TabBoundary>
    </main>
    <footer className={styles.footer}><p>© {new Date().getFullYear()} Cinescope · Entertainment discovery platform</p><p className={styles.footerNote}>Movie and TV metadata powered by TMDB, Simkl and TasteDive. Streaming availability by Watchmode. Anime discovery uses Jikan/AniList/Simkl. Third-party API credentials remain server-side.</p></footer>
  </div>
}
