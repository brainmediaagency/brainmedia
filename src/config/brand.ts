export const brandConfig = {
  productName: "B'rain Workspace",
  companyName: "B'rain Media Group",
  /** @deprecated Prefer logoPaths — kept for older call sites */
  logoPath: '/brand/brain-logo-blue.png',
  logoPaths: {
    /** Dark UI chrome in light theme (sidebar, login brand panel) */
    white: '/brand/brain-logo-white.png',
    /** Light UI primary mark */
    blue: '/brand/brain-logo-blue.png',
    /** Accent / light UI */
    orange: '/brand/brain-logo-orange.png',
    /** Neutral / light UI */
    gray: '/brand/brain-logo-gray.png',
    /** Electric-blue MEDIA lockup for dark theme (transparent PNG) */
    mediaBlue: '/brand/brain-logo-media-blue.png',
    /** Footer lockup on light surfaces */
    mediaFooter: '/brand/brain-logo-media-footer.png',
    favicon: '/brand/brain-favicon.png',
  },
  tagline: 'Ekip, operasyon ve iş süreçleri tek merkezde.',
  website: 'https://www.brainmedya.com',
  supportEmail: 'destek@brainmedya.com',
  timezone: 'Europe/Istanbul' as const,
} as const

export type BrandConfig = typeof brandConfig
export type BrandLogoVariant = keyof typeof brandConfig.logoPaths
