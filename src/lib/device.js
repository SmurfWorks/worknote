export function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function isIos() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iPhone = /iPad|iPhone|iPod/i.test(ua)
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iPhone || iPadOs
}

export function isMobileDevice() {
  return isAndroid() || isIos()
}

export function shouldCapturePcm() {
  return isAndroid() && !/Firefox/i.test(navigator.userAgent)
}