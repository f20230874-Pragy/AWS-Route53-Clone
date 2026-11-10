"""SQLAlchemy ORM models (see README for the schema diagram)."""
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """Mocked IAM user."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[str] = mapped_column(String(12), default="123456789012")
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuthSession(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship()


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # e.g. Z0123456789ABCDEFGHIJ
    name: Mapped[str] = mapped_column(String(255), index=True)  # FQDN with trailing dot
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    comment: Mapped[str] = mapped_column(String(256), default="")
    created_by: Mapped[str] = mapped_column(String(32), default="Route 53")
    caller_reference: Mapped[str] = mapped_column(String(64))
    vpc_region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    vpc_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    tags: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    records: Mapped[list["DnsRecord"]] = relationship(
        back_populates="zone", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (UniqueConstraint("name", "is_private", "vpc_id", name="uq_zone_name_scope"),)


class DnsRecord(Base):
    __tablename__ = "dns_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))  # FQDN, lowercase, trailing dot
    type: Mapped[str] = mapped_column(String(8))
    ttl: Mapped[int | None] = mapped_column(Integer, nullable=True)  # null for alias records
    values: Mapped[list] = mapped_column(JSON, default=list)  # list[str]
    # Alias
    is_alias: Mapped[bool] = mapped_column(Boolean, default=False)
    alias_target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    evaluate_target_health: Mapped[bool] = mapped_column(Boolean, default=False)
    # Routing
    routing_policy: Mapped[str] = mapped_column(String(16), default="Simple")
    set_identifier: Mapped[str | None] = mapped_column(String(128), nullable=True)
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    failover_role: Mapped[str | None] = mapped_column(String(16), nullable=True)
    location: Mapped[str | None] = mapped_column(String(64), nullable=True)
    health_check_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    zone: Mapped[HostedZone] = relationship(back_populates="records")

    __table_args__ = (
        Index("ix_records_zone_name_type", "zone_id", "name", "type"),
        UniqueConstraint("zone_id", "name", "type", "set_identifier", name="uq_record_identity"),
    )
