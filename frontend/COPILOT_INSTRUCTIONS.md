# CONFCal — Frontend Development Instructions

## 1. PROJECT OVERVIEW

You are developing the frontend for CONFCal, an academic conference discovery and calendar platform.

CONFCal helps students, researchers, and academics:

- discover academic conferences
- search conferences
- filter conferences by research area
- track paper submission deadlines
- view conference details
- save conferences
- personalize conference recommendations
- eventually manage conferences through a calendar

The backend and database are ALREADY IMPLEMENTED.

Your responsibility is ONLY the frontend.

---

# 2. ABSOLUTE PROJECT BOUNDARY

You MUST ONLY modify files inside:

frontend/

You MUST NOT modify anything outside the frontend directory.

DO NOT modify:

- ../backend/
- ../data/
- Python files
- FastAPI files
- PostgreSQL
- Supabase database schemas
- database tables
- IEEE ingestion scripts
- IEEE API scripts
- normalization scripts

The backend is considered READ-ONLY.

If you believe a backend change is required, STOP and explain what API capability is missing.

Do NOT implement a backend workaround.

---

# 3. EXISTING PROJECT STRUCTURE

The repository currently contains:

confcal/

├── backend/
│   ├── app/
│   ├── scripts/
│   └── ...
│
├── data/
│   ├── ieee_raw/
│   ├── ieee_details/
│   ├── ieee_all_categories.json
│   ├── ieee_upcoming.json
│   └── ieee_conferences.json
│
└── frontend/
    ├── src/
    ├── public/
    └── ...

The backend already contains:

- FastAPI
- SQLAlchemy
- PostgreSQL
- Supabase PostgreSQL database
- IEEE conference data

The database currently contains:

- 1,153 IEEE conferences
- 2,713 conference-category relationships
- 15 research categories

---

# 4. BACKEND API

The backend runs locally at:

http://127.0.0.1:8000

The frontend MUST communicate with the backend through HTTP APIs.

DO NOT connect the frontend directly to PostgreSQL.

DO NOT connect the frontend directly to Supabase PostgreSQL for conference data.

Use:

NEXT_PUBLIC_API_URL

from:

frontend/.env.local

Example:

NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

---

# 5. EXISTING API ENDPOINTS

## GET /api/conferences/

Returns conference listings.

Supported query parameters:

search
country
category
deadline
page
limit

Examples:

/api/conferences/

/api/conferences/?search=machine%20learning

/api/conferences/?country=India

/api/conferences/?category=machine_learning

/api/conferences/?deadline=upcoming

/api/conferences/?deadline=7days

/api/conferences/?deadline=passed

/api/conferences/?deadline=none

/api/conferences/?page=2&limit=20

Parameters can be combined.

Example:

/api/conferences/?search=AI&country=India&category=artificial_intelligence&page=1&limit=20


## GET /api/conferences/{id}

Returns detailed information about a conference.

The response includes:

- id
- event_id
- title
- start_date
- end_date
- paper_deadline
- city
- region
- country
- venue
- scope
- about
- format
- is_virtual
- website
- event_contact
- ieee_region
- ieee_detail_url
- categories


## GET /api/categories/

Returns the available research categories.

Current categories include:

- Artificial Intelligence
- Machine Learning
- Computer Vision
- Natural Language Processing
- Generative AI
- Robotics
- Internet of Things
- Cybersecurity
- Data Science
- Software Engineering
- Cloud Computing
- Computer Networks
- Blockchain
- Signal Processing
- Embedded Systems

---

# 6. IMPORTANT API RULE

Never invent an API endpoint.

If the frontend requires functionality that is not currently supported by the backend:

1. Do NOT modify the backend.
2. Do NOT create fake/mock API responses.
3. Do NOT directly access the database.
4. Clearly report the missing API capability.

For development, use real backend data.

Do NOT hardcode conference records.

---

# 7. TECHNOLOGY

Use:

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- React
- modern React patterns
- responsive design

Prefer simple, maintainable components.

Avoid unnecessary dependencies.

Do not introduce a large UI framework unless absolutely necessary.

---

# 8. DESIGN DIRECTION

CONFCal should feel like a modern SaaS/productivity application.

Design goals:

- professional
- minimal
- modern
- academic
- clean
- fast
- highly readable
- responsive
- accessible
- visually polished

Avoid:

- excessive gradients
- excessive animations
- clutter
- giant decorative illustrations
- overly rounded everything
- excessive glassmorphism
- generic AI-dashboard aesthetics
- unnecessary charts

The application should feel like a serious academic productivity tool.

---

# 9. PRIMARY UX PRINCIPLE

CONFCal is NOT simply a database of conferences.

The primary user goal is:

"Show me conferences that matter to me and deadlines I should care about."

Therefore:

DEADLINES > generic conference metadata

and

DISCOVERY > raw database browsing.

Conference cards should make deadlines highly visible.

---

# 10. APPLICATION ROUTES

Build the following routes:

/

 /explore

 /calendar

 /saved

 /conference/[id]

 /login

 /onboarding

 /dashboard

