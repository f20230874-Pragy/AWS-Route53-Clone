from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from ..bind import parse_zone_file
from ..database import get_db
from ..models import DnsRecord, HostedZone
from ..schemas import BulkDelete, ImportIn, ImportResult, Page, RecordIn, RecordOut
from ..security import current_user
from ..validation import (
    DEFAULT_TTL, EDITABLE_TYPES, ROUTING_POLICIES, ValidationFailure,
    build_record_name, in_zone, validate_domain, validate_values,
)
from .zones import get_zone_or_404

router = APIRouter(prefix="/api/hosted-zones/{zone_id}/records", tags=["records"], dependencies=[Depends(current_user)])

SORTABLE = {"name": DnsRecord.name, "type": DnsRecord.type, "ttl": DnsRecord.ttl, "routing_policy": DnsRecord.routing_policy}


def _err(msg: str, code: int = 422):
    raise HTTPException(code, msg)


def normalise(zone: HostedZone, body: RecordIn) -> dict:
    """Validate a RecordIn against Route 53's rules and return column values."""
    rtype = body.type.upper().strip()
    if rtype == "SOA":
        _err("SOA records cannot be created")
    if rtype not in EDITABLE_TYPES:
        _err(f"Unsupported record type: {body.type}")
    try:
        name = build_record_name(body.name, zone.name)
        validate_domain(name, allow_wildcard=True)
    except ValidationFailure as e:
        _err(str(e))
    if not in_zone(name, zone.name):
        _err(f"RRSet with DNS name {name} is not permitted in zone {zone.name}")
    if rtype == "CNAME" and name == zone.name:
        _err("A CNAME record cannot be created at the zone apex")
    if body.routing_policy not in ROUTING_POLICIES:
        _err(f"Invalid routing policy: {body.routing_policy}")

    out = dict(
        name=name, type=rtype, routing_policy=body.routing_policy, health_check_id=(body.health_check_id or None),
        set_identifier=None, weight=None, region=None, failover_role=None, location=None,
        is_alias=body.is_alias, alias_target=None, evaluate_target_health=False, ttl=None, values=[],
    )
    if body.routing_policy != "Simple":
        if not (body.set_identifier or "").strip():
            _err("Record ID (set identifier) is required for this routing policy")
        out["set_identifier"] = body.set_identifier.strip()
        if body.routing_policy == "Weighted":
            if body.weight is None:
                _err("Weight is required for the weighted routing policy")
            out["weight"] = body.weight
        elif body.routing_policy == "Latency":
            if not body.region:
                _err("Region is required for the latency routing policy")
            out["region"] = body.region
        elif body.routing_policy == "Failover":
            if not body.failover_role:
                _err("Failover record type is required for the failover routing policy")
            out["failover_role"] = body.failover_role
        elif body.routing_policy == "Geolocation":
            if not body.location:
                _err("Location is required for the geolocation routing policy")
            out["location"] = body.location

    if body.is_alias:
        if rtype in ("NS", "SOA", "TXT", "SRV", "MX", "CAA", "PTR"):
            _err(f"Alias is not supported for {rtype} records")
        try:
            out["alias_target"] = validate_domain(body.alias_target or "")
        except ValidationFailure as e:
            _err("Alias target: " + str(e))
        out["evaluate_target_health"] = body.evaluate_target_health
    else:
        ttl = body.ttl if body.ttl is not None else DEFAULT_TTL[rtype]
        out["ttl"] = ttl
        try:
            out["values"] = validate_values(rtype, body.values)
        except ValidationFailure as e:
            _err(str(e))
    return out


def check_conflicts(db: Session, zone: HostedZone, data: dict, exclude_id: int | None = None) -> None:
    same_name = db.scalars(select(DnsRecord).where(DnsRecord.zone_id == zone.id, DnsRecord.name == data["name"])).all()
    for r in same_name:
        if exclude_id and r.id == exclude_id:
            continue
        if r.type == data["type"] and (r.set_identifier or None) == data["set_identifier"]:
            _err(f"RRSet of type {data['type']} with DNS name {data['name']} already exists (InvalidChangeBatch)", 409)
        if data["type"] == "CNAME" or r.type == "CNAME":
            if r.type != data["type"]:
                _err(f"RRSet of type CNAME with DNS name {data['name']} is not permitted as it conflicts with other records with the same name", 409)


