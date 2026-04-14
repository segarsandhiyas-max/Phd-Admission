# Quick Setup Guide - PhD Scholar Registration System

## ✅ FASTEST WAY TO START

### Option 1: Automated Setup (Recommended)
Double-click `start.bat` in the project root directory. This will:
- Set up Python virtual environment
- Install all backend dependencies
- Install all frontend dependencies
- Start both servers automatically

### Option 2: Manual Setup

#### Backend Setup (Terminal 1)
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Backend will run at: **http://localhost:8000**

#### Frontend Setup (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```

Frontend will run at: **http://localhost:5173**

---

## 🌐 Access the Application

Once both servers are running:
1. Open your browser
2. Navigate to **http://localhost:5173**
3. You should see the PhD Scholar Registration Form

---

## 🔧 Troubleshooting

### Backend Issues

#### Problem: "pip not found" or "python not found"
**Solution:** Install Python 3.8+ from https://www.python.org/downloads/
- Make sure to check "Add Python to PATH" during installation

#### Problem: "Module not found" errors
**Solution:** Make sure you're in the virtual environment and reinstall:
```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
```

#### Problem: Port 8000 already in use
**Solution:** Kill the process using port 8000:
```bash
netstat -ano | findstr :8000
taskkill /PID <PID_NUMBER> /F
```

#### Problem: MongoDB connection error
**Solution:** Check your internet connection. The MongoDB Atlas URL is configured in `.env`

### Frontend Issues

#### Problem: "npm not found" or "node not found"
**Solution:** Install Node.js 16+ from https://nodejs.org/

#### Problem: Port 5173 already in use
**Solution:** Vite will automatically use the next available port (5174, 5175, etc.)

#### Problem: "Cannot connect to backend"
**Solution:** 
1. Verify backend is running at http://localhost:8000
2. Check browser console for CORS errors
3. Ensure `.env` file has correct API URL

---

## 📁 File Structure

```
Phd project software engineering/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── requirements.txt     # Python packages
│   ├── .env                # MongoDB config
│   └── uploads/            # File storage
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main component
│   │   ├── App.css        # Styles
│   │   ├── main.jsx       # Entry point
│   │   └── index.css      # Global styles
│   ├── package.json       # Node packages
│   ├── vite.config.js     # Vite config
│   └── .env               # API URL
│
├── start.bat              # Auto setup & start
├── start-backend.bat      # Start backend only
├── start-frontend.bat     # Start frontend only
└── README.md              # Full documentation
```

---

## 🧪 Testing the API

### Using Browser
Visit http://localhost:8000/docs for interactive API documentation (Swagger UI)

### Using curl or Postman
```bash
# Health check
curl http://localhost:8000/

# Get all scholars
curl http://localhost:8000/api/scholars
```

---

## 📝 Common Commands

### Backend Commands
```bash
# Activate virtual environment
cd backend
venv\Scripts\activate

# Start server
python -m uvicorn main:app --reload

# Install new package
pip install package-name
pip freeze > requirements.txt
```

### Frontend Commands
```bash
# Start dev server
cd frontend
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Install new package
npm install package-name
```

---

## 🔐 Security Notes

⚠️ **IMPORTANT:** The `.env` files contain database credentials. For production:
- Use environment variables
- Don't commit `.env` to version control
- Enable authentication
- Use HTTPS
- Validate all inputs
- Implement rate limiting

---

## ✨ Features Checklist

✅ Multi-step registration form (7 steps)
✅ File upload support (10 document types)
✅ MongoDB integration
✅ Responsive design
✅ Form validation
✅ Progress tracker
✅ Success/Error messages
✅ Auto-generated registration IDs

---

## 🎨 Design Elements

**Color Scheme:**
- Primary: Dark Blue (#1a2a44, #2d4a7c)
- Accent: Gold (#FFD700)
- Background: Blue gradient
- Text: White on dark, Dark on light

**Typography:**
- Font: Segoe UI
- Headers: Bold, Large
- Body: Regular, Readable

---

## 🚀 Next Steps After Setup

1. **Test the Form:**
   - Fill out each step
   - Upload sample documents
   - Submit the form
   - Verify success message

2. **Check Database:**
   - Log into MongoDB Atlas
   - View `Phd_admission` database
   - Check `scholars` collection

3. **Test API:**
   - Visit http://localhost:8000/docs
   - Try API endpoints
   - Verify responses

4. **Customize:**
   - Modify colors in App.css
   - Update university name
   - Add logo images
   - Adjust form fields

---

## 📞 Support

If you encounter issues:
1. Check this troubleshooting guide
2. Review error messages in browser console
3. Check terminal output for errors
4. Verify all dependencies are installed
5. Ensure both servers are running

---

## 🎯 Quick Test

After starting both servers, test with this:

1. Open http://localhost:5173
2. Fill "Full Name": Test Scholar
3. Fill "Email": test@example.com
4. Fill "Mobile": 9876543210
5. Click "Next" through steps
6. Check "I agree" on Declaration
7. Type your name as signature
8. Click "Submit Registration"
9. You should see: "Registration Successful! Your Registration ID is: PHD..."

---

**System Status:**
- ✅ Backend: http://localhost:8000
- ✅ Frontend: http://localhost:5173
- ✅ Database: MongoDB Atlas (Cloud)
- ✅ API Docs: http://localhost:8000/docs

---

**Ready to register PhD scholars! 🎓**
