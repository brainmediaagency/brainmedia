export type NewsSiteLink = {
  id: string
  label: string
  href: string
  logoSrc: string
  name: string
}

/** Haber ağı siteleri ve logoları. */
export const NEWS_SITE_LINKS: NewsSiteLink[] = [
  {
    id: '1',
    name: 'Memleket Haberleri',
    label: 'www.memlekethaberleri.com',
    href: 'https://www.memlekethaberleri.com',
    logoSrc: '/news-sites/logos/memlekethaberleri.png',
  },
  {
    id: '2',
    name: 'Magazin Bülteni',
    label: 'www.magazinbultenleri.com',
    href: 'https://www.magazinbultenleri.com',
    logoSrc: '/news-sites/logos/magazinbultenleri.png',
  },
  {
    id: '3',
    name: 'Haber Grubu',
    label: 'www.habergrubu.com',
    href: 'https://www.habergrubu.com',
    logoSrc: '/news-sites/logos/habergrubu.png',
  },
  {
    id: '4',
    name: 'Anadolu Haberleri',
    label: 'www.anadoluhanerleri.org',
    href: 'https://www.anadoluhanerleri.org',
    logoSrc: '/news-sites/logos/anadoluhaberleri.png',
  },
  {
    id: '5',
    name: 'Doğru Haberler',
    label: 'www.dogruhaberler.com',
    href: 'https://www.dogruhaberler.com',
    logoSrc: '/news-sites/logos/dogruhaberler.png',
  },
  {
    id: '6',
    name: 'Fenomen Haberler',
    label: 'www.fenomenhaberler.com',
    href: 'https://www.fenomenhaberler.com',
    logoSrc: '/news-sites/logos/fenomenhaberler.png',
  },
  {
    id: '7',
    name: 'Finansal Merkez Haber',
    label: 'www.finansalmerkezhaber.com',
    href: 'https://www.finansalmerkezhaber.com',
    logoSrc: '/news-sites/logos/finansalmerkezhaber.png',
  },
  {
    id: '8',
    name: 'MB Haber',
    label: 'www.haberplus81.com',
    href: 'https://www.haberplus81.com',
    logoSrc: '/news-sites/logos/haberplus81.png',
  },
  {
    id: '9',
    name: 'Show Haberler',
    label: 'www.showhaberler.com',
    href: 'https://www.showhaberler.com',
    logoSrc: '/news-sites/logos/showhaberler.png',
  },
  {
    id: '10',
    name: '81 İl Haberi',
    label: 'www.81ilhaberi.com',
    href: 'https://www.81ilhaberi.com',
    logoSrc: '/news-sites/logos/81ilhaberi.png',
  },
  {
    id: '11',
    name: 'Ulusal Merkez Haberler',
    label: 'www.ulusalmerkezhaberler.com',
    href: 'https://www.ulusalmerkezhaberler.com',
    logoSrc: '/news-sites/logos/ulusalmerkezhaberler.png',
  },
  {
    id: '12',
    name: 'Zirve Haberler',
    label: 'www.zirvehaberler.com',
    href: 'https://www.zirvehaberler.com',
    logoSrc: '/news-sites/logos/zirvehaberler.png',
  },
  {
    id: '13',
    name: 'Merkezi Haberler',
    label: 'www.merkezihaberler.com',
    href: 'https://www.merkezihaberler.com',
    logoSrc: '/news-sites/logos/merkezihaberler.png',
  },
  {
    id: '14',
    name: 'Öncü Haberler',
    label: 'www.oncuhaberler.com',
    href: 'https://www.oncuhaberler.com',
    logoSrc: '/news-sites/logos/oncuhaberler.png',
  },
  {
    id: '15',
    name: 'Sektör Öncüleri',
    label: 'www.sektoronculeri.com',
    href: 'https://www.sektoronculeri.com',
    logoSrc: '/news-sites/logos/sektoronculeri.png',
  },
]

export const NEWS_SITES_HERO_SRC = '/news-sites/hero.png'

export const DAVETSIZ_MISAFIR_TEYIT_YONERGESI = `Teyit Yönergesi

Güvenliğiniz ve teyit işlemleriniz için, Show TV resmî internet sitesini ziyaret ederek Künye bölümünde yer alan iletişim numarasını arayabilirsiniz.

Santral üzerinden Davetsiz Misafir program yapımcısına bağlanma talebinizi ilettiğinizde, tarafınıza ulaşan şirket telefon numaralarını ve ekip personelimizin ad-soyad bilgilerini paylaşarak gerekli doğrulama işlemlerini güvenle gerçekleştirebilirsiniz.`

export const NEWS_SITE_PROJECTS = [
  {
    id: 'davetsiz-misafir-2026',
    title: 'Davetsiz Misafir',
    description: '2026 güncel sunum dosyası',
    coverSrc: '/news-sites/davetsiz-misafir-cover.png',
    pdfHref: '/news-sites/davetsiz-misafir-2026.pdf',
    pdfFileName: 'Davetsiz-Misafir-Sunu-2026.pdf',
  },
] as const

