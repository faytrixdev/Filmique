import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tarifs — Filmique' };

// The checkout URL lives in the env: swapping the Whop product never touches code.
const checkoutUrl = process.env.WHOP_CHECKOUT_URL ?? '';

const perks = [
  'Épisodes illimités (brouillons)',
  'Voice-over Cartesia re-découpée beat par beat',
  'Render MP4 final (--0,04 € / export, débité de vos crédits)',
  '3,00 € de crédits offerts chaque mois d’abonnement',
];

export default function PricingPage(): React.ReactElement {
  return (
    <main style={{ maxWidth: 560, margin: '10vh auto', fontFamily: 'system-ui', textAlign: 'center' }}>
      <h1>Filmique</h1>
      <p style={{ fontSize: 15, opacity: 0.8 }}>
        19 € / mois — abonnement Whop, résiliable en un clic.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, fontSize: 14, lineHeight: 2, opacity: 0.85 }}>
        {perks.map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>
      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          style={{ display: 'inline-block', marginTop: 24, padding: '12px 28px', borderRadius: 999, background: '#111', color: '#fff', textDecoration: 'none', fontWeight: 600 }}
        >
          S&apos;abonner via Whop
        </a>
      ) : (
        <p style={{ marginTop: 24, fontSize: 13, opacity: 0.6 }}>Paiement bientôt disponible.</p>
      )}
      <p style={{ marginTop: 32, fontSize: 12, opacity: 0.6 }}>
        Déjà membre ? <a href="/login">Connectez-vous</a>
      </p>
    </main>
  );
}
