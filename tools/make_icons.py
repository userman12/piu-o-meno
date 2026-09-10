#!/usr/bin/env python3
"""Genera le icone PWA (bersaglio su gradiente) senza dipendenze esterne."""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
SS = 3  # supersampling per l'antialiasing

A = (0x7C, 0x5C, 0xFF)
B = (0xFF, 0x5F, 0x8F)
WHITE = (0xFF, 0xF6, 0xFB)


def sample(u, v, corner):
    """u,v in [0,1). Restituisce (r,g,b,a)."""
    # angoli arrotondati (0 = quadrato pieno, per la variante maskable)
    a = 255
    if corner > 0:
        dx = max(corner - u, u - (1 - corner), 0)
        dy = max(corner - v, v - (1 - corner), 0)
        if dx > 0 and dy > 0 and math.hypot(dx, dy) > corner:
            a = 0

    t = (u + v) / 2
    bg = tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))

    r = math.hypot(u - .5, v - .5)
    hit = r < .085 or .155 < r < .215 or .285 < r < .345
    return (WHITE if hit else bg) + (a,)


def png(path, size, corner):
    rows = []
    for y in range(size):
        row = bytearray(b"\x00")
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    px = sample((x + (sx + .5) / SS) / size, (y + (sy + .5) / SS) / size, corner)
                    for i in range(4):
                        acc[i] += px[i]
            row += bytes(v // (SS * SS) for v in acc)
        rows.append(bytes(row))

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(b"".join(rows), 9)))
        f.write(chunk(b"IEND", b""))
    print("scritto", path)


os.makedirs(OUT, exist_ok=True)
png(os.path.join(OUT, "icon-192.png"), 192, .22)
png(os.path.join(OUT, "icon-512.png"), 512, .22)
png(os.path.join(OUT, "icon-maskable.png"), 512, 0)
