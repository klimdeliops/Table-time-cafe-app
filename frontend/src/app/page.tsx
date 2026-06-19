'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/shared/api/client';
import { useLocale } from '@/hooks/useLocale';
import { formatRubles } from '@/lib/formatters';

interface Dish {
  id: string;
  name: string;
  price: string;
  category: string;
  isAvailable: boolean;
}

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

export default function HomePage() {
  return (
    <div className="-mt-[68px]">
      <Hero />
      <Features />
      <Gallery />
      <MenuPreview />
      <CTA />
      <Footer />
    </div>
  );
}

function Hero() {
  const { t } = useLocale();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* Blurred background photo */}
      <div className="absolute inset-0" aria-hidden>
        <Image
          src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1920&h=1080&fit=crop&q=80"
          alt=""
          fill
          priority
          className="object-cover scale-[1.07]"
          style={{ filter: 'blur(5px)' }}
        />
        {/* Espresso film overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(60,30,20,0.60)' }}
        />
      </div>

      {/* Glass content card */}
      <div
        className="relative z-10 rounded-3xl w-full mx-4 sm:mx-auto px-8 sm:px-10 py-10 sm:py-14 text-center"
        style={{
          maxWidth: '720px',
          backdropFilter: 'blur(22px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
          background: 'rgba(252,249,234,0.36)',
          border: '1px solid rgba(255,255,255,0.38)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.38), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.30)',
        }}
      >
        {/* Tagline pill */}
        <div className="inline-flex mb-7 animate-fade-in" style={{ animationDelay: '0s' }}>
          <span
            className="text-[11px] font-bold tracking-[0.24em] uppercase px-4 py-1.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.30)',
              color: '#FCF9EA',
            }}
          >
            {t('landing.tagline')}
          </span>
        </div>

        <h1
          className="text-[2.4rem] sm:text-[3.2rem] md:text-[3.8rem] font-semibold leading-[1.14] md:leading-[1.08] tracking-[-0.02em] text-white mb-5 animate-fade-up"
          style={{ animationDelay: '0.08s' }}
        >
          {t('landing.heroTitle')}
        </h1>

        <p
          className="text-base sm:text-[1.05rem] leading-relaxed mb-10 mx-auto text-white/80 animate-fade-up"
          style={{ animationDelay: '0.17s', maxWidth: '54ch' }}
        >
          {t('landing.heroSub')}
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-up"
          style={{ animationDelay: '0.25s' }}
        >
          <Link
            href="/menu"
            className="btn-amber inline-flex items-center justify-center px-7 py-3.5 rounded-2xl text-sm font-semibold w-full sm:w-auto"
          >
            {t('landing.viewMenu')}
          </Link>
          <Link
            href="/tables"
            className="inline-flex items-center justify-center px-7 py-3.5 rounded-2xl text-sm font-semibold w-full sm:w-auto transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: 'rgba(252,249,234,0.18)',
              border: '1px solid rgba(255,255,255,0.30)',
              color: '#FCF9EA',
            }}
          >
            {t('landing.reserve')}
          </Link>
        </div>
      </div>

      {/* Fade to cream at bottom */}
      <div
        className="absolute bottom-0 inset-x-0 h-80 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(252,249,234,0.08) 28%, rgba(252,249,234,0.32) 52%, rgba(252,249,234,0.68) 72%, rgba(252,249,234,0.90) 87%, #FCF9EA 100%)' }}
      />
    </section>
  );
}

const FEATURE_ICONS = {
  seasonal: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-9m0 0C12 8 9 5 5 4c0 5 3 8 7 9zm0 0c0-5 3-8 7-9-4 1-7 4-7 9z" />
    </svg>
  ),
  decor: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14.5" />
    </svg>
  ),
  reserve: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
} as const;

