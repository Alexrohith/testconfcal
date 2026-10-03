import unittest
from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy import Column, Table, Text, Uuid, create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.conference import Conference, DeadlineReminder, UserNotification
from scripts.process_deadline_reminders import process_deadline_reminders


class DeadlineReminderWorkerTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.connection = self.engine.connect()
        users_table = Table(
            "users",
            Base.metadata,
            Column("id", Uuid(as_uuid=True), primary_key=True),
            Column("email", Text, nullable=False),
            extend_existing=True,
        )
        users_table.create(self.engine)
        Conference.__table__.create(self.engine)
        DeadlineReminder.__table__.create(self.engine)
        UserNotification.__table__.create(self.engine)
        self.db = Session(bind=self.connection)

        self.processing_date = date(2030, 1, 10)
        self.user_id = uuid4()
        self.other_user_id = uuid4()
        self.db.execute(
            text("INSERT INTO users (id, email) VALUES (:id, :email)"),
            [
                {"id": self.user_id.hex, "email": "user@example.test"},
                {"id": self.other_user_id.hex, "email": "other@example.test"},
            ],
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.connection.close()
        self.engine.dispose()

    def add_conference(self, conference_id: int, paper_deadline: date | None, title: str | None = None):
        self.db.add(Conference(
            id=conference_id,
            source="IEEE",
            event_id=conference_id + 100,
            title=title or f"Conference {conference_id}",
            start_date=self.processing_date + timedelta(days=40),
            end_date=self.processing_date + timedelta(days=41),
            paper_deadline=paper_deadline,
        ))
        self.db.commit()

    def add_reminder(
        self,
        conference_id: int,
        user_id=None,
        days_before: int = 7,
        enabled: bool = True,
    ) -> DeadlineReminder:
        reminder = DeadlineReminder(
            user_id=user_id or self.user_id,
            conference_id=conference_id,
            days_before=days_before,
            enabled=enabled,
        )
        self.db.add(reminder)
        self.db.commit()
        self.db.refresh(reminder)
        self.db.commit()
        return reminder

    def run_worker(self):
        self.db.commit()
        return process_deadline_reminders(self.db, self.processing_date)

    def test_due_exactly_n_days_before_deadline(self):
        for conference_id, days_before in enumerate((1, 3, 7), start=1):
            deadline = self.processing_date + timedelta(days=days_before)
            self.add_conference(conference_id, deadline)
            self.add_reminder(conference_id, days_before=days_before)

        summary = self.run_worker()

        self.assertEqual(summary.reminders_due, 3)
        self.assertEqual(summary.notifications_inserted, 3)
        self.assertEqual(
            {
                notification.paper_deadline
                for notification in self.db.query(UserNotification).all()
            },
            {
                self.processing_date + timedelta(days=days_before)
                for days_before in (1, 3, 7)
            },
        )

    def test_not_due_one_day_early(self):
        self.add_conference(1, self.processing_date + timedelta(days=8))
        self.add_reminder(1, days_before=7)

        summary = self.run_worker()

        self.assertEqual(summary.reminders_due, 0)
        self.assertEqual(summary.notifications_inserted, 0)

    def test_one_day_late_is_caught_up(self):
        self.add_conference(1, self.processing_date + timedelta(days=6))
        self.add_reminder(1, days_before=7)

        summary = self.run_worker()

        self.assertEqual(summary.reminders_due, 1)
        self.assertEqual(summary.notifications_inserted, 1)

    def test_several_days_late_is_caught_up_while_deadline_is_future(self):
        self.add_conference(1, self.processing_date + timedelta(days=4))
        self.add_reminder(1, days_before=7)

        summary = self.run_worker()

        self.assertEqual(summary.reminders_due, 1)
        self.assertEqual(summary.notifications_inserted, 1)

    def test_paper_deadline_date_does_not_generate_late_reminder(self):
        self.add_conference(1, self.processing_date)
        self.add_reminder(1, days_before=1)

        summary = self.run_worker()

        self.assertEqual(summary.reminders_due, 0)
        self.assertEqual(summary.notifications_inserted, 0)

    def test_missing_deadline_is_skipped(self):
        self.add_conference(1, None)
        self.add_reminder(1)

        summary = self.run_worker()

        self.assertEqual(summary.skipped_missing_deadline, 1)
        self.assertEqual(summary.notifications_inserted, 0)

    def test_passed_deadline_is_skipped(self):
        self.add_conference(1, self.processing_date - timedelta(days=1))
        self.add_reminder(1)

        summary = self.run_worker()

        self.assertEqual(summary.skipped_passed_deadline, 1)
        self.assertEqual(summary.notifications_inserted, 0)

    def test_duplicate_processing_creates_only_one_notification(self):
        deadline = self.processing_date + timedelta(days=3)
        self.add_conference(1, deadline)
        self.add_reminder(1, days_before=3)

        first = self.run_worker()
        second = self.run_worker()

        self.assertEqual(first.notifications_inserted, 1)
        self.assertEqual(second.duplicates_skipped, 1)
        self.assertEqual(self.db.query(UserNotification).count(), 1)

    def test_changed_deadline_can_create_new_notification_without_deleting_history(self):
        original_deadline = self.processing_date + timedelta(days=1)
        self.add_conference(1, original_deadline)
        reminder = self.add_reminder(1, days_before=1)

        self.run_worker()
        conference = self.db.query(Conference).filter_by(id=1).one()
        changed_deadline = original_deadline + timedelta(days=10)
        conference.paper_deadline = changed_deadline
        self.db.commit()

        changed_run_date = changed_deadline - timedelta(days=1)
        summary = process_deadline_reminders(self.db, changed_run_date)

        notifications = (
            self.db.query(UserNotification)
            .filter_by(reminder_id=reminder.id)
            .order_by(UserNotification.paper_deadline)
            .all()
        )
        self.assertEqual(summary.notifications_inserted, 1)
        self.assertEqual(
            [notification.paper_deadline for notification in notifications],
            [original_deadline, changed_deadline],
        )

    def test_disabled_reminder_is_not_scanned_or_processed(self):
        self.add_conference(1, self.processing_date + timedelta(days=7))
        self.add_reminder(1, enabled=False)

        summary = self.run_worker()

        self.assertEqual(summary.reminders_scanned, 0)
        self.assertEqual(summary.notifications_inserted, 0)

    def test_multiple_users_are_isolated(self):
        deadline = self.processing_date + timedelta(days=7)
        self.add_conference(1, deadline)
        first_reminder = self.add_reminder(1, user_id=self.user_id)
        second_reminder = self.add_reminder(1, user_id=self.other_user_id)

        summary = self.run_worker()

        notifications = self.db.query(UserNotification).order_by(UserNotification.user_id).all()
        self.assertEqual(summary.notifications_inserted, 2)
        self.assertEqual(
            {notification.user_id for notification in notifications},
            {self.user_id, self.other_user_id},
        )
        self.assertEqual(
            {notification.reminder_id for notification in notifications},
            {first_reminder.id, second_reminder.id},
        )

    def test_processing_date_is_injected_and_deterministic(self):
        deadline = date(2032, 4, 20)
        self.add_conference(1, deadline)
        self.add_reminder(1, days_before=7)
        run_date = deadline - timedelta(days=7)

        summary = process_deadline_reminders(self.db, run_date)

        self.assertEqual(summary.processing_date, run_date)
        self.assertEqual(summary.notifications_inserted, 1)

    def test_current_days_before_configuration_controls_eligibility(self):
        deadline = self.processing_date + timedelta(days=5)
        self.add_conference(1, deadline)
        reminder = self.add_reminder(1, days_before=1)
        reminder.days_before = 7
        self.db.commit()

        summary = self.run_worker()

        self.assertEqual(summary.notifications_inserted, 1)
        notification = self.db.query(UserNotification).one()
        self.assertEqual(notification.reminder_id, reminder.id)

    def test_updated_days_before_can_make_a_previously_later_date_ineligible(self):
        deadline = self.processing_date + timedelta(days=5)
        self.add_conference(1, deadline)
        reminder = self.add_reminder(1, days_before=7)
        reminder.days_before = 1
        self.db.commit()

        summary = self.run_worker()

        self.assertEqual(summary.reminders_due, 0)
        self.assertEqual(summary.notifications_inserted, 0)
