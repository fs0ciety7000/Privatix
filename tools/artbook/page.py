"""Écrit les galeries de site/artbook.html (entre les marqueurs `<!-- artbook:<id>:start/end -->`) et
docs/artbook/README.md à partir de catalog.json, characters.json, scenes.json et des fichiers produits
dans site/public/artbook/. Les dimensions des images sont lues sur les fichiers (attributs width/height,
pas de décalage de mise en page).

    python3 tools/artbook/page.py
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PUB = ROOT / "site" / "public"
ART = PUB / "artbook"
PAGE = ROOT / "site" / "artbook.html"
README = ROOT / "docs" / "artbook" / "README.md"
CAT = json.loads((HERE / "catalog.json").read_text())
CHARS = {f"perso-{c['id']}": c for c in json.loads((HERE / "characters.json").read_text())["characters"]}
SCENES = {s["id"]: s for s in json.loads((HERE / "scenes.json").read_text())["planches"]}
ROLE_VAR = {"hero": "var(--px-hero)", "enemy": "var(--px-enemy)", "elite": "var(--px-violet-hi)", "boss": "var(--px-danger)", "npc": "var(--px-tungsten)"}
SECTION_TITLES = {"personnages": "Personnages", "decors": "Décors", "loot-ui": "Loot & UI", "vfx": "VFX & télégraphes", "palette": "Palette & DA"}

e = html.escape


def size(p: Path) -> str:
    b = p.stat().st_size
    return f"{b / 1024 / 1024:.1f} Mo".replace(".", ",") if b > 1024 * 1024 else f"{b / 1024:.0f} Kio"


def title_of(pid: str) -> tuple[str, str, str]:
    """(titre, sous-titre, couleur de liseré)"""
    if pid in CHARS:
        c = CHARS[pid]
        return c["name"], f"{c['kind']} · model sheet", ROLE_VAR[c["role"]]
    t = CAT["titles"].get(pid)
    if t:
        rc = "var(--px-danger)" if pid.startswith(("vfx", "decor-arenes", "decor-hall")) else "var(--px-rim)"
        if pid.startswith(("loot", "perso-tenues")):
            rc = "var(--rar-patrimoine)"
        if pid.startswith(("decor-quais", "decor-hub", "decor-passerelle")):
            rc = "var(--px-sodium)"
        return t[0], t[1], rc
    return pid, "", "var(--px-rim)"


def alt_of(pid: str) -> str:
    if pid in CHARS:
        c = CHARS[pid]
        return f"Model sheet de {c['name']} : turnaround face, trois-quarts, profil et dos, silhouette, palette extraite, taille relative au héros et poses clés."
    if pid in SCENES:
        s = SCENES[pid]
        return f"Planche « {s['title']} » : {s.get('subtitle') or s['eyebrow']}."
    t = CAT["titles"].get(pid, [pid, ""])
    return f"Planche « {t[0]} » : {t[1]}."


def card(pid: str, wide: bool, solo: bool = False) -> str:
    big = ART / "planches" / f"{pid}.webp"
    small = ART / "planches" / f"{pid}-1200.webp"
    if not big.exists():
        raise SystemExit(f"planche manquante : {big}")
    w, h = Image.open(small).size
    t, sub, rc = title_of(pid)
    sizes = "(min-width: 1180px) 540px, (min-width: 760px) 46vw, 92vw" if wide else "(min-width: 1180px) 360px, (min-width: 760px) 30vw, 92vw"
    if solo:
        sizes = "(min-width: 1180px) 1100px, 94vw"
    return (
        f'<li class="ab-card" data-reveal>\n'
        f'  <a class="ab-card__link" href="/artbook/planches/{pid}.webp" style="--rc: {rc}" data-lightbox data-caption="{e(t)} · {e(sub)}">\n'
        f'    <img class="ab-thumb" src="/artbook/planches/{pid}-1200.webp" srcset="/artbook/planches/{pid}-1200.webp 1200w, /artbook/planches/{pid}.webp 2400w" sizes="{sizes}" width="{w}" height="{h}" loading="lazy" decoding="async" alt="{e(alt_of(pid))}" />\n'
        f"  </a>\n"
        f'  <p class="ab-card__cap"><b>{e(t)}</b><span>{e(sub)}</span></p>\n'
        f"</li>"
    )


def section_html(sec) -> str:
    out = []
    for g in sec["groups"]:
        wide = g.get("wide", False)
        items = "\n".join(card(pid, wide, len(g["items"]) == 1) for pid in g["items"])
        head = f'<h3 class="tier__title" data-reveal><span>{e(g["title"])}</span></h3>\n' if g.get("title") else ""
        cls = "ab-grid ab-grid--wide" if wide else "ab-grid"
        if len(g["items"]) == 1:
            cls += " ab-grid--solo"
        out.append(f'<div class="ab-group">\n{head}<ul class="{cls}" role="list">\n{items}\n</ul>\n</div>')
    return "\n".join(out)


DL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0-4.5-4.5M12 14l4.5-4.5M4 17v3h16v-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>'


def anims_html() -> str:
    lis = []
    for a in CAT["anims"]:
        base = ART / "anim" / a["id"]
        if not Path(f"{base}.webm").exists():
            continue
        gif = Path(f"{base}.gif")
        lis.append(
            f'<li class="ab-clip" style="--rc: {a["rc"]}" data-reveal>\n'
            f'  <video data-clip data-poster="/artbook/anim/{a["id"]}-poster.webp" data-webm="/artbook/anim/{a["id"]}.webm" data-mp4="/artbook/anim/{a["id"]}.mp4" muted loop playsinline preload="none" width="960" height="540" aria-label="{e(a["title"])} : {e(a["sub"])}"></video>\n'
            f"  <figcaption>\n    <h3>{e(a['title'])}</h3>\n    <p>{e(a['sub'])}</p>\n"
            f'    <a class="ab-dl" href="/artbook/anim/{a["id"]}.gif" download>{DL_ICON}GIF · {size(gif)}</a>\n'
            f"  </figcaption>\n</li>"
        )
    return '<ul class="ab-clips" role="list">\n' + "\n".join(lis) + "\n</ul>"


def presskit_html() -> str:
    lis = []
    for i, p in enumerate(CAT["presskit"], 1):
        jpg = ART / "presskit" / f"privatix-capture-{i}.jpg"
        lis.append(
            f'<li data-reveal>\n'
            f'  <a class="shot" href="/artbook/presskit/privatix-capture-{i}.jpg" data-lightbox>\n'
            f'    <img src="/artbook/presskit/privatix-capture-{i}-960.webp" srcset="/artbook/presskit/privatix-capture-{i}-960.webp 960w, /artbook/presskit/privatix-capture-{i}.jpg 1920w" sizes="(min-width: 900px) 540px, 92vw" width="1920" height="1080" loading="lazy" decoding="async" alt="{e(p["alt"])}" />\n'
            f"  </a>\n"
            f'  <p class="shot__cap">{e(p["title"])} · <a class="link" href="/artbook/presskit/privatix-capture-{i}.jpg" download>JPG 1920×1080 · {size(jpg)}</a></p>\n'
            f"</li>"
        )
    return '<ul class="gallery" role="list">\n' + "\n".join(lis) + "\n</ul>"


def indent(block: str, n: int) -> str:
    pad = " " * n
    return "\n".join(pad + line if line else line for line in block.split("\n"))


def fill(page: str, key: str, block: str) -> str:
    pat = re.compile(rf"([ \t]*)<!-- artbook:{key}:start -->.*?<!-- artbook:{key}:end -->", re.S)
    m = pat.search(page)
    if not m:
        raise SystemExit(f"marqueur absent : {key}")
    pad = m.group(1)
    rep = f"{pad}<!-- artbook:{key}:start -->\n{indent(block, len(pad))}\n{pad}<!-- artbook:{key}:end -->"
    return page[: m.start()] + rep + page[m.end() :]


def readme() -> str:
    lines = [
        "# Artbook & Press kit",
        "",
        "Planches de l'artbook de Privatix (direction artistique « Néon & Ballast ») : model sheets des personnages, décors, loot et UI, VFX et télégraphes, palette, et animations tirées du jeu 3D. Les mêmes fichiers sont servis par le site vitrine (`site/artbook.html`) : ils vivent dans [`site/public/artbook/`](../../site/public/artbook/) et ne sont pas dupliqués ici.",
        "",
        "- Planches : WebP 2x (2400 px de large) et 1x (`-1200.webp`).",
        "- Animations : GIF (≤ 4 Mo, 30 i/s), WebM VP9 et MP4 H.264 (960×540), affiche WebP.",
        "- Press kit : logo, quatre captures 1920×1080, textes ; l'archive ZIP est assemblée au build du site (`site/scripts/presskit.mjs`).",
        "",
        "Tout est régénéré par `node tools/artbook/build.mjs` (voir [`tools/artbook/README.md`](../../tools/artbook/README.md)).",
        "",
    ]
    P = "../../site/public/artbook"
    for sec in CAT["sections"]:
        lines += [f"## {SECTION_TITLES[sec['id']]}", ""]
        for g in sec["groups"]:
            if g.get("title"):
                lines += [f"### {g['title']}", ""]
            lines += ["| Planche | Aperçu |", "|---|---|"]
            for pid in g["items"]:
                t, sub, _ = title_of(pid)
                lines.append(f"| **{t}**<br>{sub}<br>[`{pid}.webp`]({P}/planches/{pid}.webp) | <img src=\"{P}/planches/{pid}-1200.webp\" width=\"480\" alt=\"{e(alt_of(pid))}\"> |")
            lines.append("")
    lines += ["## Animations (GIF)", ""]
    for a in CAT["anims"]:
        gif = ART / "anim" / f"{a['id']}.gif"
        if not gif.exists():
            continue
        lines += [f"### {a['title']}", "", a["sub"], "", f"![{a['title']}]({P}/anim/{a['id']}.gif)", "", f"[GIF]({P}/anim/{a['id']}.gif) ({size(gif)}) · [WebM]({P}/anim/{a['id']}.webm) · [MP4]({P}/anim/{a['id']}.mp4)", ""]
    lines += ["## Press kit", "", f"- Logo : [`privatix-logo.png`]({P}/presskit/privatix-logo.png) (transparent), [`privatix-logo-fond.png`]({P}/presskit/privatix-logo-fond.png) (fond nuit)"]
    for i, p in enumerate(CAT["presskit"], 1):
        lines.append(f"- Capture {i} : [{p['title']}]({P}/presskit/privatix-capture-{i}.jpg)")
    lines += [f"- Textes et fiche technique : [`presentation.md`]({P}/presskit/presentation.md)", "", "## Notes de production", ""]
    lines += [
        "- **Rendus des personnages** : visionneuse toon de `tools/render3d/viewer/` en mode portrait (fond transparent, contre-jours colorés) ; turnarounds à l'échelle commune, caméra frontale à 6° d'élévation ; poses clés au moment des événements du manifeste (`active`, `land`).",
        "- **Captures du jeu** : `play3d.html?demo&cheat` en Chromium SwiftShader, piloté en **temps virtuel** (horloge et `requestAnimationFrame` remplacés dans la page) : chaque image est calculée à pas fixe de 1000/30 ms, le rendu logiciel lent n'altère ni le rythme ni la fluidité.",
        "- **Éclairage de présentation** : dans les Shifts, l'énergie des lampes de salle (lumières ponctuelles de 11 m et leurs flaques additives) est ramenée au budget du preset bas (2 lampes sur 6). En preset haut tel quel, les flaques additives et le bloom (seuil 0,96, force 0,9) voilent les quais et le hall ; à corriger dans le jeu (normaliser l'énergie par nombre de lampes, seuil de bloom > 1,0 comme le prévoit la DA).",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    page = PAGE.read_text()
    for sec in CAT["sections"]:
        page = fill(page, sec["id"], section_html(sec))
    page = fill(page, "animations", anims_html())
    page = fill(page, "presskit", presskit_html())
    PAGE.write_text(page)
    README.parent.mkdir(parents=True, exist_ok=True)
    README.write_text(readme())
    print(f"{PAGE.relative_to(ROOT)} et {README.relative_to(ROOT)} écrits")


if __name__ == "__main__":
    main()
