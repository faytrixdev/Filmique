// Deploy marker: tells you exactly which commit is live without opening the
// dashboard. VERCEL_GIT_COMMIT_SHA is injected at build time on Vercel.
export const GET = (): Response =>
  Response.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    deployedAt: process.env.VERCEL_DEPLOYMENT_CREATED_AT ?? null,
  });
