import { describe, expect, it } from 'vitest'
import {
  dampenPullDistance,
  isAtScrollTop,
  isIgnoredPullTarget,
  isPullArmed,
  PULL_REFRESH_THRESHOLD_PX,
} from '@/lib/pullToRefresh'

describe('dampenPullDistance', () => {
  it('ignores upward movement', () => {
    expect(dampenPullDistance(-40)).toBe(0)
    expect(dampenPullDistance(0)).toBe(0)
  })

  it('scales down and caps pull', () => {
    expect(dampenPullDistance(50)).toBeLessThan(50)
    expect(dampenPullDistance(800)).toBe(112)
  })
})

describe('isPullArmed', () => {
  it('arms at the threshold', () => {
    expect(isPullArmed(PULL_REFRESH_THRESHOLD_PX - 1)).toBe(false)
    expect(isPullArmed(PULL_REFRESH_THRESHOLD_PX)).toBe(true)
  })
})

describe('isAtScrollTop', () => {
  it('treats missing or unstrolled scroller as top', () => {
    expect(isAtScrollTop(null)).toBe(true)
    const box = document.createElement('div')
    document.body.append(box)
    box.scrollTop = 0
    expect(isAtScrollTop(box)).toBe(true)
    box.scrollTop = 20
    expect(isAtScrollTop(box)).toBe(false)
    box.remove()
  })
})

describe('isIgnoredPullTarget', () => {
  it('ignores form fields and dialogs', () => {
    const input = document.createElement('input')
    document.body.append(input)
    expect(isIgnoredPullTarget(input)).toBe(true)

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const child = document.createElement('p')
    dialog.append(child)
    document.body.append(dialog)
    expect(isIgnoredPullTarget(child)).toBe(true)

    const plain = document.createElement('div')
    document.body.append(plain)
    expect(isIgnoredPullTarget(plain)).toBe(false)

    input.remove()
    dialog.remove()
    plain.remove()
  })
})
