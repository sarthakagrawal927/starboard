# Security Audit — starboard
**Date**: 2026-03-28 | **Status**: Paused

## Secrets in Git History
No `.env`, `.pem`, `.key`, or service-account files found in git history. Clean.

## Credentials on Disk
`.env.local` contains live credentials (AUTH_SECRET, AUTH_GITHUB_ID/SECRET, TURSO_AUTH_TOKEN, SAASMAKER key).
File is gitignored and was never committed -- no leak, but credentials should be rotated before any resumed work.

## Deployment
Vercel project detected (`.vercel/` directory present). No other deployment configs (wrangler, netlify, firebase).
Verify Vercel project is paused/deleted if not in use -- stale deployments can be targeted.

## Code Security
- **CORS**: `cors` package is a dependency but no explicit wide-open CORS config (`Access-Control-Allow-Origin: *`) found in source.
- **dangerouslySetInnerHTML**: Not used anywhere. Clean.
- **Hardcoded secrets in source**: None found. `NEXT_PUBLIC_SAASMAKER_API_KEY` is a public key (expected).

## Action Items
- [ ] Rotate AUTH_SECRET, AUTH_GITHUB_SECRET, and TURSO_AUTH_TOKEN before resuming development
- [ ] Confirm Vercel deployment is paused or torn down
- [ ] Add `.env.example` documenting required vars without values (currently missing)
