Here’s a **detailed, professional, GitHub-ready README** you can paste directly into `README.md`:

````
# ConfCal — Personalized Academic Conference Calendar

<p align="center">
  <img src="frontend/public/confcal-logo.svg" alt="ConfCal Logo" width="120"/>
</p>

<h3 align="center">Discover. Personalize. Track. Never Miss a Conference Deadline.</h3>

<p align="center">
  A personalized academic conference discovery and deadline management platform for researchers, students, and academics.
</p>

<p align="center">
  <a href="https://confcal-five.vercel.app">Live Demo</a> •
  <a href="https://github.com/Alexrohith/testconfcal">GitHub</a> •
  <a href="https://confcal-backend.onrender.com/docs">API Documentation</a>
</p>

---

## 📌 Overview

**ConfCal** is a full-stack academic conference discovery platform designed to make finding, tracking, and managing research conferences easier.

Researchers and students often need to search across large conference catalogs, compare events, track paper submission deadlines, and manually maintain their own list of relevant conferences.

ConfCal brings these workflows into a single personalized platform.

The system continuously collects conference information, normalizes and stores it, categorizes conferences by research areas, and provides personalized discovery based on a user's research interests.

### Core capabilities

- 🔎 Conference discovery
- 🕷️ Automated conference data scraping/collection
- 📚 IEEE conference catalog integration
- 🎯 Personalized conference recommendations
- 📅 Deadline-first conference tracking
- 🔖 Save/bookmark conferences
- 📊 Conference comparison
- 🔔 Deadline reminders
- 🔔 In-app notifications
- 🔐 Google OAuth authentication
- 📆 Personal calendar
- 📱 Responsive UI
- ⚡ Production-ready REST API
- 🔄 Automated scheduled data synchronization

---

# 🎯 Problem Statement

Finding suitable academic conferences is surprisingly time-consuming.

Researchers typically have to:

1. Search multiple conference websites.
2. Identify conferences relevant to their research.
3. Check submission deadlines.
4. Compare locations and conference dates.
5. Bookmark useful conferences manually.
6. Track changing deadlines.
7. Remember when papers need to be submitted.

This creates a fragmented workflow.

### ConfCal solves this by providing:

```text
Conference Sources
       ↓
Data Collection / Scraping
       ↓
Normalization
       ↓
PostgreSQL Database
       ↓
Categorization
       ↓
Personalization
       ↓
Conference Discovery
       ↓
Deadline Tracking
       ↓
Reminders & Notifications
````

---

# ✨ Features

## 🔎 Conference Discovery

Explore academic conferences through a centralized interface.

Users can search and filter conferences based on:

- Research area
- Country
- Deadline
- Conference date
- Conference status
- Other available metadata

---

## 🕷️ Automated Conference Data Collection

ConfCal includes an automated ingestion pipeline for collecting conference information from IEEE conference data sources.

The pipeline:

1. Searches conference categories.
2. Retrieves conference records.
3. Deduplicates conference events.
4. Fetches detailed conference information.
5. Normalizes the data.
6. Associates conferences with research categories.
7. Performs database UPSERT operations.

The ingestion system currently processes **1,100+ unique conferences**.

### Supported research categories

```
Artificial Intelligence
Machine Learning
Computer Vision
Natural Language Processing
Generative AI
Robotics
Internet of Things
Cybersecurity
Data Science
Software Engineering
Cloud Computing
Computer Networks
Blockchain
Signal Processing
Embedded Systems
```

---

# 🎯 Personalized Recommendations

ConfCal allows users to define their research interests.

For example:

```
Machine Learning
Computer Vision
Generative AI
```

The recommendation engine matches the user's interests against conference categories.

### Recommendation ranking

Conferences are ranked using:

1. Match percentage
2. Number of matched categories
3. Paper submission deadline
4. Conference ID

Example:

```
User Interests
      │
      ├── Machine Learning
      ├── Computer Vision
      └── Generative AI
              │
              ▼
      Conference Categories
              │
              ▼
      Category Matching
              │
              ▼
      Match Percentage
              │
              ▼
      Ranked Recommendations
