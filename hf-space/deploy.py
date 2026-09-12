import os, time, traceback, sys
from huggingface_hub import HfApi

token = os.environ.get("HF_TOKEN", "")
print(f"Token prefix: {token[:12]}...")

api = HfApi(token=token)
repo_id = "Marwanmorsy999/dolapy-rmbg"

print("=== Deleting existing space ===")
try:
    api.delete_repo(repo_id=repo_id, repo_type="space")
    print("Deleted OK")
    time.sleep(5)
except Exception as e:
    print(f"Delete result: {e}")

print("=== Creating fresh space ===")
try:
    info = api.create_repo(
        repo_id=repo_id,
        repo_type="space",
        space_sdk="gradio",
        private=False,
        exist_ok=True
    )
    print(f"Created: {info}")
    time.sleep(3)
except Exception as e:
    print(f"Create error: {e}")
    traceback.print_exc()
    sys.exit(1)

print("=== Uploading files ===")
files = [
    ("hf-space/README.md", "README.md"),
    ("hf-space/requirements.txt", "requirements.txt"),
    ("hf-space/app.py", "app.py"),
]

success = True
for local, remote in files:
    try:
        url = api.upload_file(
            path_or_fileobj=local,
            path_in_repo=remote,
            repo_id=repo_id,
            repo_type="space",
        )
        print(f"OK: {remote} -> {url}")
    except Exception as e:
        print(f"FAIL: {remote}: {e}")
        traceback.print_exc()
        success = False

if success:
    print("=== All files uploaded ===")
    print("Space: https://huggingface.co/spaces/Marwanmorsy999/dolapy-rmbg")
    print("API: https://marwanmorsy999-dolapy-rmbg.hf.space/remove-bg")
else:
    sys.exit(1)
