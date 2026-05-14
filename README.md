# AttendIQ — Automated Student Attendance System

A full-stack Next.js 14 attendance monitoring system with QR code and facial recognition attendance marking.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
```
Then edit `.env.local` and fill in:
- `MONGODB_URI` — your MongoDB Atlas connection string
- `JWT_SECRET` — any long random string (e.g. run `openssl rand -base64 32`)
- `NEXT_PUBLIC_APP_URL` — your app URL (use `http://localhost:3000` for local dev)

### 3. Download face-api.js model files
Download all files from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Place them in `public/models/`. You need these files:
```
public/models/
  ssd_mobilenetv1_model-weights_manifest.json
  ssd_mobilenetv1_model-shard1
  face_landmark_68_model-weights_manifest.json
  face_landmark_68_model-shard1
  face_recognition_model-weights_manifest.json
  face_recognition_model-shard1
```

### 4. Run the app
```bash
npm run dev       # development
npm run build     # production build
npm start         # production server
```

### 5. First-time setup
1. Open `http://localhost:3000/register`
2. Create your teacher account (only one allowed)
3. Go to **Sections** → create sections (e.g. BSCS-3A)
4. Go to **Students** → add students with photos
5. Click **Train face** on each student to enable facial recognition
6. Use **QR Attendance** or **Face Recognition** to mark attendance

---

## Features

- **QR Code Attendance** — teacher generates a time-limited QR code; students scan with phone and enter their student ID
- **Facial Recognition** — teacher opens webcam; face-api.js auto-detects and marks students present in real time
- **Manual Marking** — fallback for students without face data
- **Analytics Dashboard** — attendance trends, per-student breakdown, method stats
- **PDF & Excel Export** — download reports for any section/period
- **Low Attendance Alerts** — students below 75% flagged automatically

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Next.js 14 (App Router)             |
| Database    | MongoDB Atlas + Mongoose            |
| Auth        | JWT + bcryptjs                      |
| Face AI     | face-api.js (TensorFlow.js, browser)|
| QR Code     | react-qr-code + uuid                |
| Charts      | Recharts                            |
| PDF Export  | jsPDF + jspdf-autotable             |
| Excel Export| xlsx                                |
| Styling     | Tailwind CSS + inline styles        |

---

## Project Structure

```
attendiq/
├── app/
│   ├── (auth)/          login, register pages
│   ├── (dashboard)/     protected pages (dashboard, sections, students, attendance, analytics)
│   ├── api/             all API routes
│   └── scan/[token]/    public QR scan page (no login needed)
├── components/
│   ├── layout/          Sidebar
│   ├── ui/              Card, Button, Modal, Badge, etc.
│   └── attendance/      FaceTrainer
├── lib/                 db.js, auth.js, api.js, AuthContext.js
├── middleware/          JWT auth middleware
├── models/              Mongoose schemas
└── public/models/       face-api.js weight files (you must download)
```

---

## MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Create a database user with read/write access
4. Get your connection string and paste into `.env.local`
5. Whitelist your IP (or use 0.0.0.0/0 for development)

---

## Face Recognition Notes

- face-api.js runs entirely in the **browser** — no server-side ML needed
- For best results: use clear, front-facing photos with good lighting
- The recognition threshold is set to **0.5** (lower = stricter matching)
- Students must be **trained** before face recognition can identify them
- Model files are ~6MB total and load once per browser session
