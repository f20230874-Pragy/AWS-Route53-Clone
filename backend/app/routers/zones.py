import json
import random
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..bind import to_bind
from ..database import get_db
from ..models import DnsRecord, HostedZone, User
from ..schemas import Page, ZoneCreate, ZoneOut, ZoneUpdate
from ..security import current_user
from ..validation import ValidationFailure, validate_domain

router = APIRouter(prefix="/api/hosted-zones", tags=["hosted zones"], dependencies=[Depends(current_user)])

SORTABLE = {"name": HostedZone.name, "type": HostedZone.is_private, "comment": HostedZone.comment, "id": HostedZone.id,
            "created_at": HostedZone.created_at}


def new_zone_id() -> str:
    return "Z" + "".join(random.choices(string.ascii_uppercase + string.digits, k=19))


def _name_servers() -> list[str]:
    r = random.randint
    return [
        f"ns-{r(1000, 1999)}.awsdns-{r(10, 59)}.org.",
        f"ns-{r(100, 999)}.awsdns-{r(10, 59)}.co.uk.",
        f"ns-{r(100, 999)}.awsdns-{r(10, 59)}.com.",
        f"ns-{r(100, 999)}.awsdns-{r(10, 59)}.net.",
    ]


def zone_to_out(zone: HostedZone, count: int) -> ZoneOut:
    return ZoneOut(
        id=zone.id, name=zone.name, type="private" if zone.is_private else "public", comment=zone.comment,
        created_by=zone.created_by, record_count=count, vpc_region=zone.vpc_region, vpc_id=zone.vpc_id,
        tags=zone.tags or {}, created_at=zone.created_at,
    )


def get_zone_or_404(db: Session, zone_id: str) -> HostedZone:
    z = db.get(HostedZone, zone_id)
    if not z:
        raise HTTPException(404, f"No hosted zone found with ID: {zone_id}")
    return z


def record_count(db: Session, zone_id: str) -> int:
    return db.scalar(select(func.count(DnsRecord.id)).where(DnsRecord.zone_id == zone_id)) or 0


def create_default_records(db: Session, zone: HostedZone) -> None:
    ns = _name_servers()
    db.add(DnsRecord(zone_id=zone.id, name=zone.name, type="NS", ttl=172800, values=ns))
    db.add(DnsRecord(
        zone_id=zone.id, name=zone.name, type="SOA", ttl=900,
        values=[f"{ns[0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"],
    ))


@router.get("", response_model=Page)
def list_zones(
    search: str = "",
    type: str = Query("", pattern="^(|public|private)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort: str = "name",
    order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    counts = (
        select(DnsRecord.zone_id, func.count(DnsRecord.id).label("c")).group_by(DnsRecord.zone_id).subquery()
    )
    q = select(HostedZone, func.coalesce(counts.c.c, 0)).outerjoin(counts, counts.c.zone_id == HostedZone.id)
    if search.strip():
        like = f"%{search.strip().lower()}%"
        q = q.where(or_(
            func.lower(HostedZone.name).like(like), func.lower(HostedZone.comment).like(like),
            func.lower(HostedZone.id).like(like),
            func.lower(func.iif(HostedZone.is_private, "private", "public")).like(like),
        ))
    if type:
        q = q.where(HostedZone.is_private == (type == "private"))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    col = SORTABLE.get(sort, HostedZone.name)
    q = q.order_by(col.desc() if order == "desc" else col.asc(), HostedZone.id).offset((page - 1) * page_size).limit(page_size)
    items = [zone_to_out(z, c) for z, c in db.execute(q).all()]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=ZoneOut, status_code=201)
def create_zone(body: ZoneCreate, db: Session = Depends(get_db)):
    try:
        name = validate_domain(body.name)
    except ValidationFailure as e:
        raise HTTPException(422, str(e)) from None
    private = body.type == "private"
    if private and not (body.vpc_region and body.vpc_id):
        raise HTTPException(422, "A VPC region and VPC ID are required for a private hosted zone")
    dupe = db.scalar(select(HostedZone).where(
        HostedZone.name == name, HostedZone.is_private == private, HostedZone.vpc_id == (body.vpc_id if private else None)))
    if dupe:
        raise HTTPException(409, f"A hosted zone with the name {name} already exists (HostedZoneAlreadyExists)")
    zone = HostedZone(
        id=new_zone_id(), name=name, is_private=private, comment=body.comment.strip(), caller_reference=str(uuid.uuid4()),
        vpc_region=body.vpc_region if private else None, vpc_id=body.vpc_id if private else None, tags=body.tags,
    )
    db.add(zone)
    db.flush()
    create_default_records(db, zone)
    db.commit()
    return zone_to_out(zone, 2)


@router.get("/{zone_id}", response_model=ZoneOut)
def get_zone(zone_id: str, db: Session = Depends(get_db)):
    z = get_zone_or_404(db, zone_id)
    return zone_to_out(z, record_count(db, zone_id))


@router.put("/{zone_id}", response_model=ZoneOut)
def update_zone(zone_id: str, body: ZoneUpdate, db: Session = Depends(get_db)):
    """Route 53 only allows the comment (and tags) of a hosted zone to be changed."""
    z = get_zone_or_404(db, zone_id)
    if body.comment is not None:
        z.comment = body.comment.strip()
    if body.tags is not None:
        z.tags = body.tags
    db.commit()
    return zone_to_out(z, record_count(db, zone_id))


@router.delete("/{zone_id}", status_code=204)
def delete_zone(zone_id: str, db: Session = Depends(get_db)):
    z = get_zone_or_404(db, zone_id)
    extra = db.scalar(select(func.count(DnsRecord.id)).where(
        DnsRecord.zone_id == zone_id, DnsRecord.type.notin_(["NS", "SOA"])
    )) or 0
    if extra:
        raise HTTPException(409, "The specified hosted zone contains non-required resource record sets and so cannot be deleted (HostedZoneNotEmpty)")
    db.delete(z)
    db.commit()


@router.get("/{zone_id}/export")
def export_zone(zone_id: str, format: str = Query("json", pattern="^(json|bind)$"), db: Session = Depends(get_db)):
    z = get_zone_or_404(db, zone_id)
    recs = db.scalars(select(DnsRecord).where(DnsRecord.zone_id == zone_id).order_by(DnsRecord.name, DnsRecord.type)).all()
    fname = z.name.rstrip(".")
    if format == "bind":
        return PlainTextResponse(to_bind(z.name, recs), headers={"Content-Disposition": f'attachment; filename="{fname}.zone"'})
    data = {
        "zone": json.loads(zone_to_out(z, len(recs)).model_dump_json()),
        "records": [
            {"name": r.name, "type": r.type, "ttl": r.ttl, "values": r.values, "alias": r.alias_target if r.is_alias else None,
             "routing_policy": r.routing_policy, "set_identifier": r.set_identifier}
            for r in recs
        ],
    }
    return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="{fname}.json"'})
