# Remaining work

Last reviewed: 18 October 2026.

The implementation includes Google sessions, D1 shared buyer/orders, private R2
slips and owner-managed admin access. The owner reports successful resource
creation, database migrations and deployment. The actual D1 database ID is now
saved in `wrangler.jsonc`. The previous authentication error is resolved; the
cause was not confirmed. Live authenticated browser verification remains pending;
the deployed API could not be fetched independently through this workspace.
The new slip preparation, usage counters and student academic details are
implemented locally; migrations `0003`/`0004` and this update still need deployment.

## Implemented: Google sign-in and checkout

- [x] Keep the pink สมัครสมาชิก cassette as the single public sign-in entry.
- [x] Remove the separate manual-login cassette and arbitrary login success.
- [x] Remove the previous Google SDK/token flow, hardcoded client ID, account
  simulations, student-account parser, and public OAuth configuration controls.
- [x] Discard the old browser-saved Google Client ID without deleting orders.
- [x] Disable sign-in and gate checkout while no identity provider is connected.
- [x] Configure the owner's supplied Google Client ID and Cloudflare origin.
- [x] Verify Google's signed ID token, claims and browser-bound nonce in the Worker;
  use the Google subject ID and a short-lived Secure HttpOnly session cookie.
- [x] Restore verified sessions, clear sessions on account change, and connect the
  preserved student/alumni profile and checkout views. Recheck before saving orders.
- [x] Restore header state on page load, hide login text while signed in, and show
  a themed account panel with name/email/status, account details and sign-out.
- [x] Derive admin status from the server owner/admin list, keeping package flow
  separate and ignoring browser admin flags.
- [x] Save alumni delivery drafts per Google subject locally; restore saved fields
  and require re-saving after edits before opening the phone booth. Students use
  their verified school account immediately, without saving a profile.
- [x] Route saved accounts through the role-appropriate phone booth and carry the
  selected package/color/size into checkout; remove the account icon's green dot.
- [x] Require sign-in before the phone booth; show only the account's packages and
  disable other package keys. Remove the role/all switcher, support keyboard card
  selection, and resume checkout after required alumni delivery details are saved.
- [x] Configure `sulinx.b@gmail.com` as owner; pin its verified Google subject on
  first sign-in. Add an owner-only admin list with verified account activation
  and immediate permission revocation. Other admins only review orders.
- [x] Exercise forged/expired credentials, nonce/CSRF guards, session restoration,
  sign-out, student/alumni flows and expired-session checkout with automated tests.
- [ ] Confirm the owner's Google Console Authorized JavaScript origins and audience;
  perform real Google sign-in on the deployed site. Client configuration is not
  proof that Google Console has authorized the origin.
- [x] Implement D1 buyer/order snapshots on slip submission; keep non-buyer
  drafts local and preserve existing browser demo data without importing it.
- [x] Add buyer order history and latest status/receipt loading across devices.
- [x] Hide buyer order history and the admin order table while empty; keep one
  buyer-history refresh action and remove the duplicate receipt reload button.
- [x] Remove the buyer's load-more button; keep latest-50 order history and admin
  pagination. Add ม.4/ม.5/ม.6 groups alongside all students and alumni.
- [x] Let authorized admins correct approved/rejected statuses with the latest
  version, a reason for rejection, preserved review history and updated totals.
  Keep order deletion/reset and demo controls absent.
- [x] Prepare slips asynchronously at or below 500,000 bytes before upload; show
  the exact prepared image in the preview without a compression message.
- [x] Enforce the new upload size in the Worker and database insert trigger;
  preserve older larger slips and release temporary browser image resources.
- [x] Replace repeated full-order dashboard scans with transactional summary
  counters; index role/package filters and simplify upload byte decoding.
- [x] Verify exact preview/upload bytes, size boundaries, migration upgrades and
  summary correctness after 2,000 simulated orders/reviews (about 2.2 MiB locally).
- [ ] Verify the shared flow against actual live Cloudflare resources.

## Next: verify the deployed flow

- [x] Record the owner's URL: https://triamdod-10.triamdod.workers.dev/.
- [x] Package only public website files; exclude development logs, tests, and docs.
- [x] Add the authentication Worker and API routing alongside Workers Static Assets.
- [x] Pass Wrangler dry-run validation with the authentication Worker and assets.
- [x] Create live `triamdod-orders` D1 and private `triamdod-slips` R2 resources,
  apply the first two migrations and deploy the shared backend (owner-reported complete).
  The generated D1 database ID is confirmed in the local configuration.
- [x] Resolve Cloudflare D1 authentication error 10000 (owner-reported resolved;
  the exact cause was not established).
- [x] Publish the initial shared backend to the owner's existing Worker
  (owner-reported complete; live authenticated verification remains below).
- [ ] Apply pending migrations `0003_order_usage.sql` and `0004_student_info.sql`
  with `npx wrangler d1 migrations apply DB --remote`, then deploy this update
  with `npx wrangler deploy`.
