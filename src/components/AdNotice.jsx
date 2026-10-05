import React from 'react'
import styles from './AdNotice.module.css'

// Edit these lines to change the scrolling message.
const MESSAGES = [
  '💛 বিজ্ঞাপনের জন্য আমরা আন্তরিকভাবে দুঃখিত — সাইটটি সবার জন্য ফ্রি রাখতে বিজ্ঞাপন দেখাতে হচ্ছে।',
  '🙏 আপনার ধৈর্য ও ভালোবাসার জন্য অসংখ্য ধন্যবাদ — আপনি পাশে আছেন বলেই আমরা এগিয়ে যেতে পারছি।',
  '💛 We are sincerely sorry for the ads — they help us keep Cinescope free for everyone.',
]

// Right-to-left scrolling top bar. The list is rendered twice so the loop is seamless.
export default function AdNotice() {
  const track = MESSAGES.map((m, i) => (
    <span key={i} className={styles.item}>{m}<i className={styles.dot} aria-hidden="true">✦</i></span>
  ))
  return (
    <div className={styles.bar} role="status" aria-label={MESSAGES.join(' ')}>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.group}>{track}</div>
        <div className={styles.group}>{track}</div>
      </div>
    </div>
  )
}