Authentication functionality may initially be represented by UI placeholders.

Do NOT implement Google OAuth yet unless specifically instructed.

---

# 11. LANDING PAGE

Create a polished landing page at:

/

Suggested structure:

Header:

CONFCal logo/name

Navigation:

Explore
Calendar

Login button

Hero:

"Find conferences that matter to your research."

Supporting text explaining the product.

Primary CTA:

"Explore Conferences"

Secondary CTA:

"Get Started"

Below the hero:

- deadline tracking
- personalized discovery
- research categories
- conference calendar

The landing page should feel like a real product homepage.

---

# 12. DASHBOARD

The dashboard should be the central product experience.

Suggested layout:

Header

Greeting / welcome area

Research interests section

Upcoming deadlines

Recommended conferences

Recently viewed/saved conferences

Upcoming conferences

The dashboard should prioritize:

1. deadlines
2. relevant conferences
3. saved conferences
4. upcoming events

Do not overload the dashboard.

---

# 13. EXPLORE PAGE

Route:

/explore

This is the primary conference discovery interface.

Include:

Search bar

Category filters

Country filter

Deadline filter

Pagination

Conference cards

Loading state

Error state

Empty state

Suggested filter UI:

All
Artificial Intelligence
Machine Learning
Computer Vision
NLP
Generative AI
Robotics
IoT
Cybersecurity
etc.

Search should call the backend API.

Do NOT filter the full dataset client-side.

---

# 14. CONFERENCE CARD

Create a reusable ConferenceCard component.

Each card should display:

- conference title
- research categories
- city
- country
- conference dates
- paper submission deadline
- deadline status
- conference format
- View Details button
- Save button placeholder if authentication is not implemented

Example visual hierarchy:

Conference Title

AI · Machine Learning

India

Conference:
Oct 20 – Oct 22, 2026

Paper Deadline:
7 days remaining

[View Conference]

Deadline information must be visually prominent.

---

# 15. DEADLINE STATUS

The backend provides:

deadline_status

Possible values:

passed
urgent
upcoming
no_deadline

It also provides:

days_until_deadline

Use these values.

DO NOT recalculate deadline status in the frontend unless absolutely necessary.

Suggested presentation:

passed:

"Deadline passed"

urgent:

"Deadline in 3 days"

upcoming:

"Deadline in 24 days"

no_deadline:

"No paper deadline"

Use accessible visual indicators.

Do not rely solely on color.

---

# 16. CONFERENCE DETAILS PAGE

Route:

/conference/[id]

Show:

Conference title

Categories

Conference dates

Paper submission deadline

Location

Venue

Format

Virtual/hybrid/in-person information

Scope

About

Sponsors if available from API

Official website

IEEE conference link

Contact information when available

CTA:

"Visit Conference Website"

Potential future CTA:

"Save Conference"

The page should have a clean research-oriented layout.

---

# 17. CALENDAR PAGE

Route:

/calendar

Initially build the UI around upcoming conferences.

Calendar should eventually show:

conference dates

paper deadlines

saved conferences

For the initial version:

Use backend conference data.

Do not build complex calendar functionality unless necessary.

A useful initial design could include:

Month navigation

Calendar grid

Deadline markers

Conference markers

Upcoming deadline list beside/below calendar

Keep it responsive.

---

# 18. SAVED PAGE

Route:

/saved

Authentication is not implemented yet.

Build the UI structure but do not invent saved data.

If the user is not authenticated, show:

"Sign in to save conferences."

Provide:

"Sign in with Google"

as a placeholder button.

Do not implement OAuth yet.

---

# 19. LOGIN PAGE

Route:

/login

Create a polished authentication screen.

Include:

CONFCal branding

"Continue with Google"

Email/password UI may be omitted for now.

IMPORTANT:

Do not implement fake authentication.

Do not pretend the user is logged in.

Google OAuth will be implemented later.

---

# 20. ONBOARDING

Route:

/onboarding

Create a research-interest selection experience.

Show categories as selectable cards/chips:

Artificial Intelligence
Machine Learning
Computer Vision
NLP
Generative AI
Robotics
IoT
Cybersecurity
Data Science
etc.

Allow selecting multiple categories.

For now, selection can remain frontend state.

Do not persist user interests yet.

Do not modify the backend.

The backend user-interest API will be implemented later.

---

# 21. API ARCHITECTURE

Create a dedicated frontend API layer.

For example:

src/lib/api.ts

or:

src/services/api.ts

Do not scatter fetch() calls throughout components.

Centralize API requests.

Example functions:

getConferences()
getCategories()
getConference(id)

The API base URL must come from:

process.env.NEXT_PUBLIC_API_URL

---

# 22. TYPESCRIPT TYPES

Create proper TypeScript interfaces/types.

For example:

Conference

Category

ConferenceResponse

CategoryResponse

ConferenceDetail

DeadlineStatus

Do not use:

any

unless absolutely unavoidable.

Keep API types separate from UI components.

---

# 23. LOADING STATES

Every API-driven page must have a loading state.

