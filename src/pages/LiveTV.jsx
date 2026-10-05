import React, { useEffect, useRef, useState } from 'react'
import styles from './LiveTV.module.css'
import { trackEvent } from '../lib/track.js'

// Add or replace streamingUrl values here when the channel streams are ready.
export const channels = [
  { name: 'SPORTS 1', logo: 'Sports', streamingUrl: 'https://s2.bufaloweb.com/bufalo9/tracks-v4a1/mono.ts.m3u8' },
  { name: 'SPORTS 2', logo: 'Sports', streamingUrl: 'https://bein-esp-xumo.amagi.tv/playlistR720P.m3u8' },
  { name: 'SPORTS 3', logo: 'Sports', streamingUrl: 'https://amg01334-amg01334c2-freelivesports-emea-6791.playouts.now.amagi.tv/playlist/amg01334-beinxtra-beinxtrausapp-freelivesportsemea/playlist.m3u8' },
  { name: 'SPORTS 4', logo: 'Sports', streamingUrl: 'https://channel01-onlymex.akamaized.net/hls/live/2022749/event01/index.m3u8' },
  { name: 'SPORTS 5', logo: 'Sports', streamingUrl: 'https://tv.cdn.xsg.ge/gpb-2tv/index.m3u8' },
  { name: 'SPORTS 6', logo: 'Sports', streamingUrl: 'https://tv.cdn.xsg.ge/gpb-2tv/tracks-v1a1/mono.ts.m3u8' },
  { name: 'SPORTS 7', logo: 'Sports', streamingUrl: 'https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/manifest/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/bfc6a36e-c250-4afe-b6c9-2bc57855bb7d/4.m3u8' },
  { name: 'G-TV', logo: 'G-TV', streamingUrl: 'https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/gazibdz.stream/live-orgin/gazibdz.stream/playlist.m3u8' },
  { name: 'Peace-TV', logo: 'RH', streamingUrl: 'https://livestream.peacetv.tv/live/english.smil/playlist.m3u8' },
  { name: 'ATN-BANGLA', logo: 'ATN-BANGLA', streamingUrl: 'https://tvsen5.aynascope.net/atnbangla/tracks-v1a1/mono.ts.m3u8' },
  { name: 'ANANDA-TV', logo: 'ANANDA-TV', streamingUrl: 'https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/anandatv.stream/live-orgin/anandatv.stream/playlist.m3u8' },
  { name: 'R-TV', logo: 'R-TV', streamingUrl: 'https://tvsen5.aynascope.net/RtvHD/tracks-v1a1/mono.ts.m3u8' },
  { name: 'CHANNEL 1', logo: 'Channel 1', streamingUrl: 'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDEEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFseWRtaW51aiPhnPTI2/channel1bd.stream/tracks-v1a1/mono.m3u8' },
  { name: 'S-TV', logo: 'S-TV', streamingUrl: 'https://app.ncare.live/live-orgin/channels.stream/live-orgin/channels.stream/chunks.m3u8' },
  { name: 'THIKANA-TV', logo: 'THIKANA-TV', streamingUrl: 'https://5dd3981940faa.streamlock.net/thikanatv/thikanatv/chunklist_w613464167.m3u8' },
  { name: 'DIPTO-TV', logo: 'DIPTO-TV', streamingUrl: 'https://byphdgllyk.gpcdn.net/hls/deeptotv/0_1/index.m3u8' },
  { name: 'GLOBAL-TV', logo: 'GLOBAL-TV', streamingUrl: 'https://app24.jagobd.com.bd/c3VydmVyX8RpbEU9Mi8xNy8yMFDEEHGcfRgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcEdsEfeDeKiNkVN3PTOmdFseWRtaW51aiPhnPTI2/Global-tv.stream/tracks-v1a1/mono.m3u8' },
  { name: 'MASRANGA-TV', logo: 'MASrANGA-TV', streamingUrl: 'https://tvsen5.aynascope.net/maasrangatv/tracks-v1a1/mono.ts.m3u8' },
  { name: 'MOHONA-TV', logo: 'MOHONA-TV', streamingUrl: '' },    
  { name: 'MY-TV', logo: 'MY-TV', streamingUrl: 'https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/mytv-up-off.stream/live-orgin/mytv-up-off.stream/playlist.m3u8' },
  { name: 'MASRANGA-TV', logo: 'MASrANGA-TV', streamingUrl: '' },
  { name: 'MASRANGA-TV', logo: 'MASrANGA-TV', streamingUrl: '' },
]



export default function LiveTV() {
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [playbackError, setPlaybackError] = useState(false)
  const playerRef = useRef(null)

  useEffect(() => {
    if (!selectedChannel?.streamingUrl || !playerRef.current) return
    const video = playerRef.current
    video.load()
    video.play().catch(() => {})
  }, [selectedChannel])

  function selectChannel(channel) {
    setPlaybackError(false)
    setSelectedChannel(channel)
    requestAnimationFrame(() => {
      document.getElementById('live-tv-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className={styles.page}>
      <section className={styles.playerSection} id="live-tv-player">
        <div className={styles.playerHeader}>
          <div>
            <p className={styles.eyebrow}>Live television</p>
            <h1 className={styles.heading}>{selectedChannel?.name || 'Choose a channel'}</h1>
          </div>
          {selectedChannel && <span className={styles.liveBadge}><span /> LIVE</span>}
        </div>
        <div className={styles.playerFrame}>
          {selectedChannel?.streamingUrl ? (
            <video
              ref={playerRef}
              className={styles.video}
              src={selectedChannel.streamingUrl}
              controls
              autoPlay
              playsInline
              onError={() => setPlaybackError(true)}
            />
          ) : (
            <div className={styles.emptyPlayer}>
              <div className={styles.emptyMark}>{selectedChannel?.logo || 'TV'}</div>
              <p>{selectedChannel ? 'This channel is ready for your stream URL.' : 'Select a channel below to start watching.'}</p>
              {playbackError && <span className={styles.error}>The stream could not be loaded.</span>}
            </div>
          )}
        </div>
      </section>

      <div className={styles.listHeader}>
        <div>
          <p className={styles.eyebrow}>Browse channels</p>
          <h2 className={styles.listTitle}>Live TV guide</h2>
        </div>
        <span className={styles.channelCount}>{channels.length} channels</span>
      </div>

      <div className={styles.channelGrid}>
        {channels.map(channel => (
          <button
            key={channel.name}
            className={`${styles.channelCard} ${selectedChannel?.name === channel.name ? styles.selected : ''}`}
            onClick={() => selectChannel(channel)}
          >
            <span className={styles.logo}>{channel.logo}</span>
            <span className={styles.channelInfo}>
              <span className={styles.channelName}>{channel.name}</span>
              <span className={styles.channelStatus}>{channel.streamingUrl ? 'Available now' : 'Stream coming soon'}</span>
            </span>
            <span className={styles.playIcon}>▶</span>
          </button>
        ))}
      </div>
    </div>
  )
}