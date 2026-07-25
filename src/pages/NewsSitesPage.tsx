import { Download, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  NEWS_SITE_LINKS,
  NEWS_SITES_HERO_SRC,
  NEWS_SITE_PROJECTS,
} from '@/config/newsSites'

export function NewsSitesPage() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <PageHeader
        title="Projelerimiz"
        subtitle="B’rain Medya Produksiyon haber ağı — marka vitrini ve yayın siteleri."
      />

      <section aria-label="Tasarım vitrini" className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-md)]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.12),transparent_55%)]"
            aria-hidden="true"
          />
          <div className="relative p-3 sm:p-5 md:p-6">
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-border/80 bg-surface-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <img
                src={NEWS_SITES_HERO_SRC}
                alt="B’rain Medya Produksiyon haber ağı tasarım panosu"
                className="block h-auto w-full object-contain"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="news-sites-grid-title" className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="news-sites-grid-title"
              className="font-display text-lg font-semibold text-text-primary sm:text-xl"
            >
              Haber Sitelerimiz
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Logoya tıklayarak ilgili haber sitesini açabilirsiniz.
            </p>
          </div>
          <p className="text-xs tabular-nums text-text-secondary">
            {NEWS_SITE_LINKS.length} site
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {NEWS_SITE_LINKS.map((site) => (
            <li key={site.id}>
              <a
                href={site.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${site.name} — ${site.label}`}
                className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-xs)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40"
              >
                <div className="relative flex aspect-[16/10] items-center justify-center bg-surface-muted p-2 sm:p-2.5">
                  <img
                    src={site.logoSrc}
                    alt=""
                    className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <span className="absolute right-2 top-2 rounded-full bg-surface/90 p-1 text-text-secondary opacity-0 shadow-[var(--shadow-xs)] transition-opacity group-hover:opacity-100">
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-0.5 border-t border-border/70 px-2.5 py-2.5">
                  <span className="text-center text-xs font-semibold leading-snug text-text-primary">
                    {site.name}
                  </span>
                  <span className="break-all text-center text-[10px] leading-snug text-text-secondary sm:text-[11px]">
                    {site.label}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="news-projects-title" className="space-y-4">
        <div>
          <h2
            id="news-projects-title"
            className="font-display text-lg font-semibold text-text-primary sm:text-xl"
          >
            Projelerimiz
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Proje kapağı ve sunum indirme.
          </p>
        </div>

        <ul className="space-y-4">
          {NEWS_SITE_PROJECTS.map((project) => (
            <li key={project.id} className="max-w-xl">
              <a
                href={project.pdfHref}
                download={project.pdfFileName}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${project.title} PDF indir`}
                className="group relative block h-[140px] overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-xs)] transition-all duration-200 hover:border-brand-cyan/40 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40 sm:h-[160px]"
              >
                <img
                  src={project.coverSrc}
                  alt={`${project.title} kapak`}
                  className="h-full w-full object-cover object-left transition-transform duration-200 group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-brand-navy/85 to-transparent px-3 pb-2.5 pt-8 text-xs font-medium text-white">
                  <span className="truncate">{project.title}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-2 py-1 backdrop-blur-sm">
                    <Download className="size-3.5" aria-hidden="true" />
                    PDF
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
