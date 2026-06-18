# Roadmap

## Phase 1: Foundation (DB + Config)
- 01-01: Database schema migration (all tables)
- 01-02: Seed data (school, admin, classes, semester)
- 01-03: Worker entry point + router + response helpers

## Phase 2: Authentication
- 02-01: Teacher login (phone + password)
- 02-02: Parent register (student verification)
- 02-03: Parent login
- 02-04: Admin login + Turnstile
- 02-05: Session management (D1 sessions, sliding expiry, single device)
- 02-06: Auth middleware + login rate limiting (KV)

## Phase 3: Recipe CRUD
- 03-01: Create/update daily recipe (PUT, optimistic lock)
- 03-02: Get daily recipe (with cache)
- 03-03: Create/update weekly recipe
- 03-04: Get weekly recipe
- 03-05: Snapshot creation on update
- 03-06: Teacher view own history (read-only)

## Phase 4: File Upload + Media
- 04-01: Presigned URL generation
- 04-02: Media proxy /media/:id (auth check)
- 04-03: Temporary share link (1h token)

## Phase 5: Admin Functions
- 05-01: Recipe management (list/update/delete)
- 05-02: Version history + rollback
- 05-03: Teacher/Parent account management
- 05-04: Class/Student management
- 05-05: Semester management
- 05-06: Statistics (dish count per semester)
- 05-07: Operation logs (filter/pagination)
- 05-08: Orphan file cleanup
- 05-09: Async archive (metadata JSON + batch download)

## Phase 6: Frontend
- 06-01: Home page (role selection + auto-redirect)
- 06-02: Teacher login + dashboard (daily/weekly publish)
- 06-03: Parent register + login + dashboard (view recipes)
- 06-04: Admin login + dashboard (management tables)
- 06-05: Image compressor (Canvas, 1080p)
- 06-06: Video compressor (WebCodecs + fallback)
- 06-07: Draft auto-save (localStorage)
- 06-08: Flatpickr date/week picker integration

## Phase 7: Deploy
- 07-01: GitHub repo creation + push
- 07-02: Cloudflare D1/KV/R2 creation
- 07-03: Wrangler deploy
- 07-04: GitHub-Cloudflare integration
