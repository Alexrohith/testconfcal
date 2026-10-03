CREATE TABLE conferences (
    id SERIAL PRIMARY KEY,

    source VARCHAR(50) NOT NULL,
    event_id INTEGER NOT NULL,

    title TEXT NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    paper_deadline DATE,

    city VARCHAR(255),
    region VARCHAR(255),
    country VARCHAR(255),
    venue TEXT,

    scope TEXT,
    about TEXT,

    format VARCHAR(50),
    is_virtual BOOLEAN DEFAULT FALSE,

    website TEXT,
    event_contact VARCHAR(255),

    ieee_region VARCHAR(255),

    ieee_detail_url TEXT,

    last_verified DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(source, event_id)
);


CREATE TABLE categories (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) UNIQUE NOT NULL,

    display_name VARCHAR(150) NOT NULL
);


CREATE TABLE conference_categories (
    conference_id INTEGER NOT NULL
        REFERENCES conferences(id)
        ON DELETE CASCADE,

    category_id INTEGER NOT NULL
        REFERENCES categories(id)
        ON DELETE CASCADE,

    PRIMARY KEY (conference_id, category_id)
);


CREATE TABLE users (
    id UUID PRIMARY KEY,

    email VARCHAR(255) UNIQUE NOT NULL,

    name VARCHAR(255),

    avatar_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE user_interests (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    category_id INTEGER NOT NULL
        REFERENCES categories(id)
        ON DELETE CASCADE,

    PRIMARY KEY (user_id, category_id)
);


CREATE TABLE saved_conferences (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    conference_id INTEGER NOT NULL
        REFERENCES conferences(id)
        ON DELETE CASCADE,

    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, conference_id)
);


CREATE TABLE sync_runs (
    id BIGSERIAL PRIMARY KEY,

    source VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'failed')),

    categories_searched INTEGER NOT NULL DEFAULT 0,
    raw_records INTEGER NOT NULL DEFAULT 0,
    unique_event_ids INTEGER NOT NULL DEFAULT 0,
    details_fetched INTEGER NOT NULL DEFAULT 0,
    failed_details INTEGER NOT NULL DEFAULT 0,
    inserted INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    unchanged INTEGER NOT NULL DEFAULT 0,
    category_links_added INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE INDEX ix_sync_runs_source_started_at
    ON sync_runs (source, started_at DESC);