@router.get("", response_model=Page)
def list_records(
    zone_id: str,
    search: str = "",
    type: str = "",
    routing_policy: str = "",
    alias: str = Query("", pattern="^(|yes|no)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort: str = "name",
    order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    get_zone_or_404(db, zone_id)
    q = select(DnsRecord).where(DnsRecord.zone_id == zone_id)
    if search.strip():
        like = f"%{search.strip().lower()}%"
        q = q.where(or_(
            func.lower(DnsRecord.name).like(like), func.lower(DnsRecord.type).like(like),
            func.lower(cast(DnsRecord.values, String)).like(like),
            func.lower(func.coalesce(DnsRecord.alias_target, "")).like(like),
            func.lower(func.coalesce(DnsRecord.set_identifier, "")).like(like),
        ))
    if type:
        q = q.where(DnsRecord.type == type.upper())
    if routing_policy:
        q = q.where(DnsRecord.routing_policy == routing_policy)
    if alias:
        q = q.where(DnsRecord.is_alias == (alias == "yes"))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    col = SORTABLE.get(sort, DnsRecord.name)
    # Apex-first, then requested order (mirrors the Route 53 console)
    q = q.order_by(col.desc() if order == "desc" else col.asc(), DnsRecord.type, DnsRecord.id).offset((page - 1) * page_size).limit(page_size)
    return Page(items=[RecordOut.model_validate(r) for r in db.scalars(q).all()], total=total, page=page, page_size=page_size)


@router.post("", response_model=RecordOut, status_code=201)
def create_record(zone_id: str, body: RecordIn, db: Session = Depends(get_db)):
    zone = get_zone_or_404(db, zone_id)
    data = normalise(zone, body)
    check_conflicts(db, zone, data)
    rec = DnsRecord(zone_id=zone.id, **data)
    db.add(rec)
    db.commit()
    return rec


@router.get("/{record_id}", response_model=RecordOut)
def get_record(zone_id: str, record_id: int, db: Session = Depends(get_db)):
    return _get(db, zone_id, record_id)


def _get(db: Session, zone_id: str, record_id: int) -> DnsRecord:
    rec = db.get(DnsRecord, record_id)
    if not rec or rec.zone_id != zone_id:
        raise HTTPException(404, "Record not found")
    return rec


@router.put("/{record_id}", response_model=RecordOut)
def update_record(zone_id: str, record_id: int, body: RecordIn, db: Session = Depends(get_db)):
    zone = get_zone_or_404(db, zone_id)
    rec = _get(db, zone_id, record_id)
    if rec.type == "SOA":
        _err("SOA records cannot be modified in this console", 409)
    if rec.type == "NS" and rec.name == zone.name and (body.type.upper() != "NS" or build_record_name(body.name, zone.name) != zone.name):
        _err("The apex NS record cannot be renamed or changed to another type", 409)
    data = normalise(zone, body)
    check_conflicts(db, zone, data, exclude_id=rec.id)
    for k, v in data.items():
        setattr(rec, k, v)
    db.commit()
    return rec


def _protected(rec: DnsRecord, zone: HostedZone) -> bool:
    return rec.type == "SOA" or (rec.type == "NS" and rec.name == zone.name)


@router.delete("/{record_id}", status_code=204)
def delete_record(zone_id: str, record_id: int, db: Session = Depends(get_db)):
    zone = get_zone_or_404(db, zone_id)
    rec = _get(db, zone_id, record_id)
    if _protected(rec, zone):
        _err("The default NS and SOA records of a hosted zone cannot be deleted", 409)
    db.delete(rec)
    db.commit()


@router.post("/bulk-delete")
def bulk_delete(zone_id: str, body: BulkDelete, db: Session = Depends(get_db)):
    zone = get_zone_or_404(db, zone_id)
    recs = db.scalars(select(DnsRecord).where(DnsRecord.zone_id == zone_id, DnsRecord.id.in_(body.ids))).all()
    if any(_protected(r, zone) for r in recs):
        _err("The default NS and SOA records of a hosted zone cannot be deleted", 409)
    for r in recs:
        db.delete(r)
    db.commit()
    return {"deleted": len(recs)}


@router.post("/import", response_model=ImportResult)
def import_records(zone_id: str, body: ImportIn, db: Session = Depends(get_db)):
    """Import records from a BIND zone file. SOA and apex NS records in the file are skipped."""
    zone = get_zone_or_404(db, zone_id)
    parsed, errors = parse_zone_file(body.content, zone.name)
    created = updated = 0
    skipped: list[str] = []
    for p in parsed:
        label = f"{p['name']} {p['type']}"
        if p["type"] == "SOA" or (p["type"] == "NS" and p["name"] == zone.name):
            skipped.append(f"{label} (managed by Route 53)"); continue
        try:
            data = normalise(zone, RecordIn(name=p["name"], type=p["type"], ttl=p["ttl"], values=p["values"]))
            existing = db.scalar(select(DnsRecord).where(DnsRecord.zone_id == zone.id, DnsRecord.name == data["name"], DnsRecord.type == data["type"], DnsRecord.set_identifier.is_(None)))
            if existing:
                if not body.overwrite:
                    skipped.append(f"{label} (already exists)"); continue
                for k, v in data.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                check_conflicts(db, zone, data)
                db.add(DnsRecord(zone_id=zone.id, **data))
                created += 1
            db.flush()
        except HTTPException as e:
            errors.append(f"{label}: {e.detail}")
    db.commit()
    return ImportResult(created=created, updated=updated, skipped=skipped, errors=errors)
