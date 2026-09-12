import os, time, traceback, sys
from huggingface_hub import HfApi

token = os.environ.get("HF_TOKEN", "")
print(f"Token: {token[:15]}...", flush=True)

api = HfApi(token=token)
repo_id = "Marwanmorsy999/dolapy-rmbg"

print("--- delete (clean slate) ---", flush=True)
try:
    api.delete_repo(repo_id=repo_id, repo_type="space")
    print("Deleted OK", flush=True)
    time.sleep(5)
except Exception as e:
    print(f"Delete: {type(e).__name__}: {e}", flush=True)

print("--- create ---", flush=True)
try:
    r = api.create_repo(repo_id=repo_id, repo_type="space", space_sdk="gradio", private=False, exist_ok=True)
    print(f"Created: {r}", flush=True)
    time.sleep(3)
except Exception as e:
    print(f"Create error: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)

print("--- uploading files ---", flush=True)
success = True
for local, remote in [
    ("hf-space/README.md", "README.md"),
    ("hf-space/requirements.txt", "requirements.txt"),
    ("hf-space/app.py", "app.py"),
]:
    try:
        url = api.upload_file(path_or_fileobj=local, path_in_repo=remote,
            repo_id=repo_id, repo_type="space")
        print(f"OK: {remote}", flush=True)
    except Exception as e:
        print(f"FAIL {remote}: {type(e).__name__}: {e}", flush=True)
        traceback.print_exc()
        success = False

if not success:
    sys.exit(1)

print("=== DONE ===", flush=True)
print("Space: https://huggingface.co/spaces/Marwanmorsy999/dolapy-rmbg", flush=True)
print("API:   https://marwanmorsy999-dolapy-rmbg.hf.space/remove-bg", flush=True)
