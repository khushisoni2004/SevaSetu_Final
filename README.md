# SevaSetu Final UI + MongoDB Build

Includes polished Indian flag / monument theme, restored SevaSetu logo across home, auth, sidebar, dashboard, schemes, documents and saved pages.

## Run MongoDB
```bash
docker compose up -d
```

## Run backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Run frontend
```bash
cd frontend
npm install
npm run build
npm run dev -- --host 127.0.0.1 --port 5173
```

Open: http://127.0.0.1:5173/

## Features
- Home page with government monument/flag theme.
- Login/signup with Google and OTP placeholders.
- Same SevaSetu logo and dark blue sidebar on app pages.
- Browse schemes with pagination/load more.
- Scheme details with 15px title and official site link box.
- Saved schemes with MongoDB save/delete and local fallback.
- Documents Hub with official site links.
- 25+ language dropdown support.

## Data
This package contains `frontend/src/data/sevasetuImportedSchemes.json` and `data/schemes.json` with 3406 scheme records.
