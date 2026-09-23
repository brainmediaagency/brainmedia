import { describe, expect, it } from 'vitest'
import {
  isIosNonSafariBrowser,
  IOS_PUSH_SETUP_HINT,
  onesignalBannerDismissKey,
  ONESIGNAL_BANNER_DISMISS_ENABLE,
  ONESIGNAL_BANNER_DISMISS_HINT,
} from '@/lib/onesignal'

describe('isIosNonSafariBrowser', () => {
  it('treats Chrome/Firefox/in-app iOS as blocked', () => {
    expect(
      isIosNonSafariBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true)
    expect(
      isIosNonSafariBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/129.0 Mobile/15E148 Safari/605.1.15',
      ),
    ).toBe(true)
    expect(
      isIosNonSafariBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram',
      ),
    ).toBe(true)
  })

  it('allows Safari on iPhone', () => {
    expect(
      isIosNonSafariBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false)
  })
})

describe('onesignalBannerDismissKey', () => {
  it('keeps A2HS hint dismiss separate from PWA enable prompt', () => {
    expect(onesignalBannerDismissKey('homescreen-hint')).toBe(
      ONESIGNAL_BANNER_DISMISS_HINT,
    )
    expect(onesignalBannerDismissKey('enable')).toBe(
      ONESIGNAL_BANNER_DISMISS_ENABLE,
    )
    expect(onesignalBannerDismissKey('homescreen-hint')).not.toBe(
      onesignalBannerDismissKey('enable'),
    )
  })
})

describe('iOS push copy', () => {
  it('does not send users to Settings as an App Store app', () => {
    expect(IOS_PUSH_SETUP_HINT).toMatch(/Yer imi/)
    expect(IOS_PUSH_SETUP_HINT).toMatch(/Ana Ekrana Ekle/)
    expect(IOS_PUSH_SETUP_HINT).toMatch(/Ayarlar/)
  })
})
