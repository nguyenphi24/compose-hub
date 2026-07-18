from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    environment: Mapped[str] = mapped_column(String(50), default="production")
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    services: Mapped[list["Service"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(100))
    image: Mapped[str] = mapped_column(String(255))
    container_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    host_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    restart_policy: Mapped[str] = mapped_column(String(50), default="unless-stopped")
    environment_json: Mapped[str] = mapped_column(Text, default="{}")
    volumes_json: Mapped[str] = mapped_column(Text, default="[]")

    application: Mapped[Application] = relationship(back_populates="services")