```

This provides a lightweight and explainable personalization system without requiring an LLM or embedding infrastructure.

---

# 📅 Deadline Intelligence

Deadlines are treated as a first-class part of the product.

ConfCal currently tracks the primary:

```
Paper Submission Deadline
```

Deadlines are automatically classified into meaningful states:

| Status      | Meaning                     |
| ----------- | --------------------------- |
| Passed      | Deadline has already passed |
| Today       | Deadline is today           |
| 1–7 Days    | Deadline is approaching     |
| 8–30 Days   | Upcoming                    |
| 31+ Days    | Farther away                |
| No Deadline | No deadline available       |

The interface uses deadline badges and filters to make urgent submissions easier to identify.

---

# 🔖 Saved Conferences

Authenticated users can save conferences for later.

API operations include:

```
POST   /api/conferences/{conference_id}/save
DELETE /api/conferences/{conference_id}/save
GET    /api/conferences/saved
GET    /api/conferences/{conference_id}/saved
```

Saved conferences are used across:

- Saved Conferences
- My Calendar
- Deadline reminders
- Personal research workflow

---

# 📊 Conference Comparison

Users can compare up to **three conferences simultaneously**.

Comparison includes information such as:

- Conference title
- Location
- Dates
- Paper deadline
- Format
- Venue
- Research scope
- Website

The comparison state is URL-based, making comparisons shareable and persistent across refreshes.

Example:

```
/conferences?compare=12,34,56
```

---

# 📆 My Calendar

ConfCal provides a personal calendar based on conferences saved by the authenticated user.

Users can:

- View saved conferences
- Switch between calendar views
- Search saved conferences
- Filter by country
- Filter by research area
- Filter by deadline status

The calendar is generated from the user's saved conference collection.

---

# 🔔 Deadline Reminders

Users can create deadline reminders for saved conferences.

Supported reminder intervals:

```
7 days before
3 days before
1 day before
```

The system stores reminder preferences and processes them automatically.

### Reminder architecture

```
Conference
    │
    ▼
Paper Deadline
    │
    ▼
Reminder Preference
    │
    ├── 7 days
    ├── 3 days
    └── 1 day
    │
    ▼
Daily Reminder Worker
    │
    ▼
Notification
```

---

# 🔔 Notification Center

ConfCal includes an in-app notification system.

Users can:

- View recent notifications
- See unread notification count
- Open notifications
- Mark notifications as read
- Navigate directly to the relevant conference

Notifications are scoped to the authenticated user.

---

# 🔐 Authentication

ConfCal uses **Supabase Auth** with Google OAuth.

Authentication flow:

```
User
  │
  ▼
Google OAuth
  │
  ▼
Supabase Auth
  │
  ▼
Authenticated Session
  │
  ▼
ConfCal Backend
```

The backend validates the Supabase bearer token and derives the authenticated user's identity from the token.

User IDs are **never accepted from the client for authorization-sensitive operations**.

---

# 🏗️ System Architecture

```
                         ┌─────────────────────┐
                         │   IEEE Conference   │
                         │       Sources       │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Data Collection /   │
                         │     Scraping        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Normalization &     │
                         │    Deduplication    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │       PostgreSQL /           │
                    │          Supabase            │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌─────────────────┐           ┌─────────────────┐
          │    FastAPI      │           │ Supabase Auth   │
          │     Backend     │           │   Google OAuth  │
          └────────┬────────┘           └────────┬────────┘
                   │                             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                         ┌─────────────────────┐
                         │      Next.js        │
                         │     Frontend        │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              Discover          Calendar         Dashboard
                    │               │               │
                    ▼               ▼               ▼
               Compare           Saved         Notifications
