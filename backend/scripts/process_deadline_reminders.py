from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.conference import Conference, DeadlineReminder, UserNotification


@dataclass
class ProcessingSummary:
    processing_date: date
    reminders_scanned: int = 0
    reminders_due: int = 0
    notifications_inserted: int = 0
    duplicates_skipped: int = 0
    skipped_missing_deadline: int = 0
    skipped_passed_deadline: int = 0
    errors: int = 0


def _eligible_conditions(processing_date: date, reminder_id: int):
    reminder_table = DeadlineReminder.__table__
    conference_table = Conference.__table__
    due_conditions = [
        and_(
            reminder_table.c.days_before == days_before,
            conference_table.c.paper_deadline
            <= processing_date + timedelta(days=days_before),
        )
        for days_before in (1, 3, 7)
    ]
    return (
        reminder_table.c.id == reminder_id,
        reminder_table.c.enabled.is_(True),
        conference_table.c.paper_deadline > processing_date,
        or_(*due_conditions),
    )


def process_deadline_reminders(
    db: Session,
    processing_date: date | None = None,
) -> ProcessingSummary:
    run_date = processing_date if processing_date is not None else date.today()
    summary = ProcessingSummary(processing_date=run_date)

    try:
        with db.begin():
            reminders = (
                db.query(DeadlineReminder.id, Conference.paper_deadline)
                .join(Conference, Conference.id == DeadlineReminder.conference_id)
                .filter(DeadlineReminder.enabled.is_(True))
                .order_by(DeadlineReminder.id.asc())
                .all()
            )
            summary.reminders_scanned = len(reminders)
            dialect = db.get_bind().dialect.name

            if dialect == "postgresql":
                insert_statement = postgresql_insert(UserNotification)
            elif dialect == "sqlite":
                insert_statement = sqlite_insert(UserNotification)
            else:
                raise RuntimeError(f"Unsupported database dialect for reminder processing: {dialect}")

            for reminder_id, paper_deadline in reminders:
                if paper_deadline is None:
                    summary.skipped_missing_deadline += 1
                    continue
                elif paper_deadline < run_date:
                    summary.skipped_passed_deadline += 1
                    continue

                current_reminder = DeadlineReminder.__table__
                current_conference = Conference.__table__
                current_state = (
                    db.query(current_reminder.c.id, current_conference.c.paper_deadline)
                    .select_from(
                        current_reminder.join(
                            current_conference,
                            current_conference.c.id == current_reminder.c.conference_id,
                        )
                    )
                    .filter(*_eligible_conditions(run_date, reminder_id))
                    .first()
                )
                if current_state is None:
                    continue

                summary.reminders_due += 1
                insert_values = select(
                    current_reminder.c.user_id,
                    current_reminder.c.id,
                    current_reminder.c.conference_id,
                    current_conference.c.paper_deadline,
                    func.current_timestamp(),
                ).select_from(
                    current_reminder.join(
                        current_conference,
                        current_conference.c.id == current_reminder.c.conference_id,
                    )
                ).where(
                    current_reminder.c.conference_id == current_conference.c.id,
                    *_eligible_conditions(run_date, reminder_id),
                )
                result = db.execute(
                    insert_statement
                    .from_select(
                        [
                            "user_id",
                            "reminder_id",
                            "conference_id",
                            "paper_deadline",
                            "created_at",
                        ],
                        insert_values,
                    )
                    .on_conflict_do_nothing(
                        index_elements=["reminder_id", "paper_deadline"],
                    )
                )
                if result.rowcount == 1:
                    summary.notifications_inserted += 1
                else:
                    summary.duplicates_skipped += 1
    except SQLAlchemyError:
        summary.errors += 1
        raise

    return summary


def _print_summary(summary: ProcessingSummary) -> None:
    print(
        "Deadline reminder processing: "
        f"processing_date={summary.processing_date.isoformat()} "
        f"reminders_scanned={summary.reminders_scanned} "
        f"reminders_due={summary.reminders_due} "
        f"notifications_inserted={summary.notifications_inserted} "
        f"duplicates_skipped={summary.duplicates_skipped} "
        f"skipped_missing_deadline={summary.skipped_missing_deadline} "
        f"skipped_passed_deadline={summary.skipped_passed_deadline} "
        f"errors={summary.errors}"
    )


def main() -> int:
    processing_date = date.today()
    try:
        with SessionLocal() as db:
            summary = process_deadline_reminders(db, processing_date)
    except SQLAlchemyError:
        _print_summary(ProcessingSummary(processing_date=processing_date, errors=1))
        return 1

    _print_summary(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