- [ ] Verify Google sign-in, session restoration and account change on the live URL.
- [ ] Configure a custom domain/HTTPS redirects if needed, then authorize its origin.
- [ ] Verify media playback, fonts, mobile layouts and caching on the deployed URL.

## Required before real registrations/payments

- [x] Implement shared order APIs and D1 schema for cross-device order/status access.
- [x] Implement private R2 uploads with buyer/admin access, size/encoding/JPEG
  marker/dimension validation and no-cache responses.
- [x] Replace the frontend demo password/session flag, mock data and local writes
  with Google/D1-enforced admin permissions. Only the owner manages admins.
- [x] Verify Google identity and derive the school flow on the authentication server.
- [x] Enforce verified identity, package role and private order access in the APIs.
  Enrollment/alumni membership verification remains deferred below.
- [x] Remove the old public Google Client ID configuration and account chooser.
- [ ] Replace the decorative PromptPay SVG with a real payment QR. Verify the
  recipient/account details and document the manual slip-review process.
- [x] Validate prices, roles, shirt options and review transitions on the server.
- [x] Render buyer details as text nodes and neutralize CSV formulas. Use bounded
  server-filtered order pages and load slip images only when opened.
- [ ] Issue unique tickets after approval and implement redemption/check-in.
- [x] Add durable server IDs/UTC timestamps, idempotent retries, exact-slip-hash
  duplicate checks, review versions and transactional audit history.
- [ ] Add capacity controls and ticket issuance/check-in. Exact-image hashes do
  not verify bank transfers; order status corrections are now implemented above.
- [ ] Define backups, retention/deletion policy and R2 object reconciliation for
  rare uncertain insert/upload failures. Validate these against the live services.
- [ ] Sign in as the owner on the deployed site, verify owner pinning, add a test
  reviewer, and confirm other admins cannot manage permissions.

## School student details

- [x] Read student ID from numeric school email and class/room/number from the
  signed Google name prefix (for example `611.16`); show these in student info,
  order receipts and admin rows/slip details/search/CSV. Store academic snapshots
  only with submitted orders; ignore academic fields supplied by the browser.
- [x] Explain that these details come from the school Google profile convention;
  show missing data honestly and leave historical orders without guessed values.
- [ ] Connect class, room and student number to a school-authorized roster or
  Google Workspace directory if independent enrollment verification is required.
- [ ] Confirm current enrollment/alumni eligibility if required. The current
  flow verifies the Workspace account and reads its profile naming convention;
  it does not independently verify school records or enrollment.
- [ ] Verify the real school's account naming formats and live student-info flow.

## Content and final verification

- [ ] Confirm the final date, venue, opening time, lineup, prices, delivery terms,
  shirt sizing/specifications, and merchandise artwork with the organizers.
- [ ] Replace stock Mixkit videos and placeholder archive stories/artwork with
  confirmed event content; verify rights to the supplied music/media.
- [ ] Resolve remaining TBA / ticket-drop-soon copy before sales open.
- [ ] Check the desktop and mobile design in a real browser, including keyboard
  focus, modal scrolling, and reduced-motion behavior.
- [ ] Inspect resized slips for legibility on real phone screenshots.
- [ ] Check real Worker CPU/request usage and D1 row metrics, then test concurrent
  checkouts. The local 2,000-order check does not measure live throughput/quotas.
  One 500 KB slip per buyer uses at most 1 GB for 2,000 buyers, within R2 Standard's
  current 10 GB-month free storage allowance; requests and operations also count.
- [ ] Measure load time, memory, and CPU on a phone/slow connection. Source-size
  reductions and allocation checks are not browser performance measurements.
- [x] Harden local preview malformed/suffix Range and HEAD handling; restrict it
  to public assets and verify the real pages' local resources. Cloudflare serves
  deployed assets.

## Completed in the cleanup

- [x] Keep one copy of each organizer logo and move unused reference images/logs
  out of the runtime asset folders.

- [x] Remove 51 CSS rules that have no references in either page or the runtime JS.
- [x] Load only the admin page's shared foundations and admin styles.
- [x] Load public styles directly and local scripts with defer, preserving order.
- [x] Reduce requested font families from 15 to 10 publicly and 15 to 5 in admin.
- [x] Remove the previous Google client library and account chooser entirely
  in the Google-only sign-in reset.
- [x] Share package definitions between the payphone and registration.
- [x] Remove duplicate booking listeners and carry package/color/size choices.
- [x] Retire browser order writes; preserve old local demo records without
  importing demo approvals/slips into the shared database.
- [x] Report failed saves instead of showing a false success screen.
- [x] Resize slips before upload to at most 1600 pixels on the longest edge,
  cap new images at 500,000 bytes, reject originals larger than 8 MiB, and release
  temporary image resources.
- [x] Reuse the audio context for camera effects and one 75 KiB CRT noise buffer.
- [x] Pause hidden/offscreen work; preserve manual music mute and Snake pause.
- [x] Use one admin-table action listener and avoid recalculating statistics
  just to filter the table.
- [x] Align the countdown with the displayed 13:00 opening time.

See README.md for local commands and the limits of the automated checks.
