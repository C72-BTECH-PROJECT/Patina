# Patina visual refresh: design spec

Written 2026-11-15 on branch `design/refresh`. **Approved by Anthony on 2026-11-15, with changes**, and this
version includes them:
- the Blue leather palette;
- a violet "Partly verified";
- the stitched-tag logo (replaced on 2026-11-15 by the layered-L mark, `brand/patina-mark.svg`);
- the card priority;
- the framer-motion rule;
- the go-ahead for O-10.

It specifies card R-35 (`REBUILD/TASKS.md`, cards R-35a to R-35k) and replaces that card's "Do" with the
D-cards in §10. `main` stays the demo fallback and does not change.

**Companion files** (all in `Docs/design-refs/`):

| File | What it is |
|---|---|
| `mock.html` | Login, score breakdown and token sheet, in the final palette |
| `mock-blue.html` | Anthony's palette study. Its default "Blue leather" `:root` values are the source of §2 |
| `brand/patina-mark.svg` | The mark: the layered-L. `brand/` also holds the favicon and app icons |

The breakdown in the mock is filled from a real stored score, `tests/e2e/output/r16-r17/recruiter-detail-A.json`
(the e2e run of 2026-11-13). That row was stored before weights versions existed, so the mock shows the
legacy wording and no verification chip. The token sheet shows the full chip set.

---

## 1. Direction

**Blue leather.** A patina is what a material earns with use: it cannot be faked or rushed. The refresh
reads that as worn, trusted leather.

- **The base and the brand colour.** A cool paper base, white working surfaces, and one deep blue-leather
  primary (`#1F3D58`) that carries every action.
- **The mark.** The logo is a layered L on a tile in that blue: three white L strokes stacked up and to the
  right, with a small verdigris square (`#5FC4B0`), the patina itself, at the top right. It is the only
  decorative colour in the product.
- **Colour has one meaning each.**
  - **Green** means evidence and verification only: Evidenced, Verified, a Confirmed mark, a factor that
    raises the score, a right answer, the high-band ring.
  - **Amber** means a claim with nothing behind it.
  - **Red** means not found or negative.
  - **Violet** means partly verified.
  - Nothing else in the UI is green. Success messages and completed steps use the primary blue.
- **Layout.** Work happens in contained white cards, each with one job, so a page reads at a glance
  (Anthony on Workable). Headings use a characterful display face; everything else uses quiet Inter.
- **Motion.** Motion is soft and short, and it always explains something (Spade's restraint, Auxia's
  fade-ins). The single loud moment is the score ring filling and counting up to the real number.

**What it does not do:**
- invent a number;
- change a page layout, a route or a data flow;
- add a dark mode, which is out of scope.

---

## 2. Colour tokens

All tokens are defined once, as HSL triplets in `frontend/src/index.css :root`, and read by
`tailwind.config.js` through the existing `token()` helper. They work in Tailwind classes and in SVG
attributes alike (`hsl(var(--x))`). **The token names are the existing ones**, so every page that uses
`bg-background`, `text-muted-foreground`, `bg-primary` and the other semantic classes re-themes with no JSX
change. The values are the effective defaults of `mock-blue.html`: its base `:root` overridden by its
"Blue leather" `:root`.

### 2.1 Core

| Token | Hex | HSL triplet | Use |
|---|---|---|---|
| `--background` | `#F2F3F5` | `220 13% 95.5%` | Page background (cool paper) |
| `--surface` (new) | `#FFFFFF` | `0 0% 100%` | Cards, inputs, table rows |
| `--foreground` | `#161B21` | `212.7 20% 10.8%` | Body text (ink) |
| `--muted` / `--secondary` | `#E7EAEE` | `214.3 17.1% 92%` | Sunken panels, hover fill, neutral chip |
| `--muted-foreground` | `#55606B` | `210 11.5% 37.6%` | Secondary text |
| `--border` | `#D8DDE3` | `212.7 16.4% 86.9%` | Card and divider lines |
| `--input` | `#7B8490` | `214.3 8.6% 52.4%` | Input borders only. They need 3:1 against the surface (WCAG 1.4.11) |
| `--track` (new) | `#E1E5EA` | `213.3 17.6% 90%` | Ring track, bar track |
| `--primary` / `--ring` | `#1F3D58` | `208.4 47.9% 23.3%` | Primary buttons, links, focus ring, active nav, logo tile, success messages, completed steps |
| `--primary-hover` (new) | `#172F45` | `208.7 50% 18%` | Primary hover |
| `--primary-soft` (new) | `#E2EAF2` | `210 38.1% 91.8%` | Primary tint panels (success message, active row) |
| `--primary-foreground` | `#FFFFFF` | `0 0% 100%` | Text on primary |
| `--secondary-foreground` | `#161B21` | `212.7 20% 10.8%` | Text on secondary |
| `--success` | `#1B6F3B` | `142.9 60.9% 27.1%` | **Evidence and verification only:** positive marks, the "raises" direction, right answers, the high-band ring |
| `--warning` | `#B2700C` | `36.1 87.4% 37.3%` | Icons, borders, medium-band ring. **Never used for text, and never under text** |
| `--warning-text` | `#6F5600` | `46.5 100% 21.8%` | Amber text |
| `--warning-foreground` | `#161B21` | `212.7 20% 10.8%` | Kept for the token set. `bg-warning` is never a text background |
| `--destructive` | `#BB3326` | `5.2 66.2% 44.1%` | Negative text, icons, low-band ring, destructive button |
| `--success-foreground` / `--destructive-foreground` | `#FFFFFF` | `0 0% 100%` | Text on those fills |

**Fixed colours that are not tokens:**
- The logo's verdigris square, `#5FC4B0`. In the app it is the `--verdigris` token, used only inside
  `PatinaMark`; the brand icon files carry it as a literal.
- **Shadows and focus**, which use the palette's ink `rgb(22 27 33)` and primary `rgb(31 61 88)` (§4).

**Removed since the first draft:** the `--copper` and `--info` tokens. Nothing uses them now.

### 2.2 Evidence status (skill table): `Evidenced` · `Claimed only` · `Not found`

| Status | Chip bg | Chip text | Chip border | Icon (lucide) | Text contrast |
|---|---|---|---|---|---|
| Evidenced | `#E3F2E7` | `#1D6A36` | `#B9DEC3` | `CheckCircle2` | 5.72:1 |
| Claimed only | `#FBF3D2` | `#6F5600` | `#EAD891` | `CircleDashed` | 6.27:1 |
| Not found | `#FBE5E2` | `#A1271C` | `#F1BDB6` | `XCircle` | 6.17:1 |

### 2.3 Verification (score): `Unverified` · `Partly verified` · `Verified`

| State | Chip bg | Chip text | Chip border | Icon (lucide) | Text contrast |
|---|---|---|---|---|---|
| Unverified | `#E8EBEF` | `#4A525C` | `#D0D6DD` | `Shield` | 6.62:1 |
| Partly verified | `#EFEAFB` | `#5B3F9E` | `#D3C6F1` | `ShieldHalf` | 6.73:1 |
| Verified | `#DDEFE7` | `#0F5946` | `#A9D6C3` | `ShieldCheck` | 6.93:1 |

**Colour is never the only signal.** Every status chip carries an icon as well as a colour (WCAG 1.4.1).

**Why violet for "partly verified".** It cannot be mistaken for the blue primary, the verification greens
or the neutral "unverified".

### 2.4 Contrast record (re-run 2026-11-15 for the Blue leather values; WCAG 2.x relative luminance)

