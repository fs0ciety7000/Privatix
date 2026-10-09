"""Scène Blender et rendu des passes (matières, lumière, normales) en basse résolution, sans lissage.

Méthode Dead Cells : un modèle 3D rendu directement à la taille du sprite, puis converti en pixel art
par post.py. Trois rendus par frame, tous en EXR flottant pour garder des valeurs exactes :
  - id      : chaque matière émet une couleur unique (1 échantillon, filtre minimal → bords nets) ;
  - light   : tout en blanc mat, éclairé (clé haut-gauche, contre-jour, ambiance) ;
  - normal  : normales en espace caméra, encodées 0..1.
"""
from __future__ import annotations

import math
import os
import tempfile

import bpy
import numpy as np

TMP = tempfile.mkdtemp(prefix="render3d_")


def reset_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "OPEN_EXR"
    sc.render.image_settings.color_depth = "32"
    sc.render.use_persistent_data = True
    sc.world = bpy.data.worlds.new("world")
    sc.world.use_nodes = True
    return sc


def setup_camera(sc: bpy.types.Scene, size: int, px_per_unit: float, pivot: tuple[int, int], elevation_deg: float = 40.0) -> bpy.types.Object:
    """Caméra orthographique vue de dessus 3/4. Le pied (origine du monde) tombe sur le pixel `pivot`."""
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.pixel_aspect_x = 1
    sc.render.pixel_aspect_y = 1
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size / px_per_unit
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    el = math.radians(elevation_deg)
    dist = 20.0
    # La caméra regarde vers +Y (le « haut » de l'écran est le fond de la scène).
    cam.location = (0.0, -dist * math.cos(el), dist * math.sin(el))
    cam.rotation_euler = (math.pi / 2 - el, 0.0, 0.0)
    # Décalage optique : l'origine du monde doit tomber sur le pixel pivot.
    cam_data.shift_x = (0.5 - (pivot[0] + 0.5) / size)
    cam_data.shift_y = ((pivot[1] + 0.5) / size - 0.5)
    sc.camera = cam
    return cam


def emission_material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


def light_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("light_white")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bs = nt.nodes.new("ShaderNodeBsdfDiffuse")
    bs.inputs["Color"].default_value = (0.8, 0.8, 0.8, 1.0)
    nt.links.new(bs.outputs["BSDF"], out.inputs["Surface"])
    return mat


def normal_material() -> bpy.types.Material:
    """Émission = normale en espace caméra × 0,5 + 0,5 (convention OpenGL : x droite, y haut, z vers la caméra)."""
    mat = bpy.data.materials.new("normal_cam")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    vt = nt.nodes.new("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"
    vt.convert_from = "WORLD"
    vt.convert_to = "CAMERA"
    # Espace caméra Blender : x droite, y haut, -z vers l'avant → on inverse z pour « vers la caméra ».
    mul = nt.nodes.new("ShaderNodeVectorMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = (0.5, 0.5, -0.5)
    add = nt.nodes.new("ShaderNodeVectorMath")
    add.operation = "ADD"
    add.inputs[1].default_value = (0.5, 0.5, 0.5)
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(geo.outputs["Normal"], vt.inputs["Vector"])
    nt.links.new(vt.outputs["Vector"], mul.inputs[0])
    nt.links.new(mul.outputs["Vector"], add.inputs[0])
    nt.links.new(add.outputs["Vector"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


def setup_lights(sc: bpy.types.Scene) -> list[bpy.types.Object]:
    """Clé chaude haut-gauche, contre-jour froid bas-droite, ambiance faible (pour la passe « light »)."""
    lights = []

    def add(name: str, kind: str, energy: float, rot: tuple[float, float, float], angle: float = 0.3) -> None:
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        if kind == "SUN":
            data.angle = angle
        obj = bpy.data.objects.new(name, data)
        obj.rotation_euler = rot
        sc.collection.objects.link(obj)
        lights.append(obj)

    add("key", "SUN", 3.2, (math.radians(40), math.radians(-35), math.radians(-30)))
    add("fill", "SUN", 0.6, (math.radians(70), math.radians(40), math.radians(150)))
    bg = sc.world.node_tree.nodes["Background"]
    bg.inputs["Strength"].default_value = 0.0
    return lights


def _set_world(sc: bpy.types.Scene, strength: float) -> None:
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = strength
    sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)


def _render(sc: bpy.types.Scene, name: str, samples: int) -> np.ndarray:
    sc.cycles.samples = samples
    sc.cycles.filter_width = 0.01
    path = os.path.join(TMP, f"{name}.exr")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    return arr


class PassRenderer:
    """Rend les trois passes d'une pose, en échangeant les matériaux des objets."""

    def __init__(self, sc: bpy.types.Scene, objects: list[tuple[bpy.types.Object, int]]):
        self.sc = sc
        self.objects = objects
        self.id_mats: dict[int, bpy.types.Material] = {}
        for _, mid in objects:
            if mid not in self.id_mats:
                self.id_mats[mid] = emission_material(f"id_{mid}", (mid / 255.0, 0.0, 0.0))
        self.light_mat = light_material()
        self.normal_mat = normal_material()
        self.lights = setup_lights(sc)

    def _assign(self, which: str) -> None:
        for obj, mid in self.objects:
            mat = self.id_mats[mid] if which == "id" else self.light_mat if which == "light" else self.normal_mat
            obj.data.materials.clear()
            obj.data.materials.append(mat)
            obj.visible_shadow = which == "light"

    def render(self) -> dict[str, np.ndarray]:
        sc = self.sc
        out: dict[str, np.ndarray] = {}
        for l in self.lights:
            l.hide_render = True
        _set_world(sc, 0.0)
        self._assign("id")
        out["id"] = _render(sc, "id", 1)
        self._assign("normal")
        out["normal"] = _render(sc, "normal", 1)
        for l in self.lights:
            l.hide_render = False
        _set_world(sc, 0.25)
        self._assign("light")
        out["light"] = _render(sc, "light", 24)
        return out
