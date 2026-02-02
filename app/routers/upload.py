from fastapi import APIRouter

router = APIRouter(prefix="/upload", tags=["upload"])


@router.get("/ping")
def ping():
    return {"ok": True, "module": "upload"}
