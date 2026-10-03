from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    BigInteger,
    CheckConstraint,
    UniqueConstraint,
    Index,
    Uuid,
    text,
)

from app.database import Base


class Conference(Base):
    __tablename__ = "conferences"

    id = Column(Integer, primary_key=True)

    source = Column(String(50), nullable=False)
    event_id = Column(Integer, nullable=False)

    title = Column(Text, nullable=False)

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    paper_deadline = Column(Date)

    city = Column(String(255))
    region = Column(String(255))
    country = Column(String(255))
    venue = Column(Text)

    scope = Column(Text)
    about = Column(Text)

    format = Column(String(50))
    is_virtual = Column(Boolean, default=False)

    website = Column(Text)
    event_contact = Column(String(255))

    ieee_region = Column(String(255))
    ieee_detail_url = Column(Text)

    last_verified = Column(Date)


class DeadlineReminder(Base):
    __tablename__ = "deadline_reminders"
    __table_args__ = (
        CheckConstraint("days_before IN (1, 3, 7)", name="ck_deadline_reminders_days_before"),
        UniqueConstraint("user_id", "conference_id", name="uq_deadline_reminders_user_conference"),
        Index("ix_deadline_reminders_user_enabled", "user_id", "enabled"),
        Index("ix_deadline_reminders_enabled_conference", "enabled", "conference_id"),
    )

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    conference_id = Column(Integer, ForeignKey("conferences.id", ondelete="CASCADE"), nullable=False)
    days_before = Column(Integer, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))


class UserNotification(Base):
    __tablename__ = "user_notifications"
    __table_args__ = (
        UniqueConstraint("reminder_id", "paper_deadline", name="uq_user_notifications_reminder_deadline"),
        Index(
            "ix_user_notifications_user_created",
            "user_id",
            text("created_at DESC"),
        ),
        Index(
            "ix_user_notifications_user_unread",
            "user_id",
            text("created_at DESC"),
            postgresql_where=text("read_at IS NULL"),
        ),
    )

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reminder_id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        ForeignKey("deadline_reminders.id", ondelete="CASCADE"),
        nullable=False,
    )
    conference_id = Column(Integer, ForeignKey("conferences.id", ondelete="CASCADE"), nullable=False)
    paper_deadline = Column(Date, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    read_at = Column(DateTime)