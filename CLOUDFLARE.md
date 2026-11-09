# Cloudflare setup, database and Google sign-in

Updated 19 October 2026. Production site: `https://triamdod.com/`.
Existing Worker: `triamdod-10` (`triamdod-10.triamdod.workers.dev`).

The owner reports that resource creation, the first two D1 migrations and deployment have
completed successfully. The earlier authentication error 10000 is resolved;
its exact cause was not established. The actual D1 database ID is now present
in `wrangler.jsonc`: `c8662b15-8291-4a45-80f0-a8e8781f208d`.

The Worker, private R2 slips, shared checkout/review and owner-managed admin list
pass automated checks and Wrangler bundle validation. Live authenticated buyer,
Google sign-in and admin browser verification remain pending. Requests to the
deployed API were not accessible through this workspace's web tool; no live
endpoint success is claimed from those attempts.

The 500 KB slip update adds `0003_order_usage.sql`; student academic details add
`0004_student_info.sql`. Apply pending migrations before deploying the new
Worker. They preserve existing orders and larger slips, add filter indexes,
backfill small dashboard summary counters, and add nullable student fields. These
changes have not been applied to the live services from this workspace.
Keep the existing resources:

```sh
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

## First-time resource setup (completed by the owner)

These commands are kept as a setup reference. Select the Cloudflare
account that owns the existing `triamdod-10` Worker:

```sh
cd /home/sulinx/Triamdod/TRIAMDOD
npx wrangler login
npx wrangler d1 create triamdod-orders --location apac --binding DB --update-config
npx wrangler r2 bucket create triamdod-slips --binding SLIPS --update-config
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

The create commands update `wrangler.jsonc` with the actual resource bindings;
the D1 command adds its generated database ID. Apply **all** SQL migrations
before deploying. Future updates only need pending migrations and deployment;
never recreate/delete the database to apply an update.

If a resource already exists, bind that existing resource instead of creating or
deleting it: use `npx wrangler d1 info triamdod-orders` to get its database UUID
and add `database_id` under the existing `DB` binding. The `SLIPS` bucket name is
already configured. If R2 is not enabled, enable R2 in the Cloudflare dashboard
and rerun its create command. Keep the bucket private: public `r2.dev` access and
custom public bucket domains must stay disabled. No R2 API keys are needed;
the Worker uses its bucket binding.

Wrangler builds a fresh public-only `dist/` and deploys the Worker/assets together.
`DB` and `SLIPS` have local emulation by default; no remote development binding is
configured. The database ID and Google Client ID are configuration, not passwords.

## If D1 returns authentication error 10000

Check the exact account and authentication method from your terminal first:

```sh
npx wrangler whoami --account b466fb753921d72af463ad03b323aac6
npx wrangler d1 list
```

Confirm the account ID matches the account owning `triamdod-10` in the Cloudflare
dashboard. The website's owner/admin list does not grant Cloudflare account/API
permissions. `whoami` should show the expected identity, authentication method,
and account membership roles. Its output is useful for diagnosis; do not share
API tokens or the saved credentials file.

If `whoami` reports an API token instead of the intended OAuth login, check for
`CLOUDFLARE_API_TOKEN` or legacy `CF_API_TOKEN` overrides in your terminal/.env.
API token and API key environment credentials take priority over saved OAuth.
Use a token scoped to the correct account and D1, or remove the unintended
override from the current terminal/project configuration before using OAuth.

If the OAuth login is missing D1 scope, run `npx wrangler login` without custom
scope restrictions and complete browser authorization. If D1 scope is already
present, verify D1 product permissions on the target account before repeating
login. Workers product access alone does not grant D1 product access. A valid
login with the required permissions can still encounter a service/client issue;
error 10000 alone does not identify which cause applies.

