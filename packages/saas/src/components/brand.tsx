import React from 'react';
import Link from 'next/link';

/** The mark: a film frame with an amber light inside. */
export const Mark = (): React.ReactElement => (
  <span className="brand__mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 4.5v15M16.5 4.5v15" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  </span>
);

export const Brand = ({ href = '/' }: { href?: string }): React.ReactElement => (
  <Link className="brand" href={href}>
    <Mark />
    Filmique
  </Link>
);

/** Fixed film-grain overlay. */
export const Grain = (): React.ReactElement => <div className="grain" aria-hidden="true" />;

export const CheckIcon = (): React.ReactElement => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8.4l3.2 3.1L13 4.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ArrowIcon = (): React.ReactElement => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Public marketing header. */
export const SiteNav = (): React.ReactElement => (
  <header className="container">
    <div className="nav">
      <Brand />
      <nav className="nav__links" aria-label="Navigation principale">
        <Link href="/#comment">Comment ça marche</Link>
        <Link href="/pricing">Tarifs</Link>
        <Link href="/login">Connexion</Link>
      </nav>
      <span className="spacer" />
      <Link className="btn btn--primary btn--sm" href="/app">
        Ouvrir le studio
      </Link>
    </div>
  </header>
);

const YEAR = new Date().getFullYear();

export const SiteFooter = (): React.ReactElement => (
  <footer className="container">
    <div className="footer">
      <span>© {YEAR} Filmique — des films qui commencent par « et si ».</span>
      <span className="row" style={{ gap: '1.25rem' }}>
        <Link href="/pricing">Tarifs</Link>
        <Link href="/login">Connexion</Link>
      </span>
    </div>
  </footer>
);
