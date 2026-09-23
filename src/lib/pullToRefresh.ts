export const PULL_REFRESH_THRESHOLD_PX = 72
export const PULL_REFRESH_MAX_PX = 112

const IGNORE_SELECTOR =
  'input, textarea, select, option, [contenteditable="true"], canvas, [role="dialog"], [data-no-pull-refresh]'

export function dampenPullDistance(rawDeltaY: number): number {
  if (rawDeltaY <= 0) return 0
  return Math.min(PULL_REFRESH_MAX_PX, rawDeltaY * 0.42)
}

export function isPullArmed(distancePx: number): boolean {
  return distancePx >= PULL_REFRESH_THRESHOLD_PX
}

export function isIgnoredPullTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(IGNORE_SELECTOR) !== null
}

export function canScrollVertically(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el)
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') {
    return false
  }
  return el.scrollHeight > el.clientHeight + 1
}

export function findVerticalScrollParent(
  start: EventTarget | null,
): HTMLElement | null {
  let el: Element | null = start instanceof Element ? start : null
  while (el) {
    if (el instanceof HTMLElement && canScrollVertically(el)) return el
    el = el.parentElement
  }
  const root = document.scrollingElement
  return root instanceof HTMLElement ? root : document.documentElement
}

export function isAtScrollTop(el: HTMLElement | null): boolean {
  if (!el) return true
  return el.scrollTop <= 1
}