| Pair | Colours | Ratio | Needed | Result |
|---|---|---|---|---|
| foreground on background | `#161B21` on `#F2F3F5` | 15.59 | 4.5 | PASS |
| foreground on surface / muted | `#161B21` on `#FFFFFF` / `#E7EAEE` | 17.31 / 14.35 | 4.5 | PASS |
| muted-foreground on background / muted / surface | `#55606B` | 5.78 / 5.32 / 6.42 | 4.5 | PASS |
| white on primary / primary-hover | `#FFFFFF` on `#1F3D58` / `#172F45` | 11.25 / 13.73 | 4.5 | PASS |
| primary on surface / background | `#1F3D58` | 11.25 / 10.13 | 4.5 | PASS |
| primary on `primary/10` over background / on primary-soft | `#1F3D58` on `#DDE1E5` / `#E2EAF2` | 8.56 / 9.26 | 4.5 | PASS |
| success on `success/10` over background (worst tint) / on surface | `#1B6F3B` | 4.87 / 6.21 | 4.5 | PASS |
| destructive on `destructive/10` over background (worst tint) / on surface | `#BB3326` | 4.52 / 5.81 | 4.5 | PASS |
| warning-text on `warning/10` over background / on surface | `#6F5600` | 5.63 / 6.98 | 4.5 | PASS |
| white on success / destructive | `#FFFFFF` | 6.21 / 5.81 | 4.5 | PASS |
| chips: Evidenced / Claimed only / Not found | §2.2 | 5.72 / 6.27 / 6.17 | 4.5 | PASS |
| chips: Unverified / Partly verified / Verified | §2.3 | 6.62 / 6.73 / 6.93 | 4.5 | PASS |
| ring strokes on track: success / warning / destructive / foreground | on `#E1E5EA` | 4.91 / 3.18 / 4.59 / 13.68 | 3 (non-text) | PASS |
| input border on surface / background | `#7B8490` | 3.79 / 3.41 | 3 (non-text) | PASS |
| focus ring (primary) on background / surface | `#1F3D58` | 10.13 / 11.25 | 3 (non-text) | PASS |
| warning icon on surface | `#B2700C` | 4.03 | 3 (non-text) | PASS |
| logo: verdigris square / white strokes on the primary tile | `#5FC4B0` / `#FFFFFF` on `#1F3D58` | 5.36 / 11.25 | 3 (non-text) | PASS |

**The tightest pairs:**
- destructive text on its own 10% tint over the page background, 4.52;
- the warning ring on the track, 3.18.

Neither tint may get lighter, and neither colour may change, without re-running this record. D-10 re-runs it
from the built CSS.

---

## 3. Type

| Role | Font | Size / line height | Weight | Tracking | Tailwind / class |
|---|---|---|---|---|---|
| Display (landing hero only) | Bricolage Grotesque | 56/1.05 at md and above, 40/1.1 below | 700 | -0.03em | `font-display text-[40px] md:text-[56px]` |
| h1 | Bricolage Grotesque | 30/1.2 | 600 | -0.02em | `.text-h1` (redefined) |
| h2 | Bricolage Grotesque | 22/1.3 | 600 | -0.01em | `.text-h2` (redefined) |
| h3 | Inter | 17/1.4 | 600 | 0 | `.text-h3` (redefined) |
| Body | Inter | 16/1.6 | 400 | 0 | `.text-body` |
| Body small | Inter | 14/1.5 | 400 / 500 | 0 | `.text-body-sm` |
| Caption | Inter | 12/1.45 | 400 / 500 | 0 | `.text-caption` |
| Eyebrow | JetBrains Mono | 11/1.4 | 500 | 0.08em, uppercase | `.eyebrow` (new) |
| Figures | Inter, `tabular-nums` | as the context | 600 | 0 | `.tabular-nums` |
| Score number in the ring | Bricolage Grotesque | 44/1 | 700 | -0.03em | in ScoreRing |

- **Loading.** One Google Fonts request replaces the current Inter `@import` at `index.css:1`:
  `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap`.
- **Tailwind families.**
  - `fontFamily.display` and `fontFamily.heading` become `['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif']`.
  - `sans` becomes `['Inter', 'system-ui', '-apple-system', 'sans-serif']`.
  - `mono` becomes `['"JetBrains Mono"', 'ui-monospace', 'monospace']`.

---

## 4. Spacing, radius, shadows

- **Spacing.** Tailwind's 4px scale is unchanged. Conventions:
  - card padding `p-6`, or `p-8` for the composite card;
  - `gap-3` within a group, `space-y-6` between sections in a card, `mb-6` between cards;
  - page gutters stay as they are (layouts are frozen).
- **Radius.**
  - `rounded-md` (8px): buttons, inputs, nav items.
  - `rounded-lg` (12px): inner panels (factor boxes, summary, notes, alerts).
  - `rounded-xl` (16px): cards and modals.
  - `rounded-full`: chips.
  - Override Tailwind with `borderRadius: { md: '8px', lg: '12px', xl: '16px' }`. `'4xl': '2rem'` stays.
- **Shadows.** All are tinted with the palette's ink `rgb(22 27 33)`, never pure black. Focus uses its
  primary `rgb(31 61 88)`.
  - `shadow-xs`: `0 1px 2px rgb(22 27 33 / .06)`. Primary buttons.
  - `shadow-card`: `0 1px 2px rgb(22 27 33 / .05), 0 4px 12px -4px rgb(22 27 33 / .08)`. Cards.
  - `shadow-pop`: `0 12px 32px -8px rgb(22 27 33 / .18), 0 2px 6px rgb(22 27 33 / .06)`. The auth card,
    modals, popovers.
  - `shadow-focus`: `0 0 0 3px rgb(31 61 88 / .28)`. Focus, together with `border-primary`.

---

## 5. Motion

### 5.1 Rules
1. **CSS transitions and keyframes by default.** No new framer-motion code anywhere.
   - **Where framer is removed.** It comes out only of files a card restyles.
   - **The exception.** If removing it from a file makes a test fail, the card restores that file's framer
     usage, keeps it, and records the file and the failing test on the card.
   - **The dependency.** `framer-motion` stays in `package.json` until after Nov 18 (Anthony, 2026-11-15).
2. **No effect here needs a motion library.** The ring's count-up is about 25 lines of
   `requestAnimationFrame` in a hook (§5.3). Bars and staggers are CSS keyframes. Exit animations are dropped,
   not reproduced.
3. **Everything respects `prefers-reduced-motion: reduce`.**
   - A global rule in `index.css` reduces all CSS animation and transition durations to 0.01ms.
   - `<MotionConfig reducedMotion="user">` in `App.jsx` covers any framer usage left during the migration.
   - The count-up hook returns the final value immediately.
4. **Motion never hides content from tests or readers.** Entrance animations use `animation-fill-mode:
   backwards`, so nothing keeps a `transform` after it ends (a lingering transform would trap fixed-position
   modals). No element starts with `visibility: hidden`.
5. **Nothing loops,** except the existing spinners.

### 5.2 Tokens (CSS custom properties in `index.css`, plus Tailwind `transitionDuration` / `transitionTimingFunction`)

| Token | Value | Use |
|---|---|---|
| `--dur-press` | 100ms | `:active` scale (0.98) on buttons |
| `--dur-fast` | 150ms | Hover colour, border and shadow changes |
| `--dur-base` | 220ms | Page entrance, list item entrance, modal pop |
| `--dur-slow` | 400ms | Evidence bars filling |
| `--dur-signature` | 1200ms | Score ring and count-up |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | Everything except the ring |
| `--ease-emph` | `cubic-bezier(.16,1,.3,1)` | The ring arc. The count-up uses the matching `1-(1-t)^4` |
| `--stagger` | 40ms | Per list item, capped at the 8th item (max 280ms) |

### 5.3 The signature moment: the score ring
On the candidate Results page (`/candidate/results/:id`) the ring arc draws from 0 to the value over 1200ms,
and the number counts up to the same value over the same time. The arc starts 120ms after mount. The evidence
bars in the breakdown fill after it, 300ms later.

**The constraint.** The e2e spine (`tests/e2e/spine.spec.mjs:310-313`, `:545-548`) waits for
`[data-testid="application-score"][data-state="scored"]` to be visible, then reads its `innerText` **once**
and compares it with the API value. A visible counting number on that element would fail the test.

