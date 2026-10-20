"""Read-only Cycles device probe. Does not render or save user preferences."""
import bpy
import json

result = {"blender": bpy.app.version_string, "backends": {}, "gpu_available": False}
prefs = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = backend
        devices = prefs.get_devices_for_type(backend)
        result["backends"][backend] = [
            {"name": d.name, "type": d.type, "id": d.id} for d in devices
        ]
        if any(d.type == backend for d in devices):
            result["gpu_available"] = True
    except Exception as error:
        result["backends"][backend] = {"error": str(error)}
print("DISTRICT_GPU_PROBE=" + json.dumps(result, sort_keys=True))
if not result["gpu_available"]:
    raise RuntimeError("No viable Cycles GPU device; CPU fallback is forbidden.")
