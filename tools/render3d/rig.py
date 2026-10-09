"""Construction de personnages 3D low-poly articulés (pièces rigides parentées à des articulations).

Méthode Dead Cells : pas de skinning, des pièces simples (sphères, cylindres, boîtes arrondies)
accrochées à des « os » (Empties). Une pose = des rotations d'articulations ; on la pose, on rend.
Unités : mètres. Le personnage regarde vers -Y (vers la caméra) ; les pieds sont à l'origine.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import bpy
from mathutils import Euler, Vector


@dataclass
class Character:
    root: bpy.types.Object
    joints: dict[str, bpy.types.Object] = field(default_factory=dict)
    parts: list[tuple[bpy.types.Object, int]] = field(default_factory=list)
    rest: dict[str, Vector] = field(default_factory=dict)

    def joint(self, name: str) -> bpy.types.Object:
        return self.joints[name]

    def reset_pose(self) -> None:
        self.root.location = (0, 0, 0)
        for name, j in self.joints.items():
            j.rotation_euler = (0, 0, 0)
            j.location = self.rest[name]
            j.scale = (1, 1, 1)

    def pose(self, rotations: dict[str, tuple[float, float, float]], root_offset: tuple[float, float, float] = (0, 0, 0), facing_deg: float = 0.0, offsets: dict[str, tuple[float, float, float]] | None = None, scales: dict[str, tuple[float, float, float]] | None = None) -> None:
        """Rotations en degrés (x, y, z) par articulation ; `facing_deg` tourne tout le personnage autour de Z."""
        self.reset_pose()
        self.root.rotation_euler = (0, 0, math.radians(facing_deg))
        self.root.location = root_offset
        for name, (rx, ry, rz) in rotations.items():
            if name in self.joints:
                self.joints[name].rotation_euler = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), "XYZ")
        for name, (dx, dy, dz) in (offsets or {}).items():
            if name in self.joints:
                r = self.rest[name]
                self.joints[name].location = (r.x + dx, r.y + dy, r.z + dz)
        for name, s in (scales or {}).items():
            if name in self.joints:
                self.joints[name].scale = s
        bpy.context.view_layer.update()

    def set_visible(self, part_names: list[str], visible: bool) -> None:
        for obj, _ in self.parts:
            if obj.name.split(".")[0] in part_names:
                obj.hide_render = not visible


class Builder:
    """Assemble un personnage : articulations puis pièces attachées."""

    def __init__(self, name: str):
        self.sc = bpy.context.scene
        root = bpy.data.objects.new(f"{name}_root", None)
        self.sc.collection.objects.link(root)
        self.char = Character(root=root)

    def joint(self, name: str, parent: str | None, loc: tuple[float, float, float]) -> "Builder":
        j = bpy.data.objects.new(name, None)
        self.sc.collection.objects.link(j)
        j.parent = self.char.root if parent is None else self.char.joints[parent]
        j.location = loc
        j.rotation_mode = "XYZ"
        self.char.joints[name] = j
        self.char.rest[name] = Vector(loc)
        return self

    def _attach(self, obj: bpy.types.Object, joint: str, mid: int) -> bpy.types.Object:
        obj.parent = self.char.joints[joint]
        self.char.parts.append((obj, mid))
        return obj

    def _new_mesh_obj(self, name: str) -> bpy.types.Object:
        obj = bpy.context.active_object
        obj.name = name
        # Ombrage lisse : bandes de lumière propres une fois quantifiées.
        for poly in obj.data.polygons:
            poly.use_smooth = True
        return obj

    def sphere(self, name: str, joint: str, mid: int, loc: tuple[float, float, float], scale: tuple[float, float, float], segments: int = 16) -> bpy.types.Object:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=1.0)
        obj = self._new_mesh_obj(name)
        obj.scale = scale
        obj.location = loc
        return self._attach(obj, joint, mid)

    def capsule(self, name: str, joint: str, mid: int, start: tuple[float, float, float], end: tuple[float, float, float], radius: float, radius_end: float | None = None) -> bpy.types.Object:
        """Cylindre arrondi d'un point à un autre (membres)."""
        a, b = Vector(start), Vector(end)
        d = b - a
        length = d.length
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=radius_end if radius_end is not None else radius, depth=length)
        obj = self._new_mesh_obj(name)
        obj.location = (a + b) / 2
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
        cap = self._attach(obj, joint, mid)
        # Embouts sphériques.
        r_end = radius_end if radius_end is not None else radius
        self.sphere(f"{name}_a", joint, mid, tuple(a), (radius, radius, radius), 10)
        self.sphere(f"{name}_b", joint, mid, tuple(b), (r_end, r_end, r_end), 10)
        return cap

    def box(self, name: str, joint: str, mid: int, loc: tuple[float, float, float], size: tuple[float, float, float], bevel: float = 0.04, rot: tuple[float, float, float] = (0, 0, 0)) -> bpy.types.Object:
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        obj = self._new_mesh_obj(name)
        obj.scale = size
        obj.location = loc
        obj.rotation_euler = tuple(math.radians(v) for v in rot)
        if bevel > 0:
            mod = obj.modifiers.new("bevel", "BEVEL")
            mod.width = bevel
            mod.segments = 3
            mod.affect = "EDGES"
        return self._attach(obj, joint, mid)

    def cylinder(self, name: str, joint: str, mid: int, loc: tuple[float, float, float], radius: float, depth: float, rot: tuple[float, float, float] = (0, 0, 0), vertices: int = 14) -> bpy.types.Object:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
        obj = self._new_mesh_obj(name)
        obj.location = loc
        obj.rotation_euler = tuple(math.radians(v) for v in rot)
        return self._attach(obj, joint, mid)

    def arc(self, name: str, joint: str, mid: int, radius: float, width: float, start_deg: float, end_deg: float, z: float = 0.0, thickness: float = 0.02, taper: bool = True, plane: str = "xy") -> bpy.types.Object:
        """Bande courbe (smear d'un coup), de start à end (degrés). Plan « xy » (horizontal) ou « yz » (vertical, devant)."""
        mesh = bpy.data.meshes.new(name)
        verts, faces = [], []
        steps = 14
        for i in range(steps + 1):
            t = i / steps
            a = math.radians(start_deg + (end_deg - start_deg) * t)
            w = width * (t if taper else 1.0)
            for r in (radius - w / 2, radius + w / 2):
                if plane == "yz":
                    verts.append((z, math.cos(a) * r, math.sin(a) * r))
                else:
                    verts.append((math.cos(a) * r, math.sin(a) * r, z))
        for i in range(steps):
            k = i * 2
            faces.append((k, k + 1, k + 3, k + 2))
        mesh.from_pydata(verts, [], faces)
        obj = bpy.data.objects.new(name, mesh)
        self.sc.collection.objects.link(obj)
        mod = obj.modifiers.new("solid", "SOLIDIFY")
        mod.thickness = thickness
        return self._attach(obj, joint, mid)

    def build(self) -> Character:
        return self.char
