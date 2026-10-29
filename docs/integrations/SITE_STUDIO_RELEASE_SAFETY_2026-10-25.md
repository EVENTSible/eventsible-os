# Site Studio release safety — October 25, 2026

Status: PARTIAL / NOT READY. Production authorization: NOT GRANTED.

The existing Vercel Pro infrastructure remains selected. October 23 hosted functional and load results remain dated evidence; this audit does not claim a fresh hosted Owner roundtrip.

## Verified blockers

- Supabase organization `pguaaqwtigzjhydmwach` is Free. The OS backup dashboard explicitly states Free does not include project backups. PITR and restore-to-new-project are plan gated. No recent managed recovery point or independently verified external Production backup was established.
- Both active projects, OS and EVENTSgame, show Nano compute. An organization Pro upgrade affects billing for both, without combining databases. Budget approximately $35/month for two continuous Nano/Micro-priced instances: $25 plan plus approximately $20 compute less $10 organization compute credit, excluding taxes/overages/add-ons. Paid Nano billing does not automatically resize its hardware. No purchase or EVENTSgame modification is authorized.
- HQ and Builder track Git main and automatically assign Production domains. Public has no Git integration. HQ explicitly shows no deployment checks configured and a 30-day Production retention policy. OS main is unprotected; consumer protection/rules APIs are entitlement gated. Passing CI alone is not an enforced release approval gate. Verify retained rollback targets immediately before release.
- Production Auth uses the correct HQ Site URL and permits the canonical HQ callback and Builder recovery routes. Historical Preview entries, canonical path wildcards and a malformed local URL require a separately approved cleanup review. Do not remove routes blindly or test real password recovery without authorization.
- Current Public mode does not initialize Builder Auth, denies Builder-owned privileged functions and submits inquiries through the existing OS intake Edge endpoint. Its absent Supabase environment entries are not by themselves a release blocker; do not add a Public service-role key merely to match Builder. This narrows the earlier conditional environment warning. Builder browser/server backend agreement still requires value-blind verification.

## Exact schema correction

Previous reviewed proposal SHA-256: `c8cbfb89dc02606cfeaacdb683a8a0b6b59dc763d1dd5fc63ea3c8ae4bfaa222`.

Corrected canonical Git/LF proposal SHA-256: `113125346d7d5d99ff7c22f6ea8454513f32e06d633266357ef977a6ff993c09`.

The Windows CRLF working copy used for the local SQL rehearsal hashes to `4eb2e19f2dd7a2fb11f002dc2bdf1951acd90d5e38d34e48b93b93bdc0af4c93`; its SQL is byte-identical after newline normalization. The previous Windows hash above corresponds to prior Git/LF hash `aaf523a7412c008915bcda3316c06df2c77f273a3ea7b87093b992a111b4dbf0`. Future approval must pin the exact packaged artifact bytes and must not silently mix newline-dependent checksums.

Read-only Production catalog inspection showed broad default sequence privileges. A new synthetic local database reproduced anonymous USAGE/SELECT/UPDATE and authenticated UPDATE on the identity sequence after applying the old proposal. The sole SQL correction revokes inherited sequence grants from PUBLIC, anon and authenticated before granting authenticated USAGE/SELECT. It does not alter business tables, authorization roles or publication behavior. Fresh local checks confirm Owner draft creation/publication still work; anonymous sequence use and authenticated sequence UPDATE are denied.

The proposal is additive but is not safely rerunnable: unconditional CREATE POLICY fails on repeat application. It has no outer transaction or migration-ledger registration. Future execution requires an approved migration artifact/runner, exact object-absence preflight and atomic transaction. An injected local failure rolled back all new objects; repeat execution under a transaction preserved the synthetic sentinel. Do not silently rerun partially applied SQL or drop published data.

## Proposed release controls

Before any merge, separately approve and verify a Git deployment stop for HQ/Builder and turn off automatic Production-domain assignment. A project Git disconnect is an available temporary control; alternatively review a source-controlled git.deploymentEnabled policy as its own change. Turning off promotion alone still permits Production builds. Preserve existing projects, aliases and current traffic. Do not rely on the media-free build guard as an authorization gate.

After a verified recoverable backup, separately approve Production bindings/Auth, schema packaging/application, each PR merge, each staged Production build and each promotion. Never promote an old synthetic-backend Preview. Retain exact previous Production deployment IDs; application rollback must retain additive Site Studio data. Content revision restoration and database recovery are separate owner-approved procedures.

The full audit packet and source evidence are in the task workspace under `deliverables/site-studio-release-safety-2026-10-25/`. No Production schema/data/settings, DNS, billing, real media, or EVENTSgame resource was changed. The grant fix changes the HQ head and schema hash; a fresh exact-head hosted gate must be satisfied before release. Historical credential-bearing fixtures remain retired and must not be reopened.

References: [Supabase pricing](https://supabase.com/pricing), [compute billing](https://supabase.com/docs/guides/platform/manage-your-usage/compute), [backups](https://supabase.com/docs/guides/platform/backups), [Vercel Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration).
