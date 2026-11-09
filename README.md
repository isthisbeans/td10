# TRIAMDOD 10

Thai concert website built with plain HTML, CSS and JavaScript, with a Cloudflare
Worker for Google sign-in, D1 order records and private R2 payment slips.
The owner reports successful Cloudflare resource creation, database migrations
and deployment. The configuration now contains the actual D1 database ID.
The slip and student-info updates, including migrations `0003` and `0004`, still
need deployment.
Live Google sign-in and the complete buyer/admin flow still need browser checks;
this workspace could not fetch the deployed API independently.
See [CLOUDFLARE.md](CLOUDFLARE.md) for setup and deployment.

The production login origin is now `https://triamdod.com` in `wrangler.jsonc`.
Deploy that configuration and add the same URL to the existing Google Web client's
Authorized JavaScript origins. Connecting the custom domain alone does not update
either setting. Use this domain for sign-in and `/admin`.

## Run locally

Use Node.js 22.13+ (Node 24 recommended).
From this directory:

```sh
npx wrangler d1 migrations apply DB --local
npx wrangler dev --port 3000
```

Open `http://localhost:3000` and `/admin`. Local D1/R2 state stays in `.wrangler/`;
local testing does not upload orders to the live database. Run the migration
command again when new migration files are added.

Add `http://localhost` and `http://localhost:3000` to the Google web client's
Authorized JavaScript origins. Local cookies are HttpOnly and SameSite=Strict;
the deployed site uses Secure `__Host-` cookies and its configured HTTPS origin.
`node server.js` is a static preview only; authentication and orders need Wrangler.

## Sign-in and checkout

The pink สมัครสมาชิก cassette is the single Google sign-in entry. It keeps the
cream label, red glow and full reel-window EJECT button. After a signed-out session
is confirmed, Google's sign-in button prepares quietly in the closed, inert modal.
Opening login reuses its loaded frame; an early opening waits for that frame before
revealing the cassette. No checking message or automatic Google prompt is shown.

