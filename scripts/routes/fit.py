"""A minimal FIT reader: just enough to pull the track out of a course or activity file."""

import struct
from pathlib import Path

RECORD = 20  # global message number of a track point
SEMI = 180 / 2**31
# base type number -> (struct code, size, "invalid" value)
BASE = {
    0: ("B", 1, 0xFF),
    1: ("b", 1, 0x7F),
    2: ("B", 1, 0xFF),
    3: ("h", 2, 0x7FFF),
    4: ("H", 2, 0xFFFF),
    5: ("i", 4, 0x7FFFFFFF),
    6: ("I", 4, 0xFFFFFFFF),
    7: ("s", 1, None),
    8: ("f", 4, None),
    9: ("d", 8, None),
    10: ("B", 1, 0),
    11: ("H", 2, 0),
    12: ("I", 4, 0),
    13: ("B", 1, 0xFF),
    14: ("q", 8, 0x7FFFFFFFFFFFFFFF),
    15: ("Q", 8, 0xFFFFFFFFFFFFFFFF),
    16: ("Q", 8, 0),
}


def messages(data: bytes) -> list[tuple[int, dict[int, int | float]]]:
    """Returns (global message number, {field number: raw value}) for every data message."""
    pos, end = data[0], data[0] + struct.unpack_from("<I", data, 4)[0]
    defs: dict[int, tuple] = {}
    out = []
    while pos < end:
        head = data[pos]
        pos += 1
        if head & 0x80:  # compressed timestamp header: always a data message
            local, is_def, dev = (head >> 5) & 3, False, False
        else:
            local, is_def, dev = head & 0x0F, bool(head & 0x40), bool(head & 0x20)
        if is_def:
            order = ">" if data[pos + 1] else "<"
            num = struct.unpack_from(order + "H", data, pos + 2)[0]
            n = data[pos + 4]
            fields = [tuple(data[pos + 5 + 3 * i : pos + 8 + 3 * i]) for i in range(n)]
            pos += 5 + 3 * n
            skip = 0
            if dev:
                nd = data[pos]
                skip = sum(data[pos + 2 + 3 * i] for i in range(nd))
                pos += 1 + 3 * nd
            defs[local] = (order, num, fields, skip)
            continue
        order, num, fields, skip = defs[local]
        values = {}
        for fnum, size, btype in fields:
            code, width, invalid = BASE.get(btype & 0x1F, ("B", 1, None))
            if code != "s" and size == width:
                v = struct.unpack_from(order + code, data, pos)[0]
                if v != invalid:
                    values[fnum] = v
            pos += size
        pos += skip
        out.append((num, values))
    return out


def track(file: Path) -> list[tuple[float, float, float | None]]:
    """Returns (lat, lon, altitude in metres or None) for every track point with a position."""
    out = []
    for num, v in messages(file.read_bytes()):
        if num != RECORD or 0 not in v or 1 not in v:
            continue
        alt = v[78] / 5 - 500 if 78 in v else v[2] / 5 - 500 if 2 in v else None
        out.append((v[0] * SEMI, v[1] * SEMI, alt))
    return out
