import unittest
from uuid import uuid4

from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user_id
from app.models.conference import Conference
from app.routers.conferences import (
    get_recommended_conferences,
    router as conferences_router,
)


class RecommendedConferenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.connection = self.engine.connect()
        self.connection.execute(text("""
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL
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
            CREATE TABLE user_interests (
                user_id TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, category_id)
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
        self.no_interest_user_id = uuid4()
        self.connection.execute(
            text("INSERT INTO users (id, email) VALUES (:id, :email)"),
            [
                {"id": self.user_id.hex, "email": "one@example.test"},
                {"id": self.other_user_id.hex, "email": "two@example.test"},
                {"id": self.no_interest_user_id.hex, "email": "three@example.test"},
            ],
        )
        self.connection.execute(text("""
            INSERT INTO categories (id, name, display_name)
            VALUES
                (1, 'ai', 'Artificial Intelligence'),
                (2, 'ml', 'Machine Learning'),
                (3, 'nlp', 'Natural Language Processing'),
                (4, 'robotics', 'Robotics')
        """))
        self.connection.execute(text("""
            INSERT INTO conferences (
                id, source, event_id, title, start_date, end_date, paper_deadline,
                city, country, format, is_virtual, website
            )
            VALUES
                (1, 'IEEE', 101, 'Full match', '2030-01-01', '2030-01-02', NULL,
                 'City A', 'Country A', 'Hybrid', 0, 'https://a.test'),
                (2, 'IEEE', 102, 'Partial later deadline', '2030-02-01', '2030-02-02',
                 '2029-11-03', 'City B', 'Country B', 'Virtual', 1, 'https://b.test'),
                (3, 'IEEE', 103, 'Partial tied deadline first id', '2030-03-01', '2030-03-02',
                 '2029-11-02', 'City C', 'Country C', 'In-person', 0, 'https://c.test'),
                (4, 'IEEE', 104, 'Single match', '2030-04-01', '2030-04-02',
                 '2029-11-01', 'City D', 'Country D', 'Hybrid', 0, 'https://d.test'),
                (5, 'IEEE', 105, 'No match', '2030-05-01', '2030-05-02',
                 '2029-11-01', 'City E', 'Country E', 'Virtual', 1, 'https://e.test'),
                (6, 'IEEE', 106, 'Partial no deadline', '2030-06-01', '2030-06-02',
                 NULL, 'City F', 'Country F', 'Hybrid', 0, 'https://f.test'),
                (7, 'IEEE', 107, 'Partial tied deadline later id', '2030-07-01', '2030-07-02',
                 '2029-11-02', 'City G', 'Country G', 'Virtual', 1, 'https://g.test')
        """))
        self.connection.execute(
            text("""
                INSERT INTO user_interests (user_id, category_id)
                VALUES (:user_id, :category_id)
            """),
            [
                {"user_id": self.user_id.hex, "category_id": category_id}
                for category_id in (1, 2, 3)
            ] + [
                {"user_id": self.other_user_id.hex, "category_id": 4},
            ],
        )
        self.connection.execute(text("""
            INSERT INTO conference_categories (conference_id, category_id)
            VALUES
                (1, 1), (1, 2), (1, 3),
                (2, 1), (2, 2),
                (3, 1), (3, 2),
                (4, 1),
                (5, 4),
                (6, 1), (6, 2),
                (7, 1), (7, 2)
        """))
        self.connection.commit()
        self.db = Session(bind=self.connection)

    def tearDown(self):
        self.db.close()
        self.connection.close()
        self.engine.dispose()

    def test_multiple_interests_full_partial_and_zero_match(self):
        response = get_recommended_conferences(self.user_id, 1, 20, self.db)
        results = {conference["id"]: conference for conference in response["results"]}

        self.assertEqual(response["total"], 6)
        self.assertEqual(response["personalization_configured"], True)
        self.assertNotIn(5, results)
        self.assertEqual(results[1]["match_count"], 3)
        self.assertEqual(results[1]["match_percentage"], 100)
        self.assertEqual(
            [category["name"] for category in results[1]["matched_categories"]],
            ["ai", "ml", "nlp"],
        )
        self.assertEqual(results[2]["match_count"], 2)
        self.assertEqual(results[2]["match_percentage"], 67)
        self.assertEqual(results[4]["match_count"], 1)
        self.assertEqual(results[4]["match_percentage"], 33)

    def test_zero_interests_returns_unconfigured_empty_result(self):
        response = get_recommended_conferences(
            self.no_interest_user_id,
            1,
            20,
            self.db,
        )

        self.assertEqual(response, {
            "page": 1,
            "limit": 20,
            "total": 0,
            "personalization_configured": False,
            "results": [],
        })

    def test_ordering_is_deterministic_and_null_deadlines_are_last(self):
        response = get_recommended_conferences(self.user_id, 1, 20, self.db)

        self.assertEqual(
            [conference["id"] for conference in response["results"]],
            [1, 3, 7, 2, 6, 4],
        )
        tied_ids = [
            conference["id"]
            for conference in response["results"]
            if conference["match_count"] == 2
        ]
        self.assertEqual(tied_ids, [3, 7, 2, 6])

    def test_pagination_returns_total_and_separate_pages(self):
        first_page = get_recommended_conferences(self.user_id, 1, 3, self.db)
        second_page = get_recommended_conferences(self.user_id, 2, 3, self.db)

        self.assertEqual(first_page["total"], 6)
        self.assertEqual([item["id"] for item in first_page["results"]], [1, 3, 7])
        self.assertEqual(second_page["page"], 2)
        self.assertEqual([item["id"] for item in second_page["results"]], [2, 6, 4])

    def test_recommendation_response_has_no_user_identifiers(self):
        response = get_recommended_conferences(self.user_id, 1, 20, self.db)

        self.assertNotIn("user_id", response)
        self.assertNotIn("user_id", response["results"][0])

    def test_unauthenticated_request_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            get_current_user_id(None)
        self.assertEqual(raised.exception.status_code, 401)

    def test_caller_supplied_user_id_does_not_change_recommendations(self):
        route = next(
            route
            for route in conferences_router.routes
            if isinstance(route, APIRoute)
            and route.path == "/api/conferences/recommended"
        )
        query_parameter_names = {parameter.name for parameter in route.dependant.query_params}
        dependency_calls = {
            dependency.call for dependency in route.dependant.dependencies
        }

        self.assertNotIn("user_id", query_parameter_names)
        self.assertIn(get_current_user_id, dependency_calls)
        response = get_recommended_conferences(self.user_id, 1, 20, self.db)
        other_user_response = get_recommended_conferences(
            self.other_user_id,
            1,
            20,
            self.db,
        )
        self.assertEqual(response["total"], 6)
        self.assertEqual(response["results"][0]["match_count"], 3)
        self.assertEqual(other_user_response["total"], 1)
        self.assertEqual(other_user_response["results"][0]["matched_categories"][0]["name"], "robotics")


if __name__ == "__main__":
    unittest.main()
