# Areen CUBs Studio — design system

The visual specification. Tokens, typography, components, patterns, and the
rules that keep the two themes honest.

**Rule zero: components name roles, never colours.** If a component needs a
value with no role, the role is missing — do not reintroduce a literal.

---

## 1. Why this exists

Before this system, `globals.css` carried **~560 lines of theme patches**:

```
html.light  .bg-\[\#0D2D47\] { … !important }   ~470 lines
html:not(.light) .text-ink   { … !important }   ~90 lines
```

They existed because components named literal colours — **1,349 hardcoded hex
classes across 61 files** — so the second theme had to be repainted on top of
them, by selector. Three consequences, all of which actually happened:

- a new component could look right in one theme and be unreadable in the other;
- a contrast fix meant hunting a hex through a patch list, not changing a value;
- the patch list was itself load-bearing, so deleting a "dead" rule broke a page.

Both tables are gone. Both themes are now one lookup.

## 2. Colour

Tokens live in `src/styles/tokens.css` as **RGB triplets**, not hex strings, so
Tailwind opacity modifiers work: `rgb(var(--ac-surface) / <alpha-value>)` makes
`bg-surface/60` valid. A variable holding `#RRGGBB` silently breaks every
`/opacity` suffix in the codebase — a failure that looks like a design choice.

**Dark is the base.** The no-flash script in `layout.tsx` adds `.light` as the
opt-in, so bare `:root` must be dark or the first paint is wrong.

### Brand ramp

Anchored on the five brief colours, interpolated into one hue family:

| Token | Value | Role |
|---|---|---|
| `brand-400` | `#3382D6` | secondary blue |
| `brand-500` | `#1064D4` | **primary blue** — the anchor |
| `brand-600` | `#0D54B4` | accent in light theme (see below) |
| `brand-900` | `#0A336F` | deep navy — the rail |
| `--ac-support` | `#8FADCE` | supporting blue-grey |

### Semantic roles

`canvas` · `surface` / `-2` / `-3` · `rail` / `-2` / `-border` / `-fg` /
`-muted` · `content` / `-2` / `-3` / `-inverse` · `line` / `-strong` ·
`accent2` / `-hover` / `-weak` / `-fg` · `focus` · `hover` · `active` ·
`selected` · `info` · `success` · `warning` · `danger` (each with `-weak`) ·
`chart-1…6` / `-grid` / `-track`.

### Two decisions worth stating

**The rail is deep navy in both themes.** It is the one place the brand asserts
itself constantly, and it is what makes a screenshot of this product
recognisable. Its contents use the `rail-*` roles, never the page text roles,
because the rail keeps its own ground regardless of theme.

**Light-theme accent is `brand-600`, not `brand-500`.** `#1064D4` clears 4.5:1
on white but only **4.05–4.45:1 on its own weak tints** — which is exactly where
accent-coloured *text* sits: a selected row, a chip, a highlighted cell. One
step darker along the same hue reads as the same blue, takes that text to
~5.1:1, and improves white-on-fill from 5.9:1 to 7.0:1. `#1064D4` remains the
anchor at `brand-500`.

### Contrast

Normal text **4.5:1**, large text and meaningful boundaries **3:1**, measured by
axe on every run with no exclusions. `#8FADCE` is **never** light-mode body
text — it measures 1.70:1 on the light canvas. It is a dark-theme muted tone and
a light-theme boundary.

### Charts

Six colours ordered **blue → amber → teal → magenta → slate → green**, varying
hue *and* lightness so adjacent series stay separable under deuteranopia and
protanopia. Colour is never the only encoding: charts also carry labels or
direct annotation.

## 3. Typography

| Role | Face | Licence |
|---|---|---|
| Interface | **Manrope** | SIL OFL |
| Arabic | **Noto Sans Arabic** | SIL OFL |

Both self-hosted at build time by `next/font/google`: no runtime request, no
paid service, nothing to accept. Manrope loads as a **variable axis**, not six
static cuts.

**Noto Sans Arabic stays inside the `sans` stack**, after Manrope. Manrope has
no Arabic coverage, so dropping that fallback makes every Arabic glyph render
from an arbitrary system face at the wrong weight and line height. This was
broken briefly during the migration and caught by `src/lib/fonts.test.ts`.

Finance and any aligned digits use `font-variant-numeric: tabular-nums`.

## 4. Depth

Four steps: `shadow-ac-sm`, `shadow-ac`, `shadow-ac-md`, `shadow-ac-lg`, plus
`shadow-rail`. Deliberately shallow — max 8px blur at low alpha.

**Never pair a 1px border with a wide soft shadow as decoration.** That
combination — the "ghost card" — is the most reliable tell of a generated
interface, and reads as neither flat nor raised. Each surface picks one.

## 5. Motion

One easing family, defined once:

| Token | Value | Use |
|---|---|---|
| `ease-ac` | `cubic-bezier(0.16, 1, 0.3, 1)` | the default — entering, hover, disclosure |
| `ease-ac-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | symmetric moves |
| `duration-1` | 120ms | colour, opacity |
| `duration-2` | 180ms | hover, small transforms |
| `duration-3` | 240ms | disclosure, page furniture |

**`ease-in` is absent on purpose**: on entering UI it delays the moment the user
is actually watching. Nothing exceeds 250ms — slower than that on an
operational surface reads as lag, not polish. `prefers-reduced-motion` collapses
all three durations to 1ms **at the token**, so every consumer inherits it.

Controls press (`active:scale-[0.98]`) rather than lifting: the control yields
under the finger instead of the layout shifting.

## 6. Touch targets

44×44 minimum on **coarse pointers only**, via a registered `pointer-coarse:`
variant and a pseudo-element that expands the hit area without changing the
visual box. Enforcing 44px everywhere would inflate every dense table row on a
mouse-driven screen for no one's benefit.

## 7. Skills synthesised

The brief asked which materially influenced the result.

| Skill | What was taken |
|---|---|
| `high-end-visual-design` | Ban on generic 1px-border + harsh-shadow pairs; custom cubic-bezier over `linear`/`ease-in-out`; `scale(0.98)` press |
| `impeccable` | Token-first architecture; roles over literals; a11y and i18n as structure, not polish |
| `minimalist-ui` | Restraint on gradients and heavy shadows; typographic contrast doing the work |
| `redesign-existing-projects` | Audit-with-evidence before editing; never break behaviour to make the design easier |
| `review-animations` | Sub-300ms UI budget; `ease-in` is a finding; reduced-motion at the source |
| `emil-design-eng` | The invisible details: focus rings, press states, concentric radii |
| `design-taste-frontend` | Anti-templated stance; commit to a direction rather than hedging |

**Deliberate deviations.** `high-end-visual-design` bans Lucide icons and asks
for dramatic scroll choreography; `gpt-taste` wants massive section spacing.
Both are written for marketing pages. This is a dense operations product where
icon consistency beats novelty and vertical space is a cost, so Lucide stays at
a uniform stroke and motion is confined to state changes. Recorded as a
judgement, not an oversight.

## 8. What is NOT changed by any of this

Role guards, RLS, client scoping, IDOR behaviour, storage privacy,
issued-document immutability, TVA calculation, money-shadow behaviour, audit
logging, fail-closed authentication, French copy, timezone handling and finance
formatting are untouched. This is a visual and structural change to how colour
and type are *named*, verified by the same suites that guard those behaviours.
