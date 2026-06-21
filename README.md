# SevaSetu – AI-Powered Government Scheme Assistance Platform

SevaSetu is a full-stack web application designed to help Indian citizens discover, understand, save, and track government welfare schemes in a simple and accessible way. The platform focuses on multilingual support, voice-based assistance, document guidance, application tracking, and MongoDB-backed user data storage.

## Overview

Many citizens face difficulty finding suitable government schemes due to scattered information, complex eligibility rules, language barriers, and lack of document clarity. SevaSetu solves this problem by providing a user-friendly digital platform where users can search schemes, receive AI-assisted recommendations, save useful schemes, track application progress, and get voice-based help for filling basic profile and document details.

The project is especially useful for students, farmers, women, senior citizens, rural users, and citizens who need simple guidance for government services.

## Key Features

* AI-powered government scheme discovery
* Search and filter across 3000+ government schemes
* Multilingual interface with English and Hindi support
* Voice Seva Bot for scheme-related queries
* Voice Form Help for rural, senior, and less digitally literate users
* Application Journey Tracker for tracking scheme application progress
* Saved Schemes feature for bookmarking important schemes
* User authentication and profile management
* Document requirement guidance
* MongoDB storage for users, profiles, saved schemes, voice data, and application tracking
* Clean responsive frontend UI
* FastAPI backend with REST APIs
* Ready for deployment on Render, Vercel, and MongoDB Atlas

## Tech Stack

### Frontend

* React.js
* Vite
* JavaScript
* CSS
* Lucide React Icons
* Browser Speech Recognition and Speech Synthesis APIs
* LocalStorage for offline-friendly temporary state

### Backend

* Python
* FastAPI
* Uvicorn
* MongoDB
* Motor / PyMongo
* JWT-based authentication
* REST API architecture

### Database

* MongoDB local during development
* MongoDB Atlas for production deployment

## Main Modules

### 1. Home Page

The landing page introduces SevaSetu as a citizen-focused scheme assistance platform with a modern government-service inspired design.

### 2. Authentication

Users can sign up, log in, and maintain a profile. User data is stored in MongoDB.

### 3. Scheme Discovery

Users can search and explore a large dataset of government schemes. The platform supports scheme matching based on state, category, beneficiary type, and other eligibility-related fields.

### 4. Saved Schemes

Users can save useful schemes for later reference. Saved schemes are stored in MongoDB.

### 5. Voice Seva Bot

The Voice Seva Bot allows users to ask scheme-related questions using text or voice. It helps users find suitable schemes and understand basic eligibility or document requirements.

### 6. Voice Form Help

Voice Form Help is designed for rural users, senior citizens, and less digitally literate citizens. It asks simple Hindi voice questions and helps collect profile details and document availability.

### 7. Application Journey Tracker

Users can track scheme application progress, required documents, pending steps, applied status, and personal notes.

### 8. MongoDB Data Storage

The backend stores real user-related data in MongoDB collections such as users, profiles, saved_schemes, voice_profiles, voice_interactions, application_tracker, and frontend_sync_logs.

## Project Structure

```text
SevaSetu_Final_With_Data/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── data/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── datasets/
├── data/
├── README.md
└── .gitignore
```

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/khushisoni2004/SevaSetu_Final.git
cd SevaSetu_Final
```

### 2. Start MongoDB Using Docker

```bash
docker rm -f sevasetu-mongo 2>/dev/null || true

docker run -d \
  --name sevasetu-mongo \
  -p 27017:27017 \
  mongo:7
```

### 3. Start Backend

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

uvicorn main:app --host 127.0.0.1 --port 8000
```

Backend will run at:

```text
http://127.0.0.1:8000
```

### 4. Start Frontend

Open a new terminal:

```bash
cd frontend

npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend will run at:

```text
http://127.0.0.1:5173
```

## Important Local URLs

```text
Home Page:              http://127.0.0.1:5173/
Dashboard:              http://127.0.0.1:5173/app/dashboard
Schemes:                http://127.0.0.1:5173/app/schemes
Voice Bot:              http://127.0.0.1:5173/app/voice-bot
Voice Form Help:        http://127.0.0.1:5173/app/voice-form-help
Application Tracker:    http://127.0.0.1:5173/app/applications
Backend API:            http://127.0.0.1:8000
MongoDB:                mongodb://localhost:27017
```

## MongoDB Collections

The project uses MongoDB to store real user and interaction data. Important collections include:

```text
users
profiles
saved_schemes
schemes
voice_profiles
voice_interactions
application_tracker
frontend_sync_logs
```

## Import Scheme Dataset to MongoDB

If you want to import the 3000+ scheme dataset into MongoDB:

```bash
cd frontend

docker cp src/data/sevasetuImportedSchemes.json sevasetu-mongo:/tmp/sevasetuImportedSchemes.json

docker exec -it sevasetu-mongo mongoimport \
  --db sevasetu_db \
  --collection schemes \
  --file /tmp/sevasetuImportedSchemes.json \
  --jsonArray
```

Check count:

```bash
docker exec -it sevasetu-mongo mongosh sevasetu_db --eval "db.schemes.countDocuments()"
```

## Backend API Summary Check

```bash
curl http://127.0.0.1:8000/api/database/summary
```

## Deployment Plan

### Backend Deployment

Recommended platform: Render

Render settings:

```text
Root Directory: backend
Runtime: Python
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Environment variables:

```text
MONGODB_URI = your MongoDB Atlas connection string
MONGODB_DB = sevasetu_db
```

### Frontend Deployment

Recommended platform: Vercel

Vercel settings:

```text
Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Environment variable:

```text
VITE_API_URL = your Render backend URL
```

## Future Enhancements

* Advanced AI-based eligibility scoring
* More accurate multilingual scheme matching
* Admin dashboard for scheme management
* Document upload and verification workflow
* Real-time application status updates
* Integration with official government APIs
* More regional Indian language support
* Improved analytics dashboard for citizens

## Author

Khushi Soni
B.Tech Information Technology
Shri G. S. Institute of Technology and Science, Indore

## License

This project is created for academic, learning, and portfolio purposes.
