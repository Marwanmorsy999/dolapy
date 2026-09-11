FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir     torch torchvision --index-url https://download.pytorch.org/whl/cpu &&     pip install --no-cache-dir     "transformers>=4.38.0" Pillow numpy fastapi python-multipart uvicorn

COPY app.py .

ENV HF_HOME=/tmp/hf_cache
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
