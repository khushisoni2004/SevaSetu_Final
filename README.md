# SevaSetu

SevaSetu is a full-stack government scheme assistance web application designed to help citizens explore, match, save, and track welfare schemes through a clean multilingual interface. The platform includes scheme discovery, user authentication, saved schemes, profile management, application tracking, document guidance, and voice-based assistance.

## Live Deployment

Frontend: https://seva-setu-final.vercel.app
Backend: https://sevasetu-backend-3ed6.onrender.com


##  Screenshot

![SevaSetu Home Page](frontend/public/images/homepage.png)

## Tech Stack

**Frontend:** React.js, Vite, CSS
**Backend:** FastAPI, Python
**Database:** MongoDB Atlas
**Deployment:** Vercel, Render

## Key Features

* User signup and login
* Multilingual interface
* Government scheme listing and filtering
* Scheme details and eligibility support
* Saved schemes with database sync
* User profile management
* Application tracking
* Voice Seva Bot and form help
* MongoDB Atlas based persistent storage
* Vercel frontend with Render backend integration

## Folder Structure

```text
SevaSetu_Final_With_Data/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── public/
│   │   └── images/
│   ├── src/
│   │   ├── components/
│   │   ├── data/
│   │   ├── i18n/
│   │   ├── utils/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── package-lock.json
│   └── vercel.json
│
├── import_all_raw_schemes_to_mongo.py
├── start-backend.sh
├── start-frontend.sh
└── README.md
```

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/khushisoni2004/SevaSetu_Final.git
cd SevaSetu_Final_With_Data
```

### 2. Run Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

Backend will run on:

```text
http://127.0.0.1:8000
```

### 3. Run Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on:

```text
http://127.0.0.1:5173
```

## Environment Variables

Backend `.env`:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
MONGODB_DB=sevasetu_db
MONGO_URI=your_mongodb_atlas_connection_string
MONGO_DB=sevasetu_db
SECRET_KEY=your_secret_key
ALGORITHM=HS256
```

Frontend `.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

For production, frontend uses Vercel rewrite proxy to connect with the Render backend.

## Deployment

The frontend is deployed on Vercel and the backend is deployed on Render. MongoDB Atlas is used as the cloud database for storing users, schemes, profiles, saved schemes, voice interactions, and application tracker data.

## Project Status

The project is fully connected with frontend, backend, and MongoDB Atlas. Authentication, saved schemes, profile, scheme database, and deployment are working successfully.
