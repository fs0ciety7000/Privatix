"""PNJ du hub OCC (32×32, 1 direction `down`, idle 4 frames, pivot (16, 28))."""
import lib
from humanoid import Humanoid
from lib import parse, canvas, blit
from palette import CHAR

c = CHAR
S, F = 32, 26

NPC = {
    # nom : (tête, torse, pantalon, chaussures, manches, accessoire)
    "marcel": (
        """
        .iiiiii.
        iIIiiiii
        iiiiiiid
        dddddddd
        bpKppKpb
        .bwwwwb.
        ..pbbz..
        """,
        """
        .hzzzzh.
        hzzqqzzhh
        hzzqqzzh
        hzzzqzzh
        hzazzazh
        hzzzzzzh
        .eeee.ee
        """,
        ("s", "d", "K"), ("h", "e", "K"), ("z", "h"), None,
    ),
    "josiane": (
        """
        .zqqqqz.
        zqqqqqqz
        zqqqqqqz
        zqppppqz
        zpKppKpz
        .zpppzz.
        ..pxxp..
        """,
        """
        .xxxxxx.
        xxxqqxxR
        xxxqqxxR
        xxxxxxxR
        xRxxxxRR
        xxxxxxRR
        .dddd.dd
        """,
        ("i", "n", "K"), ("h", "e", "K"), ("x", "R"), "thermos",
    ),
    "fatou": (
        """
        .LLaaLL.
        LaLLLLaG
        LLLaLLLG
        hmmmmmmh
        hmKmmKmh
        .hmmmmh.
        ..hmmh..
        """,
        """
        .wwwwww.
        wwwLLwwb
        wwwwwwwb
        wwxwwwwb
        wwwwwwbb
        wwwwwwbb
        .ssss.ss
        """,
        ("I", "i", "n"), ("w", "b", "s"), ("w", "b"), None,
    ),
    "kevin": (
        """
        .dddddd.
        dssdddyy
        dddddddd
        hppppppz
        hpKppKpz
        .ppppzz.
        ..zppz..
        """,
        """
        .yyddyy.
        yyyddyyyo
        ywyddywy
        yyyddyyy
        dhhhhhhd
        yyyyyyyy
        .dddd.dd
        """,
        ("s", "d", "K"), ("h", "e", "K"), ("s", "d"), "wrench",
    ),
    "bene": (
        """
        ..hhhh..
        .hmmhhh.
        hmhhhhhh
        hppppppz
        hKKpKKpz
        .ppppzz.
        ..zmmz..
        """,
        """
        .iiwwii.
        IiiwxwiI
        IiiwwwiI
        Iiiiiiin
        Iiaiiiin
        Iiiiiiin
        .dddd.dd
        """,
        ("i", "n", "K"), ("K", "d", "K"), ("i", "n"), None,
    ),
    "yasmina": (
        """
        .eeeeee.
        ehheeeee
        eheeeeee
        emmmmmmK
        smKmmKms
        .smmmms.
        ..smms..
        """,
        """
        .IIIIII.
        IcIIIIIi
        IIIwwIIi
        IIIIIIIi
        IIIIIIii
        IIIIIIii
        .dddd.dd
        """,
        ("d", "n", "K"), ("w", "b", "s"), ("I", "i"), None,
    ),
    "rudy": (
        """
        ..pppp..
        dpqpppzd
        spppppzs
        dppppppd
        dpKppKpd
        .ppppzz.
        ..zmmz..
        """,
        """
        .mmmmmm.
        mzzmmmzh
        mzzmmmmh
        mmmmmmmh
        mmmmmmhh
        mmmmmmhh
        .dddd.dd
        """,
        ("d", "n", "K"), ("h", "e", "K"), ("m", "h"), "micro",
    ),
    "jeanmi": (
        """
        .dddddd.
        dssddddd
        dddddddd
        hppppppz
        hpKppKpz
        .hhhhhh.
        ..hhhh..
        """,
        """
        .bbqqbb.
        bbhhhhbbg
        bbhhhhbb
        bbhhhhbb
        bbhhhhbb
        bbhhhhbb
        .dddd.dd
        """,
        ("s", "d", "K"), ("w", "b", "s"), ("b", "g"), "tasse",
    ),
}


def _body(name):
    head, torso, pants, shoes, sleeve, _acc = NPC[name]
    t = parse(torso)
    t = t[:, :8]
    return Humanoid(S, F, {"down": parse(head)}, {"down": t}, leg_len=8, leg_w=3, gap=2,
                    pants=pants, shoes=shoes, sleeve=sleeve, hand=("p", "z") if name not in ("fatou", "yasmina") else
                    ("m", "h"), neck=1)


def _acc(kind, t):
    def draw(layer, hand, P):
        x, y = hand
        if kind == "thermos":
            lib.rect(layer, x, y - 3, 3, 6, c["i"])
            lib.rect(layer, x, y - 3, 3, 1, c["s"])
            lib.px(layer, x, y - 1, c["I"])
        elif kind == "wrench":
            lib.rect(layer, x, y - 4, 1, 7, c["b"])
            lib.rect(layer, x - 1, y - 5, 3, 2, c["s"])
        elif kind == "micro":
            lib.rect(layer, x, y - 2, 2, 3, c["d"])
            lib.px(layer, x, y - 3, c["s"])
        elif kind == "tasse":
            lib.rect(layer, x - 1, y - 1 - (1 if t in (1, 2) else 0), 3, 3, c["q"])
            lib.px(layer, x, y - 1 - (1 if t in (1, 2) else 0), c["h"])
    return draw


def idle(name):
    body = _body(name)
    acc = NPC[name][5]
    out = []
    for i, b in enumerate((0, 0, 1, 1)):
        P = {"bob": b, "hands": ((10, 18 + b), (20, 18 + b))}
        if acc:
            P["item"] = _acc(acc, i)
            P["item_layer"] = "top"
        out.append(body.frame("down", P))
    return out


def build(emit):
    for name in NPC:
        emit("sprites/npcs", f"{name}_idle_strip4", idle(name), 200, loop=True, pivot=(16, 28))
