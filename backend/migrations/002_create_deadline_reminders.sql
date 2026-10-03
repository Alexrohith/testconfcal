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
    CONSTRAINT uq_deadline_reminders_user_conference
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
    CONSTRAINT uq_user_notifications_reminder_deadline
        UNIQUE (reminder_id, paper_deadline)
);

CREATE INDEX ix_user_notifications_user_created
    ON user_notifications (user_id, created_at DESC);

CREATE INDEX ix_user_notifications_user_unread
    ON user_notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;
