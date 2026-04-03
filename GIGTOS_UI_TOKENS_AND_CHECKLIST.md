# Gigtos UI Tokens and Component Checklist

Version: 1.0
Date: 2026-04-03
Design Direction: Editorial Concierge

## 1. Design Principles

- Trust-first: Every screen must reinforce safety, clarity, and control.
- Local-first: Users should always feel this is a Kavali-focused service marketplace.
- Guided action: Complex actions are split into clear steps with next-best actions.
- Calm confidence: Visual style should feel premium but practical, not noisy.

## 2. Design Tokens

### 2.1 Color Tokens

Core brand colors:
- Indigo brand: #764BA2
- Emerald action: #057A31

Token table:

| Token | Hex | Usage |
|---|---|---|
| --color-brand-600 | #764BA2 | Primary brand identity, section accents |
| --color-brand-700 | #5F3A86 | Brand hover, dark accents |
| --color-action-600 | #057A31 | Primary CTA background |
| --color-action-700 | #046127 | CTA hover |
| --color-accent-500 | #F97316 | Secondary highlights, urgency chips |
| --color-bg-50 | #F8F7FB | App background tint |
| --color-surface-0 | #FFFFFF | Cards, modals, form surfaces |
| --color-surface-100 | #F3F4F6 | Soft section blocks |
| --color-border-200 | #D6D8DE | Default borders |
| --color-border-300 | #C5C8D3 | Strong borders |
| --color-text-900 | #1F2937 | Primary text |
| --color-text-700 | #4B5563 | Secondary text |
| --color-text-500 | #6B7280 | Helper text |
| --color-success-600 | #15803D | Success state |
| --color-warning-600 | #B45309 | Warning state |
| --color-danger-600 | #B91C1C | Error state |
| --color-info-600 | #2563EB | Informational state |

