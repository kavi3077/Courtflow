# CourtFlow Professional — MongoDB Edition

React + TypeScript, Express + TypeScript, MongoDB 7 (Prisma 6), Redis and Docker.

## Start on Windows (PowerShell)

1. Extract the ZIP into a new folder. Do not overwrite your old PostgreSQL project.
2. Open Docker Desktop and wait until the engine is running.
3. Open PowerShell in the `CourtFlow_Professional` folder (the folder with docker-compose.yml).
4. Run:

```powershell
Copy-Item .env.example .env
notepad .env
```

Set your own ADMIN_EMAIL, ADMIN_PASSWORD (at least 12 characters) and JWT_SECRET (at least 32 characters). Save the file. Then run:

```powershell
docker compose up --build -d
docker compose logs -f backend
```

Open http://localhost:3000. Sign in using the administrator email/password from `.env`. Admin creation happens automatically on the first startup; no sample cases are inserted. After an admin exists, changing `.env` does not reset that account's password.

If port 3000 or 4000 is occupied by the old project, run `docker compose down` in that old project folder first, without `-v` so its data is preserved.

## Authorized registration

1. Administrator opens **User access** in the sidebar.
2. Enter the authorized user's exact email and create an invitation.
3. Share the displayed code privately with that person.
4. The person opens **Create account**, enters that email and code, and chooses their password.

Invitations expire after seven days, can be used once, and are bound to an email address. Creating another invitation for the same email replaces the previous code. Staff cannot create invitations or access user administration. Disabling a user blocks sign-in and all subsequent API requests, including previously issued tokens. Re-enabling restores access. The administrator account cannot be disabled from this screen.

## Case workflow

- Register a case from Cases → New case; each user starts with an empty, private workspace.
- Open a case by clicking its row/title to reach its workspace.
- **Edit** changes case information, dates, priority and workflow status.
- **Workflow status** changes Pending, Scheduled, Active, Adjourned, Closed or Disposed. Every status change is recorded.
- **Judges** in the sidebar creates/edits/deletes judge records. The case's **Judges** tab assigns or unassigns a judge.
- **Advocates** in the sidebar creates counsel records. The case's **Advocates** tab assigns or removes counsel.
- **Hearings** schedules, edits, completes, adjourns, cancels or deletes hearings, including outcome and notes. Next-hearing metadata is recalculated after hearing changes.
- **History** lets you correct notes on prior status events. Original status transitions, author and timestamp are preserved; change the current status using the workflow selector.
- **Delete** asks for confirmation and removes the case, hearings, evidence records/files, judgment, advocate links and history.
- **Evidence** supports private upload/download/delete; **Judgment** creates/updates the disposition.
- Dashboard statistics, case search/filter/pagination and responsive navigation are retained.

Judge and advocate records are private to the user who created them. The administrator manages access, but does not automatically see another user's case data. Judges and advocates are personnel records, not extra login roles.

## Data and operations

MongoDB is the only primary database; PostgreSQL is removed. Prisma is retained as the data-access layer with MongoDB ObjectIds and indexes. Docker configures a single-node replica set automatically so transactions work. MongoDB and Redis are not published on host ports. This Compose setup is intended for local use; frontend/API bind to localhost. Uploaded evidence and MongoDB data use persistent Docker volumes.

```powershell
docker compose ps
docker compose logs backend
docker compose down
```

`docker compose down` preserves data. `docker compose down -v` permanently deletes this project's data and evidence; use it only for an intentional full reset.

This is a fresh MongoDB database. Existing PostgreSQL data is not migrated; retain your old project and volumes if you need those records.

## Development without Docker

Use Node 20.19+ or 22.12+, a MongoDB replica set (or Atlas) and Redis. Configure root `.env` with DATABASE_URL and REDIS_URL for those services.

```powershell
cd backend
npm ci
npm run prisma:generate
npm run db:push
npm run dev
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open the Vite URL, usually http://localhost:5173. The Docker path is recommended because it configures MongoDB's replica set for you.

## Validation

See TEST_RESULTS.md for the build and API checks performed for this delivery.
