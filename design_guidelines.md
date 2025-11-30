# FriendsNavigator Design Guidelines

## Design Approach

**Selected Approach:** Design System (Material Design) with Map Application References

**Justification:** FriendsNavigator is a utility-focused application requiring clear hierarchy, efficient information display, and reliable real-time interactions. Drawing inspiration from Google Maps, Uber, and modern location apps while following Material Design principles for consistency.

**Key Design Principles:**
1. Map-first interface with minimal UI obstruction
2. Instant clarity for location data and team status
3. Touch-friendly controls for mobile-first experience
4. Clear visual hierarchy for critical actions (create/join team, set meet-up)

---

## Core Design Elements

### A. Typography

**Font Family:** Inter from Google Fonts CDN
- Primary: Inter (400, 500, 600 weights)
- Fallback: system-ui, -apple-system, sans-serif

**Type Scale:**
- Hero/Page Titles: text-4xl (36px), font-semibold
- Section Headers: text-2xl (24px), font-semibold
- Card Titles/Team Names: text-xl (20px), font-medium
- Body Text: text-base (16px), font-normal
- Captions/Meta (ETA, distance): text-sm (14px), font-medium
- Buttons: text-base (16px), font-medium

---

### B. Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Micro spacing (gaps, padding): p-2, gap-2
- Component spacing: p-4, mb-4, gap-4
- Section spacing: p-6, py-8, gap-8
- Major layouts: p-12, py-16

**Grid System:**
- Home screen: Single column stack, max-w-md centered
- Team list: Single column cards with gap-4
- Map overlay panels: Floating with rounded-2xl, backdrop-blur

**Viewport Strategy:**
- Home screen: Natural height, centered vertically with py-12
- Map screen: Full viewport (h-screen) for immersive experience

---

### C. Component Library

#### Navigation & Headers
- **Top Bar (Map Screen):** Floating rounded-full pill at top with team name, semi-transparent with backdrop-blur-md, px-6 py-3
- **Back Button:** Circular button (w-12 h-12) with arrow icon, positioned absolute top-4 left-4

#### Buttons
- **Primary Action (Create/Join):** Large rounded-xl, px-8 py-4, w-full on mobile
- **Secondary Action:** Outlined variant with border-2, same sizing
- **Icon Buttons:** Circular (w-12 h-12), rounded-full for map controls
- **Meet-up Point Setter:** Floating action button (FAB) - rounded-full, w-14 h-14, fixed bottom-6 right-6

#### Cards
- **Team Cards (Home):** rounded-xl, p-6, with shadow-md
  - Team name as text-xl font-semibold
  - Member count and timestamp as text-sm
  - Join button aligned right
- **Info Cards (Map Overlays):** rounded-2xl, backdrop-blur-lg, p-4
  - Member list with avatar placeholders and names
  - ETA/Distance display with icon pairs

#### Forms
- **Input Fields:** rounded-lg, px-4 py-3, border-2
  - Focus state with ring-4
  - Label above input as text-sm font-medium, mb-2
- **Form Container:** max-w-md, p-8, centered

#### Map Components
- **User Markers:** Circular with ring-4 to show active user, 12px diameter
- **Meet-up Marker:** Larger pin icon (24px) with pulsing animation
- **Direction Lines:** Solid 3px width with arrow markers
- **ETA Badges:** Floating rounded-full pills near each marker, px-3 py-1, text-xs

#### Lists
- **Recent Teams:** Vertical stack with gap-4
- **Team Members (Map):** Compact list with gap-2, showing name + distance

---

### D. Interactive States

**Buttons:**
- Hover: Transform scale-105, transition-all duration-200
- Active: scale-95
- Disabled: opacity-50, cursor-not-allowed

**Cards:**
- Hover: shadow-lg, translate-y-[-2px], transition-all duration-200
- No transform on mobile (touch devices)

**Map Interactions:**
- Marker click: Scale up briefly, show info panel
- Smooth pan/zoom transitions

---

## Screen-Specific Layouts

### Home Screen
- **Header:** FriendsNavigator logo/title, text-4xl, text-center, mb-12
- **Action Buttons:** Two large buttons in vertical stack, gap-4, mb-16
- **Recent Teams:** Section header "Recent Teams", mb-6, followed by team cards
- Container: max-w-md, mx-auto, px-4, py-12

### Create/Join Team Forms
- Overlay modal or dedicated screen with max-w-md centered
- Form title at top, mb-8
- Single input field for team name/number, mb-6
- Submit button, w-full
- Cancel/back link below as text-sm

### Live Map Screen
- **Full-screen map:** No padding, h-screen w-screen
- **Floating panels:**
  - Team name pill: top-6, self-center
  - Member list drawer: bottom-0, slide-up panel, rounded-t-3xl, max-h-1/2
  - FAB for meet-up point: bottom-6 right-6
  - Back button: top-4 left-4
- **Info overlays:** Positioned absolute with z-index layering

---

## Accessibility

- Minimum touch target: 44x44px (w-11 h-11)
- Focus indicators with ring-4 on all interactive elements
- ARIA labels for map markers and icon buttons
- High contrast ratios for all text
- Keyboard navigation support for all actions

---

## Icons

**Library:** Heroicons (outline and solid) via CDN

**Usage:**
- Navigation: arrow-left, x-mark
- Actions: plus-circle, user-plus, map-pin
- Map: location-marker, navigation
- UI: clock (ETA), users (team members)

Icon sizes: w-5 h-5 (20px) for inline, w-6 h-6 (24px) for buttons

---

## Images

**Hero Section:** Not applicable - this is a utility app without traditional hero
**Avatars:** Use circular placeholders (w-10 h-10) with initials for team members
**Map:** Mapbox provides the visual backdrop - no additional imagery needed

---

## Responsive Behavior

- **Mobile (base):** Single column, full-width buttons, bottom sheets for map info
- **Tablet (md:):** Maintain single column for forms, side panel (w-80) for map member list
- **Desktop (lg:):** Max-w-7xl container for home, floating panels on map more spread out

Critical: Map screen remains full-screen across all breakpoints. Panels adjust positioning and size responsively.