**The structure that keeps it passing:**
```jsx
<span data-testid="application-score" data-state="scored" className="sr-only">{String(value)}</span>
<span aria-hidden="true" className="...ring number styles...">{displayed}</span>
```
- The test element always holds the exact final string, so screen readers also hear one number, not a count.
- `sr-only` is 1×1px and clipped. Playwright counts that as visible (non-empty box, no
  `visibility:hidden`), and `innerText` returns its text.
- `displayed` comes from `useCountUp(value)` (new `frontend/src/lib/useCountUp.js`). The hook:
  - formats with the same number of decimals as `String(value)`;
  - ends on exactly `String(value)`;
  - returns `String(value)` at once under reduced motion or when `value` is not finite.
- If the spine fails on this element after D-5, D-5 is FAIL. The builder does not change the test.

### 5.4 Lists and pages
- **`.anim-rise`.** The keyframe `rise` (opacity 0 → 1, `translateY(6px)` → 0), `--dur-base`, `--ease-out`,
  `backwards`.
- **`.anim-stagger`.** On a list container: each direct child gets `rise`, with delays of 0, 40, … 280ms for
  `:nth-child(1..8)` and 280ms for every later child. Used on card grids, the factor list, dashboard rows and
  the applications table body (`tbody.anim-stagger > tr`).
- **Page transition.** Each layout wraps `<Outlet/>` in `<div className="route-root">`, and the CSS rule
  `.route-root > * { animation: rise var(--dur-base) var(--ease-out) backwards; }` applies. A route change
  mounts a new page element, so the entrance plays without any `key` and without remounting anything the app
  does not already remount. Public pages (Landing, Login, RoleSelection, ResetPassword, EmailConfirmed,
  NotFound) put `anim-rise` on their main card or hero instead.
- **Evidence bars.** The fill uses `transform-origin: left` and the keyframe `grow-x` (`scaleX(0)` → 1),
  `--dur-slow`, `backwards`, `animation-delay: 300ms`. The width is set inline as today, so no JS is needed.
- **Modal pop** (CandidateModal). The panel uses `pop` (opacity 0 → 1, `scale(.98)` → 1), `--dur-base`. The
  backdrop uses `fade` (opacity 0 → 1). No exit animation.

---

## 6. Components

### 6.1 Buttons (`Button.jsx` and the `.btn` classes in `index.css`; both must look the same)
- **Base:** `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50 disabled:pointer-events-none`.
- **Sizes:** sm `h-8 px-3 text-caption`, md `h-10 px-4 text-body-sm`, lg `h-12 px-6 text-body`.
- **Variants:**
  - primary: `bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover`;
  - secondary: `bg-secondary text-secondary-foreground hover:bg-border`;
  - outline: `border border-border bg-surface text-foreground hover:bg-muted`;
  - ghost: `text-muted-foreground hover:bg-muted hover:text-foreground`;
  - destructive: `bg-destructive text-destructive-foreground hover:bg-destructive/90`.
- **Links styled as buttons** (`<Link className="... bg-primary ...">`) get the same classes as the variant
  they imitate. Their element, `href` and text do not change.

### 6.2 Inputs
- **Text, email, password, number, select, textarea:** `h-11` (textarea `min-h-[96px] py-2.5`),
  `rounded-md border border-input bg-surface px-3.5 text-[15px] text-foreground
  placeholder:text-muted-foreground hover:border-foreground focus:outline-none focus:border-primary
  focus:shadow-focus transition-[border-color,box-shadow] duration-150`.
- **With a leading icon:** `pl-[42px]`, icon at `left-3.5`, 18px, `text-muted-foreground`.
- **Password:** `pr-11`. The show/hide toggle is a 34px `type="button"` square at `right-1.5`, with
  `hover:bg-muted rounded-sm`.
- **Labels:** `text-body-sm font-medium text-foreground mb-1.5`, with their icon inline. Labels keep their
  `htmlFor` and their text.

### 6.3 Cards
- **`.card`:** `background: hsl(var(--surface)); border: 1px solid hsl(var(--border)); border-radius: 16px;
  box-shadow: var(--shadow-card)`.
- **Inner panels:** `rounded-lg border border-border`.
  - On a white card: `bg-background`, which reads as sunken paper.
  - For notes and summaries: `bg-muted`.
- **Hover-lift cards** (landing features and the job list only): `transition-[transform,box-shadow]
  duration-150 hover:-translate-y-0.5 hover:shadow-pop`.

### 6.4 Chips (`Badge.jsx`)
- **Base:** `inline-flex items-center gap-[5px] h-[22px] px-2 rounded-full border text-caption font-medium
  whitespace-nowrap`.
- **New optional prop `icon`:** a lucide component, rendered first as `<Icon className="w-3 h-3 shrink-0"
  aria-hidden="true"/>`.
- **The root element stays a `<span>`.**
- **Variants.** Existing names keep their meaning, re-coloured:

| Variant | Classes |
|---|---|
| `default` | `bg-muted text-foreground border-transparent` |
| `outline` | `bg-surface text-foreground border-border` (also the **unknown** status/verification style; the name stays `outline`, `skillStatus.test.js:18` checks it) |
| `primary` | `bg-primary/10 text-primary border-primary/20` |
| `success` | `bg-success/10 text-success border-success/20` |
| `warning` | `bg-warning/10 text-warning-text border-warning/30` |
| `destructive` | `bg-destructive/10 text-destructive border-destructive/20` |
| `evidenced` (new) | `chip-evidenced` (index.css, §2.2 values) |
| `claimed` (new) | `chip-claimed` |
| `notfound` (new) | `chip-notfound` |
| `unverified` (new) | `chip-unverified` (§2.3) |
| `partly` (new) | `chip-partly` |
| `verified` (new) | `chip-verified` |

- **Size `md`:** `h-7 px-3 text-body-sm`.

### 6.5 Navigation (`CandidateLayout.jsx`, `RecruiterLayout.jsx`)
- **Bar:** `h-[60px]`, `bg-background/85 backdrop-blur-md border-b border-border`. No slide-in (the
  framer `y: -100` entrance is removed).
- **Wordmark:** `<PatinaMark size={28} />` followed by the text `PATINA` in `font-display font-bold
  text-[15px] tracking-[.14em] text-foreground`. The text node stays exactly `PATINA`.
- **`PatinaMark`** (new `frontend/src/components/PatinaMark.jsx`, the only place the logo is drawn):
  - **Geometry:** `Docs/design-refs/brand/patina-mark.svg`, viewBox `0 0 32 32`.
  - **Tile:** `rx="7"`, `fill="hsl(var(--primary))"`.
  - **Three L strokes:** `#FFFFFF`, `strokeWidth="3"`, `strokeLinejoin="round"`.
  - **Square:** `fill="hsl(var(--verdigris))"` (`#5FC4B0`).
  - **Props:** `size` (default 28) sets `width` and `height`; `className` is passed through.
  - **Accessibility:** `aria-hidden="true"` and `focusable="false"`, because the adjacent `PATINA` text
    names the link.
- **Favicon and app icons:** `Docs/design-refs/brand/` holds `favicon.ico`, `logo192.png`, `logo512.png` and
  `apple-touch-icon-180.png`, drawn from `patina-mark.svg` with the tile as a literal `#1F3D58` (an icon file
  cannot read CSS variables). They are copied to `frontend/public/` (the last as `apple-touch-icon.png`).
- **Role pill:** `font-mono text-[11px] uppercase tracking-[.06em] px-2 py-[5px] rounded-full border
  border-border bg-surface text-muted-foreground`.
- **Nav items:** `h-[34px] px-3 rounded-md text-body-sm text-muted-foreground hover:bg-muted
  hover:text-foreground`.
  - **Active item:** `bg-surface text-foreground font-medium ring-1 ring-border`, with a 2px `bg-primary`
    underline 13px below the item (`after:` pseudo-element).
  - **Active state** comes from swapping `Link` for `NavLink` (same import source, same `to`, still an `<a>`;
    it adds `aria-current="page"`).
- **Unchanged:** labels, `hidden sm:inline` spans, `aria-label`s, the `href="/recruiter/create-job"` link and
  the notification count.

---