function Features() {
  const { t } = useLocale();
  const { ref, visible } = useInView();

  const features: { key: keyof typeof FEATURE_ICONS; titleKey: string; bodyKey: string }[] = [
    { key: 'seasonal', titleKey: 'landing.features.seasonal', bodyKey: 'landing.features.seasonalDesc' },
    { key: 'decor',    titleKey: 'landing.features.decor',    bodyKey: 'landing.features.decorDesc'    },
    { key: 'reserve',  titleKey: 'landing.features.reserve',  bodyKey: 'landing.features.reserveDesc'  },
  ];

  return (
    <section className="relative py-40 overflow-hidden" style={{ background: 'linear-gradient(180deg, #FCF9EA 0%, #FCF9EA 55%, rgba(174,183,132,0.18) 70%, rgba(174,183,132,0.52) 84%, rgba(174,183,132,0.80) 93%, #AEB784 100%)' }}>
      <div ref={ref} className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Section header */}
        <div
          className={`max-w-xl mb-14 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <p
            className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3"
            style={{ color: '#FFA239' }}
          >
            {t('landing.aboutTag')}
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold leading-[1.2] tracking-tight text-brand-espresso">
            {t('landing.aboutTitle')}
          </h2>
          <p className="mt-4 leading-relaxed text-brand-espresso/70">
            {t('landing.aboutDesc')}
          </p>
        </div>

        {/* Feature cards — 3-col from sm (640px) upward */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {features.map(({ key, titleKey, bodyKey }, i) => (
            <div
              key={key}
              className={`rounded-2xl p-7 group cursor-default transition-all duration-500 hover:-translate-y-2 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{
                transitionDelay: visible ? `${i * 80 + 140}ms` : '0ms',
                backdropFilter: 'blur(20px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
                background: 'rgba(252,249,234,0.26)',
                border: '1px solid rgba(255,255,255,0.32)',
                boxShadow: '0 8px 28px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.42)',
              }}
            >
              {/* Icon badge */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 flex-shrink-0"
                style={{ background: 'rgba(255,162,57,0.11)', color: '#FFA239' }}
              >
                {FEATURE_ICONS[key]}
              </div>

              {/* Expanding accent line */}
              <div
                className="h-0.5 rounded-full mb-4 transition-all duration-300 group-hover:w-12"
                style={{ width: '2rem', background: '#FFA239' }}
              />

              <h3 className="text-base font-semibold text-brand-espresso mb-2">
                {t(titleKey)}
              </h3>
              <p className="text-sm leading-relaxed text-brand-espresso/70">
                {t(bodyKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const GALLERY_PHOTOS = [
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1481833761820-0509d3217039?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&h=400&fit=crop&q=80',
];

function Gallery() {
  const { t } = useLocale();
  const { ref, visible } = useInView(0.08);

  return (
    <section
      className="relative py-40 overflow-hidden"
      style={{ background: '#AEB784' }}
    >
      {/* Ambient blurred gradient blobs */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          style={{
            position: 'absolute', top: '-15%', left: '-8%',
            width: '55%', height: '55%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)',
            filter: 'blur(72px)',
          }}
        />
        <div
          style={{
            position: 'absolute', bottom: '-12%', right: '-6%',
            width: '48%', height: '48%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(75,46,43,0.14) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute', top: '38%', left: '30%',
            width: '40%', height: '40%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,162,57,0.12) 0%, transparent 70%)',
            filter: 'blur(56px)',
          }}
        />
      </div>

      <div ref={ref} className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">

        {/* Section header */}
        <div
          className={`mb-12 text-center transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <p
            className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3"
            style={{ color: 'rgba(255,255,255,0.72)' }}
          >
            {t('landing.galleryTag')}
          </p>
          <h2
            className="text-3xl sm:text-4xl font-semibold tracking-tight"
            style={{ color: 'rgba(255,255,255,0.93)' }}
          >
            {t('landing.galleryTitle')}
          </h2>
        </div>

        {/* 3 × 2 photo grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GALLERY_PHOTOS.map((src, i) => (
            <div
              key={i}
              className={`relative overflow-hidden rounded-2xl group transition-all duration-500 hover:-translate-y-1.5 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{
                transitionDelay: visible ? `${i * 65}ms` : '0ms',
                height: '224px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.12)',
              }}
            >
              <Image
                src={src}
                alt={`Table & Time — фото ${i + 1}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              {/* Gradient vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 55%)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade to MenuPreview */}
      <div
        className="absolute bottom-0 inset-x-0 h-72 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(248,245,228,0.10) 30%, rgba(248,245,228,0.35) 55%, rgba(248,245,228,0.68) 74%, rgba(248,245,228,0.90) 88%, #F8F5E4 100%)' }}
      />
    </section>
  );
}

function MenuPreview() {
  const { t } = useLocale();
  const { ref, visible } = useInView();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    apiFetch<Dish[]>('/api/menu')
      .then((all) => setDishes(all.filter((d) => d.isAvailable).slice(0, 6)))
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section className="relative pt-40 pb-72 bg-[#F8F5E4]">
      <div ref={ref} className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div
          className={`flex items-end justify-between mb-10 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div>
            <p
              className="text-[11px] font-bold tracking-[0.22em] uppercase mb-2"
              style={{ color: '#FFA239' }}
            >
              {t('landing.menuTag')}
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-brand-espresso">
              {t('landing.menuTitle')}
            </h2>
          </div>
          <Link
            href="/menu"
            className="hidden sm:inline-block text-sm font-medium transition-colors duration-150 hover:opacity-70"
            style={{ color: '#FFA239', borderBottom: '1px solid rgba(255,162,57,0.35)', paddingBottom: '1px' }}
          >
            {t('landing.menuMore')}
          </Link>
        </div>

        {/* Loading skeleton */}
        {!loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[54px] rounded-xl bg-brand-espresso/10 animate-pulse" />
            ))}
          </div>
        )}

        {/* Dish cards */}
        {loaded && !loadError && dishes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dishes.map((dish, i) => (
              <div
                key={dish.id}
                className={`rounded-xl px-5 py-4 flex items-center justify-between gap-4 transition-all duration-300 hover:-translate-y-0.5 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
                style={{
                  transitionDelay: `${i * 50}ms`,
                  backdropFilter: 'blur(16px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                  background: 'rgba(252,249,234,0.26)',
                  border: '1px solid rgba(255,255,255,0.32)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.38)',
                }}
              >
                <span className="text-sm font-medium text-brand-espresso truncate">
                  {dish.name}
                </span>
                <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: '#FFA239' }}>
                  {formatRubles(dish.price)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty / error state */}
        {loaded && (loadError || dishes.length === 0) && (
          <div
            className="rounded-xl px-6 py-10 flex flex-col items-center gap-3 text-center"
            style={{
              backdropFilter: 'blur(16px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
              background: 'rgba(252,249,234,0.26)',
              border: '1px solid rgba(255,255,255,0.32)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.38)',
            }}
          >
            <p className="text-sm text-brand-espresso/50">{t('common.noData')}</p>
            <Link
              href="/menu"
              className="text-sm font-medium transition-colors duration-150 hover:opacity-70"
              style={{ color: '#FFA239' }}
            >
              {t('landing.menuMore')}
            </Link>
          </div>
        )}

        {/* Mobile "see more" link */}
        {loaded && !loadError && dishes.length > 0 && (
          <div className="sm:hidden mt-6 text-center">
            <Link href="/menu" className="text-sm font-medium" style={{ color: '#FFA239' }}>
              {t('landing.menuMore')}
            </Link>
          </div>
        )}
      </div>

      {/* Bottom fade into CTA — starts below the dish cards */}
      <div
        className="absolute bottom-0 inset-x-0 h-[42%] pointer-events-none"
        style={{
          background: [
            'linear-gradient(to bottom,',
            'transparent 0%,',
            'rgba(160,100,45,0.04) 18%,',
            'rgba(120,65,22,0.14) 35%,',
            'rgba(88,40,12,0.32) 52%,',
            'rgba(60,24,8,0.58) 68%,',
            'rgba(38,16,6,0.80) 82%,',
            'rgba(28,14,6,0.93) 93%,',
            '#1c0e09 100%)',
          ].join(' '),
        }}
      />
    </section>
  );
}

function CTA() {
  const { t } = useLocale();
  const { ref, visible } = useInView(0.2);

  return (
    <section
      className="relative py-24 overflow-hidden"
      style={{ background: '#1c0e09' }}
    >
      {/* Radial amber tint */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 32% 50%, rgba(255,162,57,0.11) 0%, transparent 52%)' }}
      />

      {/* Dot-grid texture — fades in from top so no hard border with previous section */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,162,57,0.55) 1px, transparent 0)',
          backgroundSize: '28px 28px',
          opacity: 0.12,
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 35%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 35%)',
        }}
      />

      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          width: '520px', height: '520px',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(255,162,57,0.09) 0%, transparent 58%)',
          filter: 'blur(48px)',
        }}
      />


      {/* Content */}
      <div
        ref={ref}
        className={`relative z-10 max-w-lg mx-auto px-6 text-center transition-all duration-700 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <h2 className="text-3xl sm:text-[2.6rem] font-semibold leading-[1.15] tracking-tight text-white mb-4">
          {t('landing.ctaTitle')}
        </h2>
        <p className="leading-relaxed mb-9" style={{ color: 'rgba(252,249,234,0.58)' }}>
          {t('landing.ctaDesc')}
        </p>
        <Link
          href="/tables"
          className="btn-amber inline-flex items-center justify-center px-8 py-3.5 rounded-2xl text-sm font-semibold"
        >
          {t('landing.ctaButton')}
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLocale();

  return (
    <footer className="py-14 text-white/45" style={{ background: '#180b08' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-10 text-sm">

        <div className="space-y-3">
          <p className="text-white font-semibold text-base">
            Table <span style={{ color: '#FFA239' }}>&</span> Time
          </p>
          <p className="leading-relaxed">{t('footer.tagline')}</p>
        </div>

        <div className="space-y-3">
          <p className="text-white/70 font-medium">{t('footer.navigate')}</p>
          <div className="space-y-1.5">
            <Link href="/menu"   className="block transition-colors duration-150 hover:text-white/75">{t('navbar.menu')}</Link>
            <Link href="/tables" className="block transition-colors duration-150 hover:text-white/75">{t('navbar.tables')}</Link>
            <Link href="/login"  className="block transition-colors duration-150 hover:text-white/75">{t('navbar.login')}</Link>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-white/70 font-medium">{t('footer.contact')}</p>
          <p>42 Clock Street, City Centre</p>
          <p>hello@tableandtime.com</p>
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto px-4 sm:px-6 mt-10 pt-6 text-xs text-white/25"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        © {new Date().getFullYear()} Table & Time. {t('footer.copyright')}
      </div>
    </footer>
  );
}