```

---

# 🧩 Technology Stack

## Frontend

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- Supabase JavaScript Client

## Backend

- **Python**
- **FastAPI**
- **SQLAlchemy**
- **Pydantic**
- PostgreSQL

## Database

- **Supabase PostgreSQL**
- Row Level Security
- PostgreSQL indexes
- Foreign keys
- Constraints
- UPSERT-based synchronization

## Authentication

- Supabase Auth
- Google OAuth

## Data Collection

- Python
- IEEE Conference API/data sources
- HTTP requests
- Concurrent detail fetching
- Data normalization
- Deduplication

## Automation

- GitHub Actions
- Scheduled IEEE synchronization
- Daily deadline reminder worker

## Deployment

| Component      | Platform       |
| -------------- | -------------- |
| Frontend       | Vercel         |
| Backend        | Render         |
| Database       | Supabase       |
| Authentication | Supabase Auth  |
| Scheduled Jobs | GitHub Actions |

---

# 📂 Project Structure

```
confcal/
│
├── backend/
│   │
│   ├── app/
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── main.py
│   │   │
│   │   ├── models/
│   │   │   └── conference.py
│   │   │
│   │   └── routers/
│   │       ├── conferences.py
│   │       ├── categories.py
│   │       ├── sync.py
│   │       └── reminders.py
│   │
│   ├── scripts/
│   │   ├── import_conferences.py
│   │   ├── sync_ieee.py
│   │   ├── scheduled_sync.py
│   │   └── process_deadline_reminders.py
│   │
│   ├── migrations/
│   │   ├── 001_create_sync_runs.sql
│   │   ├── 002_create_deadline_reminders.sql
│   │   └── 003_enable_reminder_rls.sql
│   │
│   ├── tests/
│   │   ├── test_saved_conferences.py
│   │   ├── test_recommended_conferences.py
│   │   ├── test_reminders.py
│   │   └── test_deadline_reminder_worker.py
│   │
│   ├── requirements.txt
│   └── schema.sql
│
├── frontend/
│   │
│   ├── app/
│   ├── components/
│   ├── src/
│   │   ├── lib/
│   │   └── types/
│   │
│   ├── public/
│   │   └── confcal-logo.svg
│   │
│   ├── package.json
│   └── next.config.ts
│
├── .github/
│   └── workflows/
│       ├── weekly-ieee-sync.yml
│       └── daily-deadline-reminders.yml
│
└── README.md
```

---

# 🗄️ Database Design

The core database consists of the following entities:

```
users
  │
  ├─────────────── user_interests
  │
  ├─────────────── saved_conferences
  │
  └─────────────── deadline_reminders
                         │
                         ▼
                  user_notifications


conferences
  │
  └──────────── conference_categories
                         │
                         ▼
                    categories
```

### Core tables

#### `conferences`

Stores conference metadata:

- Title
- Dates
- Paper deadline
- Location
- Country
- Venue
- Scope
- Format
- Website
- Source
- External event ID
- Verification timestamps

#### `categories`

Stores supported research categories.

#### `conference_categories`

Many-to-many relationship between conferences and categories.

#### `users`

Stores application-level user profiles.

#### `user_interests`

Stores research interests selected by users.

#### `saved_conferences`

Stores conferences saved by users.

#### `deadline_reminders`

Stores user reminder preferences.

#### `user_notifications`

Stores generated deadline notifications.

---

# 🔄 Data Synchronization

ConfCal uses an automated synchronization pipeline to keep conference information updated.

### Synchronization flow

```
GitHub Actions
      │
      ▼
Scheduled Sync
      │
      ▼
IEEE Search
      │
      ▼
15 Research Categories
      │
      ▼
Deduplicate Event IDs
      │
      ▼
Fetch Conference Details
      │
      ▼
Normalize Records
      │
      ▼
UPSERT PostgreSQL
      │
      ▼
Update Category Relationships
      │
      ▼