## 7. Auth screens (Login / Signup, ResetPassword, RoleSelection, EmailConfirmed)
Layout stays: header row, then a centred `max-w-md` card. The treatment:

- **Background:** paper plus two soft radial washes in the primary blue:
  - `radial-gradient(60% 50% at 50% 0%, rgb(31 61 88 / .10), transparent 70%)`;
  - `radial-gradient(40% 35% at 85% 90%, rgb(31 61 88 / .06), transparent 70%)`.
- **Grid:** a 48px line grid in `--border`, masked to an ellipse behind the card (`.auth-bg` in `index.css`;
  mock §1). It nods to Auxia's line motif and stays static.
- **Card:** `.card p-8 shadow-pop anim-rise`.
- **Heading block:**
  - an eyebrow `Credibility, explained` (new decorative text, `aria-hidden` not needed);
  - the h1 in `text-h1`, keeping its text (`Welcome Back` / `Create an Account`);
  - the subtitle in `text-body-sm text-muted-foreground`, text unchanged.
- **Error alert** (`role="alert"`, `data-testid="login-error"` unchanged): `rounded-lg border
  border-destructive/25 bg-destructive/10 p-3.5`. The icon sits in a 32px `rounded-md bg-destructive/12`
  square. The title is `font-semibold text-destructive`.
- **Success message:** the same shape, in primary: `border-primary/20 bg-primary-soft text-primary`.
  Green is reserved for evidence (§1).
- **Submit:** primary, `h-11 w-full`. The text and the trailing arrow are kept, as is
  `data-testid`/`name="submit"`/`type="submit"`.
- **Links:** "Forgot password?" and "Sign Up / Log In" become `text-primary font-semibold
  hover:underline underline-offset-[3px]`. "Didn't get the confirmation email?" stays a quiet
  `text-muted-foreground` button.
- **Divider:** a `border-t border-border pt-5 mt-6` divider before the "Don't have an account?" row.

---

## 8. Landing page
Layout stays: fixed nav, hero in two columns, "How it works", footer. The copy stays (R-15 made it honest).

- **Nav:** the §6.5 wordmark. "Log In" is a ghost button and "Get Started" a primary `h-9` button. No
  slide-in.
- **Hero, left column:**
  - eyebrow chip: the current "AI-Powered Skill Validation" text, as `.eyebrow` inside a `rounded-full
    border border-border bg-surface px-3 py-1.5` pill;
  - headline: the display style (§3), with "AI-Powered" in `text-primary`;
  - paragraph: `text-lg text-muted-foreground`;
  - CTAs: primary `Get Started`, outline `Log In`, both `h-11`.
- **Hero, right column: a real breakdown.** It replaces nothing until O-10 delivers data (§10).
  - **What it shows:** a white `.card shadow-pop` titled with the eyebrow `A real stored score`, showing:
    - the ring (static, final value, no count-up on the landing);
    - the band and verification chips;
    - the three factor rows (label, sub-score, weight %, points, with the direction stripe);
    - the first six skill-table rows with their status chips.
  - **Where the data comes from:** only `frontend/src/content/landingSample.json`, and it is rendered with
    the same components the app uses (`ScoreRing`, `Badge`, `VerificationBadge`).
  - **Caption under the card:** `Captured from a real scoring run on <date> (<fixture résumé>, <job>).
    Nothing on this card was typed by hand.`
  - **If the file does not exist,** the current `ScoreInputsPanel` stays.
- **"How it works": the connecting line.** An inline SVG path runs behind the three feature cards on md and
  above. It is a 1.5px `--border-strong` line with a 6px `primary` dot at each card.
  - When the section enters the viewport (one `IntersectionObserver`, `threshold: 0.3`, sets
    `data-inview="true"`), the path draws by `stroke-dashoffset` over 900ms with `--ease-out`.
  - The cards use `anim-stagger`.
  - Under reduced motion the line is drawn at once.
  - Below md the line is not rendered.
- **Mid-page CTA:** one centred primary `Get Started` button under "How it works". It is the existing link,
  repeated (Auxia and Spade both repeat the CTA). It needs no new route.
- **Footer:** the wordmark and `© 2026 PATINA`, unchanged text.

---

## 9. Score breakdown: the centrepiece
`ScoreBreakdown.jsx` serves both the candidate Results page and the recruiter drill-down
(`CandidateModal.jsx`). Section order and every string stay. The treatment (mock §2):

- **Composite card** (Results only):
  - ring: 160px, r=52, stroke 10, round cap, track `--track`. The stroke colour comes from `bandTone`, as
    today, through `hsl(var(--success|warning|destructive|foreground))`;
  - number: in the band's text tone (`text-success`, `text-warning-text`, `text-destructive`,
    `text-foreground`);
  - a faint radial tint of the same tone inside the ring at 7% opacity;
  - chips (band, verification, evidence-limited) in `flex-wrap gap-2`;
  - the next-step note as a `bg-muted rounded-lg` panel; "Go to the assessment" as a primary text link.
- **Summary panel:** `rounded-lg border border-border bg-muted p-4`. The evidence-limited line is
  `text-warning-text`, with a `text-warning` icon.
- **Factor box:** `rounded-lg border border-border bg-surface p-4 pl-[19px]` plus a 3px left stripe
  (`relative overflow-hidden` with a `before:` pseudo-element):
  - `raises`: `bg-success`;
  - `lowers`: `bg-destructive`;
  - `sole`: `bg-primary`;
  - `neutral`: `bg-muted-foreground`;
  - `unavailable`: a dashed stripe (`repeating-linear-gradient(hsl(var(--input)) 0 6px, transparent 6px
    10px)`).
- **Factor header:**
  - the direction icon in the direction's text tone;
  - the h4 in `text-body font-semibold`;
  - the direction label in `text-caption`;
  - stat columns: value `text-body font-semibold tabular-nums`, key `text-[11px] text-muted-foreground`.
- **Metric bars:** a `h-1.5 rounded-full bg-[hsl(var(--track))]` track. The fill is `bg-primary`, or
  `bg-destructive` for a negative direction, and animates with the `grow-x` keyframe (§5.4).
- **Skill-set evidence chips** ("Job skills found / not found in the résumé") become `outline`. They are
  **no longer** `success`/`destructive`, because a résumé match is a claim and must not wear the
  "Evidenced" green (§1). The ✓/✗ icon on the heading carries the direction.
- **Per-question list:** "Right" in `text-success`, "Not right" in `text-destructive`. Both stay
  `tabular-nums`.
- **Unavailable panel** (`EvidenceUnavailable`): `rounded-lg border border-dashed border-input/60
  bg-background p-4`.
- **Skill table:**
  - headers in the eyebrow style (mono, 11px, uppercase);
  - rows `py-2.5`, `hover:bg-background`, `tbody.anim-stagger` (capped at 8 delays);
  - the status chip uses the new variants with icons (§2.2);
  - marks: Confirmed in `text-success` with `CheckCircle2`, Absent in `text-destructive` with `XCircle`,
    Unavailable / Not recorded in `text-muted-foreground` with `Minus`;
  - the `data-testid`, `data-mark` and `title` attributes are unchanged.
- **Flags panel:** the check row is a `.card`-less `rounded-lg border bg-surface p-3`. A raised flag is
  `bg-warning/10 border-warning/30` with `ShieldAlert`. The "not built yet" panel uses the unavailable style.
- **Footer line:** `text-caption text-muted-foreground`. Unchanged text.

---

## 10. Build cards

### 10.1 Order and protocol

**Priority (Anthony, 2026-11-15):**
1. **Core:** D-1 to D-6 in order, then D-10.
   - The first batch is D-1, D-2 and D-3. After it, the work stops for Anthony's visual check.
2. **Only if Anthony says the budget allows:** D-7 and D-8.
3. **D-9** waits for O-10.

**Who builds:**
- Each card is built by a Sonnet subagent (`patina-implementer`, model `sonnet`) that follows the card
  exactly.
