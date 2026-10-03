from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Integer,
    String,
    Text,
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