import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowIcon, CheckIcon, Grain, SiteFooter, SiteNav } from '@/components/brand';

export const metadata: Metadata = { title: 'Tarifs — Filmique' };

// The checkout URL lives in the env: swapping the Whop product never touches code.
const checkoutUrl = process.env.WHOP_CHECKOUT_URL ?? '';

const perks = [
  'Épisodes illimités en brouillon',
  'Voix Cartesia recoupée beat par beat',
  'Montage recalé sur les timestamps de chaque mot',
  'Export MP4 1920×1080 — 0,04 € par film, débité de vos crédits',
  '3,00 € de crédits offerts chaque mois d’abonnement',
];

export default function PricingPage(): React.ReactElement {
  return (
    <div className="ground">
      <Grain />
      <SiteNav />
      <main className="section container--narrow" style={{ textAlign: 'center' }}>
        <span className="eyebrow">Tarifs</span>
        <h1 className="display" style={{ marginTop: '0.6rem' }}>
          Un abonnement, <em>pas</em> un compteur
        </h1>
        <p className="lede" style={{ margin: '1rem auto 2.5rem' }}>
          Écrivez autant d’hypothèses que vous voulez. Vous ne payez le rendu que lorsque le film vous plaît.
        </p>

        <div className="plan" style={{ margin: '0 auto', textAlign: 'left' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="card__label">Filmique Studio</span>
            <span className="pill pill--voiced">
              <span className="pill__dot" />
              Mensuel
            </span>
          </div>
          <div className="plan__price" style={{ marginTop: '1rem' }}>
            19 € <span>/ mois</span>
          </div>
          <p className="note" style={{ marginTop: '0.35rem' }}>
            Abonnement Whop, résiliable en un clic. 3 € de crédits offerts chaque mois.
          </p>

          <hr className="hairline" style={{ margin: '1.5rem 0' }} />

          <ul className="plan__list">
            {perks.map((perk) => (
              <li key={perk}>
                <CheckIcon />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          {checkoutUrl ? (
            <a className="btn btn--primary btn--lg btn--block" href={checkoutUrl}>
              S’abonner via Whop
              <ArrowIcon />
            </a>
          ) : (
            <button className="btn btn--primary btn--lg btn--block" disabled>
              Paiement bientôt disponible
            </button>
          )}

          <p className="note" style={{ textAlign: 'center', marginTop: '1rem' }}>
            Déjà membre ?{' '}
            <Link href="/login" style={{ color: 'var(--amber)', fontWeight: 600 }}>
              Connectez-vous
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