Do not run migrations or deploy until database access succeeds. There is no
application schema change needed to fix Cloudflare control-plane authentication.
References: [Wrangler identity and login](https://developers.cloudflare.com/workers/wrangler/commands/general/),
[authentication precedence](https://developers.cloudflare.com/workers/wrangler/commands/general/#auth-token),
[Workers permissions and product boundaries](https://developers.cloudflare.com/workers/authorization/workers/).

## Your owner account

`OWNER_GOOGLE_EMAIL` is already set to `sulinx.b@gmail.com`. After deploying:

1. Sign in with this Google account on the site. Its verified Google subject is
   pinned as the single owner in D1; no owner is inferred from the first visitor.
2. Open `/admin` or the account panel's จัดการคำสั่งซื้อ link. The admin page shares
   the site's Google session.
3. Use รายชื่อผู้ดูแล to add other reviewers' exact Google emails. Only your owner
   account can view/change this list. Each Gmail/Workspace account activates when
   its verified Google identity signs in, and is pinned to that account ID.
4. Other admins can inspect/approve/reject slips. They cannot manage admins.
   Removing an admin revokes their next protected request immediately.

For a school-domain admin, Google must return a matching Workspace `hd` claim.
Personal Google accounts using a third-party email without Workspace remain
pending. The configured Gmail owner is supported. Owner identity is separate
from student/alumni package eligibility. The owner cannot be removed through
this list. Transferring ownership later requires an explicit database/config
change; editing the email variable alone does not replace a pinned owner.

Local and production databases pin ownership independently. There are no admin
credentials in localStorage/sessionStorage and no public promotion endpoint.

## Local development

```sh
npx wrangler d1 migrations apply DB --local
npx wrangler dev --port 3000
```

Open `http://localhost:3000`. Local orders/slips are separate from production and
persist under `.wrangler/`. Run local migrations before starting the new backend.
Use the same owner Google account for the owner panel. `node server.js` only
previews static files and cannot run sign-in, database or slip APIs.

## Google Console settings

Google Auth Platform → Clients → the Web client must authorize these exact
JavaScript origins, without a path or trailing slash:

```text
https://triamdod.com
http://localhost
http://localhost:3000
```

Client: `367195319418-jrbbsim94l6p5l6qqjaeln8cgr9f51m5.apps.googleusercontent.com`.
The SDK uses a JavaScript callback, so no redirect URI/client secret is required.
If the Google project is in testing, add the accounts under Audience → Test users
as needed. Google Console settings and a live popup remain unverified here.
`APP_ORIGIN` in `wrangler.jsonc` is now `https://triamdod.com`. Deploy this
configuration to the existing Worker after connecting that custom domain:

```sh
npx wrangler deploy
```

Changing DNS or attaching a Cloudflare custom domain does not update this variable
or Google's Authorized JavaScript origins. The Worker checks the request's exact
origin before returning the login configuration or session. Keeping the old
`workers.dev` value rejects requests from `triamdod.com` with HTTP 403
`Unrecognized site origin`; the login panel displays its generic Google connection
error before it can show the sign-in button.

In Google Auth Platform → Clients, open the existing Web client above, add
`https://triamdod.com` under **Authorized JavaScript origins**, and save. Do not
include a path or trailing slash. In Branding, add `triamdod.com` under
**Authorized domains** when using it for the application's homepage/privacy links.
These Google settings must be saved separately from the Worker deployment.

Use `https://triamdod.com` for production login. If `www.triamdod.com` is also
connected, redirect it to this origin before sign-in so that the page, API and
host-only session cookies use the same host. The old `workers.dev` address is no
longer the configured login origin; use the custom domain for buyer/admin checks.

After deploying, open `https://triamdod.com/api/auth/config`. It should return
HTTP 200 with `clientId` and `nonce`, then verify the Google popup and session in
the browser. A 403 with `Unrecognized site origin` means the deployed
`APP_ORIGIN` still differs from the browser's origin. A Google `origin_mismatch`
means that exact origin has not been authorized for the Web client.

Reference: [Google Identity Services setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## Storage and API

D1 stores the buyer's verified Google subject/email, name and any alumni delivery
details **when an order/slip is submitted**. It stores canonical package/price,
shirt choice, pending/approved/rejected status, UTC timestamps, idempotency key,
private slip metadata and review history. Prices are integer baht. Admin/owner
permission records are separate; ordinary sign-in creates no customer profile.
Non-buyer alumni drafts remain local.

For a verified school account, a numeric email such as `25784@tun.ac.th` provides
student ID `25784`; the Google name prefix `611.16 Name` provides grade 6, room
11, number 16. These are account-profile conventions, not a school-roster lookup.
Missing/unrecognized values remain unavailable. Student order snapshots store
these server-derived values at submission; browser-supplied academic fields are
ignored. Student account info and receipts, admin rows/slip details/search/CSV use
the same fields. Migration `0004` leaves historical orders' new fields NULL.

R2 stores normalized JPEG images under random private keys. Before upload, the
browser uses asynchronous JPEG encoding, adjusting quality and then dimensions
until the result fits within 500,000 bytes. It displays those same bytes in the
preview without a compression notice. The longest edge is at most 1600 px;
original selections are limited to 8 MiB. Temporary canvas/image resources are
released after preparation and stale account/selection results are discarded.

Only the buyer or a current administrator can GET an order's slip. The Worker
checks image markers, dimensions, encoding and size without decoding large
images server-side. Both the Worker and the new database insert trigger reject
new slips over 500,000 bytes; older larger slips remain readable. Private responses are
`no-store` and `nosniff`; lists never include image bytes or bucket keys.

| Route | Access / behavior |
| --- | --- |
| `/api/auth/config`, `/api/auth/google`, `/api/auth/session`, `/api/auth/logout` | Google-only sessions |
| `GET /api/orders` | Own orders, 50 per page, optional cursor |
| `POST /api/orders` | Verified buyer, canonical role/price, idempotent creation |
| `GET /api/orders/:id` | Buyer/admin order and review status |
| `GET /api/orders/:id/slip` | Buyer/admin private image |
| `GET /api/admin/orders` | Admin filtered/searchable order pages |
| `GET /api/admin/stats` | Admin database-wide revenue/status/shirt totals |
| `POST /api/admin/orders/:id/review` | Admin review/status correction, version checked |
| `GET/POST /api/admin/access` | Owner list/add admins |
| `POST /api/admin/access/remove` | Owner remove admin |

Writes require same-origin JSON and a verified session. The schema enforces
unique order IDs, buyer/request IDs and exact-image slip hashes. Repeated retries
reuse the original order. Reviews update status and append history in one D1
batch transaction. Admins can change approved orders to rejected and rejected
orders to approved; rejection still needs a reason and approval clears it. Every
change keeps prior review history, increments the version and updates summary
counts/revenue/shirts. Stale or same-status requests write nothing. There is no
order deletion/reset endpoint. Group filters distinguish all students, ม.4, ม.5,
ม.6 and alumni from saved order details; unknown grades remain under all students.
Only approved shirts/revenue count in production totals. Admin CSV contains the
current filtered page; subsequent pages can be exported separately.
Admin order responses include `reviewerEmail` from the latest saved review;
the list, inspector and CSV show this email and `reviewedAt`. When an admin reads
`GET /api/orders/:id`, each history entry also includes `reviewer_email`. The
inspector displays every decision with its reviewer, time and reason. Buyer
responses omit reviewer identities. This uses the existing `order_reviews`
records and index, so reviewer attribution needs no additional migration.
The buyer account shows its latest 50 orders with one refresh action and no
load-more button; admin pagination remains available.
Summary counters are updated by database triggers in the order transaction;
reading dashboard statistics scans at most 63 groups for the current catalog,
rather than every order. Role and package filters have dedicated indexes.

R2/D1 are separate services. Failed inserts clean up new uploads when the outcome
is known; uncertain database failures preserve the image to avoid deleting a
possibly committed order's slip. Object reconciliation/retention operations remain
launch work. Identical bytes are detected; bank transfers are not automatically
verified. Old local demo orders/approvals are preserved locally, with no import.

## Budget for about 2,000 buyers

Assuming one new slip per buyer, 2,000 × 500,000 bytes is at most 1 GB of image
storage. Slips live in R2, while D1 contains only records and private object
references.

Current free allowances, checked 18 October 2026:

| Service | Included usage |
| --- | --- |
| R2 Standard | 10 GB-month storage, 1 million Class A operations and 10 million Class B operations per month |
| D1 | 500 MB per database, 5 GB across the account; 5 million rows read and 100,000 rows written per day |
| Workers Free | 100,000 requests per day; 10 ms CPU time per request |

Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Normal usage for this event should fit the storage allowances. User count alone
cannot guarantee staying within every limit: retries, searches, admin refreshes,
bots, other account usage and simultaneous bursts all matter. D1 counts scanned
rows and index writes, not just returned orders; exceeding Free daily quotas
blocks queries until reset. R2 can bill usage above its free allowance. The
summary counters reduce repeated reads; upload decoding uses a typed byte loop
to avoid expensive per-byte callback allocation. Neither change proves a live
request will stay within Workers Free CPU limits.

## Sales setup

Replace the decorative PromptPay QR and confirm bank/recipient details before
accepting real transfers. Ticket generation/check-in, capacity and data
retention/backup operations are still in UNFINISHED.md.

Sources: [Cloudflare D1 setup](https://developers.cloudflare.com/d1/get-started/),
[R2 Worker bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/),
[Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/),
[Google ID token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