Instagram, LINE, Facebook and other detected app WebViews show a browser handoff
instead of loading the unsupported Google popup. LINE uses its documented
`openExternalBrowser=1` link; other Android apps offer a Chrome intent. On iOS and
when an app blocks the launch, Thai instructions, a visible selectable link and
a copy button let visitors continue in Safari or Chrome. A sign-in help toggle
also offers these steps when an app hides its identity. The destination reopens
sign-in and preserves a requested package, shirt color and size; it obtains its
own nonce and session, with no account details or credentials in the handoff URL.
For links shared through LINE, use `https://triamdod.com/?openExternalBrowser=1`
to open the site in the external browser immediately. Embedded browser detection
depends on the app's user-agent; physical Instagram/LINE device checks remain
necessary. See [Google browser support](https://developers.google.com/identity/gsi/web/guides/supported-browsers)
and [LINE external links](https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/#opening-url-in-external-browser).

Returning signed-in accounts skip the Google download. The Worker checks Google's signature, audience, issuer, expiry,
verified email and browser-bound nonce. A short-lived HttpOnly cookie holds the
Google ID token; there are no passwords, client secrets, refresh tokens or tokens
in localStorage. Sessions last up to one hour. Logout clears this site's session.

The header restores the account without opening the modal, hides เข้าสู่ระบบ,
and shows the themed account panel with name, email and student/alumni/admin
status. Session expiry and returning to a tab recheck the session.
The official concert pass shows all five package rows in gold while signed out.
After verified sign-in, the account's student or alumni packages stay gold and
the other group has a subtle gray fill. Logout restores all five gold rows.

School Workspace accounts with both `hd=tun.ac.th` and a matching school email use
student packages 1–3. Other Google accounts use alumni packages 4–5. Cards,
keypad shortcuts, checkout and the server enforce this division. Coin insertion
and the handset remain optional effects. Shirt packages (3–5) show Espresso and
Sand Beige color choices alongside the booth's size picker. These choices carry
through checkout, purchase confirmation and payment, including when returning
to the booth to edit them. Packages without shirts hide the color controls.
For school accounts, the Worker reads
student ID from a numeric school email and class/room/number from the Google
name prefix: `611.16 Name` means ม.6 / ห้อง 11 / เลขที่ 16. Other formats show
unavailable details. This reads the school account naming convention; it is not
an independent school-roster or enrollment check.

Students proceed straight to the phone booth using their verified Google name
and email. Alumni enter their own name, phone, shipping address and batch, then
save them locally. The name starts empty unless they previously saved it;
Google's display name is not copied into the delivery form.
Drafts are separated by verified Google account ID and survive logout. Editing a
draft requires saving it again. Choosing a package first resumes its checkout
when the required delivery details have been saved.

The phone booth is the only package/color/size picker. Continuing opens the
gold cassette titled “ยืนยันรายการที่เลือก”, showing the selected package,
contents, total, shirt options, buyer and delivery details. Its confirmation
button goes directly to the cobalt-blue cassette for QR payment and slip upload.
Both edit buttons return to the booth with the current choices. Editing clears
the previous confirmation and slip; returning requires confirming the updated
summary again. Reviewing or confirming alone does not create an order.

The account card has logout, “ตรวจสอบคำสั่งซื้อ”, and phone-booth actions in that
order. Order history is loaded only when requested and stays in its own jade-green
cassette, with status badges, an empty state, refresh, and saved receipt details.
Submitting a slip also opens its receipt in this cassette. Returning buyers can
check orders without a local alumni delivery draft. Only the current account's
server-backed orders are shown; logout clears them and ignores late responses.
Decorative cassette backs stay visible behind the active screen. Choosing an
action brings its cassette forward and moves the previous one behind it, while
inactive forms and receipts remain hidden and inert.

Submitting a slip creates a `pending` order and a buyer snapshot in D1. Drafts
stay local until submission; sign-in alone creates no customer record. The Worker
sets the Google account/email, package price, role, order ID and timestamp.
Student orders also snapshot the available student ID, grade, room and number.
These come from the verified Google profile, ignoring browser-submitted values,
and appear in student info/receipts and admin rows, slip details, search and CSV.
Older orders keep missing academic fields rather than inventing historical data.
Slips are prepared asynchronously as JPEGs (longest edge 1600 px), lowering
quality and then dimensions as needed to stay at or below 500,000 bytes. The
preview shows exactly the image that is uploaded, with no compression message.
The Worker and database also cap new slips at 500,000 bytes. Original selections
are limited to 8 MiB; existing larger stored slips remain readable.
Images are saved in a private R2 bucket. The image route checks the buyer/admin session
on every request and disables caching. Lists contain metadata and private image
URLs, with at most 50 orders per page. Images are loaded only when opened.

Failed requests do not show a success screen. Retries keep an idempotency key;
the database also rejects reuse of identical slip bytes. This does not detect
re-photographed transfers or verify a bank payment. Payment review is manual.

Signed-in buyers can open คำสั่งซื้อของฉัน from their account, reopen a receipt
and load its latest approval/rejection status on another device. Order history
stays hidden until orders exist, with one refresh control on the account screen.
The buyer view shows the latest 50 orders without a load-more button.
The admin table also stays hidden when its result list is empty. Old browser demo
orders remain untouched locally and are never imported as real purchases.

## Owner and administrators

`OWNER_GOOGLE_EMAIL` is set to `sulinx.b@gmail.com`. On its first verified Google
sign-in after migrations, ownership is pinned to that Google subject in D1.
Open `/admin` or จัดการคำสั่งซื้อ in the account panel to reach the dashboard.

Only this owner can view/manage the admin list. Add another account's exact
Google email there; Gmail and Google Workspace accounts activate when they sign
in and are then pinned to their Google subject. Other admins can review orders
but cannot add/remove admins. Removing an entry revokes access on subsequent
requests, including existing sessions. The owner cannot be removed through this
list. Changing the configured owner email alone does not transfer pinned ownership.

The old demo password, browser admin flag, mock data generator and local order
writes are removed. Every protected API checks the verified identity and D1
permissions. Admins can approve/reject pending orders and correct an approved
order to rejected or a rejected order to approved. Each change atomically updates
the latest version and appends an audit record; stale/same-status requests write
nothing. Shirt production counts and revenue follow the current approved orders.
Admin groups distinguish ม.4, ม.5, ม.6, all students and alumni using saved student
details; historical missing grades stay under all students. There are no order
delete/reset or demo-data controls. Search/filtering runs on the server; CSV exports
the current page, renders buyer text safely and neutralizes spreadsheet formulas.
Dashboard totals come from small transactionally maintained summary groups,
avoiding full order scans after each review. Role/package filters have indexes.
Grade, room and number share an aligned row in both the admin list and slip
inspector, with student ID on its own line below. The buyer's student card also
places ID below the class details. Missing historical values display as a dash.

The admin dashboard uses compact totals and a five-column order list, with
buyer/shipping details in the slip inspector. On phones, rows become stacked
cards. Stock counts and owner-only admin management are collapsed by default;
the admin list loads only when opened. Click a total to filter quickly, clear all
filters in one click, and use previous/next pages without losing the current
page on refresh. CSV still includes the complete fields for the current page.

One inspector contains the slip, approval controls and inline rejection reason.
Previous/next controls move between the current page's orders. The checked
auto-next option opens another pending order after saving a pending review;
turn it off to close the inspector after saving. Corrections to an existing
approved/rejected decision close the inspector. Successful reviews update the
returned order locally and reload only the global totals, with a list reload
when a page needs refilling. Concurrent/stale reviews still reload the server
state. Refresh or return to the tab to load other admins' latest decisions.

Reviewed orders show the approving or rejecting admin's saved Google email and
review time in the admin list, slip inspector and CSV. The inspector also loads
the full decision history, including the admin, time and rejection reason for
each change. Existing review records supply historical attribution without a new
migration. Reviewer emails are visible only to admins.

The dashboard loads one stylesheet and one font family, with no animated
backgrounds or grain filters. Its local HTML/CSS/JavaScript assets are about 31%
smaller than the previous dashboard (external font bytes excluded). This is a
file-size comparison, not a measured live load-time result.

## Project files and deployment

- `index.html`, `admin.html`, `css/`, `js/`, `assets/`: themed public pages/assets.
- `worker/auth.mjs`, `http.mjs`: Google sessions, bounded JSON and origin checks.
- `worker/orders.mjs`, `admin-access.mjs`: orders, private slips and owner/admin permissions.
- `migrations/`: D1 schema and indexes for orders, reviews, owner and admin list.
- `js/catalog.js`: one immutable package catalog used by the browser and Worker.
- `js/api.js`: small shared API client. `js/profiles-store.js`: local alumni drafts.
- `js/slip-image.js`: bounded JPEG preparation shared by preview and upload.
- `scripts/build-cloudflare.mjs`: rebuilds public-only `dist/`.
- `reference/`: preserved design references and old logs; excluded from deployment.
- [UNFINISHED.md](UNFINISHED.md): remaining launch work and deferred features.

```sh
node scripts/auth-browser.test.mjs
node scripts/order-reviews.test.mjs
node scripts/build-cloudflare.mjs
npx wrangler deploy --dry-run
```

The build excludes Worker source, migrations, reference files, scripts and
docs from public assets. Worker code is bundled separately by Wrangler. A static
ZIP upload cannot run the API. The API requires the database migrations first.

For 2,000 buyers submitting one slip each, new images occupy at most 1 GB in R2,
below its 10 GB-month Standard free allowance. This is a storage estimate, not
a guarantee against daily request/read/write limits, CPU limits or concurrent
traffic. See [CLOUDFLARE.md](CLOUDFLARE.md) for quotas and deployment commands.

## Phone layout and interaction pass — 19 October 2026

The public page keeps its retro artwork, colors and fonts, with a fitted countdown,
wrapping ticket labels, contained merchandise controls and larger touch targets.
The menu collapses before desktop links run out of room and resets after resizing.
Signed-in members see their member pass directly when opening the phone menu;
the extra account-icon toggle is hidden there. Desktop retains its account popup.
On phones and tablets, all three shirt views (brown front, beige front and back
print) stay available in a native horizontal swipe gallery with original 4:5
proportions, visible captions and a swipe hint. Color controls reveal the matching
front without moving the page; both selectors stay in sync and reservations retain
the chosen color. Rotation preserves the selected view. Desktop keeps the full
rack. Rack height follows the artwork without squeezing shirts together.

Phone-booth packages use full-width vintage phonecards with readable names,
descriptions, prices and selected states. The complete telephone booth stays
expanded above the packages on narrow screens, with no extra toggle to open it.
Desktop keeps its complete phone booth and side-by-side packages. Active cards
no longer scale into their neighbors, and each responsive component owns its
layout rules instead of combining conflicting dimensions from two stylesheets.
Checkout and photo dialogs scroll on short screens and respect screen safe areas.
The reel-window EJECT buttons dismiss account and checkout cassettes.

Public dialogs share focus handling and an iOS-compatible fixed-body scroll lock.
Closing an inactive dialog cannot unlock another, Escape dismisses the front
dialog, and closing restores the page position and a visible trigger. Google
sign-in fits its container and resizes after rotation. Admin navigation, filters,
review headers and fields also fit narrow screens with larger touch controls.

## Phone performance pass — 19 October 2026

Phones, coarse-pointer devices, Save-Data users and slow 2G connections use lighter
rendering. The retro background artwork stays visible but its continuous floating,
spinning and shimmer animations stop. Small static grain replaces full-screen SVG
turbulence, sticky navigation and dialogs avoid backdrop blur, and shirt/cassette
shadows and video color filters are simplified. Layout, print artwork and controls
stay intact. Normal desktop rendering keeps its full presentation.

The TV autoplays muted and inline when visible on phones and computers. Tapping
the screen pauses it; tapping again resumes, with no extra play-button UI.
Playback pauses when offscreen, hidden or covered by a dialog, while manual pause
stays paused. A blocked autoplay attempt can be retried by tapping the screen.
Phone static feedback paints one reused frame
without an animation loop. The soundtrack has no media source until playback is
requested, and general phone taps do not start it. The explicit sound controls
still work. Desktop keeps first-gesture music.

Public dialogs pause video, music, countdown timers, Snake and background CSS
animations. Countdown and explicitly requested music can resume after closing;
Snake waits for the player. These changes reduce background rendering and
requests; they are not measured phone FPS, CPU, memory or load-time results.

## Performance and reliability pass — 19 October 2026

The three displayed organizer/concert logos now use lossless WebP: 784,349 bytes
became 446,992 bytes, a 43.0% reduction with identical decoded RGBA pixels. The
original PNGs remain available for design work. Explicit image dimensions reserve
their space, and the first-screen title/logo appear without waiting for a scroll
reveal. The decorative equalizer and ticket foil animate transforms instead of
changing layout or repainting their backgrounds each frame. Reduced-motion
preferences apply across the public page and checkout components.

CRT noise updates at most 30 times per second, reuses its pixel buffer, and ignores
late playback after the page becomes hidden. Snake pauses outside its section and
resumes on user action. Repeated effects reuse noise samples; camera clicks no
longer queue a winder timer, and repeated shirt/phone feedback replaces old timers.
The Google SDK and nonce request start together after a signed-out session is
confirmed, so the official button can load before the login panel opens. Worker
requests reuse imported public keys during their certificate lifetime while still
verifying every token signature, expiry and permission check.

The build keeps modular source files and emits a hashed stylesheet/script per
page. It stages complete output before replacing `dist/`, preserves the previous
output on build errors, and retains a recovery copy if replacement and restoration
both fail. Static preview serves public page resources, supports HEAD responses
and media ranges, and excludes private files. Build locally with
`node scripts/build-cloudflare.mjs`; deployment commands are in CLOUDFLARE.md.

## Initial cleanup results (before the sign-in reset)

Local CSS linked by the admin page fell from 235,044 to 43,405 bytes (81.5%).
Public CSS fell from 206,991 to 201,238 bytes (2.8%); files now load directly
without a stylesheet import chain. Font-family
requests fell from 15 to 10 publicly and from 15 to 5 in admin.

Music waits for interaction. Video and countdown activity pause while offscreen
or hidden; game activity pauses in hidden tabs. Camera effects share one audio
context, and CRT noise reuses a 160 × 120 pixel buffer rather than allocating a
new full-size buffer every frame. Slips are resized before upload and are no longer stored in browser localStorage.

These are source/behavior improvements, not measured load-time or memory claims.
