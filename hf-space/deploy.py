import os, time, traceback
from huggingface_hub import HfApi

token = os.environ.get("HF_TOKEN", "")
print(f"Token: {token[:15]}...", flush=True)

api = HfApi(token=token)
repo_id = "Marwanmorsy999/dolapy-rmbg"

print("--- delete ---", flush=True)
try:
    api.delete_repo(repo_id=repo_id, repo_type="space")
    print("Deleted", flush=True)
    time.sleep(5)
except Exception as e:
    print(f"delete exc: {type(e).__name__}: {e}", flush=True)

print("--- create ---", flush=True)
try:
    r = api.create_repo(repo_id=repo_id, repo_type="space", space_sdk="gradio", private=False, exist_ok=True)
    print(f"created: {r}", flush=True)
    time.sleep(3)
except Exception as e:
    print(f"create exc: {type(e).__name__}: {e}", flush=True)
    traceback.print_exc()

print("--- upload README ---", flush=True)
try:
    r = api.upload_file(path_or_fileobj="hf-space/README.md", path_in_repo="README.md", repo_id=repo_id, repo_type="space")
    print(f"readme ok: {r}", flush=True)
except Exception as e:
    print(f"readme exc: {type(e).__name__}: {e}", flush=True)
    traceback.print_exc()

print("--- upload requirements ---", flush=True)
try:
    r = api.upload_file(path_or_fileobj="hf-space/requirements.txt", path_in_repo="requirements.txt", repo_id=repo_id, repo_type="space")
    print(f"reqs ok: {r}", flush=True)
except Exception as e:
    print(f"reqs exc: {type(e).__name__}: {e}", flush=True)
    traceback.print_exc()

print("--- upload app.py ---", flush=True)
try:
    r = api.upload_file(path_or_fileobj="hf-space/app.py", path_in_repo="app.py", repo_id=repo_id, repo_type="space")
    print(f"app ok: {r}", flush=True)
except Exception as e:
    print(f"app exc: {type(e).__name__}: {e}", flush=True)
    traceback.print_exc()

print("--- done ---", flush=True)