- If a card fails its check twice, the third attempt runs on Opus.
- The lead runs the card's check itself after the subagent reports. This is the budget rule: no separate
  verifier agent.

**Every card:**
- Runs on `design/refresh` only.
- Commits nothing. Anthony commits.
- Is tracked in `REBUILD/TASKS.md` as R-35a to R-35k, pointing to its full text here, and is logged per the
  session protocol.

**Hard limits on every card:**
- No route, layout grid, data fetch, prop contract or API call changes.
- Every `data-testid`, `data-*` attribute, `role`, `aria-*`, label text, button text, heading text and
  `title` prefix the tests rely on stays byte-identical. The inventory is §11.

**Global check (`G`) at the end of every card** (Git Bash, from the repo root). The baseline on
2026-11-15, before D-1, was 11 suites and 121/121 tests passing, with the build at exit 0:
```bash
cd frontend && CI=true npx react-scripts test --watchAll=false   # all suites pass, 121 or more tests
CI=true npm run build                                            # exit 0; CI=true turns any lint warning into a failure
cd .. && git status --short                                      # only the card's files changed
git diff -U0 -- frontend/src | grep -E '^[-+].*(data-testid|aria-|role=|htmlFor|title=)'   # every removed line has an identical added line, or the card names the change
```
The e2e spine (`powershell -File tests\run-suite.ps1 -Suites e2e`, with the stack running) runs once after
D-5 and once in D-10. That is the budget rule: one e2e per batch.

---

### D-1 · Foundation: tokens, config clean-up, fonts, global motion
- **Files:**
  - `frontend/tailwind.config.js`
  - `frontend/src/index.css`
  - `frontend/src/App.jsx` (one wrapper only)
- **Do:**
  1. `index.css:1`: replace the Inter `@import` with the §3 URL.
  2. `index.css :root`:
     - Set every token in §2.1 to its HSL triplet (keep the variable names; add `--surface`, `--track`,
       `--primary-hover`, `--primary-soft`). The hex value goes in a trailing comment, as the file does
       today.
     - Add the motion tokens of §5.2 and the shadow values of §4 as `--shadow-xs`, `--shadow-card`,
       `--shadow-pop` and `--shadow-focus`.
     - Delete `--accent-purple`, `--accent-cyan`, `--accent-pink`, `--accent-emerald` and
       `--glow-intensity`.
  3. `html, body`: `background: hsl(var(--background)); color: hsl(var(--foreground))`; the font family is
     `'Inter', system-ui, -apple-system, sans-serif`.
  4. `.card`: as §6.3. `.btn`, `.btn-primary`, `.badge`, `.badge-primary`: re-point to the tokens, with
     values per §6.1 and §6.4 (the same visual result as `Button`/`Badge`).
  5. Redefine `.text-h1`, `.text-h2` and `.text-h3` per §3. Add `.eyebrow`.
  6. Add to `@layer components`:
     - the six chip classes `.chip-evidenced` … `.chip-verified`, with the exact hex values of §2.2 and
       §2.3 for bg, text and border;
     - `.auth-bg` (§7);
     - `.route-root > *`, `.anim-rise`, `.anim-stagger` with `:nth-child(1..8)` delays, `.bar-grow`
       (`transform-origin:left; animation: grow-x var(--dur-slow) var(--ease-out) 300ms backwards`),
       `.anim-pop`, `.anim-fade`;
     - keyframes `rise`, `grow-x`, `pop`, `fade`.
  7. Add the global `@media (prefers-reduced-motion: reduce)` block, exactly as in `mock.html` (the end of
     its `<style>`).
  8. **Delete these unused classes** (the grep at `design/refresh` HEAD found no JSX use):
     - `.glass-card`, `.glass-card-hover`, `.glow-border` (and its pseudo-elements), `.magnetic-btn`;
     - every `.glow-orb*`, `.gradient-text`, `@keyframes gradient-shift`, `.floating-particle`,
       `.noise-overlay`;
     - `.input-glow:focus`, `.scan-line`, `.pulse-ring` (and `::after`), `.reveal-up` (and `.visible`),
       `.spotlight` (and `::before`), `.neon-edge`, `.progress-glow` (and `::after`), every
       `.corner-decoration*`;
     - `.animated-underline` (and its pseudo-elements);
     - the second copies of the scrollbar and `::selection` blocks (lines 282-303; keep the first copies).

     Also delete `.skeleton` (and its keyframes), `.counter-value` and `.bg-grid-pattern`, which are unused too. **Keep** `.card-lift` (Landing uses it).
     Selection colour: `background: hsl(var(--primary)); color: #fff`.
  9. `tailwind.config.js`:
     - **Delete** the `accent` block (purple, cyan and pink were all `#0a0a0a`; emerald, amber and rose
       are unused), the whole `glow` block, `border.glow`, `background.primary/secondary/tertiary`,
       `foreground.muted`, `surface.hover/elevated` and `backgroundImage.mesh-gradient`.
     - **Delete** the animations `glow-pulse`, `float`, `scan`, `rotate-slow`, `particle-drift`,
       `gradient-shift`, `border-rotate`, `counter`, `reveal-up` and `reveal-scale`, with their keyframes.
       The grep found no JSX use.
     - **Delete** the boxShadows `glow-*` and `inner-glow`.
     - **Add colours:** `surface: token('surface')`, `track: token('track')`, `primary.hover:
       token('primary-hover')` and `primary.soft: token('primary-soft')`. Replace the existing `surface`
       object (`DEFAULT/hover/elevated`) with the single token.
     - **Add** the boxShadows `xs`, `card`, `pop` and `focus` (§4), and `borderRadius` md, lg and xl (§4).
     - **Add** `fontFamily` per §3, `transitionDuration` `{ press: '100ms', fast: '150ms', base: '220ms',
       slow: '400ms' }` and `transitionTimingFunction` `{ out: 'cubic-bezier(.2,.7,.2,1)', emph:
       'cubic-bezier(.16,1,.3,1)' }`.
  10. `@tailwindcss/vite`: it is **already gone** from `frontend/package.json` and `package-lock.json`
      (removed in `219249b`; verified 2026-11-15). Do not edit `package.json`. Record the check only.
  11. `App.jsx`: wrap the existing tree in `<MotionConfig reducedMotion="user">` (import from
      `framer-motion`). Nothing else changes.
- **Check:**
  - **G** passes.
  - `grep -rnE "accent-(purple|cyan|pink)|#0a0a0a" frontend/tailwind.config.js frontend/src/index.css`
    returns nothing.
  - `grep -n "tailwindcss/vite" frontend/package.json frontend/package-lock.json` returns nothing.
  - `grep -rnE "glass-card|gradient-text|glow-|reveal-up|input-glow" frontend/src --include=*.jsx`
    returns nothing.
  - **Lead, with the stack running:** a screenshot of `/login` (`node tests/e2e/shot.mjs --role none
    --path /login --out tests/e2e/output/design/d1-login.png`) shows the cool paper background
    (`#F2F3F5`) and the blue primary button (`#1F3D58`).

### D-2 · Shared components: Button, Badge, ScoreBadge chips, Spinner, EmptyState
- **Files:**
  - `frontend/src/components/Button.jsx`
  - `Badge.jsx`
  - `ScoreBadge.jsx`
  - `Spinner.jsx`
  - `EmptyState.jsx`
  - `frontend/src/components/recruiter/ScoreBreakdown.jsx` (the `SKILL_STATUS` map only)
