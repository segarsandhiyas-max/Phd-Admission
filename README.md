# PhD Scholar Registration System

A comprehensive web application for PhD scholar registration at Puducherry Technological University.

## Tech Stack

### Frontend
- React 18
- Vite
- Axios for API calls
- Responsive CSS with gradient design

### Backend
- Python FastAPI
- Motor (Async MongoDB driver)
- Pydantic for data validation
- File upload support

### Database
- MongoDB Atlas

## Features

✅ **7-Step Registration Process:**
1. Personal Details
2. Undergraduate (UG) Academic Details
3. Postgraduate (PG) Academic Details (Optional)
4. Entrance Examination Details
5. Research Information
6. Work Experience & Document Upload
7. Declaration

✅ **Document Upload Support:**
- UG/PG Certificates
- Entrance Exam Score Card
- Resume/CV
- Statement of Purpose
- Recommendation Letters
- Category Certificate
- ID Proof, Photo, Signature

✅ **Interactive UI:**
- Multi-step form with progress tracker
- Gradient design inspired by university branding
- Form validation
- File upload feedback
- Success/Error messages

## Project Structure

```
Phd project software engineering/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # Environment variables
│   └── uploads/            # Uploaded files directory
│
└── frontend/
    ├── src/
    │   ├── App.jsx         # Main application component
    │   ├── App.css         # Application styles
    │   ├── main.jsx        # Entry point
    │   └── index.css       # Global styles
    ├── index.html          # HTML template
    ├── package.json        # Node dependencies
    ├── vite.config.js      # Vite configuration
    └── .env                # Environment variables
```

## Setup Instructions

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- MongoDB Atlas account (connection URL provided)

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   ```

3. Activate virtual environment:
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. The `.env` file is already configured with MongoDB connection

6. Run the FastAPI server:
   ```bash
   python main.py
   ```
   Or using uvicorn:
   ```bash
   uvicorn main:app --reload
   ```

   Backend will be available at: http://localhost:8000

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The `.env` file is already configured

4. Run the development server:
   ```bash
   npm run dev
   ```

   Frontend will be available at: http://localhost:5173

## Usage

1. Start the backend server (port 8000)
2. Start the frontend development server (port 5173)
3. Open your browser and navigate to http://localhost:5173
4. Fill out the registration form step by step
5. Upload required documents
6. Review and submit

## API Endpoints

### Backend API Routes

- `GET /` - Health check
- `POST /api/upload-file` - Upload a file
- `POST /api/register` - Submit registration
- `GET /api/scholars` - Get all scholars (paginated)
- `GET /api/scholar/{registration_id}` - Get specific scholar

### API Documentation

FastAPI provides automatic interactive API documentation:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Environment Variables

### Backend (.env)
```
MONGODB_URL=mongodb+srv://akshuakv_db_user:uFrreBfrmaHOM77P@cluster0.rs5hnti.mongodb.net/?appName=Cluster0
DATABASE_NAME=Phd_admission
GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

Google sign in uses the Google web client ID in both frontend and backend. New Google users are created as Scholar accounts automatically.

## MongoDB Database Structure

**Database Name:** Phd_admission

**Collection:** scholars

**Document Structure:**
```json
{
  "registration_id": "PHD20260210123456",
  "personal_details": {...},
  "ug_details": {...},
  "pg_details": {...},
  "entrance_exam": {...},
  "research_info": {...},
  "work_experience": {...},
  "declaration_agreed": true,
  "digital_signature": "...",
  "submission_date": "2026-02-10",
  "uploaded_files": {...},
  "created_at": "2026-02-10T10:30:00"
}
```

## Build for Production

### Frontend Build
```bash
cd frontend
npm run build
```
The production build will be in the `dist/` directory.

### Backend Deployment
Use a production ASGI server like uvicorn or gunicorn:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Color Scheme

The design is inspired by the university's branding:
- Primary: Dark Blue (#1a2a44, #2d4a7c)
- Accent: Gold/Yellow (#FFD700)
- Background: Blue gradient
- Interactive elements: Yellow highlights on dark blue

## Security Notes

⚠️ **Important:** The `.env` files contain sensitive information (database credentials). In a production environment:
- Never commit `.env` files to version control
- Use environment variables or secure secret management
- Implement proper authentication and authorization
- Add input validation and sanitization
- Enable HTTPS/SSL
- Implement rate limiting

## Future Enhancements

- User authentication and login
- Admin dashboard for viewing submissions
- Email notifications
- PDF generation of registration forms
- Payment gateway integration
- Document verification system
- Multi-language support

## Support

For technical support or queries, contact the Directorate of Academic Research.

---

**© 2026 Puducherry Technological University. All rights reserved.**