Gradients:
- Hero gradient: linear-gradient(135deg, #764BA2 0%, #057A31 100%)
- Soft atmosphere: radial + low-opacity brand overlays on neutral base

Contrast rules:
- Body text on surface: minimum 4.5:1
- Large heading text: minimum 3:1
- Button text: minimum 4.5:1

### 2.2 Typography Tokens

Font families:
- Display and headings: Manrope
- Body, controls, labels: Inter

Type scale:

| Token | Size | Weight | Line Height | Use |
|---|---:|---:|---:|---|
| --font-display-72 | 72px | 800 | 1.05 | Hero desktop headline |
| --font-display-56 | 56px | 800 | 1.08 | Hero tablet/large sections |
| --font-h1 | 44px | 800 | 1.12 | Page headers |
| --font-h2 | 34px | 700 | 1.18 | Section headers |
| --font-h3 | 26px | 700 | 1.22 | Card titles / step titles |
| --font-h4 | 20px | 700 | 1.3 | Subsection headers |
| --font-body-lg | 18px | 400 | 1.6 | Intro paragraph |
| --font-body-md | 16px | 400 | 1.55 | Default body |
| --font-body-sm | 14px | 400 | 1.5 | Secondary labels |
| --font-caption | 12px | 500 | 1.4 | Chips, helper text |
| --font-micro | 11px | 500 | 1.35 | Metadata |

Responsive typography:
- Mobile hero max: 34px
- Mobile section title: 24px
- Mobile body baseline: 15px

Letter spacing:
- Eyebrow labels: 0.08em uppercase
- Display titles: -0.015em

### 2.3 Spacing Tokens

8-point base with 4-point support:
- --space-1: 4px
- --space-2: 8px
- --space-3: 12px
- --space-4: 16px
- --space-5: 20px
- --space-6: 24px
- --space-8: 32px
- --space-10: 40px
- --space-12: 48px
- --space-16: 64px

Layout spacing rules:
- Page horizontal padding desktop: 24px to 32px
- Page horizontal padding mobile: 14px to 16px
- Section spacing desktop: 24px to 40px
- Section spacing mobile: 16px to 24px
- Card internal padding desktop: 16px to 24px
- Card internal padding mobile: 12px to 16px

### 2.4 Radius, Border, Shadow, Z-Index

Radius:
- --radius-sm: 8px
- --radius-md: 12px
- --radius-lg: 16px
- --radius-xl: 20px
- --radius-pill: 999px

Border:
- Default: 1px solid var(--color-border-200)
- Emphasis: 1px solid var(--color-border-300)
- Focus ring: 2px solid rgba(118, 75, 162, 0.35)

Shadow:
- --shadow-sm: 0 2px 8px rgba(17, 24, 39, 0.08)
- --shadow-md: 0 10px 24px rgba(17, 24, 39, 0.12)
- --shadow-lg: 0 18px 40px rgba(17, 24, 39, 0.16)

Z-index layers:
- Base content: 1
- Sticky UI (bottom nav): 1200
- Floating assistant: 1250
- Header menu/dropdown: 1300
- Overlay/modal: 1500+

### 2.5 Motion Tokens

Timing:
- --motion-fast: 120ms
- --motion-base: 220ms
- --motion-slow: 320ms

Easing:
- Standard: cubic-bezier(0.2, 0, 0, 1)
- Exit: cubic-bezier(0.4, 0, 1, 1)

Usage:
- Hover lift: translateY(-1px) to (-3px)
- Card reveal: fade + translateY(8px -> 0)
- Step transitions: opacity and horizontal shift only (avoid complex transforms)

## 3. Interaction State Specifications

### 3.1 Buttons

Primary CTA:
- Default: emerald 600 background, white text
- Hover: emerald 700 background, shadow-md
- Active: darken by 8%, remove 20% shadow
- Focus: visible 2px ring in indigo alpha
- Disabled: 60% opacity, no hover elevation, cursor not-allowed
- Loading: spinner + disabled semantics

Secondary CTA:
- Default: white background, border-200, text-900
- Hover: surface-100 background
- Active: border-300
- Focus: indigo ring

Destructive action:
- Use danger palette with explicit confirmation affordance

### 3.2 Inputs and Form Controls

- Default: border-200, surface-0, text-900
- Hover: border-300
- Focus: ring + border-brand-600
- Error: danger-600 border + helper text
- Success: success-600 border + helper text
- Disabled: surface-100 background, text-500

Validation behavior:
- Validate on blur for individual fields
- Validate all required fields on step transition
- Keep error text short and actionable

### 3.3 Cards and Containers

- Card default: surface-0 + border-200 + shadow-sm
- Hover (interactive cards only): shadow-md + slight lift
- Selected: action-600 border tint and subtle action background tint
- Disabled/inactive card: reduce opacity, disable pointer events

### 3.4 Navigation Elements

- Active item: strong color fill + semibold text
- Inactive item: muted text + no fill
- Hover: subtle background tint
- Focus: ring visible for keyboard users

## 4. Responsive System

Breakpoints:
- xs: <= 480px
- sm: 481px to 700px
- md: 701px to 900px
- lg: 901px to 1200px
- xl: >= 1201px

Responsive behavior:
- Hero: 2-column at lg+, stacked at md and below
- Services: 4 cards in 2x2 for mobile, auto-fit grid for desktop
- Stepper: horizontal desktop, stacked mobile
- Footer/nav: persistent bottom nav mobile; top/global nav desktop
- Modals: full-width card with safe margins on mobile

Touch targets:
- Minimum 44x44px
- Chip controls minimum 36px height

## 5. Component Breakdown Specs

### 5.1 Navigation Header

Desktop:
- Height: 68px to 76px
- Left: logo + city context
- Right: primary nav and account menu
- Background: gradient or tinted surface with high contrast
- Sticky optional; if sticky, add shadow-sm on scroll

Mobile:
- Compact header 56px to 64px
- Hamburger menu with clear close state
- Avoid more than 1 row of action controls

### 5.2 Persistent Footer / Mobile Quick Nav

Desktop footer:
- Surface-100 background
- 20px top/bottom padding
- Clear legal and support links

Mobile quick nav:
- Fixed bottom, inset 8px from viewport
- Rounded container (radius-md)
- 3 to 4 high-value actions only
- Current destination visually distinct

### 5.3 Primary CTA Buttons

- Height: 44px desktop, 42px mobile
- Horizontal padding: 14px to 18px
- Font: Inter 700 14px to 16px
- Primary fill: action-600
- Transition: motion-fast standard easing

### 5.4 Hero Section

- One clear headline focus
- One supporting sentence under 2 lines where possible
- Max two primary actions
- Trust signal chips beneath action row
- AI prompt panel appears secondary but discoverable

### 5.5 Service Cards

- Icon container with consistent visual weight
- Service title + one short description line set
- Verified badge required
- Action pair: Book Now + Get Quote
- Uniform card heights where practical on desktop

### 5.6 Booking Stepper

- Exactly 3 visible steps
- Current step highlighted with stronger brand treatment
- Completed step gets success visual marker
- Step titles concise and task-oriented

### 5.7 Confirmation and Next Steps Panel

- Summary card with key details in fixed order
- What happens next block with 3 bullets
- Final action button always visible and unambiguous

## 6. Visual Logic Rules

### 6.1 Iconography

- Prefer line icons with consistent stroke (1.75 to 2.0)
- Icon sizes: 20, 24, 32, 40
- Use filled icons only for status/emphasis moments
- Avoid mixed emoji and line icon style in same context

### 6.2 Card Logic

- Every card needs: title, support text, clear action or status
- Do not exceed 3 visual densities in same section
- Keep alignment grid strict: edges and baselines must line up

### 6.3 Spacing Logic

- Tight pair (label + input): 6px to 8px
- Related controls: 12px to 16px
- Section blocks: 24px+
- Long page rhythm should alternate content density

### 6.4 Content Hierarchy

- One H1 per page
- H2 for major sections only
- Keep body lines at 55 to 75 characters where possible
- Ensure primary CTA appears in first viewport on mobile

## 7. Accessibility Checklist

- Keyboard navigation complete for all interactive controls
- Visible focus ring on all links, buttons, and form fields
- Color contrast meets WCAG AA thresholds
- Form errors are text-based, not color-only
- Icons with meaning have labels or adjacent text
- Modals trap focus and close with Escape

## 8. Data and State Patterns

Loading states:
- Skeleton for card lists
- Inline spinner for button submit actions
- Keep layout stable while loading

Empty states:
- Clear message + one recovery action
- No raw technical language

Error states:
- Human-readable explanation
- Actionable next step (retry, edit, contact support)

Long content handling:
- Truncate card body text after 2 lines with predictable clamp
- Preserve full content in detail/expanded views

## 9. Implementation Checklist (Page by Page)

### 9.1 Home Page

- Hero follows typography and spacing tokens
- AI prompt chips use standard chip sizing and focus styles
- Services section includes localized heading and verified badges
- Trust section and testimonials follow card token rules
- Mobile bottom nav uses touch target and active-state rules

### 9.2 Booking Flow Page

- Stepper visual states align with interaction specs
- Step transition validates required fields
- Schedule mode and immediate mode both fully covered
- Preferred pro cards support selected and unselected states
- Confirmation step includes summary and next steps panel

### 9.3 My Bookings Page

- Status badges map to semantic token colors
- Action buttons follow primary/secondary/destructive variants
- Filters and search use standard form controls and spacing
- Empty, loading, and error states follow data/state patterns

### 9.4 Auth and Profile Pages

- Input and helper text hierarchy follows form system
- Error/success feedback uses semantic color tokens
- Primary action placement is predictable and consistent
- Mobile form spacing respects touch ergonomics

### 9.5 Admin and Dashboard Views

- Card and table containers use shared radius and border rules
- Status chips use standardized semantic palette
- Dense data areas preserve 14px minimum text size
- Action clusters maintain spacing and avoid visual overload

## 10. Ready-to-Use CSS Token Snippet

```css
:root {
  --color-brand-600: #764BA2;
  --color-brand-700: #5F3A86;
  --color-action-600: #057A31;
  --color-action-700: #046127;
  --color-accent-500: #F97316;

  --color-bg-50: #F8F7FB;
  --color-surface-0: #FFFFFF;
  --color-surface-100: #F3F4F6;
  --color-border-200: #D6D8DE;
  --color-border-300: #C5C8D3;

  --color-text-900: #1F2937;
  --color-text-700: #4B5563;
  --color-text-500: #6B7280;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  --shadow-sm: 0 2px 8px rgba(17, 24, 39, 0.08);
  --shadow-md: 0 10px 24px rgba(17, 24, 39, 0.12);
  --shadow-lg: 0 18px 40px rgba(17, 24, 39, 0.16);

  --motion-fast: 120ms;
  --motion-base: 220ms;
  --motion-slow: 320ms;
}
```

## 11. QA Handoff Checklist

- Token values match this spec exactly
- No component ships without full interaction states
- Mobile tap targets and sticky actions validated on physical device sizes
- Accessibility checks performed for keyboard and contrast
- Booking flow walkthrough validates all 3 steps and edge cases

---

Owner: Product Design + Frontend
Use this as the source of truth for ongoing UI implementation and reviews.

## 12. Strict Page-Level UI Blueprint (Pixel Values)

Use this section as non-negotiable implementation guidance for frontend delivery.

### 12.1 Global Layout Grid

Desktop (>=1200px):
- Max content width: 1120px
- Side gutter: 24px min
- 12-column grid, 24px gutters
- Section vertical spacing: 32px default, 48px major transitions

Tablet (701px-1199px):
- Max content width: 960px
- Side gutter: 20px
- 8-column grid, 20px gutters
- Section vertical spacing: 24px to 32px

Mobile (<=700px):
- Side gutter: 14px
- Single-column flow
- Section vertical spacing: 20px to 24px
- Sticky bottom-safe area padding: 90px min when bottom nav is present

### 12.2 Home Page Exact Specs

Header:
- Height desktop: 72px
- Height mobile: 60px
- Logo size: 22px bold
- Primary auth button height: 40px desktop, 38px mobile
- Nav link text: 14px weight 500

Hero:
- Hero card radius: 20px
- Hero internal padding desktop: 28px
- Hero internal padding mobile: 20px
- H1 size desktop: clamp(44px, 5vw, 56px)
- H1 size mobile: 32px
- Subtext size: 17px desktop, 15px mobile
- Primary CTA height: 44px desktop, 42px mobile
- CTA horizontal padding: 14px to 18px
- Trust chip height: 30px
- Trust chip text: 12px weight 500

AI prompt panel:
- Panel min width desktop: 320px
- Prompt chip min height: 36px
- Prompt chip padding: 9px 11px
- Prompt chip radius: 10px

Services section:
- Section card padding: 24px desktop, 16px mobile
- Services grid desktop: 2 columns in current implementation (upgrade path: 4 columns for wide desktop)
- Services grid mobile: 2 columns
- Service card min height: 220px desktop, auto mobile
- Service icon box: 38px
- Service title: 22px desktop, 18px mobile
- Service description: 14px
- Badge text: 11px weight 700
- Card action button height: 42px

How-it-works section:
- Step card padding: 16px
- Step number text: 16px weight 800
- Step title: 20px
- Step body: 14px

Testimonials and Why section:
- Testimonial card padding: 16px
- Quote text: 15px
- Name footer text: 14px weight 700

Footer / mobile quick nav:
- Desktop footer vertical padding: 20px
- Mobile quick nav height: 58px container minimum
- Mobile quick nav button text: 11px weight 700
- Mobile quick nav button radius: 8px

### 12.3 Booking Flow Page Exact Specs

Page shell:
- Max width: 980px
- Outer padding desktop: 22px to 24px
- Outer padding mobile: 12px to 14px
- Shell radius: 20px desktop, 14px mobile
- Shell border: 1px solid var(--color-border-200)

Booking hero/header:
- Badge size: 12px uppercase
- H1: clamp(26px, 3.4vw, 44px)
- Intro text: 16px desktop, 14px mobile
- Trust chips: 30px height, 12px text

Stepper:
- Step card height: 72px min
- Step circle: 28x28
- Step title text: 13px weight 700
- Horizontal gap: 8px to 10px
- Mobile behavior: stack to single column

Form controls:
- Label text: 13px weight 700
- Input/select/textarea height: 44px (textarea auto with min 88px)
- Input horizontal padding: 12px
- Input radius: 9px
- Input border: #C9D2DE
- Focus ring: 2px rgba(118, 75, 162, 0.25)
- Field group spacing: 12px

Mode toggle (Immediate vs Scheduled):
- Container radius: 11px
- Toggle option height: 40px
- Option text: 14px weight 700

Pro cards:
- Card radius: 10px
- Card padding: 12px
- Card min height: 96px
- Title text: 15px weight 700
- Meta text: 12px

Confirmation:
- Summary card padding: 12px
- Summary row text: 14px
- Next-steps list text: 14px
- Action row button height: 44px
- Mobile sticky action bar bottom offset: 8px

### 12.4 My Bookings Page Exact Specs

Top controls:
- Search input height: 42px
- Filter select height: 42px
- Gap between controls: 10px

Booking cards:
- Card padding: 16px
- Card radius: 12px
- Card border: 1px solid var(--color-border-200)
- Service title: 20px
- Metadata text: 13px
- Status chip height: 28px
- Status chip text: 12px weight 600
- Primary action button height: 40px

Quotes block:
- Quote card padding: 12px
- Quote row gap: 8px
- Price text: 18px weight 700

### 12.5 Auth + Profile Exact Specs

Auth card:
- Max width: 420px
- Padding: 24px
- Radius: 16px

Inputs:
- Height: 44px
- Label spacing from field: 6px
- Error text: 12px

Primary submit:
- Height: 44px
- Full width
- Text: 15px weight 700

Profile completeness module:
- Progress bar height: 8px
- Section card padding: 16px
- Section heading: 18px weight 700

### 12.6 Admin + Dashboard Exact Specs

KPI cards:
- Min width: 220px
- Padding: 16px
- Radius: 12px
- KPI value text: 28px weight 800
- KPI label text: 12px uppercase optional

Tables and lists:
- Row height: 52px min
- Header text: 12px weight 700 uppercase optional
- Cell text: 14px
- Action buttons: 36px to 40px height

### 12.7 Mandatory Remove/Add/Change Checklist

Remove immediately:
- Emoji-only iconography in core card/UI actions
- Inconsistent button colors for same action type
- Over-tight card text blocks with less than 12px vertical rhythm

Add immediately:
- Verified badge treatment across service and professional cards
- Clear secondary CTA where users are not ready to book
- Empty/loading/error states for each key page

Change immediately:
- Use emerald for all primary submit/convert buttons
- Keep indigo for brand context and navigational emphasis
- Standardize all inputs/buttons to shared heights and radii

### 12.8 Acceptance Criteria (UI Sign-Off)

- Every page conforms to token palette and typography rules
- Spacing rhythm follows the 8pt system with no ad-hoc values
- All interactive elements include hover, focus, active, disabled states
- Mobile layout has no clipped controls and maintains 44x44 touch targets
- Home-to-booking flow has clear visual hierarchy and conversion-first CTAs
