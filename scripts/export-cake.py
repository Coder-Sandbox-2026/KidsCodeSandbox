from pathlib import Path
from collections import defaultdict
from mathutils import Vector
import bpy
import os
import shutil

ROOT = Path(__file__).resolve().parents[1]
BLEND = Path(os.environ.get("KIDSCODE_BLEND", str(ROOT / "src" / "assets" / "KidsCodeItems.blend")))
OUT = ROOT / "src" / "assets" / "model" / "Cake.glb"
COPY = ROOT / "src" / "assets" / "Cake.glb"

if bpy.data.objects.get("Cake") is None:
    if not BLEND.exists():
        raise SystemExit(
            "No Cake object is loaded and no blend file was found at "
            f"{BLEND}. Pass the .blend to Blender, or set KIDSCODE_BLEND."
        )
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))

obj = bpy.data.objects.get("Cake")
if not obj:
    raise SystemExit("No Cake object in the blend file")

mat = bpy.data.materials.get("ATLAS_Cake_MATERIAL_256")
if mat:
    if hasattr(mat, "blend_method"):
        try:
            mat.blend_method = "OPAQUE"
        except TypeError:
            pass
    if hasattr(mat, "surface_render_method"):
        try:
            mat.surface_render_method = "DITHERED"
        except TypeError:
            pass
    mat.use_backface_culling = True

    if mat.node_tree:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf:
            alpha = bsdf.inputs.get("Alpha")
            if alpha:
                for link in list(alpha.links):
                    mat.node_tree.links.remove(link)
                alpha.default_value = 1.0
            # Drop the unused flat normal map so Three.js uses mesh normals.
            nrm = bsdf.inputs.get("Normal")
            if nrm:
                for link in list(nrm.links):
                    mat.node_tree.links.remove(link)

# Average split-vertex normals by position so the atlased mesh can shade smooth.
mesh = obj.data
acc = defaultdict(lambda: Vector((0.0, 0.0, 0.0)))
for vert in mesh.vertices:
    key = (round(vert.co.x, 5), round(vert.co.y, 5), round(vert.co.z, 5))
    acc[key] += vert.normal
smooth = []
for vert in mesh.vertices:
    key = (round(vert.co.x, 5), round(vert.co.y, 5), round(vert.co.z, 5))
    n = acc[key]
    if n.length_squared > 0:
        n = n.normalized()
    else:
        n = vert.normal.copy()
    smooth.append(n)
mesh.normals_split_custom_set_from_vertices(smooth)

bpy.ops.object.select_all(action="DESELECT")
obj.hide_set(False)
obj.select_set(True)
for child in obj.children:
    child.hide_set(False)
    child.hide_render = False
    child.select_set(True)
bpy.context.view_layer.objects.active = obj

os.makedirs(OUT.parent, exist_ok=True)

kwargs = dict(
    filepath=str(OUT),
    check_existing=False,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_extras=True,
)
# Blender 5 renamed some flags; keep only supported ones.
rna = bpy.ops.export_scene.gltf.get_rna_type()
supported = set(rna.properties.keys())
kwargs = {k: v for k, v in kwargs.items() if k in supported or k in {"filepath", "check_existing"}}
if "export_image_format" in supported:
    kwargs["export_image_format"] = "AUTO"
if "export_keep_originals" in supported:
    kwargs["export_keep_originals"] = False
if "export_yup" in supported:
    kwargs["export_yup"] = True
if "export_unused_images" in supported:
    kwargs["export_unused_images"] = False
if "export_unused_textures" in supported:
    kwargs["export_unused_textures"] = False

bpy.ops.export_scene.gltf(**kwargs)

shutil.copy2(OUT, COPY)
print("Exported", OUT, "bytes", OUT.stat().st_size)
