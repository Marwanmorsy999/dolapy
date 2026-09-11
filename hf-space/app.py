import torch
from PIL import Image
from transformers import pipeline
import io, base64, numpy as np
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import gradio as gr

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[Dolapy] Loading RMBG-2.0 on {device}...")
pipe = pipeline(
    "image-segmentation",
    model="briaai/RMBG-2.0",
    trust_remote_code=True,
    device=device
)
print("[Dolapy] Ready.")

def _remove_bg(image: Image.Image) -> Image.Image:
    result = pipe(image, return_tensors=False)
    entry = result[0] if isinstance(result, list) else result
    mask = entry.get("mask") or entry.get("score")
    if mask is None:
        raise ValueError("No mask returned")
    if not isinstance(mask, Image.Image):
        mask = Image.fromarray((np.array(mask) * 255).astype(np.uint8))
    out = image.convert("RGBA")
    mask_l = mask.convert("L").resize(out.size, Image.LANCZOS)
    r, g, b, a = out.split()
    return Image.merge("RGBA", (r, g, b, mask_l))

# Build FastAPI app first — routes registered here take priority
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"],
    allow_methods=["POST","OPTIONS","GET"], allow_headers=["*"])

@app.post("/remove-bg")
async def remove_bg(request: Request):
    content_type = request.headers.get("content-type", "")
    try:
        if "multipart" in content_type:
            form = await request.form()
            f = form.get("image")
            if not f:
                return JSONResponse({"error": "no image field"}, status_code=400)
            image_bytes = await f.read()
        elif "json" in content_type:
            body = await request.json()
            b64 = body.get("image", "")
            if "," in b64: b64 = b64.split(",", 1)[1]
            image_bytes = base64.b64decode(b64)
        else:
            image_bytes = await request.body()
        if not image_bytes:
            return JSONResponse({"error": "empty"}, status_code=400)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        result = _remove_bg(image)
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        buf.seek(0)
        return Response(content=buf.read(), media_type="image/png",
            headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-store"})
    except Exception as e:
        import traceback; traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/health")
async def health():
    return {"status": "ok", "model": "briaai/RMBG-2.0", "device": device}

# Gradio UI — mounted at /ui so it does NOT override /remove-bg or /health
# HF Spaces with gradio SDK requires a Gradio app to be present
def gradio_fn(image):
    if image is None: return None
    return _remove_bg(image)

with gr.Blocks(title="Dolapy RMBG") as demo:
    gr.Markdown("## Dolapy Background Removal\nAPI: `POST /remove-bg` | `GET /health`")
    with gr.Row():
        inp = gr.Image(type="pil", label="Input")
        out = gr.Image(type="pil", label="Output", image_mode="RGBA")
    btn = gr.Button("Remove Background")
    btn.click(gradio_fn, inputs=inp, outputs=out)

# Mount at /ui — FastAPI owns /remove-bg and /health
app = gr.mount_gradio_app(app, demo, path="/ui")

# trigger
