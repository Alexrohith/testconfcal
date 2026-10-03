import os
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

import requests
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.auth import _supabase_configuration, get_current_user_id
from app.models.conference import Conference
from app.routers.conferences import (
    get_conference_saved_status,
    get_saved_conferences,
    save_conference,
    unsave_conference,
)


class SavedConferenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        self.connection = self.engine.connect()
        self.connection.execute(text("""
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL
            )
        """))
        self.connection.execute(text("""
            CREATE TABLE saved_conferences (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
                saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, conference_id)
            )
        """))
        Conference.__table__.create(self.engine)
        self.connection.execute(text("""
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL
            )
        """))
        self.connection.execute(text("""
            CREATE TABLE conference_categories (
                conference_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                PRIMARY KEY (conference_id, category_id)
            )
        """))
        self.user_id = uuid4()
        self.other_user_id = uuid4()
        self.connection.execute(
            text("INSERT INTO users (id, email) VALUES (:id, :email)"),
            [
                {"id": str(self.user_id), "email": "user@example.com"},
                {"id": str(self.other_user_id), "email": "other@example.com"},
            ],
        )
        self.connection.execute(text("""
            INSERT INTO conferences (
                id, source, event_id, title, start_date, end_date,
                paper_deadline, city, country, format, is_virtual, website
            )
            VALUES
                (1, 'IEEE', 101, 'Earlier deadline', '2030-01-01', '2030-01-02',
                 '2029-11-01', 'City A', 'Country A', 'In-person', 0, 'https://a.test'),
                (2, 'IEEE', 102, 'No deadline', '2030-02-01', '2030-02-02',
                 NULL, 'City B', 'Country B', 'Virtual', 1, 'https://b.test')
        """))
        self.connection.commit()
        self.db = Session(bind=self.connection)

    def tearDown(self):
        self.db.close()
        self.connection.close()
        self.engine.dispose()

    def test_save_is_idempotent_and_status_is_user_scoped(self):
        first_save = save_conference(1, self.user_id, self.db)
        second_save = save_conference(1, self.user_id, self.db)

        self.assertEqual(first_save, {
            "conference_id": 1,
            "saved": True,
            "already_saved": False,
        })
        self.assertEqual(second_save, {
            "conference_id": 1,
            "saved": True,
            "already_saved": True,
        })
        self.assertEqual(
            get_conference_saved_status(1, self.user_id, self.db),
            {"conference_id": 1, "saved": True},
        )
        self.assertEqual(
            get_conference_saved_status(1, self.other_user_id, self.db),
            {"conference_id": 1, "saved": False},
        )

    def test_unsave_is_idempotent_and_cannot_remove_another_users_record(self):
        save_conference(1, self.user_id, self.db)

        first_unsave = unsave_conference(1, self.other_user_id, self.db)
        second_unsave = unsave_conference(1, self.user_id, self.db)
        third_unsave = unsave_conference(1, self.user_id, self.db)

        self.assertTrue(first_unsave["already_unsaved"])
        self.assertFalse(second_unsave["already_unsaved"])
        self.assertTrue(third_unsave["already_unsaved"])
        self.assertFalse(
            get_conference_saved_status(1, self.user_id, self.db)["saved"]
        )

    def test_saved_list_is_scoped_complete_and_deadline_sorted(self):
        save_conference(2, self.user_id, self.db)
        save_conference(1, self.user_id, self.db)
        save_conference(2, self.other_user_id, self.db)

        response = get_saved_conferences(self.user_id, self.db)
        conferences = response["conferences"]

        self.assertEqual([conference["id"] for conference in conferences], [1, 2])
        self.assertEqual(conferences[0]["title"], "Earlier deadline")
        self.assertEqual(conferences[0]["city"], "City A")
        self.assertEqual(conferences[1]["deadline_status"], "no_deadline")
        self.assertEqual(
            get_saved_conferences(self.other_user_id, self.db)["conferences"][0]["id"],
            2,
        )

    def test_nonexistent_conference_returns_not_found(self):
        with self.assertRaises(HTTPException) as raised:
            save_conference(999, self.user_id, self.db)

        self.assertEqual(raised.exception.status_code, 404)

    def test_missing_bearer_token_is_unauthenticated(self):
        with self.assertRaises(HTTPException) as raised:
            get_current_user_id(None)

        self.assertEqual(raised.exception.status_code, 401)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "https://preferred.example",
        "SUPABASE_ANON_KEY": "preferred-anon-key",
        "NEXT_PUBLIC_SUPABASE_URL": "https://fallback.example",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "fallback-anon-key",
    })
    @patch("app.auth.load_dotenv")
    def test_supabase_configuration_prefers_backend_names(self, _load_dotenv):
        self.assertEqual(
            _supabase_configuration(),
            ("https://preferred.example", "preferred-anon-key"),
        )

    @patch.dict(os.environ, {
        "SUPABASE_URL": "",
        "SUPABASE_ANON_KEY": "",
        "NEXT_PUBLIC_SUPABASE_URL": "",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "",
    })
    @patch("app.auth.load_dotenv")
    def test_supabase_configuration_loads_frontend_names_as_local_fallback(
        self,
        load_dotenv,
    ):
        def load_local_values(path):
            if path.name == ".env.local":
                os.environ["NEXT_PUBLIC_SUPABASE_URL"] = "https://local.example"
                os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "local-anon-key"

        load_dotenv.side_effect = load_local_values

        self.assertEqual(
            _supabase_configuration(),
            ("https://local.example", "local-anon-key"),
        )

    @patch.dict(os.environ, {
        "SUPABASE_URL": "https://supabase.example",
        "SUPABASE_ANON_KEY": "public-anon-key-for-test",
    })
    @patch("app.auth.requests.get")
    def test_authenticated_user_id_comes_from_supabase(self, get):
        user_id = uuid4()
        get.return_value.status_code = 200
        get.return_value.json.return_value = {"id": str(user_id)}

        result = get_current_user_id("Bearer access-token")

        self.assertEqual(result, user_id)
        get.assert_called_once_with(
            "https://supabase.example/auth/v1/user",
            headers={
                "apikey": "public-anon-key-for-test",
                "Authorization": "Bearer access-token",
            },
            timeout=5,
        )

    @patch.dict(os.environ, {
        "SUPABASE_URL": "https://supabase.example",
        "SUPABASE_ANON_KEY": "public-anon-key-for-test",
    })
    @patch("app.auth.requests.get")
    def test_expired_supabase_session_returns_unauthorized(self, get):
        get.return_value.status_code = 401

        with self.assertRaises(HTTPException) as raised:
            get_current_user_id("Bearer expired-token")

        self.assertEqual(raised.exception.status_code, 401)

    @patch.dict(os.environ, {
        "SUPABASE_URL": "https://supabase.example",
        "SUPABASE_ANON_KEY": "public-anon-key-for-test",
    })
    @patch("app.auth.requests.get", side_effect=requests.RequestException)
    def test_supabase_outage_returns_service_unavailable(self, _get):
        with self.assertRaises(HTTPException) as raised:
            get_current_user_id("Bearer access-token")

        self.assertEqual(raised.exception.status_code, 503)

    def test_database_error_returns_service_unavailable(self):
        failing_db = Mock()
        failing_db.query.side_effect = OperationalError(
            "SELECT",
            {},
            Exception("database failure"),
        )

        with self.assertRaises(HTTPException) as raised:
            save_conference(1, self.user_id, failing_db)

        self.assertEqual(raised.exception.status_code, 503)
        failing_db.rollback.assert_called_once()


if __name__ == "__main__":
    unittest.main()