- **Do:**
  1. `Button.jsx`: apply the base, sizes and variants of §6.1 verbatim.
  2. `Badge.jsx`:
     - apply the §6.4 base and variant table;
     - add the `icon` prop;
     - keep `<span>` as the root and `{...props}` passthrough;
     - in `Badge.Verified`, `Badge.Pending` and `Badge.Failed`, keep the text.
  3. `ScoreBadge.jsx`:
     - in `VERIFICATION`, set `variant` to `unverified` / `partly` / `verified` and add `icon` to `Shield` /
       `ShieldHalf` / `ShieldCheck`;
     - the unknown fallback stays `variant: 'outline'`, with no icon;
     - `VerificationBadge` passes `icon={view.icon}`;
     - labels, hints, `title`, `data-testid` and `data-verification` are unchanged.
  4. `ScoreBreakdown.jsx` `SKILL_STATUS`:
     - variants: evidenced → `evidenced`, claimed_only → `claimed`, not_found → `notfound`;
     - add `icon`: `CheckCircle2`, `CircleDashed`, `XCircle`;
     - the unknown fallback stays `outline` with no icon;
     - pass `icon={status.icon}` at the badge render (`ScoreBreakdown.jsx:420`).
  5. `Spinner.jsx`, `EmptyState.jsx`:
     - swap literal greys for tokens (`text-muted-foreground`, `bg-muted`);
     - EmptyState's icon tile becomes `rounded-xl bg-muted`;
     - its title becomes `text-h2` (Bricolage).
- **Check:**
  - **G** passes, including `skillStatus.test.js` (unknown is still `outline`) and `scoreWeights.test.jsx`.
  - `grep -n "variant: '" frontend/src/components/ScoreBadge.jsx` shows `unverified`, `partly`, `verified`
    and `outline`.

### D-3 · Logo, navigation and page transition
> **Updated 2026-11-15:** the stitched-tag mark this card first built was replaced by the layered-L mark
> (`Docs/design-refs/brand/patina-mark.svg`); the old `logo.svg` and `favicon.svg` are in
> `Docs/archive/design-refs/`. Steps 1 and 2 below describe the current files.
- **Files:**
  - new `frontend/src/components/PatinaMark.jsx`
  - `frontend/public/favicon.ico`, `logo192.png`, `logo512.png`, `apple-touch-icon.png`
  - `frontend/public/index.html`, `manifest.json`
  - `frontend/src/components/layouts/CandidateLayout.jsx`
  - `RecruiterLayout.jsx`
  - **The wordmark block only** in: `frontend/src/pages/public/Login.jsx:229-234`, `Landing.jsx:213-218`
    and `:239-244`, `RoleSelection.jsx:44-49`, `ResetPassword.jsx:124-128`,
    `frontend/src/pages/candidate/Upload.jsx:335-340`, and `frontend/src/pages/admin/Dashboard.jsx:89-92`.
    These are the line ranges at the start of D-3; re-find each one by the `PATINA` text.
- **Do:**
  1. **Create `PatinaMark.jsx`:**
     ```jsx
     export default function PatinaMark({ size = 28, className = '' }) {
       return (
         <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`}
              aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
           <rect width="32" height="32" rx="7" fill="hsl(var(--primary))" />
           <g fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round">
             <path d="M7.80 9.80V24.30H22.20" />
             <path d="M13.00 8.00V19.20H24.00" />
             <path d="M18.00 6.20V14.20H25.80" />
           </g>
           <rect x="21.4" y="6.20" width="4.4" height="4.4" rx="0.6" fill="hsl(var(--verdigris))" />
         </svg>
       );
     }
     ```
     It is `Docs/design-refs/brand/patina-mark.svg` with the tile fill on `--primary` and the square on
     `--verdigris` (`168.1 46.1% 57.1%`, defined in `:root` of `frontend/src/index.css`).
  2. **Favicon and app icons.** Copy `favicon.ico`, `logo192.png` and `logo512.png` from
     `Docs/design-refs/brand/` to `frontend/public/`, and `apple-touch-icon-180.png` as
     `apple-touch-icon.png`. In `frontend/public/index.html` the icon link is
     `<link rel="icon" href="%PUBLIC_URL%/favicon.ico" sizes="any" />` and the apple-touch-icon link points
     at `apple-touch-icon.png`; `manifest.json` lists the same files.
  3. **Every wordmark site.**
     - Replace the tile element with `<PatinaMark size={28} />`. The tile element is the `div` holding
       `Zap`, `Lock` or `UploadIcon`; in the admin Dashboard it is the bare `<Zap className="h-5 w-5" />`.
     - Give the `PATINA` text span exactly `className="font-display font-bold text-[15px] tracking-[.14em]
       text-foreground"`.
     - **Admin Dashboard:** wrap the bare text ` PATINA` in such a span, so the text node is exactly
       `PATINA`, and set the `Link`'s className to `flex items-center gap-2.5 no-underline`.
     - **Landing footer:** use `size={24}`.
     - **Unchanged:** the text `How would you like to use PATINA?` (RoleSelection) and `© 2026 PATINA. All
       rights reserved.` (Landing). Neither is a wordmark.
     - **Imports.** In each touched file, add the import of `PatinaMark` with the relative path. Remove
       `Zap`, `Lock` or `UploadIcon` from the `lucide-react` import **only if** `grep` finds no other use of
       that name in the file. `CreateJob.jsx`'s `Zap` is not a wordmark and is not touched.
     - Nothing else in those page files changes. Their framer usage stays until their own card restyles them.
  4. **Layouts:** apply §6.5 (bar, role pill, nav items, active state).
     - Replace `motion.nav` with `nav` and delete its `initial`, `animate` and `transition` props. Remove the
       `framer-motion` import.
     - Swap each nav item `Link` for `NavLink` (import from `react-router-dom`). Its `className` becomes a
       function `({ isActive }) => base + (isActive ? active : '')`, with the base and active classes of
       §6.5.
     - Leave the logo `Link`, the profile link and the create-job links as `Link`.
  5. Wrap `<Outlet />` in `<div className="route-root">`.
  6. Keep every label, `hidden sm:inline` span, `aria-label`, `to` and the notification badge.
  7. The mobile floating create-job button: `shadow-pop bg-primary hover:bg-primary-hover`.
- **Check:**
  - **G** passes.
  - `grep -n "framer-motion" frontend/src/components/layouts/*.jsx` returns nothing.
  - `grep -rn "PATINA" frontend/src --include=*.jsx` shows the same lines of text as before D-3.
  - `grep -rln "PatinaMark" frontend/src` lists the component and the 7 page/layout files with wordmarks.
  - **Lead:** screenshots of `/login`, `/candidate/dashboard` and `/recruiter/dashboard` show the mark and
    the active nav item underlined; the browser tab shows the layered-L favicon.

### D-4 · Auth screens
- **Files:**
  - `frontend/src/pages/public/Login.jsx`
  - `ResetPassword.jsx`
  - `RoleSelection.jsx`
  - `EmailConfirmed.jsx`
  - `NotFound.jsx`
- **Do:**
  1. Apply §7 and the input spec of §6.2 to `AnimatedInput`, the role `select` and the resend input.
  2. Remove every `motion.*`:
     - `motion.header` / `motion.div` / `motion.h1` / `motion.button` → the same tag, with
       `initial`, `animate`, `exit`, `transition`, `whileHover`, `whileTap` and `key={isLogin}` deleted;
     - the `AnimatePresence` around the name field → a fragment;
     - the spinner `motion.div` → `<span className="w-4 h-4 rounded-full border-2
       border-primary-foreground/30 border-t-primary-foreground animate-spin" />`;
     - remove the `framer-motion` import.
  3. Add `auth-bg` to the outer `min-h-screen` div. Add `anim-rise` and `shadow-pop` to the card.
  4. Add the eyebrow `<p className="eyebrow">Credibility, explained</p>` above the h1 on the login/signup
     card only.
  5. The same treatment applies to ResetPassword, RoleSelection, EmailConfirmed and NotFound: `auth-bg`,
     the card style, and motion removed the same way.
  6. All test hooks from §11 "Login/Signup" stay unchanged.
- **Check:**
  - **G** passes, including `Login.test.jsx`.
  - `grep -c 'type="submit"' frontend/src/pages/public/Login.jsx` is unchanged from before.
  - Screenshots of `/login`, `/signup` and `/select-role`, compared side by side with `mock.html` §1.

### D-5 · Results page and the score ring (signature moment)
- **Files:**
  - `frontend/src/pages/candidate/Results.jsx`
  - new `frontend/src/lib/useCountUp.js`
  - new `frontend/src/lib/useCountUp.test.js`
