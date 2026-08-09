"""Generator for the Kaheel live-demo parcel skits (Lottie).

Kept in the repo so the animations can be retuned without hand-editing JSON.
Run with `python3 scripts/gen-demo-lottie.py` from the project root.

Notes that cost time to rediscover:
  * Lottie/After Effects paint the FIRST item of a group on TOP, so every
    group here is written top-most shape first.
  * A fill applies to the paths that precede it inside the same group.
  * Multi-dimensional keyframes need `i`/`o` easing arrays sized per dimension.
"""
import json
import os

FR = 30
OUT = "public/lottie"


def col(hexs):
    h = hexs.lstrip("#")
    return [round(int(h[i:i + 2], 16) / 255, 4) for i in (0, 2, 4)] + [1]


PURPLE_D = col("#3c096c")
PURPLE = col("#7b2cbf")
LILAC = col("#e0aaff")
CARD = col("#c77dff")
SKIN = col("#ffd9b3")
AMBER = col("#f59e0b")
DARK = col("#240046")


def tr(p=(0, 0), s=(100, 100), r=0, a=(0, 0), o=100):
    return {"ty": "tr", "p": {"a": 0, "k": list(p)}, "a": {"a": 0, "k": list(a)},
            "s": {"a": 0, "k": list(s)}, "r": {"a": 0, "k": r}, "o": {"a": 0, "k": o}}


def fill(c):
    return {"ty": "fl", "c": {"a": 0, "k": c}, "o": {"a": 0, "k": 100}, "r": 1, "nm": "f"}


def stroke(c, w):
    return {"ty": "st", "c": {"a": 0, "k": c}, "o": {"a": 0, "k": 100},
            "w": {"a": 0, "k": w}, "lc": 2, "lj": 2, "nm": "s"}


def rect(size, pos=(0, 0), r=8):
    return {"ty": "rc", "d": 1, "s": {"a": 0, "k": list(size)},
            "p": {"a": 0, "k": list(pos)}, "r": {"a": 0, "k": r}, "nm": "r"}


def ell(size, pos=(0, 0)):
    return {"ty": "el", "d": 1, "s": {"a": 0, "k": list(size)},
            "p": {"a": 0, "k": list(pos)}, "nm": "e"}


def trim(start, end):
    return {"ty": "tm", "s": {"a": 0, "k": start}, "e": {"a": 0, "k": end},
            "o": {"a": 0, "k": 0}, "m": 1, "nm": "t"}


def group(items, name="g", **kw):
    return {"ty": "gr", "nm": name, "it": items + [tr(**kw)]}


def kf(frames, ease=(0.35, 0.65)):
    out = []
    for i, (t, v) in enumerate(frames):
        node = {"t": t, "s": list(v) if isinstance(v, (list, tuple)) else [v]}
        if i < len(frames) - 1:
            n = len(node["s"])
            node["i"] = {"x": [ease[0]] * n, "y": [1] * n}
            node["o"] = {"x": [ease[1]] * n, "y": [0] * n}
        out.append(node)
    return {"a": 1, "k": out}


def static(v):
    return {"a": 0, "k": list(v) if isinstance(v, (list, tuple)) else v}


def ks(p=(100, 100), s=(100, 100), r=0, o=100, a=(0, 0)):
    def norm(v):
        return v if isinstance(v, dict) else static(v)
    return {"o": norm(o), "r": norm(r),
            "p": norm(p if isinstance(p, dict) else list(p) + [0]),
            "a": static(list(a) + [0]), "s": norm(s)}


def layer(ind, name, shapes, kss, op):
    return {"ddd": 0, "ind": ind, "ty": 4, "nm": name, "sr": 1, "ks": kss,
            "ao": 0, "shapes": shapes, "ip": 0, "op": op, "st": 0, "bm": 0}


def head(blink=None):
    """One cartoon face for every scene: top-most shape first."""
    return group([
        # facial features sit above the skull
        group([ell([26, 20], [0, 8]), trim(38, 62), stroke(DARK, 3.2)], "smile"),
        group([ell([8, 10], [-11, -5]), fill(DARK)], "eye-l"),
        group([ell([8, 10], [11, -5]), fill(DARK)], "eye-r"),
        group([ell([10, 6], [-21, 6]), fill(CARD)], "blush-l"),
        group([ell([10, 6], [21, 6]), fill(CARD)], "blush-r"),
        group([ell([60, 60]), fill(SKIN)], "skull"),
    ], "head")


def parcel(lid_rotation):
    """Purple parcel with a hinged lid; lid first so it stays on top."""
    return [
        {"ty": "gr", "nm": "lid", "it": [
            rect([110, 18], [0, 0], 6), fill(CARD),
            {"ty": "tr", "p": {"a": 0, "k": [-55, -28]}, "a": {"a": 0, "k": [-55, 0]},
             "s": {"a": 0, "k": [100, 100]}, "r": lid_rotation, "o": {"a": 0, "k": 100}},
        ]},
        group([rect([16, 74], [0, 10], 2), fill(LILAC)], "tape", o=65),
        group([rect([104, 74], [0, 10], 10), trim(0, 100), stroke(PURPLE_D, 3)], "edge"),
        group([rect([104, 74], [0, 10], 10), fill(PURPLE)], "box"),
    ]


