"""Seed a demo user + a handful of hosted zones so the console isn't empty on first run."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import DnsRecord, HostedZone, User
from .routers.zones import create_default_records, new_zone_id
from .security import hash_password

DEMO_USER = ("123456789012", "admin", "password")

DEMO_ZONES = [
    ("example.com.", False, "Production website"),
    ("acme-corp.io.", False, "Marketing site and APIs"),
    ("internal.acme.local.", True, "Private zone for service discovery"),
    ("shop.example.org.", False, "E-commerce storefront"),
    ("blog.example.net.", False, ""),
    ("staging.example.com.", False, "Staging environment"),
    ("mail.example.co.uk.", False, "Mail infrastructure"),
    ("cdn.acme-corp.io.", False, "CDN aliases"),
    ("dev.acme.local.", True, "Developer sandbox VPC"),
    ("docs.example.dev.", False, "Documentation portal"),
    ("status.example.app.", False, "Status page"),
    ("legacy.example.biz.", False, "Decommissioning in Q4"),
]

EXAMPLE_RECORDS = [
    ("", "A", 300, ["93.184.216.34"]),
    ("", "AAAA", 300, ["2606:2800:220:1:248:1893:25c8:1946"]),
    ("", "MX", 3600, ["10 mail1.example.com.", "20 mail2.example.com."]),
    ("", "TXT", 300, ['"v=spf1 include:_spf.example.com ~all"']),
    ("", "CAA", 3600, ['0 issue "letsencrypt.org"', '0 issuewild ";"']),
    ("www", "CNAME", 300, ["example.com."]),
    ("api", "A", 60, ["203.0.113.10", "203.0.113.11"]),
    ("blog", "CNAME", 300, ["blog.example.net."]),
    ("mail1", "A", 300, ["198.51.100.25"]),
    ("mail2", "A", 300, ["198.51.100.26"]),
    ("_dmarc", "TXT", 300, ['"v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"']),
    ("_sip._tcp", "SRV", 300, ["10 60 5060 sip.example.com."]),
    ("1.113.0.203.in-addr.arpa", "PTR", 300, ["api.example.com."]),
    ("ftp", "A", 300, ["203.0.113.50"]),
    ("vpn", "A", 300, ["203.0.113.60"]),
    ("status", "CNAME", 300, ["status.example.app."]),
    ("docs", "CNAME", 300, ["docs.example.dev."]),
    ("cdn", "CNAME", 300, ["d111111abcdef8.cloudfront.net."]),
]


def seed(db: Session) -> None:
    if db.scalar(select(func.count(User.id))):
        return
    acct, uname, pw = DEMO_USER
    db.add(User(account_id=acct, username=uname, password_hash=hash_password(pw)))
    for name, private, comment in DEMO_ZONES:
        z = HostedZone(
            id=new_zone_id(), name=name, is_private=private, comment=comment, caller_reference=f"seed-{name}",
            vpc_region="us-east-1" if private else None, vpc_id="vpc-0a1b2c3d4e5f6a7b8" if private else None,
            created_by="Route 53" if name != "legacy.example.biz." else "Other", tags={"env": "demo"} if not private else {},
        )
        db.add(z)
        db.flush()
        create_default_records(db, z)
        if name == "example.com.":
            for prefix, rtype, ttl, values in EXAMPLE_RECORDS:
                rname = name if prefix == "" else (f"{prefix}.{name}" if not prefix.endswith("arpa") else f"{prefix}.")
                if prefix.endswith("arpa"):
                    continue  # PTR belongs in a reverse zone; skip in forward demo zone
                db.add(DnsRecord(zone_id=z.id, name=rname, type=rtype, ttl=ttl, values=values))
            db.add(DnsRecord(zone_id=z.id, name=f"shop.{name}", type="A", is_alias=True, alias_target="d1234abcd.cloudfront.net.", evaluate_target_health=False))
            for i, (ip, w) in enumerate([("203.0.113.21", 70), ("203.0.113.22", 30)], 1):
                db.add(DnsRecord(zone_id=z.id, name=f"app.{name}", type="A", ttl=60, values=[ip], routing_policy="Weighted",
                                 set_identifier=f"app-{i}", weight=w))
        elif name == "acme-corp.io.":
            for host, ip in [("@", "198.51.100.7"), ("www", "198.51.100.7"), ("api", "198.51.100.8")]:
                db.add(DnsRecord(zone_id=z.id, name=name if host == "@" else f"{host}.{name}", type="A", ttl=300, values=[ip]))
    db.commit()
