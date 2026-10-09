"""Construction Blender (bpy) et export GLB d'un `Model` (cf. geo.py) avec ses clips (cf. poses.py).

Repères : le modèle est décrit en coordonnées Three.js (Y haut, +Z avant). Blender est en Z haut :
(x, y, z)three → (x, -z, y)blender. L'exporteur glTF (export_yup) refait la conversion inverse,
on retrouve donc exactement les coordonnées du prototype dans le GLB.

Os : tête à la position de l'articulation, queue le long de +Z Blender (vers le haut), roll 0 → le
repère local de chaque os vaut exactement le repère Three (x = X, y = haut, z = avant). L'exporteur
glTF n'ajoute donc AUCUNE rotation de repos : tous les nœuds d'os (sockets compris) ont une
rotation identité dans le GLB, et un objet accroché à un socket garde l'orientation du personnage.
Une rotation de pose Three (x, y, z) en Euler 'YXZ' (R = Ry·Rx·Rz) devient Euler((x, y, z), 'ZXY')
en Blender (même produit de matrices) ; décalages et échelles sont recopiés tels quels.
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Euler

from .geo import MATS, Model, smooth_normals, srgb_to_linear
from .poses import Clip

FPS = 30
D2R = math.pi / 180


def to_b(v) -> tuple[float, float, float]:
    return (float(v[0]), float(-v[2]), float(v[1]))


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.fps_base = 1.0


# ─── Matériaux ─────────────────────────────────────────────────────────────────


def _material(name: str) -> bpy.types.Material:
    """Matériau Principled qui lit la couleur de sommet (exportée en COLOR_0). Le shader toon du jeu
    remplace ce matériau d'après son nom (`toon`, `glow`, `mirror`, `glass`)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    col = nt.nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Color"
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.8
    if name == "glow":
        nt.links.new(col.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 2.0
    elif name == "mirror":
        bsdf.inputs["Metallic"].default_value = 1.0
        bsdf.inputs["Roughness"].default_value = 0.15
    elif name == "glass":
        bsdf.inputs["Alpha"].default_value = 0.15
        m.surface_render_method = "BLENDED"
    return m


# ─── Armature ──────────────────────────────────────────────────────────────────


def build_armature(model: Model) -> bpy.types.Object:
    arm_data = bpy.data.armatures.new(f"{model.name}_rig")
    arm = bpy.data.objects.new(model.name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name in model.bones:
        eb = arm_data.edit_bones.new(name)
        h = to_b(model.world(name))
        eb.head = h
        eb.tail = (h[0], h[1], h[2] + 0.08)
        eb.roll = 0.0
        eb.use_deform = model.bones[name].deform
    for name, b in model.bones.items():
        if b.parent:
            arm_data.edit_bones[name].parent = arm_data.edit_bones[b.parent]
            arm_data.edit_bones[name].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "ZXY"
    return arm


# ─── Maillage ──────────────────────────────────────────────────────────────────


def _facet_color(i: int) -> float:
    """Valeur pseudo-aléatoire stable par facette (0..1)."""
    x = math.sin(i * 12.9898 + 78.233) * 43758.5453
    return x - math.floor(x)


def build_mesh(model: Model, name: str, parts=None, arm: bpy.types.Object | None = None, outline_attr: bool = True) -> bpy.types.Object:
    """Fusionne les pièces en UN maillage (un slot de matériau par type : toon, glow, mirror, glass),
    couleurs de sommet linéaires (RGB = couleur, A = part émissive), groupes de sommets = os."""
    parts = model.parts if parts is None else parts
    verts, faces, cols, mats, outl, smooth = [], [], [], [], [], []
    groups: dict[str, list] = {}
    used = [m for m in MATS if any(p.mat == m for p in parts)]
    slot = {m: i for i, m in enumerate(used)}
    base = 0
    face_no = 0
    for p in parts:
        V = p.V
        F = p.F
        if p.flat:
            # sommets dupliqués par face → ombrage plat exact, et couleur par facette
            nv, nf = [], []
            for f in F:
                s = len(nv)
                nv.extend(V[list(f)])
                nf.append(tuple(range(s, s + len(f))))
            ON = smooth_normals(V, F, True)
            on = np.concatenate([ON[list(f)] for f in F]) if F else np.zeros((0, 3))
            V = np.array(nv)
            F = nf
        else:
            on = smooth_normals(V, F, True)
        n = len(V)
        c = np.tile(np.array([*srgb_to_linear(np.array(p.color)), p.emit]), (n, 1))
        if p.facet_ids:
            k = 0
            for fi, f in enumerate(F):
                v = _facet_color(face_no + fi)
                c[list(f), 0:3] = v  # gris de 0 à 1 : le shader miroir en tire la teinte
                k += 1
        face_no += len(F)
        verts.append(V)
        cols.append(c)
        outl.append(on * p.outline)
        faces.extend(tuple(i + base for i in f) for f in F)
        mats.extend([slot[p.mat]] * len(F))
        smooth.extend([not p.flat] * len(F))
        if p.weights:
            for b, w in p.weights:
                groups.setdefault(b, []).append((base, w))
        else:
            groups.setdefault(p.bone, []).append((base, np.ones(n)))
        base += n
    V = np.concatenate(verts)
    C = np.concatenate(cols)
    O = np.concatenate(outl)
    Vb = np.stack([V[:, 0], -V[:, 2], V[:, 1]], axis=1)

    me = bpy.data.meshes.new(name)
    me.from_pydata(Vb.tolist(), [], faces)
    me.polygons.foreach_set("material_index", mats)
    me.polygons.foreach_set("use_smooth", smooth)
    ca = me.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", C.astype(np.float32).ravel())
    me.color_attributes.active_color = ca
    if outline_attr:
        # attribut perso exporté tel quel (pas de conversion d'axes) → déjà en repère Three
        oa = me.attributes.new("_OUTLINE", "FLOAT_VECTOR", "POINT")
        oa.data.foreach_set("vector", O.astype(np.float32).ravel())
    me.validate()
    for m in used:
        me.materials.append(_material(m))
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if arm is not None:
        for b, lst in groups.items():
            vg = obj.vertex_groups.new(name=b)
            for start, w in lst:
                for i, wi in enumerate(w):
                    if wi > 1e-4:
                        vg.add([start + i], float(wi), "REPLACE")
        obj.parent = arm
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = arm
    return obj


# ─── Animation ─────────────────────────────────────────────────────────────────


def _apply_pose(arm: bpy.types.Object, pose: dict, animated_loc: set, animated_scl: set) -> None:
    pbs = arm.pose.bones
    for pb in pbs:
        r = pose["rot"].get(pb.name)
        if r is None:
            pb.rotation_euler = (0, 0, 0)
        else:
            pb.rotation_euler = Euler((r[0] * D2R, r[1] * D2R, r[2] * D2R), "ZXY")
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    if "root" in pbs:
        pbs["root"].location = pose["root"]
        pbs["root"].scale = pose["scale"]
    for b, o in pose.get("loc", {}).items():
        if b in pbs:
            pbs[b].location = o
    for b, s in pose.get("scl", {}).items():
        if b in pbs:
            pbs[b].scale = s


def bake_clips(arm: bpy.types.Object, clips: list[Clip], skip_rot: set | None = None) -> None:
    """Une action par clip, échantillonnée à 30 i/s, rangée sur une piste NLA (export « ACTIONS »)."""
    skip_rot = skip_rot or set()
    ad = arm.animation_data_create()
    for clip in clips:
        n = max(1, round(clip.duration * FPS))
        samples = [clip.fn(1000.0 * clip.duration * i / n) for i in range(n + 1)]
        loc_b = {b for s in samples for b in s.get("loc", {})}
        scl_b = {b for s in samples for b in s.get("scl", {})}
        act = bpy.data.actions.new(clip.name)
        act.use_fake_user = True
        ad.action = act
        for i, pose in enumerate(samples):
            _apply_pose(arm, pose, loc_b, scl_b)
            for pb in arm.pose.bones:
                if pb.name in skip_rot:
                    continue
                if not arm.data.bones[pb.name].use_deform and pb.name not in loc_b and pb.name not in scl_b:
                    continue
                pb.keyframe_insert("rotation_euler", frame=i, group=pb.name)
                if pb.name == "root" or pb.name in loc_b:
                    pb.keyframe_insert("location", frame=i, group=pb.name)
                if pb.name == "root" or pb.name in scl_b:
                    pb.keyframe_insert("scale", frame=i, group=pb.name)
        ad.action = None
        track = ad.nla_tracks.new()
        track.name = clip.name
        strip = track.strips.new(clip.name, 0, act)
        strip.name = clip.name
        track.mute = True
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


# ─── Export ────────────────────────────────────────────────────────────────────


def export(path: Path, animations: bool = True, selection: list | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if selection is not None:
        bpy.ops.object.select_all(action="DESELECT")
        for o in selection:
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=selection is not None,
        export_yup=True,
        export_apply=False,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_attributes=True,
        export_skins=True,
        export_def_bones=False,
        export_animations=animations,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=True,
        export_reset_pose_bones=True,
        export_rest_position_armature=True,
        export_morph=False,
        export_extras=True,
    )
