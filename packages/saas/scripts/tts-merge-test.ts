import { neon } from '@neondatabase/serverless';
import { CartesiaVoice, concatWav, wavDuration } from '@what-if/engine/providers/voice';

const main = async (): Promise<void> => {
  const sql = neon(process.env.DATABASE_URL!);
  const voice = new CartesiaVoice(process.env.CARTESIA_API_KEY ?? '');
  const voiceId = '8f1e9d27-96ff-405e-9213-7432a784ac0b';
  const beats = ['Et si Internet disparaissait pendant trente jours ?', 'La moitié du monde perdrait ses repères.', 'Et personne ne serait prêt.'];
  const parts: Uint8Array[] = [];
  const wordCounts: number[] = [];
  for (const b of beats) {
    const { audio, words } = await voice.synthesize(b, voiceId);
    parts.push(audio);
    wordCounts.push(words.length);
    console.log(`beat "${b.slice(0, 24)}..." bytes=${audio.byteLength} duration=${wavDuration(audio)?.toFixed(2)}s words=${words.length}`);
  }
  const merged = concatWav(parts, 0.25);
  console.log('merged bytes:', merged?.byteLength, 'duration:', wavDuration(merged ?? new Uint8Array())?.toFixed(2), 's');
  const expected = parts.reduce((sum, p) => sum + (wavDuration(p) ?? 0), 0) + 0.25 * (parts.length - 1);
  console.log('expected duration:', expected.toFixed(2), 's');
  const id = crypto.randomUUID();
  await sql`insert into audio_files (id, mime, data_b64) values (${id}, 'audio/wav', ${Buffer.from(merged ?? new Uint8Array()).toString('base64')})`;
  const res = await fetch(`https://filmique.vercel.app/api/tts/${id}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  console.log('served:', res.status, res.headers.get('content-type'), buf.byteLength, 'bytes', String.fromCharCode(...buf.slice(0, 4)));
};

void main();
