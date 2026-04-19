import sys
from pathlib import Path

# Ensure `core` and workspace packages resolve when running pytest from `backend/`
_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))