def write(name, w, h, op, layers):
    os.makedirs(OUT, exist_ok=True)
    doc = {"v": "5.9.6", "fr": FR, "ip": 0, "op": op, "w": w, "h": h, "nm": name,
           "ddd": 0, "assets": [], "layers": layers, "markers": []}
    path = f"{OUT}/{name}.json"
    with open(path, "w") as fh:
        json.dump(doc, fh, separators=(",", ":"))
    print(f"{path}: {os.path.getsize(path) / 1024:.1f} KB")


# ── Scene 1: parcel drops, squashes, lid flips, mascot pops out and waves ────
OP = 150
write("kaheel-parcel-drop", 200, 200, OP, [
    layer(1, "sparkle-a", [group([ell([15, 15]), fill(AMBER)], "sp")],
          ks(p=[44, 62, 0],
             s=kf([(0, [0, 0]), (44, [0, 0]), (56, [120, 120]), (72, [78, 78]),
                   (100, [115, 115]), (OP - 1, [0, 0])]), o=static(88)), OP),
    layer(2, "sparkle-b", [group([ell([11, 11]), fill(LILAC)], "sp")],
          ks(p=[158, 50, 0],
             s=kf([(0, [0, 0]), (48, [0, 0]), (60, [118, 118]), (78, [80, 80]),
                   (104, [112, 112]), (OP - 1, [0, 0])]), o=static(92)), OP),
    layer(3, "arm-wave", [group([rect([15, 38], [0, -15], 7), fill(LILAC)], "arm")],
          ks(p=kf([(0, [140, 152, 0]), (34, [140, 152, 0]), (46, [140, 92, 0]),
                   (54, [140, 100, 0]), (86, [140, 92, 0]), (118, [140, 100, 0]),
                   (OP - 1, [140, 94, 0])]),
             r=kf([(0, 0), (48, 0), (62, -36), (76, -8), (90, -36), (104, -8),
                   (118, -30), (OP - 1, -14)])), OP),
    layer(4, "mascot", [head()],
          ks(p=kf([(0, [100, 152, 0]), (34, [100, 152, 0]), (46, [100, 84, 0]),
                   (54, [100, 94, 0]), (86, [100, 84, 0]), (118, [100, 94, 0]),
                   (OP - 1, [100, 88, 0])]),
             r=kf([(0, 0), (46, 0), (70, -7), (100, 7), (OP - 1, 0)])), OP),
    layer(5, "parcel", parcel(kf([(0, 0), (30, 0), (40, -58), (OP - 1, -58)])),
          ks(p=kf([(0, [100, -70, 0]), (16, [100, 132, 0]), (24, [100, 120, 0]),
                   (30, [100, 128, 0]), (OP - 1, [100, 128, 0])], ease=(0.2, 0.8)),
             s=kf([(0, [100, 100]), (14, [100, 100]), (18, [122, 80]),
                   (26, [94, 108]), (32, [100, 100]), (OP - 1, [100, 100])])), OP),
    layer(6, "shadow", [group([ell([104, 16]), fill(DARK)], "sh")],
          ks(p=[100, 174, 0],
             s=kf([(0, [40, 40]), (16, [104, 104]), (24, [86, 86]),
                   (32, [100, 100]), (OP - 1, [100, 100])]),
             o=kf([(0, 0), (14, 0), (20, 26), (OP - 1, 20)])), OP),
])

# ── Scene 2: mascot peeks over the parcel edge and waves ─────────────────────
OP2 = 132
write("kaheel-parcel-peek", 200, 200, OP2, [
    layer(1, "sparkle", [group([ell([14, 14]), fill(AMBER)], "sp")],
          ks(p=[50, 68, 0],
             s=kf([(0, [0, 0]), (30, [118, 118]), (60, [78, 78]),
                   (92, [116, 116]), (OP2 - 1, [90, 90])]), o=static(88)), OP2),
    layer(2, "arm-wave", [group([rect([15, 38], [0, -15], 7), fill(LILAC)], "arm")],
          ks(p=kf([(0, [134, 158, 0]), (12, [134, 158, 0]), (26, [134, 106, 0]),
                   (36, [134, 114, 0]), (74, [134, 106, 0]), (108, [134, 114, 0]),
                   (OP2 - 1, [134, 108, 0])]),
             r=kf([(0, 0), (28, 0), (42, -40), (56, -10), (70, -40), (84, -10),
                   (100, -34), (OP2 - 1, -16)])), OP2),
    layer(3, "mascot", [head()],
          ks(p=kf([(0, [100, 158, 0]), (12, [100, 158, 0]), (26, [100, 100, 0]),
                   (36, [100, 108, 0]), (74, [100, 100, 0]), (108, [100, 108, 0]),
                   (OP2 - 1, [100, 102, 0])]),
             r=kf([(0, 6), (26, 6), (52, -8), (84, 8), (OP2 - 1, 4)])), OP2),
    layer(4, "parcel", parcel(static(-56)), ks(p=[100, 128, 0]), OP2),
    layer(5, "shadow", [group([ell([104, 16]), fill(DARK)], "sh")],
          ks(p=[100, 174, 0], o=static(20)), OP2),
])
