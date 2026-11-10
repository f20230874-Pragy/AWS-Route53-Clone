"""Route 53-style record validation and name normalisation."""
import ipaddress
import re

RECORD_TYPES = ["A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SOA", "SRV", "TXT"]
EDITABLE_TYPES = [t for t in RECORD_TYPES if t != "SOA"]
ROUTING_POLICIES = ["Simple", "Weighted", "Latency", "Failover", "Geolocation", "Multivalue answer"]
ALIAS_TYPES = {"A", "AAAA", "CNAME", "TXT", "MX", "SRV", "CAA", "PTR", "NS"}  # Route 53 allows alias for A/AAAA/CNAME/... in practice

DEFAULT_TTL = {"A": 300, "AAAA": 300, "CNAME": 300, "TXT": 300, "MX": 300, "NS": 172800, "PTR": 300, "SRV": 300, "CAA": 300, "SOA": 900}

_LABEL = re.compile(r"^(?!-)[a-z0-9_*-]{1,63}(?<!-)$")


class ValidationFailure(ValueError):
    pass


def fqdn(name: str) -> str:
    """Lowercase + ensure trailing dot. Handles Route 53's octal-escape for wildcards."""
    name = name.strip().lower().replace("\\052", "*")
    if not name:
        raise ValidationFailure("Name is required")
    return name if name.endswith(".") else name + "."


def validate_domain(name: str, *, allow_wildcard: bool = False) -> str:
    n = fqdn(name)
    if len(n) > 254:
        raise ValidationFailure("Domain name is too long (max 253 characters)")
    labels = n.rstrip(".").split(".")
    for i, lab in enumerate(labels):
        if lab == "*" and allow_wildcard and i == 0:
            continue
        if not _LABEL.match(lab):
            raise ValidationFailure(f'"{n}" is not a valid DNS name (invalid label "{lab}")')
    return n


def in_zone(name: str, zone_name: str) -> bool:
    return name == zone_name or name.endswith("." + zone_name)


def build_record_name(prefix: str, zone_name: str) -> str:
    """Accepts a prefix ("www"), an empty string (apex) or a full name inside the zone."""
    prefix = prefix.strip().lower()
    if prefix in ("", "@"):
        return zone_name
    full = fqdn(prefix)
    if in_zone(full, zone_name):
        return full
    return fqdn(prefix.rstrip(".") + "." + zone_name)


def _check_ipv4(v: str) -> str:
    try:
        return str(ipaddress.IPv4Address(v.strip()))
    except ValueError:
        raise ValidationFailure(f'"{v}" is not a valid IPv4 address') from None


def _check_ipv6(v: str) -> str:
    try:
        return str(ipaddress.IPv6Address(v.strip()))
    except ValueError:
        raise ValidationFailure(f'"{v}" is not a valid IPv6 address') from None


def _check_host(v: str) -> str:
    return validate_domain(v, allow_wildcard=False)


def _check_mx(v: str) -> str:
    parts = v.split()
    if len(parts) != 2 or not parts[0].isdigit() or not 0 <= int(parts[0]) <= 65535:
        raise ValidationFailure(f'"{v}" is not a valid MX value. Use "<priority> <mail server>", e.g. 10 mail.example.com')
    return f"{int(parts[0])} {_check_host(parts[1])}"


def _check_srv(v: str) -> str:
    parts = v.split()
    if len(parts) != 4 or not all(p.isdigit() for p in parts[:3]):
        raise ValidationFailure(f'"{v}" is not a valid SRV value. Use "<priority> <weight> <port> <target>", e.g. 1 10 5269 xmpp.example.com')
    pr, w, port = (int(p) for p in parts[:3])
    if not (0 <= pr <= 65535 and 0 <= w <= 65535 and 0 <= port <= 65535):
        raise ValidationFailure("SRV priority, weight and port must be between 0 and 65535")
    return f"{pr} {w} {port} {_check_host(parts[3])}"


_CAA = re.compile(r'^(\d{1,3})\s+(issue|issuewild|iodef)\s+"(.*)"$')


def _check_caa(v: str) -> str:
    m = _CAA.match(v.strip())
    if not m or int(m.group(1)) > 255:
        raise ValidationFailure(f'"{v}" is not a valid CAA value. Use: 0 issue "letsencrypt.org"')
    return f'{int(m.group(1))} {m.group(2)} "{m.group(3)}"'


def _check_txt(v: str) -> str:
    v = v.strip()
    chunks = re.findall(r'"((?:[^"\\]|\\.)*)"', v)
    if not v.startswith('"'):
        # Route 53 requires quoting; be friendly like the console and wrap it.
        if '"' in v:
            raise ValidationFailure("TXT values must be enclosed in double quotation marks")
        chunks, v = [v], f'"{v}"'
    elif not chunks:
        raise ValidationFailure("Invalid TXT value")
    if any(len(c) > 255 for c in chunks):
        raise ValidationFailure("Each quoted TXT string may be at most 255 characters")
    if sum(len(c) for c in chunks) > 4000:
        raise ValidationFailure("TXT value is too long (max 4000 characters)")
    return v


_VALIDATORS = {
    "A": _check_ipv4,
    "AAAA": _check_ipv6,
    "CNAME": _check_host,
    "NS": _check_host,
    "PTR": _check_host,
    "MX": _check_mx,
    "SRV": _check_srv,
    "CAA": _check_caa,
    "TXT": _check_txt,
}


def validate_values(rtype: str, values: list[str]) -> list[str]:
    cleaned = [v.strip() for v in values if v and v.strip()]
    if not cleaned:
        raise ValidationFailure("At least one value is required")
    if rtype in ("CNAME", "PTR") and len(cleaned) > 1:
        raise ValidationFailure(f"A {rtype} record can only have a single value")
    if rtype == "SOA":
        return cleaned
    out = [_VALIDATORS[rtype](v) for v in cleaned]
    if len(set(out)) != len(out):
        raise ValidationFailure("Duplicate values are not allowed in a record")
    return out
