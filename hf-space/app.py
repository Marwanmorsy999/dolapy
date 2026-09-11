import spaces
import torch
from PIL import Image
from transformers import pipeline
import io, base64, numpy as np
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import gradio as gr

pipe = None

def load_model():
    global pipe
    if pipe is None:
        pipe = pipeline(
            "image-segmentation",
            model="briaai/RMBG-2.0",
            trust_remote_code=True,
            device="cuda" if torch.cuda.is_available() else "cpu"
        )
    return pipe

# Pre-load on startup
try:
    load_model()
except Exception as e:
    print(f"Model pre-load deferred: {e}")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["*"],
)

@spaces.GPU(duration=30)
def remove_background(image: Image.Image) -> Image.Image:
    model = load_model()
    result = model(image, return_tensors=False)
    entry = result[0] if isinstance(result, list) else result
    mask = entry.get("mask") or entry.get("score")
    if mask is None:
        raise ValueError("Model returned no mask")
    if not isinstance(mask, Image.Image):
        mask = Image.fromarray((np.array(mask) * 255).astype(np.uint8))
    output = image.convert("RGBA")
    mask_l = mask.convert("L").resize(output.size, Image.LANCZOS)
    r, g, b, a = output.split()
    output = Image.merge("RGBA", (r, g, b, mask_l))
    return output

@app.post("/remove-bg")
async def remove_bg_endpoint(request: Request):
    content_type = request.headers.get("content-type", "")
    try:
        if "multipart" in content_type:
            form = await request.form()
            image_file = form.get("image")
            if not image_file:
                return Response(content='{"error":"no image field"}', status_code=400, media_type="application/json")
            image_bytes = await image_file.read()
        elif "json" in content_type:
            body = await request.json()
            b64 = body.get("image", "")
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            image_bytes = base64.b64decode(b64)
        else:
            image_bytes = await request.body()
        if not image_bytes:
            return Response(content='{"error":"empty"}', status_code=400, media_type="application/json")
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        result = remove_background(image)
        buf = io.BytesIO()
        result.save(buf, format="PNG", optimize=False)
        buf.seek(0)
        return Response(
            content=buf.read(), media_type="image/png",
            headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-store"}
        )
    except Exception as e:
        return Response(content=f'{{"error":"{str(e)}"}}', status_code=500, media_type="application/json")

@app.get("/health")
async def health():
    return {"status": "ok", "model": "briaai/RMBG-2.0", "gpu": torch.cuda.is_available()}

def gradio_fn(image):
    if image is None:
        return None
    return remove_background(image)

demo = gr.Interface(
    fn=gradio_fn,
    inputs=gr.Image(type="pil", label="Garment photo"),
    outputs=gr.Image(type="pil", label="Background removed", image_mode="RGBA"),
    title="Dolapy — Background Removal",
    description="RMBG-2.0 | POST /remove-bg for API access",
    allow_flagging="never",
)

app = gr.mount_gradio_app(app, demo, path="/")