Record Sync Statistics
```

The synchronization process is designed to be **idempotent**.

Running the synchronization multiple times does not create duplicate conference records.

The database uses:

```
UNIQUE(source, event_id)
```

to enforce source-level uniqueness.

---

# ⚡ Performance & Reliability

The synchronization system includes several reliability mechanisms:

### Idempotent UPSERT

Conference records are matched using:

```
(source, event_id)
```

Existing conferences are updated instead of duplicated.

### Deduplication

Multiple category searches can return the same conference.

ConfCal deduplicates events before detail processing.

### Concurrent detail fetching

Conference details are fetched concurrently using a controlled worker pool.

### Rate limiting

Requests are throttled to avoid excessive API traffic.

### PostgreSQL advisory locking

The synchronization process uses an advisory lock to prevent overlapping synchronization jobs.

### Transaction safety

Database updates occur within transactions so failures do not leave partially updated state.

### Sync history

Synchronization runs are recorded with:

- Start time
- Completion time
- Status
- Records fetched
- Records inserted
- Records updated
- Category links added
- Error information

---

# 🔒 Security

Security was considered across the application stack.

### Authentication

All user-specific API endpoints require a valid Supabase bearer token.

### Authorization

The backend derives the user identity from the authenticated token.

Clients cannot provide arbitrary user IDs to access another user's data.

### Database security

User-specific tables use PostgreSQL Row Level Security.

Users can access only their own:

- Interests
- Saved conferences
- Reminder preferences
- Notifications

### Secret management

Sensitive credentials are stored outside the repository.

Examples:

```
DATABASE_URL
IEEE_API_KEY
SUPABASE credentials
Google OAuth secrets
```

Frontend-exposed variables use the `NEXT_PUBLIC_` convention only for values that are safe to expose publicly.

---

# 🔔 Automated Jobs

ConfCal uses GitHub Actions for scheduled background tasks.

## Weekly Conference Synchronization

The IEEE catalog synchronization runs automatically on a scheduled basis.

Workflow:

```
GitHub Actions
      ↓
IEEE Sync
      ↓
Data Normalization
      ↓
Database UPSERT
      ↓
Sync History
```

It can also be manually triggered using GitHub Actions.

---

## Daily Deadline Reminder Processing

A separate scheduled workflow processes reminder preferences.

```
Daily GitHub Action
        ↓
Reminder Worker
        ↓
Find Eligible Reminders
        ↓
Check Paper Deadline
        ↓
Generate Notification
        ↓
Prevent Duplicate Notification
```

The notification system uses a unique constraint on reminder/deadline combinations to prevent duplicate notifications.

---

# 🧪 Testing

The project includes automated backend and frontend validation.

### Backend

Tests cover:

- Authentication
- Saved conferences
- Recommendations
- Deadline reminders
- Notifications
- Reminder worker
- Authorization
- Cross-user access protection
- Deadline edge cases
- Duplicate prevention

### Frontend

Validation includes:

- ESLint
- TypeScript compilation
- Production build
- Responsive UI testing
- Mobile layout validation
- URL state validation
- Deadline boundary testing

Example backend commands:

```
cd backend

python -m unittest discover -s tests -v
```

Compile validation:

```
python -m compileall app scripts
```

Frontend:

```
cd frontend

npm run lint
npm run build
```

---

# 🚀 Local Development

## Prerequisites

Make sure you have:

- Python 3.10+
- Node.js
- npm
- PostgreSQL/Supabase
- Git

---

# 1. Clone the repository

```
git clone https://github.com/Alexrohith/testconfcal.git

cd testconfcal
```

---

# 2. Backend Setup

```
cd backend
```

Create a virtual environment:

```
python -m venv .venv
```

Activate it on Windows:

```
.venv\Scripts\activate
```

Install dependencies:

```
pip install -r requirements.txt
```

Create:

```
.env
```

Example:

```
DATABASE_URL=your_database_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
IEEE_API_KEY=your_ieee_api_key
```

Run the backend:

```
uvicorn app.main:app --reload
```

API will be available at:

```
http://localhost:8000
```

Swagger documentation:

```
http://localhost:8000/docs
```

---

# 3. Frontend Setup

```
cd frontend
```

Install dependencies:

```
npm install
```

Create:

```
.env.local
```

Example:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start development:

```
npm run dev
```

Open:

```
http://localhost:3000
```

---

# 🔑 Environment Variables

### Backend

| Variable            | Purpose                 |
| ------------------- | ----------------------- |
| `DATABASE_URL`      | PostgreSQL connection   |
| `SUPABASE_URL`      | Supabase project URL    |
| `SUPABASE_ANON_KEY` | Supabase public API key |
| `IEEE_API_KEY`      | IEEE data access        |

### Frontend

| Variable                        | Purpose                 |
| ------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL`           | Backend API URL         |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public API key |

