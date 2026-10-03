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


CREATE TABLE deadline_reminders (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    conference_id INTEGER NOT NULL
        REFERENCES conferences(id)
        ON DELETE CASCADE,
    days_before INTEGER NOT NULL
        CHECK (days_before IN (1, 3, 7)),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, conference_id)
);

CREATE INDEX ix_deadline_reminders_user_enabled
    ON deadline_reminders (user_id, enabled);

CREATE INDEX ix_deadline_reminders_enabled_conference
    ON deadline_reminders (enabled, conference_id);


CREATE TABLE user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    reminder_id BIGINT NOT NULL
        REFERENCES deadline_reminders(id)
        ON DELETE CASCADE,
    conference_id INTEGER NOT NULL
        REFERENCES conferences(id)
        ON DELETE CASCADE,
    paper_deadline DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    UNIQUE (reminder_id, paper_deadline)
);

CREATE INDEX ix_user_notifications_user_created
    ON user_notifications (user_id, created_at DESC);

CREATE INDEX ix_user_notifications_user_unread
    ON user_notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

ALTER TABLE deadline_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY deadline_reminders_select_own
    ON deadline_reminders
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY deadline_reminders_insert_own
    ON deadline_reminders
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY deadline_reminders_update_own
    ON deadline_reminders
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY deadline_reminders_delete_own
    ON deadline_reminders
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY user_notifications_select_own
    ON user_notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY user_notifications_update_own
    ON user_notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE deadline_reminders, user_notifications
    FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE deadline_reminders TO authenticated;
GRANT INSERT (user_id, conference_id, days_before, enabled)
    ON TABLE deadline_reminders TO authenticated;
GRANT UPDATE (conference_id, days_before, enabled)
    ON TABLE deadline_reminders TO authenticated;
GRANT SELECT ON TABLE user_notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE user_notifications TO authenticated;

REVOKE ALL ON SEQUENCE deadline_reminders_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE user_notifications_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE deadline_reminders_id_seq TO authenticated;

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