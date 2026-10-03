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
