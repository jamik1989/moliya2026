from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/ping")
def ping():
    return {"ok": True, "module": "analytics"}