Examples:

Skeleton conference cards

Loading spinner where appropriate

Do not leave blank white screens.

---

# 24. ERROR STATES

If the backend is unavailable:

Show a friendly message:

"Unable to load conferences."

Provide:

"Try again"

Do not expose raw Python errors to users.

---

# 25. EMPTY STATES

For example:

No conferences match your filters.

Provide:

Clear filters

---

# 26. RESPONSIVENESS

The application must work on:

Desktop
Laptop
Tablet
Mobile

Prioritize mobile usability.

Do not build a desktop-only dashboard.

---

# 27. ACCESSIBILITY

Use:

semantic HTML

proper buttons

keyboard navigation

visible focus states

ARIA labels when necessary

sufficient contrast

Do not make important information color-only.

---

# 28. COMPONENT ARCHITECTURE

Prefer reusable components such as:

components/
├── layout/
│   ├── Navbar.tsx
│   └── Footer.tsx
│
├── conferences/
│   ├── ConferenceCard.tsx
│   ├── ConferenceGrid.tsx
│   ├── ConferenceFilters.tsx
│   ├── DeadlineBadge.tsx
│   └── ConferenceSkeleton.tsx
│
├── categories/
│   └── CategorySelector.tsx
│
└── ui/
    ├── Button.tsx
    ├── Badge.tsx
    └── EmptyState.tsx

Do not create components unnecessarily.

---

# 29. STATE MANAGEMENT

Do not introduce Redux or another global state library unless clearly necessary.

Use:

React state
URL search parameters
server/client fetching where appropriate

Search/filter state should preferably be represented in URL query parameters so users can share/bookmark filtered results.

---

# 30. URL FILTERS

For /explore:

Example:

/explore?search=machine%20learning&country=India&category=machine_learning

The UI should initialize its filter state from URL parameters.

When filters change, update the URL.

This allows:

- browser back/forward
- sharing filtered searches
- bookmarking searches

---

# 31. PERFORMANCE

Do not fetch the entire conference dataset into the browser.

Use backend pagination.

Default:

limit=20

Fetch additional pages as required.

Avoid unnecessary API requests.

Do not refetch data on every keystroke.

For search, use a small debounce.

---

# 32. SECURITY

Never expose:

- database passwords
- Supabase service-role keys
- backend secrets
- IEEE API keys

Do not place secrets in:

NEXT_PUBLIC_*

Only public frontend configuration belongs in NEXT_PUBLIC_*.

---

# 33. MOCK DATA POLICY

Do NOT create fake conference data when the backend is available.

Use real API data.

For purely visual components that require data before an API exists, use minimal temporary placeholders and clearly isolate them.

Do not present fake conferences as real conferences.

---

# 34. DEVELOPMENT WORKFLOW

Work incrementally.

Do NOT attempt to build the entire application in one giant change.

Recommended order:

PHASE 1

- API client
- TypeScript types
- Navbar
- basic layout
- landing page

PHASE 2

- Explore page
- conference cards
- search
- filters
- pagination

PHASE 3

- Conference details page
- deadline UI
- responsive improvements

PHASE 4

- dashboard
- onboarding UI
- calendar UI
- saved UI

PHASE 5

- authentication after backend support exists

---

# 35. BEFORE MODIFYING FILES

First inspect the existing Next.js project.

Understand:

- app structure
- Tailwind configuration
- package.json
- existing global styles
- layout
- components

Do not blindly overwrite existing files.

Reuse existing structure when possible.

---

# 36. CODE QUALITY

Use:

- clean TypeScript
- meaningful names
- small components
- reusable utilities
- clear separation of concerns

Avoid:

- giant components
- duplicated API calls
- duplicated UI logic
- unnecessary dependencies
- magic numbers
- inline massive objects

---

# 37. CRITICAL SAFETY RULE

If a requested frontend feature cannot be implemented without modifying the backend:

STOP.

Explain:

1. what the frontend needs
2. what API is currently missing
3. what endpoint would be required

Do not modify backend files yourself.

---

# 38. CURRENT TASK

Start with PHASE 1 only.

Implement:

1. API client
2. TypeScript API types
3. global application layout
4. professional Navbar
5. landing page
6. basic Explore page
7. fetch real conferences from FastAPI
8. fetch real categories from FastAPI
9. loading states
10. error states
11. responsive design

DO NOT implement:

- Google OAuth
- Supabase Auth
- database changes
- backend changes
- saved-conference persistence
- user persistence
- recommendation algorithm
- notification system

Those will be implemented later.

---

# 39. FINAL VERIFICATION

Before finishing PHASE 1:

Run:

npm run lint

and:

npm run build

Fix frontend errors.

Confirm:

- frontend runs
- backend remains untouched
- API requests work
- conferences display from FastAPI
- categories display from FastAPI
- search works
- responsive layout works
- no TypeScript errors
- no lint errors

At the end, provide a concise summary of:

- files created
- files modified
- dependencies added
- API endpoints used
- anything that remains for Phase 2

Do not modify anything outside frontend/.