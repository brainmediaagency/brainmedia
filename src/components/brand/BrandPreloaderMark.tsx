import { BrandLogo } from '@/components/brand/BrandLogo'

export function BrandPreloaderMark() {
  return (
    <div className="route-preloader__spinner-wrap">
      <div className="route-preloader__logo">
        <BrandLogo
          variant="white"
          themeAdaptive={false}
          className="h-auto w-[75%] max-w-[140px]"
        />
      </div>
      <div className="route-preloader__spinner" aria-hidden="true" />
    </div>
  )
}
