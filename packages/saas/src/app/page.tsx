import React from 'react';
import Link from 'next/link';
import { ArrowIcon, CheckIcon, Grain, SiteFooter, SiteNav } from '@/components/brand';

const steps = [
  {
    n: '01',
    title: 'Une hypothèse',
    body: '« Et si Internet disparaissait pendant trente jours ? » Une phrase suffit. Filmique en tire un angle, un ton et une durée.',
  },
  {
    n: '02',
    title: 'Un storyboard',
    body: 'Le compose écrit les beats, choisit les plans, cale les coupes sur les mots. Vous relisez, vous ajustez, vous gardez la main.',
  },
  {
    n: '03',
    title: 'Un film',
    body: 'La voix est synthétisée beat par beat, le montage recale ses cuts sur chaque syllabe, puis le MP4 est rendu.',
  },
];

const samples = [
  { kicker: 'Hypothèse 001', title: 'Et si la Lune s’éloignait d’un mètre par an ?' },
  { kicker: 'Hypothèse 002', title: 'Et si chaque mensonge devenait visible ?' },
  { kicker: 'Hypothèse 003', title: 'Et si le silence durait une heure par jour ?' },
];

const features = [
  { title: 'Voix réelle', body: 'Synthèse Cartesia par beat, timestamps de chaque mot — pas une estimation.' },
  { title: 'Montage au mot', body: 'Les coupes tombent sur la syllabe juste, jamais sur une respiration.' },
  { title: 'Export MP4', body: 'Rendu 1920×1080 prêt à publier, débité à l’export depuis votre solde.' },
  { title: 'Réglage fin', body: 'Plans, props d’archétype, musique et niveaux : tout reste éditable.' },
];

export default function Home(): React.ReactElement {
  return (
    <div className="ground">
      <Grain />
      <SiteNav />

      <main>
        <section className="hero container">
          <div className="hero__frame" aria-hidden="true">
            <div className="hero__glow" />
          </div>
          <div className="hero__content">
            <span className="eyebrow">Studio de films hypothétiques</span>
            <h1 className="display">
              Et si une idée
              <br />
              devenait un <em>film</em> ?
            </h1>
            <p className="lede">
              Filmique transforme une hypothèse en court-métrage : storyboard écrit, plans composés, voix posée,
              coupes calées sur chaque mot. De la phrase au MP4, sans timeline à remplir.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--primary btn--lg" href="/app">
                Créer mon premier film
                <ArrowIcon />
              </Link>
              <Link className="btn btn--lg" href="/#comment">
                Comment ça marche
              </Link>
            </div>
            <p className="note" style={{ marginTop: '0.5rem' }}>
              Sans carte bancaire · première hypothèse en moins d’une minute
            </p>
          </div>
        </section>

        <section className="section container" id="comment">
          <div className="section__head">
            <span className="eyebrow">Le procédé</span>
            <h2 className="display">Trois étapes, aucune corvée</h2>
          </div>
          <div className="steps">
            {steps.map((step) => (
              <article className="step" key={step.n}>
                <div className="step__num">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section container">
          <div className="section__head">
            <span className="eyebrow">Exemples</span>
            <h2 className="display">
              Des films qui commencent par <em>et si</em>
            </h2>
            <p className="lede">
              Chaque épisode part d’une seule question et tient en trente à quatre-vingt-dix secondes. Voici le genre
              d’hypothèse que le studio sait filmer.
            </p>
          </div>
          <div className="episodes episodes--fill">
            {samples.map((sample) => (
              <article className="poster" key={sample.kicker}>
                <div className="poster__kicker">{sample.kicker}</div>
                <div className="poster__title">{sample.title}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="section container">
          <div className="section__head">
            <span className="eyebrow">Ce qu’il y a sous le capot</span>
            <h2 className="display">Un studio, pas un générateur</h2>
          </div>
          <div className="steps">
            {features.map((feature) => (
              <article className="card card--pad card--hover" key={feature.title}>
                <span style={{ color: 'var(--amber)' }}>
                  <CheckIcon />
                </span>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.7rem 0 0.35rem' }}>{feature.title}</h3>
                <p className="note">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section container">
          <div className="card card--pad" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px' }}>
              <span className="eyebrow">Abonnement</span>
              <h2 className="display" style={{ marginTop: '0.5rem' }}>
                19 € par mois, <em>résiliable</em> en un clic
              </h2>
              <p className="lede" style={{ marginTop: '0.75rem' }}>
                Épisodes illimités en brouillon, voix Cartesia, export MP4 à 0,04 € et 3 € de crédits offerts chaque
                mois.
              </p>
            </div>
            <Link className="btn btn--primary btn--lg" href="/pricing">
              Voir les tarifs
              <ArrowIcon />
              </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
