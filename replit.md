# FriendsNavigator

## Overview

FriendsNavigator is a real-time location sharing application that enables groups of friends to coordinate meet-ups. Users can create or join teams, share their live location with team members, set meet-up points, and view estimated travel times and routes on an interactive map. The application provides a Google Maps-inspired interface with a mobile-first design approach, emphasizing clarity and minimal UI obstruction for an immersive mapping experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**Routing**: Client-side routing implemented with Wouter, a lightweight routing library. The application has three main routes:
- Home page (`/`) - Team creation, joining, and recent teams list
- Live map view (`/map/:teamId`) - Real-time map visualization with team member locations
- 404 page - Fallback for unknown routes

**State Management**: TanStack React Query for server state and data fetching, with custom hooks for managing UI state (toasts, mobile detection).

**UI Component Library**: Shadcn UI (New York variant) with Radix UI primitives, providing a comprehensive set of accessible components. The design system uses Tailwind CSS with custom theming based on CSS variables for consistent styling.

**Design System**: Material Design-inspired approach with map application references (Google Maps). Key principles include:
- Map-first interface with minimal chrome
- Touch-friendly controls optimized for mobile
- Clear visual hierarchy using Inter font family
- Spacing based on Tailwind's spacing scale (2, 4, 6, 8, 12, 16)
- Custom color system with light/dark mode support via CSS variables

**Map Integration**: Mapbox GL JS for interactive mapping capabilities, including:
- Real-time marker rendering for team members
- Route visualization with driving directions
- Custom marker styling with member-specific colors
- Geolocation tracking for user position updates

### Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript support.

**Architecture Pattern**: The backend uses a minimal RESTful API structure with separation of concerns:
- `server/index.ts` - Main application entry point, middleware setup, and request logging
- `server/routes.ts` - API route registration (currently skeletal, designed for extension)
- `server/storage.ts` - Data access layer interface with in-memory implementation
- `server/static.ts` - Static file serving for production builds
- `server/vite.ts` - Vite middleware integration for development mode

**Development vs Production**: The application uses Vite's development server in development mode with HMR support, and serves pre-built static assets in production.

**Build Process**: Custom build script (`script/build.ts`) that:
- Bundles the client using Vite
- Bundles the server using esbuild with selective dependency bundling
- Externalizes dependencies not in the allowlist to reduce syscalls and improve cold start times

### Data Storage Solutions

**Real-time Database**: Firebase Realtime Database for storing and synchronizing:
- Team data (name, creation timestamp, creator ID)
- Team member information (locations, colors, last update timestamps)
- Meet-up points with coordinates and metadata
- Recent teams list for quick access

**Local Storage**: Browser localStorage for:
- User ID generation and persistence
- User name storage
- Recent teams tracking on the client side

**In-Memory Storage**: The server implements an in-memory storage interface (`MemStorage`) as a placeholder, suggesting the architecture supports swapping storage backends. Currently, the main data persistence occurs through Firebase on the client side.

**Rationale**: Firebase Realtime Database was chosen for its:
- Built-in real-time synchronization capabilities essential for live location tracking
- Simple client-side SDK integration
- Automatic conflict resolution for concurrent updates
- No backend infrastructure required for real-time features

### Authentication and Authorization

**User Identification**: Lightweight, anonymous user system:
- Unique user IDs generated client-side using timestamp and random string combination
- No formal authentication or account creation required
- User names stored locally and optionally provided

**Team Access**: Team access is controlled through team ID knowledge:
- Teams use auto-generated codes (e.g., `TEAM_TIMESTAMP_RANDOM`)
- Anyone with the team code can join
- No password protection or access control lists

**Security Model**: Trust-based with minimal authorization, prioritizing ease of use over security. This is appropriate for casual friend groups but not suitable for sensitive data.

### External Dependencies

**Firebase Realtime Database**
- Purpose: Real-time data synchronization for team state, member locations, and meet-up points
- Configuration: Requires Firebase project credentials (API key, auth domain, database URL, etc.)
- Client-side integration only

**Mapbox**
- Purpose: Interactive map rendering and directions API
- Services used:
  - Mapbox GL JS for map visualization
  - Directions API for route calculation and ETA estimation
- Authentication: Access token required (stored in environment variable `VITE_MAPBOX_ACCESS_TOKEN`)

**Google Fonts**
- Purpose: Inter font family for typography
- Integration: CDN link in HTML head with preconnect optimization

**Browser Geolocation API**
- Purpose: Real-time user position tracking
- No external service required, uses native browser capability
- Requires user permission for location access

**Third-party UI Libraries**
- Radix UI: Unstyled, accessible component primitives
- Lucide React: Icon library
- Class Variance Authority: Component variant management
- Tailwind CSS: Utility-first styling framework

**Database Schema** (Firebase Realtime Database structure):
```
teams/
  {teamId}/
    id: string
    name: string
    createdAt: number
    createdBy: string
    meetupPoint?: {
      lat: number
      lng: number
      name?: string
      setBy?: string
      timestamp?: number
    }
    members?: {
      {memberId}: {
        id: string
        name?: string
        location?: {
          lat: number
          lng: number
          timestamp?: number
        }
        color?: string
        lastUpdated?: number
      }
    }

recentTeams/
  {teamId}/
    id: string
    name: string
    joinedAt: number
```

**Environment Variables Required**:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_MAPBOX_ACCESS_TOKEN`
- `DATABASE_URL` (configured in drizzle.config.ts but not actively used)