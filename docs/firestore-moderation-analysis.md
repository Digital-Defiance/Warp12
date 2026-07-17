# Firestore moderation analysis (implementation note)

Target: `(default)` Firestore database, Standard edition / Native mode.

New server-owned paths:

- `moderationReports/{reportId}` — reports and automatic review flags. Admin SDK
  creates/updates; clients have no direct access.
- `moderationConfig/contentReview` — separate chat/name token lists and global
  allowlist. Admin SDK only.
- `moderationReportRate/{uid}` — server-side one-hour submission rate window.
  Admin SDK only.

Queries:

- Ops list all: `moderationReports.orderBy(createdAt desc).limit(N)` (single
  field automatic index).
- Ops status filter:
  `moderationReports.where(status == X).orderBy(createdAt desc).limit(N)`
  (composite index in `firestore.indexes.json`).

Auth/write model:

- Players use `submitModerationReport` callable. It validates sector
  membership, copies evidence server-side, prevents self-reporting and limits
  reports to 10/hour.
- Firestore message/game triggers create review-only flags. Matches never
  automatically mute, ban, delete, or block names/messages.
- Ops callables list/update reports and update content-review configuration.
- Firestore Rules deny every direct client read/write on all three paths.
