"""Minimal BIND zone-file parser / serializer."""
import re
import shlex

from .validation import RECORD_TYPES, ValidationFailure, fqdn

_TTL_UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}
CLASSES = {"IN", "CH", "HS"}


def parse_ttl(tok: str) -> int | None:
    m = re.fullmatch(r"(\d+[smhdwSMHDW]?)+", tok)
    if not m:
        return None
    total = 0
    for num, unit in re.findall(r"(\d+)([smhdwSMHDW]?)", tok):
        total += int(num) * _TTL_UNITS.get(unit.lower(), 1)
    return total


def _strip_comment(line: str) -> str:
    out, in_q, esc = [], False, False
    for ch in line:
        if esc:
            out.append(ch); esc = False; continue
        if ch == "\\":
            out.append(ch); esc = True; continue
        if ch == '"':
            in_q = not in_q
        if ch == ";" and not in_q:
            break
        out.append(ch)
    return "".join(out)


def _logical_lines(text: str) -> list[tuple[str, bool]]:
    """Join parenthesised multi-line entries. Returns (line, starts_with_whitespace)."""
    lines, buf, depth, indented = [], "", 0, False
    for raw in text.splitlines():
        line = _strip_comment(raw)
        if depth == 0:
            if not line.strip():
                continue
            indented = line[:1] in (" ", "\t")
        stripped_q = re.sub(r'"(?:[^"\\]|\\.)*"', "", line)
        depth += stripped_q.count("(") - stripped_q.count(")")
        buf += " " + line.replace("(", " ").replace(")", " ") if buf else line.replace("(", " ").replace(")", " ")
        if depth <= 0:
            lines.append((buf, indented))
            buf, depth = "", 0
    if buf:
        lines.append((buf, indented))
    return lines


def _absolute(name: str, origin: str) -> str:
    if name == "@":
        return origin
    return name.lower() if name.endswith(".") else f"{name.lower()}.{origin}"


def parse_zone_file(text: str, zone_name: str) -> tuple[list[dict], list[str]]:
    """Return (records, errors). Records are dicts: name,type,ttl,values (grouped by name+type)."""
    origin, default_ttl, last_name, last_ttl = zone_name, 300, zone_name, None
    grouped: dict[tuple[str, str], dict] = {}
    errors: list[str] = []
    for line, indented in _logical_lines(text):
        s = line.strip()
        try:
            if s.upper().startswith("$ORIGIN"):
                origin = fqdn(s.split()[1]); continue
            if s.upper().startswith("$TTL"):
                default_ttl = parse_ttl(s.split()[1]) or default_ttl; continue
            if s.startswith("$"):
                continue
            try:
                toks = shlex.split(s, posix=False)
            except ValueError:
                toks = s.split()
            if not toks:
                continue
            if indented:
                name = last_name
            else:
                name = _absolute(toks.pop(0), origin)
            ttl = None
            while toks and (parse_ttl(toks[0]) is not None or toks[0].upper() in CLASSES):
                t = toks.pop(0)
                if t.upper() not in CLASSES:
                    ttl = parse_ttl(t)
            if not toks:
                raise ValidationFailure("missing record type")
            rtype = toks.pop(0).upper()
            if rtype not in RECORD_TYPES:
                raise ValidationFailure(f"unsupported record type {rtype}")
            last_name = name
            ttl = ttl if ttl is not None else (last_ttl if last_ttl is not None else default_ttl)
            last_ttl = ttl
            if rtype in ("CNAME", "NS", "PTR"):
                toks = [_absolute(toks[0], origin)]
            elif rtype == "MX":
                toks = [toks[0], _absolute(toks[1], origin)]
            elif rtype == "SRV":
                toks = toks[:3] + [_absolute(toks[3], origin)]
            value = " ".join(toks)
            if rtype == "TXT":
                parts = re.findall(r'"(?:[^"\\]|\\.)*"|\S+', " ".join(toks))
                value = " ".join(p if p.startswith('"') else f'"{p}"' for p in parts)
            g = grouped.setdefault((name, rtype), {"name": name, "type": rtype, "ttl": ttl, "values": []})
            g["values"].append(value)
        except (ValidationFailure, IndexError) as e:
            errors.append(f"{s[:80]}: {e}")
    return list(grouped.values()), errors


def to_bind(zone_name: str, records: list) -> str:
    out = [f"$ORIGIN {zone_name}", f"; Exported from Route 53 clone", ""]
    for r in sorted(records, key=lambda r: (r.name != zone_name, r.name, r.type)):
        if r.is_alias:
            out.append(f"; ALIAS {r.name} {r.type} -> {r.alias_target}")
            continue
        for v in r.values:
            out.append(f"{r.name}\t{r.ttl}\tIN\t{r.type}\t{v}")
    return "\n".join(out) + "\n"
