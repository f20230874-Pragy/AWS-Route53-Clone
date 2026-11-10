"""Pydantic request / response models."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .validation import ROUTING_POLICIES


class LoginIn(BaseModel):
    account_id: str = Field(default="123456789012")
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    username: str
    account_id: str


# ---- Hosted zones ----
class ZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=253)
    comment: str = Field(default="", max_length=256)
    type: Literal["public", "private"] = "public"
    vpc_region: str | None = None
    vpc_id: str | None = None
    tags: dict[str, str] = Field(default_factory=dict)


class ZoneUpdate(BaseModel):
    comment: str | None = Field(default=None, max_length=256)
    tags: dict[str, str] | None = None


class ZoneOut(BaseModel):
    id: str
    name: str
    type: Literal["public", "private"]
    comment: str
    created_by: str
    record_count: int
    vpc_region: str | None = None
    vpc_id: str | None = None
    tags: dict[str, str] = {}
    created_at: datetime


class Page(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ---- Records ----
class RecordIn(BaseModel):
    name: str = ""  # prefix or full name
    type: str
    ttl: int | None = Field(default=300, ge=0, le=2147483647)
    values: list[str] = Field(default_factory=list)
    is_alias: bool = False
    alias_target: str | None = None
    evaluate_target_health: bool = False
    routing_policy: str = "Simple"
    set_identifier: str | None = Field(default=None, max_length=128)
    weight: int | None = Field(default=None, ge=0, le=255)
    region: str | None = None
    failover_role: Literal["PRIMARY", "SECONDARY"] | None = None
    location: str | None = None
    health_check_id: str | None = None


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    zone_id: str
    name: str
    type: str
    ttl: int | None
    values: list[str]
    is_alias: bool
    alias_target: str | None
    evaluate_target_health: bool
    routing_policy: str
    set_identifier: str | None
    weight: int | None
    region: str | None
    failover_role: str | None
    location: str | None
    health_check_id: str | None
    created_at: datetime
    updated_at: datetime


class BulkDelete(BaseModel):
    ids: list[int] = Field(min_length=1)


class ImportIn(BaseModel):
    content: str
    overwrite: bool = False


class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: list[str]
    errors: list[str]


assert "Simple" in ROUTING_POLICIES
