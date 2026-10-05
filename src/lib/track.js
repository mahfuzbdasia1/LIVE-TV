// Sob event ei ekta function diye GTM e jabe
export function trackEvent(event, params = {}) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...params })
}