> Never commit `.env`, `.env.local`, database passwords, service-role keys, OAuth secrets, or API keys to Git.

---

# 🌐 Production Deployment

ConfCal is deployed using a modern serverless/cloud architecture.

```
                    GitHub
                      │
             ┌────────┴────────┐
             ▼                 ▼
          Vercel             Render
             │                 │
             ▼                 ▼
         Next.js            FastAPI
             │                 │
             └────────┬────────┘
                      │
                      ▼
                  Supabase
                PostgreSQL
                      +
                 Supabase Auth
```

### Frontend

Hosted on:

```
https://confcal-five.vercel.app
```

### Backend

Hosted on:

```
https://confcal-backend.onrender.com
```

### API Documentation

```
https://confcal-backend.onrender.com/docs
```

---

# 📡 API Overview

## Conferences

```
GET /api/conferences
GET /api/conferences/{id}
GET /api/conferences/recommended
```

## Saved Conferences

```
GET    /api/conferences/saved
POST   /api/conferences/{id}/save
DELETE /api/conferences/{id}/save
GET    /api/conferences/{id}/saved
```

## Categories

```
GET /api/categories
```

## Reminders

```
GET    /api/reminders
POST   /api/reminders
PATCH  /api/reminders/{id}
DELETE /api/reminders/{id}
```

## Notifications

```
GET   /api/notifications
PATCH /api/notifications/{id}/read
```

## Synchronization

```
GET /api/sync/status
GET /api/sync/health
```

---

# 🧠 Design Philosophy

ConfCal follows several principles:

### 1. Deadline-first

Researchers care not only about which conference is relevant, but also:

> "When is the paper due?"

Therefore deadlines are treated as a primary discovery signal.

### 2. Explainable personalization

Instead of returning unexplained recommendations, ConfCal shows why a conference matches the user's interests.

### 3. Minimal infrastructure

The platform intentionally avoids unnecessary complexity.

The V1 recommendation system uses structured category matching rather than expensive embedding or LLM infrastructure.

### 4. Secure by default

User-specific operations are authenticated and authorized at the backend/database layers.

### 5. Automation over manual maintenance

Conference synchronization and deadline notifications are automated through scheduled jobs.

---

# 🗺️ Roadmap

## V1 — Current

- IEEE conference ingestion
- Conference catalog
- Conference categorization
- Search and filtering
- Google OAuth
- Research interests
- Personalized recommendations
- Saved conferences
- Personal calendar
- Conference comparison
- Deadline intelligence
- Deadline reminders
- Notification center
- Automated synchronization
- Production deployment
- Responsive UI

## V2 — Planned

- Additional conference sources
- Cross-source conference deduplication
- Semantic conference relevance
- Advanced recommendation models
- Email deadline digests
- Advanced notification preferences
- Conference intelligence
- Research-topic extraction
- Improved personalization

---

# 🤝 Contributing

Contributions are welcome.

### Fork the repository

```
git clone https://github.com/Alexrohith/testconfcal.git
```

Create a feature branch:

```
git checkout -b feature/your-feature
```

Make your changes and commit:

```
git add .
git commit -m "feat: add your feature"
```

Push:

```
git push origin feature/your-feature
```

Then open a Pull Request.

---

# 🐛 Reporting Issues

If you discover a bug or have a feature request, please open an issue with:

- Clear description
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/logs where applicable

---

# 📄 License

This project is currently maintained as a personal/open-source project.

See the repository for the applicable licensing terms.

---

# 👨‍💻 Authors

### Cosmic Coders

Built with ❤️ for researchers, students, and the academic community.

---

# ⭐ Support the Project

If you find ConfCal useful:

⭐ Star the repository\
🐛 Report issues\
💡 Suggest improvements\
🤝 Contribute