- **Do:**
  1. **`useCountUp(value, { duration = 1200, delay = 120 })`:**
     - It returns a string.
     - If `!Number.isFinite(Number(value))` or `matchMedia('(prefers-reduced-motion: reduce)').matches`,
       it returns `String(value)`.
     - Otherwise it animates from 0 with `rAF` and easing `1-(1-t)**4`, formatted with
       `toFixed(decimals)`, where `decimals = (String(value).split('.')[1] || '').length`. The last frame
       returns `String(value)` exactly.
     - It cancels its rAF on unmount.
     - Tests (with jest fake timers and a mocked `matchMedia`): it returns `String(value)` under reduced
       motion, and ends on `String(value)` for `42.49` and for `80`.
  2. **`ScoreRing`:**
     - Container `w-40 h-40`. `viewBox 0 0 120 120`, r=52, strokeWidth 10, track
       `stroke="hsl(var(--track))"`.
     - The arc becomes a plain `<circle>`: `strokeDasharray={C}`, with `strokeDashoffset` held in state.
       It starts at `C` and is set to the final offset in a `useEffect` after a 120ms timeout. Its style is
       `transition: stroke-dashoffset var(--dur-signature) var(--ease-emph)`.
     - The number is rendered exactly as §5.3: an `sr-only` span with the test id, and an `aria-hidden` span
       `font-display text-[44px] font-bold tracking-[-.03em] tabular-nums {TONE_TEXT}` showing
       `useCountUp(value)`.
     - Add a tint `div` (`absolute inset-[18px] rounded-full`, `background: radial-gradient(circle,
       hsl(var(--<tone>) / .07), transparent 70%)`).
     - Remove the framer import.
  3. **The rest of the page:**
     - Every `motion.div {...fadeUp}` becomes `div`, and the delays move to one `anim-stagger` wrapper
       around the three cards. Delete `fadeUp`.
     - The header label "Result for your application to" gets `className="eyebrow"` (text unchanged).
     - The composite card is `card p-8`.
     - The `next-step` panel is `rounded-lg bg-muted border border-border p-3`.
     - The BackLinks use the outline/primary button classes of §6.1 at `h-11`.
  4. `Message` keeps its testids.
- **Check:**
  - **G** passes, including `Results.test.jsx` and the new `useCountUp.test.js`.
  - Run **the e2e spine** (`powershell -File tests\run-suite.ps1 -Suites e2e`, with the stack running
    unpiped from `scripts\start-all.ps1`). It must exit 0. In particular `spine.spec.mjs:313` and `:548`
    ("Result composite equals the response") must pass.
  - Manual: with OS reduced motion on, the number appears final at once.

### D-6 · ScoreBreakdown and the recruiter drill-down
- **Files:**
  - `frontend/src/components/recruiter/ScoreBreakdown.jsx`
  - `CandidateModal.jsx`
- **Do:**
  1. Apply §9 to `ScoreBreakdown.jsx`:
     - **Factor:** add `data-direction={factor.direction}`, plus the stripe classes: `relative
       overflow-hidden` and `before:absolute before:inset-y-0 before:left-0 before:w-[3px]
       before:content-['']`, with `before:bg-success` / `before:bg-destructive` / `before:bg-primary` /
       `before:bg-muted-foreground` by direction. For `unavailable`, use an inline `style` on a child `<span
       aria-hidden="true">` stripe with the dashed gradient, because Tailwind cannot put a gradient in
       `before:`.
     - **`MetricEvidence`:** replace `motion.div` with `<div className={`h-full rounded-full bar-grow
       ${...}`} style={{ width: `${pct}%` }} />`. Remove the framer import.
     - **`SkillSetEvidence`:** the badges use `variant="outline"`.
     - **Table and flags:** class changes per §9 only.
  2. Do not add any element before the first `<span>` inside `drilldown-composite` or `subscore-value`
     (§11 fragile items 3 and 4).
  3. `CandidateModal.jsx`:
     - The two `motion.div`s (`CandidateModal.jsx:559`, `:569`) become `div`, with their motion props
       deleted.
     - The backdrop gets `anim-fade bg-foreground/40 backdrop-blur-[2px]`. The panel gets `anim-pop
       rounded-xl shadow-pop bg-surface`.
     - Remove the framer import.
     - The weights table keeps its column order (`td` nth(1) = weight). Headers use the eyebrow style.
     - Chips follow D-2 automatically.
- **Check:**
  - **G** passes, including `skillStatus.test.js` and `scoreWeights.test.jsx`.
  - `grep -n "framer-motion" frontend/src/components/recruiter/ScoreBreakdown.jsx
    frontend/src/components/recruiter/CandidateModal.jsx` returns nothing.
  - Screenshot of the drill-down via `shot.mjs` (`--role recruiter --path /recruiter/applications`, then
    open the first row).

### D-7 · Candidate pages
- **Files:**
  - `frontend/src/pages/candidate/Dashboard.jsx`
  - `CandidateJobs.jsx`
  - `JobDetail.jsx`
  - `Upload.jsx`
  - `Assessment.jsx`
  - `Notifications.jsx`
  - `CandidateProfile.jsx`
  - `applicationState.jsx`
  - `frontend/src/components/assessment/*.jsx`
- **Do:**
  1. Replace framer usage the same way as D-4 step 2, in `Upload.jsx` (the only framer importer in this
     group).
  2. Page titles get `text-h1`. Section titles get `text-h3`.
  3. Lists and grids of cards get `anim-stagger` on their direct parent: dashboard rows, job cards and
     notifications.
  4. Inputs follow §6.2. Buttons follow §6.1.
  5. `QuestionCard`:
     - the option rows become `rounded-lg border border-border bg-surface hover:bg-background`;
     - selected: `border-primary bg-primary/5 ring-1 ring-primary`;
     - keep `data-testid="assessment-option"`, `data-label` and `data-selected`.
  6. Timer and save indicator: `tabular-nums font-mono`, with text unchanged.
  7. **Must stay:**
     - `div.card` around each CandidateJobs job;
     - `div.flex-wrap > span` for parsed skills (Badge root is a span);
     - one `[data-outcome]` per question in ResultView;
     - `dl/dt/dd` in Contact;
     - no `<a>` in Links or Contact.
  8. **Open, to be decided by Anthony before D-7 or D-8 runs.** The application status `shortlisted` uses
     Badge `success` (`applicationState.jsx:48`, and the recruiter-side map in `applicationsLogic.js`). That
     makes it green for a state that is not evidence, which breaks §1. Its new colour is Anthony's call,
     because `under_review` already uses `primary`.
- **Check:**
  - **G** passes, including `Upload.test.jsx`.
  - `grep -n "framer-motion" frontend/src/pages/candidate/*.jsx` returns nothing.

### D-8 · Recruiter and admin pages
- **Files:**
  - `frontend/src/pages/recruiter/Dashboard.jsx`
  - `Applications.jsx`
  - `Jobs.jsx`
  - `JobDetails.jsx`
  - `CreateJob.jsx`
  - `Profile.jsx`
  - `frontend/src/components/recruiter/ApplicationsTable.jsx`
  - `frontend/src/pages/admin/Dashboard.jsx`
- **Do:**
  1. Replace framer the same way as D-4 step 2.
  2. Tables:
     - headers in the eyebrow style;
     - rows `hover:bg-background`, with `tbody` getting `anim-stagger`;
     - the score cell keeps the composite as its **first `<span>`**, and "Awaiting assessment" stays a
       `div` and the cell's `firstChild` (§11 fragile item 3).
  3. CreateJob:
     - the step indicator becomes primary dots;
     - the selected skill chips are `variant="primary"`;
     - the suggestion buttons are outline `h-8`;
     - the completed-step circle `bg-success text-success-foreground` (`CreateJob.jsx:322`) becomes
       `bg-primary-soft text-primary`, because green is reserved for evidence (§1);
     - all labels and testids unchanged.
  4. Stat tiles on the dashboards: `.card p-5`, value `font-display text-[28px] tabular-nums`, label
     `.eyebrow`.
