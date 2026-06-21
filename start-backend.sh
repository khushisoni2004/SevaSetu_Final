#!/bin/bash
cd "$(dirname "$0")"

echo "Starting MongoDB..."
docker start sevasetu-mongo >/dev/null 2>&1 || docker run -d --name sevasetu-mongo -p 27017:27017 mongo:7 >/dev/null

echo "Installing backend dependencies..."
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

echo "Starting SevaSetu backend at http://127.0.0.1:8000"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
