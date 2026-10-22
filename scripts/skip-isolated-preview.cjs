// Vercel: exit 0 skips a build. Only these isolated release branches are skipped.
const branches = new Set(['codex/site-studio-owner-draft-preview-20261020', 'codex/public-site-published-content-20261020']);
process.exit(process.env.VERCEL_ENV === 'preview' && branches.has(process.env.VERCEL_GIT_COMMIT_REF) ? 0 : 1);
