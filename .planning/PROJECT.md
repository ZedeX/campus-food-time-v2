# Project: 校园食光 (Campus Food Time)

## Vision
为食堂老师提供发布每日/每周食谱的平台，家长可查看。基于 Cloudflare Workers + D1 + R2 + KV 全免费栈。

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JS, Flatpickr
- Backend: Cloudflare Workers (ES Modules)
- DB: Cloudflare D1 (SQLite)
- Cache: KV + Workers Cache API
- Storage: R2 (private bucket)
- Testing: Vitest + @cloudflare/vitest-pool-workers

## Key Decisions
- D1 for all business data, KV for cache/session/counters only
- Presigned URL direct upload to R2 (no Worker proxy for upload)
- R2 private bucket, media access via Worker proxy /media/:id
- Reversible password encryption (per user decision)
- Optimistic locking with version field
- Beijing timezone for business dates, UTC for timestamps
- ISO 8601 strict for week calculation
- All Cloudflare free tier
