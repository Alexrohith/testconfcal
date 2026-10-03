import unittest
from datetime import date, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlalchemy import Column, Table, Text, Uuid, create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user_id
from app.database import Base
from app.models.conference import Conference, DeadlineReminder, UserNotification
from app.routers.reminders import (
    ReminderCreate,
    ReminderUpdate,
    create_reminder,
    delete_reminder,
    list_notifications,
    list_reminders,
    mark_notification_read,
    router as reminders_router,
    update_reminder,
)


class DeadlineReminderTests(unittest.TestCase):
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

        self.user_id = uuid4()
        self.other_user_id = uuid4()
        self.connection.execute(
            text("INSERT INTO users (id, email) VALUES (:id, :email)"),
            [
                {"id": self.user_id.hex, "email": "user@example.test"},
                {"id": self.other_user_id.hex, "email": "other@example.test"},
            ],
        )
        today = date.today()
        self.connection.execute(
            text("""
                INSERT INTO conferences (
                    id, source, event_id, title, start_date, end_date, paper_deadline
                )
                VALUES
                    (1, 'IEEE', 101, 'Future deadline', :start_date, :end_date, :future),
                    (2, 'IEEE', 102, 'No deadline', :start_date, :end_date, NULL),
                    (3, 'IEEE', 103, 'Passed deadline', :start_date, :end_date, :passed)
            """),
            {
                "start_date": (today + timedelta(days=60)).isoformat(),
                "end_date": (today + timedelta(days=61)).isoformat(),
                "future": (today + timedelta(days=30)).isoformat(),
                "passed": (today - timedelta(days=1)).isoformat(),
            },
        )
        self.connection.commit()
        self.db = Session(bind=self.connection)

    def tearDown(self):
        self.db.close()
        self.connection.close()
        self.engine.dispose()

    def test_unauthenticated_create_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            get_current_user_id(None)
        self.assertEqual(raised.exception.status_code, 401)

        route = next(
            route for route in reminders_router.routes
            if isinstance(route, APIRoute) and route.path == "/api/reminders"
        )
        self.assertIn(
            get_current_user_id,
            {dependency.call for dependency in route.dependant.dependencies},
        )

    def test_create_accepts_supported_lead_times(self):
        for days_before in (7, 3, 1):
            response = create_reminder(
                ReminderCreate(conference_id=1, days_before=days_before),
                self.user_id,
                self.db,
            )
            self.assertEqual(response["days_before"], days_before)
            self.assertTrue(response["enabled"])
            self.assertEqual(response["paper_deadline"], date.today() + timedelta(days=30))

    def test_create_rejects_invalid_lead_time(self):
        for days_before in (0, 2, 14):
            with self.assertRaises(ValueError):
                ReminderCreate(conference_id=1, days_before=days_before)

    def test_create_rejects_missing_and_passed_deadlines(self):
        with self.assertRaises(HTTPException) as missing:
            create_reminder(ReminderCreate(conference_id=2, days_before=7), self.user_id, self.db)
        self.assertEqual(missing.exception.status_code, 422)

        with self.assertRaises(HTTPException) as passed:
            create_reminder(ReminderCreate(conference_id=3, days_before=7), self.user_id, self.db)
        self.assertEqual(passed.exception.status_code, 409)

    def test_create_rejects_unknown_conference(self):
        with self.assertRaises(HTTPException) as raised:
            create_reminder(ReminderCreate(conference_id=999, days_before=7), self.user_id, self.db)
        self.assertEqual(raised.exception.status_code, 404)

    def test_repeated_create_updates_same_user_reminder_idempotently(self):
        first = create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)
        second = create_reminder(ReminderCreate(conference_id=1, days_before=3), self.user_id, self.db)

        self.assertEqual(first["id"], second["id"])
        self.assertEqual(second["days_before"], 3)
        self.assertEqual(
            self.db.query(DeadlineReminder)
            .filter(DeadlineReminder.user_id == self.user_id)
            .count(),
            1,
        )

    def test_list_is_scoped_and_deadline_ordered(self):
        later_conference = Conference(
            id=4,
            source="IEEE",
            event_id=104,
            title="Later deadline",
            start_date=date.today() + timedelta(days=70),
            end_date=date.today() + timedelta(days=71),
            paper_deadline=date.today() + timedelta(days=45),
        )
        self.db.add(later_conference)
        self.db.commit()
        create_reminder(ReminderCreate(conference_id=4, days_before=1), self.user_id, self.db)
        create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)
        create_reminder(ReminderCreate(conference_id=1, days_before=3), self.other_user_id, self.db)

        reminders = list_reminders(self.user_id, self.db)["reminders"]
        self.assertEqual([item["conference_id"] for item in reminders], [1, 4])

    def test_cross_user_reminder_access_is_not_found(self):
        reminder = create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)

        with self.assertRaises(HTTPException) as raised:
            update_reminder(reminder["id"], ReminderUpdate(enabled=False), self.other_user_id, self.db)
        self.assertEqual(raised.exception.status_code, 404)

        self.assertEqual(
            delete_reminder(reminder["id"], self.other_user_id, self.db),
            {"id": reminder["id"], "deleted": True},
        )
        self.assertEqual(list_reminders(self.user_id, self.db)["reminders"][0]["id"], reminder["id"])

    def test_update_days_and_disable(self):
        reminder = create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)
        updated = update_reminder(
            reminder["id"],
            ReminderUpdate(days_before=3),
            self.user_id,
            self.db,
        )
        self.assertEqual(updated["days_before"], 3)

        disabled = update_reminder(
            reminder["id"],
            ReminderUpdate(enabled=False),
            self.user_id,
            self.db,
        )
        self.assertFalse(disabled["enabled"])

    def test_update_validates_current_paper_deadline(self):
        reminder = create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)
        conference = self.db.query(Conference).filter_by(id=1).one()
        conference.paper_deadline = date.today() - timedelta(days=1)
        self.db.commit()

        with self.assertRaises(HTTPException) as past:
            update_reminder(reminder["id"], ReminderUpdate(enabled=True), self.user_id, self.db)
        self.assertEqual(past.exception.status_code, 409)

        conference.paper_deadline = None
        self.db.commit()
        with self.assertRaises(HTTPException) as missing:
            update_reminder(reminder["id"], ReminderUpdate(enabled=False), self.user_id, self.db)
        self.assertEqual(missing.exception.status_code, 422)

    def test_patch_rejects_user_or_conference_id_changes(self):
        for payload in (
            {"enabled": False, "user_id": str(self.other_user_id)},
            {"days_before": 3, "conference_id": 4},
        ):
            with self.assertRaises(ValueError):
                ReminderUpdate.model_validate(payload)

    def test_delete_is_idempotent(self):
        reminder = create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)

        self.assertEqual(delete_reminder(reminder["id"], self.user_id, self.db), {
            "id": reminder["id"],
            "deleted": True,
        })
        self.assertEqual(delete_reminder(reminder["id"], self.user_id, self.db), {
            "id": reminder["id"],
            "deleted": True,
        })

    def _insert_notification(self, user_id, reminder_id, paper_deadline):
        notification = UserNotification(
            user_id=user_id,
            reminder_id=reminder_id,
            conference_id=1,
            paper_deadline=paper_deadline,
            created_at=datetime.now(),
        )
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def test_notification_list_is_scoped_and_includes_conference_title(self):
        reminder = create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)
        other_reminder = create_reminder(ReminderCreate(conference_id=1, days_before=3), self.other_user_id, self.db)
        self._insert_notification(self.user_id, reminder["id"], date.today() + timedelta(days=30))
        self._insert_notification(self.other_user_id, other_reminder["id"], date.today() + timedelta(days=30))

        notifications = list_notifications(self.user_id, self.db)["notifications"]
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0]["conference_title"], "Future deadline")
        self.assertEqual(notifications[0]["reminder_id"], reminder["id"])

    def test_mark_notification_read_is_user_scoped(self):
        reminder = create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)
        notification = self._insert_notification(
            self.user_id,
            reminder["id"],
            date.today() + timedelta(days=30),
        )

        response = mark_notification_read(notification.id, self.user_id, self.db)
        self.assertIsNotNone(response["read_at"])
        self.assertIsNotNone(
            self.db.query(UserNotification).filter_by(id=notification.id).one().read_at,
        )

    def test_cross_user_notification_read_is_not_found(self):
        reminder = create_reminder(ReminderCreate(conference_id=1, days_before=7), self.user_id, self.db)
        notification = self._insert_notification(
            self.user_id,
            reminder["id"],
            date.today() + timedelta(days=30),
        )

        with self.assertRaises(HTTPException) as raised:
            mark_notification_read(notification.id, self.other_user_id, self.db)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertIsNone(
            self.db.query(UserNotification).filter_by(id=notification.id).one().read_at,
        )


if __name__ == "__main__":
    unittest.main()
