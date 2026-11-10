'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authSecret, consumeMagicLink, requestMagicLink, SESSION_COOKIE, sessionCookie } from '@/lib/auth';
import { drizzleMagicRepo } from '@/db/auth-repo';
import { getDb } from '@/db';

const repo = () => drizzleMagicRepo(getDb());

export type RequestState = { link?: string; error?: string } | null;

export const requestMagicAction = async (_prev: RequestState, formData: FormData): Promise<RequestState> => {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Adresse e-mail invalide.' };
  try {
    const token = await requestMagicLink(repo(), email, Date.now());
    const link = `/verify?token=${token}`;
    // MVP mailer: the link is shown in the server log and returned to the (dev) page.
    console.log(`[auth] magic link for ${email}: ${link}`);
    return { link };
  } catch (e) {
    return { error: `Échec de l’envoi : ${e instanceof Error ? e.message : String(e)}` };
  }
};

export const logoutAction = async (): Promise<void> => {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
};

export const setSessionCookie = async (email: string): Promise<void> => {
  (await cookies()).set(SESSION_COOKIE, sessionCookie(email, authSecret(), Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600,
    path: '/',
  });
};

export const verifyByClick = async (token: string): Promise<{ ok: boolean; email?: string }> => {
  const res = await consumeMagicLink(repo(), token, Date.now());
  if (!res.ok) return { ok: false };
  await setSessionCookie(res.email);
  return { ok: true, email: res.email };
};
