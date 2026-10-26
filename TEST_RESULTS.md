# Validation results

- Backend TypeScript build: passed.
- MongoDB Prisma schema format/validation and generated client: passed (Prisma 6.19.0).
- Frontend TypeScript and Vite production build: passed.
- Signup regression check using React server rendering: passed. The signup form contains a required invitation-code input, and the signin form does not.
- 18 HTTP access-control checks using the real Express handlers and mocked database methods: passed. These cover unauthorized signup, email-bound invitations, single use, expiration, staff restrictions, disabled accounts/tokens, administrator protection, and case/judge ownership guards.

Run the included access checks with `cd backend`, `npm ci`, then `npm test`.

## Limits

A live MongoDB integration run was attempted, but the native MongoDB process was blocked by this execution environment (`open: Operation not permitted`). Docker is unavailable here. Browser tests were attempted, but no browser executable was available and its download failed. Therefore full Docker startup, live database transactions/cascades and browser interactions have not been verified here. Successful builds and mocked access checks do not establish those results.

An integration script is included at `backend/tests/integration.mjs`. Use a dedicated empty, disposable MongoDB replica-set database; it creates test accounts and records. Set TEST_DATABASE_URL, run `npx prisma db push` with DATABASE_URL set to the same test database, then `npm run test:integration`. Never use your actual case database for integration tests. The script checks signup/signin, assignments, privacy, status history, hearing synchronization, user suspension, case deletion cleanup and dashboard counts.
