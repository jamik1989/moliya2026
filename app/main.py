from fastapi import FastAPI

from app.routers import auth, upload, analytics

app = FastAPI(title="ABC Moliya Dinamikasi")

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(analytics.router)


@app.get("/")
def healthcheck():
    return {"status": "ok"}