- **Check:**
  - **G** passes, including `CreateJob.test.jsx` and `scoreWeights.test.jsx`.
  - `grep -rn "framer-motion" frontend/src/pages/recruiter frontend/src/components/recruiter
    frontend/src/pages/admin` returns nothing.

### O-10 · Anthony: capture the landing sample (no code; blocks D-9)
- **Do:**
  1. With the stack running, sign in as a staged candidate (recommended: `tests/fixtures/demo/demo_support_ops.pdf`
     against a support job, because it shows GF-3, fair scoring for support/maintenance work).
  2. Open the candidate's result page.
  3. In DevTools → Network, copy the JSON response of `GET /api/applications/<id>/result`.
  4. Save it as `Docs/design-refs/landing-sample.raw.json`.
- **Permission is already given.** Anthony said on 2026-11-15 that he will capture the support candidate's
  result and that this score may appear on the public landing page. It comes from the synthetic fixture
  résumé `demo_support_ops.pdf`.
- **Done when:** the file exists.

### D-9 · Landing page (needs O-10)
- **Files:**
  - `frontend/src/pages/public/Landing.jsx`
  - new `frontend/src/content/landingSample.json`
  - new `scripts/make-landing-sample.mjs`
- **Do:**
  1. **`make-landing-sample.mjs`** reads `Docs/design-refs/landing-sample.raw.json` and writes
     `landingSample.json`.
     - **Fields it keeps:**
       - `score.credibilityScore`, `score.band` and `score.verification`;
       - from `score.explanation`: `factors`, `skill_evidence` (first 6 rows), `weights_version` and
         `generated_at`;
       - `application.job_title`.
     - **Fields it drops:** everything else, including the candidate's name, email, links, ids,
       `summary` and `github_account`.
     - It adds `provenance: { captured_from: 'GET /api/applications/:id/result', generated_at, fixture:
       <the résumé file name Anthony gave> }`.
     - It exits non-zero if the raw file is missing.
  2. **`Landing.jsx`:** apply §8.
     - Import the JSON with `try`-free static import. If the file is absent the build fails, so D-9 does not
       start without O-10.
     - Render the right-hand card with `ScoreRing` (export it from `Results.jsx` with a new `static` prop
       that skips the count-up), `ScoreBadge`, `VerificationBadge`, a compact factor list and the first six
       skill rows.
     - The caption text is exactly as §8, filled from `provenance`.
  3. Remove framer the same way as D-4 step 2. `useScroll`/`useTransform` (the chevron fade) is deleted
     along with the bouncing chevron.
  4. Add the connecting line SVG and the IntersectionObserver as §8.
- **Check:**
  - **G** passes.
  - `node -e "const s=require('./frontend/src/content/landingSample.json'); if(JSON.stringify(s).match(/@|email|name\"/i)) process.exit(1)"`
    exits 0.
  - The composite on the landing equals `credibilityScore` in the raw file.
  - Screenshot of `/` at 1440 and 390 wide; the 390 one has no horizontal scroll.

### D-10 · Verification pass
- **Files:** none in the app. It writes `Docs/design-refs/VERIFY.md` and the screenshots in
  `tests/e2e/output/design/`.
- **Do:**
  1. Run **G**.
  2. Run the e2e suite: spine, smoke and unreadable must exit 0.
  3. Run a contrast script over the final `index.css` tokens, with every pair of §2.4 at or above its
     threshold.
  4. `grep -rn "framer-motion" frontend/src` lists every remaining importer. If none is left, add an
     **[ask]** to `REBUILD/TASKS.md` for removing the dependency.
  5. Take screenshots with `shot.mjs` of:
     - landing, login, signup;
     - the candidate dashboard and result;
     - the recruiter applications page and drill-down;
     - CreateJob step 2;

     all at 1440 wide, and the result and login pages at 390 wide.
  6. `shot.mjs` has no reduced-motion option (checked 2026-11-15). Check reduced motion by hand on the
     result page with the OS setting on, and record what was seen.
- **Check:** every item above is recorded PASS/FAIL with output in `VERIFY.md`.

---

## 11. Test hooks to preserve (from the 2026-11-15 inventory)

| Area | Hooks |
|---|---|
| Login/Signup | testids `login-username`, `login-password`, `login-submit`, `signup-submit`, `login-error` (`role="alert"`), `signup-confirm-email`. Labels `Username`, `Password`, `Full Name`, `Email Address`, `Account type`. Texts "Sign In", "Create Account", "Sign up as a recruiter to get started", "Account created" (once). Exactly one `button[type="submit"]` in the form. |
| Upload | buttons `Replace`, `Browse files`. testids `resume-upload-button`, `resume-unreadable`, `resume-parsed`, `parsed-skills` (`div.flex-wrap > span`), `parsed-education` (li), `parsed-links` (li, no `<a>`), `parsed-contact` (`dt`/`dd`, no `<a>`). Their texts. |
| Candidate jobs and job detail | `div.card` holding an h2 with the job title; link `View job`; h1 job title; `apply-button`, `application-score[data-state]`, `application-composite`. |
| Candidate dashboard | `application-row-<id>`, `status-badge[data-status]`, `assessment-link`, `assessment-state[data-state]`, `application-result-link`; nav link `My applications`. |
| Results | `application-score[data-state="scored"]` whose innerText **starts with the composite** (§5.3); `[title^="Score band"]`; `resume-match`; `github-ownership-note`; `verification-badge` (first one = top section); "Evidence-limited". |
| Assessment | heading `Skill assessment`; `assessment-state`, `assessment-start`, `assessment-question[data-question-id][data-type]`, `assessment-option[data-label][data-selected]`, `assessment-short-answer`, `assessment-timer[data-remaining-ms]`, `assessment-save-indicator[data-save-state]`, `assessment-submit` ("Submit (n/n)"), `assessment-result` with one `[data-outcome]` per question. |
| Recruiter | `a[href="/recruiter/create-job"]`; CreateJob labels and testids (`job-title-input`, `description-suggestions`, `skill-search-input`, `skill-option`, `skill-add-custom`, `selected-skill`, `job-submit`, button `Next Step`). Applications: `application-row-<id>[data-scoring][data-status]`, `application-score` (first `span` = composite), `awaiting-assessment` (a `div`, `firstChild`), `partial-score-label`, `open-drilldown`, `shortlist-button`. |
| Drill-down and breakdown | `drilldown[data-state]`, `drilldown-close`, `drilldown-awaiting`, `drilldown-composite[data-state][data-value]` (first `span`), `weight-<key>` (weight in `td` nth(1)), `weight-unearned`, `weights-version`, `subscore-{parsing,github,assessment}[data-available]` > `subscore-value` (`NN/100` or `—`), `drilldown-assessment-state`, `skill-row`, `skill-mark-{resume,github,assessment}[data-mark]`, `skill-evidence-legacy`, `flags-panel`, `flag-check-sources-disagree[data-state]`, `flag-kinds-not-built`, `breakdown-weights-version`, `verification-state`, `evidence-limited`. |
| Status strings | "Evidenced", "Claimed only", "Not found", "Unknown status: …"; "Unverified", "Partly verified", "Verified", "Unknown verification: …"; High/Medium/Low; Raised/Not raised/Not run/Not recorded; every assessment-state label in `applicationsLogic.test.js`. "Strong Match" never appears. |

**Fragile, CSS or structure dependent:**
1. `div.flex-wrap > span` (Upload skills).
2. `div.card` (CandidateJobs).
3. First-`span` composite rules (ApplicationsTable ScoreCell, `drilldown-composite`), and "Awaiting
   assessment" as `firstChild`.
4. `td` nth(1) in the weights table.
5. The `title^="Score band"` prefix.
6. The ring testid on the number element (§5.3).
7. A single submit button on Login.
8. `skillStatus.test.js:18` expects variant `outline` for unknown.
9. `a[href="/recruiter/create-job"]`.
10. "My applications" sits in `hidden sm:inline` (tests run at 1440px).
