from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.database import get_db
from app.models.conference import Conference, DeadlineReminder, UserNotification


router = APIRouter(prefix="/api", tags=["Reminders"])
ReminderDays = Literal[1, 3, 7]


class ReminderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conference_id: int = Field(gt=0)
    days_before: ReminderDays


class ReminderUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days_before: ReminderDays | None = None
    enabled: bool | None = None

    @model_validator(mode="after")
    def validate_patch_fields(self):
        if not self.model_fields_set or any(
            getattr(self, field) is None for field in self.model_fields_set
        ):
            raise ValueError("Provide days_before or enabled with a non-null value.")
        return self


def _reminder_response(reminder: DeadlineReminder, paper_deadline: date | None):
    return {
        "id": reminder.id,
        "conference_id": reminder.conference_id,
        "days_before": reminder.days_before,
        "enabled": reminder.enabled,
        "paper_deadline": paper_deadline,
        "created_at": reminder.created_at,
        "updated_at": reminder.updated_at,
    }


@router.post("/reminders")
def create_reminder(
    request: ReminderCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        conference = db.query(Conference).filter(Conference.id == request.conference_id).first()
        if conference is None:
            raise HTTPException(status_code=404, detail="Conference not found.")
        if conference.paper_deadline is None:
            raise HTTPException(status_code=422, detail="This conference has no paper deadline.")
        if conference.paper_deadline < date.today():
            raise HTTPException(status_code=409, detail="The paper deadline has already passed.")

        values = {
            "user_id": user_id,
            "conference_id": request.conference_id,
            "days_before": request.days_before,
            "enabled": True,
        }
        dialect = db.get_bind().dialect.name
        if dialect == "postgresql":
            statement = postgresql_insert(DeadlineReminder).values(**values)
        elif dialect == "sqlite":
            statement = sqlite_insert(DeadlineReminder).values(**values)
        else:
            statement = None

        if statement is not None:
            statement = statement.on_conflict_do_update(
                index_elements=["user_id", "conference_id"],
                set_={
                    "days_before": request.days_before,
                    "enabled": True,
                    "updated_at": func.current_timestamp(),
                },
            )
            db.execute(statement)
        else:
            reminder = (
                db.query(DeadlineReminder)
                .filter(
                    DeadlineReminder.user_id == user_id,
                    DeadlineReminder.conference_id == request.conference_id,
                )
                .first()
            )
            if reminder is None:
                db.add(DeadlineReminder(**values))
            else:
                reminder.days_before = request.days_before
                reminder.enabled = True

        db.commit()
        reminder = (
            db.query(DeadlineReminder)
            .filter(
                DeadlineReminder.user_id == user_id,
                DeadlineReminder.conference_id == request.conference_id,
            )
            .first()
        )
        if reminder is None:
            raise SQLAlchemyError("Reminder upsert did not persist.")
        return _reminder_response(reminder, conference.paper_deadline)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to save this reminder right now.",
        ) from exc


@router.get("/reminders")
def list_reminders(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        reminders = (
            db.query(DeadlineReminder, Conference.paper_deadline)
            .join(Conference, Conference.id == DeadlineReminder.conference_id)
            .filter(DeadlineReminder.user_id == user_id)
            .order_by(Conference.paper_deadline.asc().nullslast(), DeadlineReminder.id.asc())
            .all()
        )
        return {
            "reminders": [
                _reminder_response(reminder, paper_deadline)
                for reminder, paper_deadline in reminders
            ]
        }
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Reminders are temporarily unavailable.",
        ) from exc


@router.patch("/reminders/{reminder_id}")
def update_reminder(
    reminder_id: int,
    request: ReminderUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        reminder = (
            db.query(DeadlineReminder)
            .filter(
                DeadlineReminder.id == reminder_id,
                DeadlineReminder.user_id == user_id,
            )
            .first()
        )
        if reminder is None:
            raise HTTPException(status_code=404, detail="Reminder not found.")

        conference = db.query(Conference).filter(Conference.id == reminder.conference_id).first()
        if conference is None:
            raise HTTPException(status_code=404, detail="Conference not found.")
        if conference.paper_deadline is None:
            raise HTTPException(status_code=422, detail="This conference has no paper deadline.")

        enabled = reminder.enabled if request.enabled is None else request.enabled
        if enabled and conference.paper_deadline < date.today():
            raise HTTPException(status_code=409, detail="The paper deadline has already passed.")

        if request.days_before is not None:
            reminder.days_before = request.days_before
        if request.enabled is not None:
            reminder.enabled = request.enabled
        reminder.updated_at = func.current_timestamp()
        db.commit()
        db.refresh(reminder)
        return _reminder_response(reminder, conference.paper_deadline)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to update this reminder right now.",
        ) from exc


@router.delete("/reminders/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        reminder = (
            db.query(DeadlineReminder)
            .filter(
                DeadlineReminder.id == reminder_id,
                DeadlineReminder.user_id == user_id,
            )
            .first()
        )
        if reminder is not None:
            db.delete(reminder)
            db.commit()
        return {"id": reminder_id, "deleted": True}
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to delete this reminder right now.",
        ) from exc


@router.get("/notifications")
def list_notifications(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        notifications = (
            db.query(UserNotification, Conference.title)
            .join(Conference, Conference.id == UserNotification.conference_id)
            .filter(UserNotification.user_id == user_id)
            .order_by(UserNotification.created_at.desc(), UserNotification.id.desc())
            .all()
        )
        return {
            "notifications": [
                {
                    "id": notification.id,
                    "reminder_id": notification.reminder_id,
                    "conference_id": notification.conference_id,
                    "conference_title": title,
                    "paper_deadline": notification.paper_deadline,
                    "created_at": notification.created_at,
                    "read_at": notification.read_at,
                }
                for notification, title in notifications
            ]
        }
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Notifications are temporarily unavailable.",
        ) from exc


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        notification = (
            db.query(UserNotification)
            .filter(
                UserNotification.id == notification_id,
                UserNotification.user_id == user_id,
            )
            .first()
        )
        if notification is None:
            raise HTTPException(status_code=404, detail="Notification not found.")
        if notification.read_at is None:
            notification.read_at = func.current_timestamp()
            db.commit()
            db.refresh(notification)
        return {"id": notification.id, "read_at": notification.read_at}
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to update this notification right now.",
        ) from exc
