import { neon } from '@neondatabase/serverless';
import { CartesiaVoice } from '@what-if/engine/providers/voice';

const main = async (): Promise<void> => {
  const sql = neon(process.env.DATABASE_URL!);
  const voice = new CartesiaVoice(process.env.CARTESIA_API_KEY ?? '');
  const voiceId = '8f1e9d27-96ff-405e-9213-7432a784ac0b';
  const { audio, words, mime } = await voice.synthesize('Et si Internet disparaissait pendant trente jours ?', voiceId);
  console.log('mime:', mime, 'audio bytes:', audio.byteLength, 'words:', words.length);
  console.log('first words:', words.slice(0, 4));
  const id = crypto.randomUUID();
  await sql`insert into audio_files (id, mime, data_b64) values (${id}, ${mime ?? 'audio/mpeg'}, ${Buffer.from(audio).toString('base64')})`;
  const res = await fetch(`https://filmique.vercel.app/api/tts/${id}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  console.log('GET /api/tts ->', res.status, res.headers.get('content-type'), buf.byteLength, 'bytes', String.fromCharCode(...buf.slice(0, 4)));
};

void main();
