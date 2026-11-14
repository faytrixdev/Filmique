// French Cartesia voices available to the wizard. Ids are real Cartesia voice
// uuids (the API rejects anything else), verified against GET /voices. Order is
// the order the UI shows; the first one is the default narration.

export type VoiceOption = {
  id: string;
  name: string;
  tagline: string;
  accent: 'fr-FR' | 'fr-CA';
  gender: 'masculine' | 'feminine';
};

export const VOICES: VoiceOption[] = [
  { id: '8f1e9d27-96ff-405e-9213-7432a784ac0b', name: 'Jules', tagline: 'Animateur posé, confiant', accent: 'fr-FR', gender: 'masculine' },
  { id: 'd9f4af15-c402-4f50-bbda-d8823d028d6a', name: 'Henri', tagline: 'Voix incarnée, rythme de plateau', accent: 'fr-FR', gender: 'masculine' },
  { id: '996ec149-0dca-4389-ad08-e2d6f906b4bf', name: 'Mathis', tagline: 'Explication mesurée, analytique', accent: 'fr-FR', gender: 'masculine' },
  { id: 'b56a7171-86f0-42b6-b3fa-a316794aa4e0', name: 'Zoé', tagline: 'Claire et précise', accent: 'fr-FR', gender: 'feminine' },
  { id: '92579402-6868-412e-b845-3efed0be7a9e', name: 'Jade', tagline: 'Calme, rassurante', accent: 'fr-FR', gender: 'feminine' },
  { id: 'f5e6c270-2aa9-463f-b48b-579a39284ce2', name: 'Félix', tagline: 'Accent québécois, chaleureux', accent: 'fr-CA', gender: 'masculine' },
];

/** Default narration voice: a French Cartesia voice (Jules - Polished Host). */
export const DEFAULT_VOICE_ID = VOICES[0].id;

export const DEFAULT_VOICE_LABEL = `${VOICES[0].name} - ${VOICES[0].tagline} (fr)`;

export const voiceById = (id?: string): VoiceOption | undefined =>
  id ? VOICES.find((v) => v.id === id) : undefined;
