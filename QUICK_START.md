# ⚡ QUICK START - PhD Scholar Registration

## 🚀 Start Everything in 3 Steps

### Step 1: Run Setup Script
```
Double-click: start.bat
```
This will:
- Create Python virtual environment
- Install all Python packages
- Install all Node packages  
- Start backend server
- Start frontend server

**Wait 2-3 minutes for installation to complete**

---

### Step 2: Open Browser
```
URL: http://localhost:5173
```
The frontend should open automatically, or open it manually.

---

### Step 3: Start Using!
Fill out the registration form and submit.

---

## 🎯 For Next Time (Quick Restart)

After first installation, just run:
```
restart.bat
```
Starts both servers in seconds!

---

## 📍 Important URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | Registration Form |
| **Backend** | http://localhost:8000 | API Server |
| **API Docs** | http://localhost:8000/docs | API Documentation |

---

## 🛑 Stop Servers

When done, run:
```
stop.bat
```

---

## 🔧 Individual Control

Need to run servers separately?

**Backend Only:**
```bash
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload
```

**Frontend Only:**
```bash
cd frontend
npm run dev
```

---

## ✅ Verify It's Working

### Check 1: Backend Responding
Open: http://localhost:8000
Should see:
```json
{"message":"PhD Scholar Registration API","status":"active"}
```

### Check 2: Frontend Loading
Open: http://localhost:5173
Should see: PhD Scholar Registration Form with blue gradient

### Check 3: API Docs Available
Open: http://localhost:8000/docs
Should see: Interactive Swagger UI

---

## 🚨 Troubleshooting

### Problem: Scripts not working
**Try:** Right-click script → "Run as administrator"

### Problem: Port already in use
**Backend 8000 taken:**
Kill process: `taskkill /F /PID <PID>`
Or let uvicorn auto-select next port

**Frontend 5173 taken:**
Vite will automatically use port 5174

### Problem: Python/Node not found
**Install:**
- Python 3.8+: https://www.python.org/downloads/
- Node.js 16+: https://nodejs.org/

### Problem: Dependencies fail to install
**Backend:**
```bash
cd backend
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm cache clean --force
npm install
```

---

## 📝 Test Registration

### Quick Test Steps:
1. Open http://localhost:5173
2. Step 1 - Fill:
   - Name: Test Scholar
   - Email: test@test.com
   - Mobile: 9876543210
   - Fill other required fields
3. Click "Next" through steps
4. Step 7 - Check declaration box
5. Type your name as signature
6. Click "Submit Registration"
7. Should see: "Registration Successful! Your Registration ID is: PHD..."

✅ If you see registration ID, everything works!

---

## 🎯 What Each File Does

| File | Purpose |
|------|---------|
| `start.bat` | First-time setup + start |
| `restart.bat` | Quick restart both servers |
| `stop.bat` | Stop all servers |
| `start-backend.bat` | Backend only |
| `start-frontend.bat` | Frontend only |

---

## 📦 What Gets Installed

### Backend Packages:
- fastapi - Web framework
- uvicorn - ASGI server
- motor - MongoDB driver
- pydantic - Data validation
- python-dotenv - Environment vars
- python-multipart - File uploads

### Frontend Packages:
- react - UI library
- react-dom - React renderer
- vite - Build tool
- axios - HTTP client

**Total size: ~200-300 MB**

---

## 🔄 Daily Workflow

### Morning:
```bash
restart.bat
```

### Using:
- Share URL with applicants
- Monitor MongoDB for submissions
- Check API logs if needed

### Evening:
```bash
stop.bat
```

---

## 🎓 System Ready!

Once you see:
```
✅ Backend running at: http://localhost:8000
✅ Frontend running at: http://localhost:5173
```

**You're ready to accept PhD registrations!**

---

## 📞 Need Help?

1. Check `SETUP_GUIDE.md` for detailed instructions
2. Check `README.md` for full documentation
3. Review console/terminal for error messages
4. Verify MongoDB connection in `.env`

---

## 💡 Pro Tips

**Tip 1:** Keep terminal windows open to see logs  
**Tip 2:** Use API docs to test endpoints manually  
**Tip 3:** Check MongoDB Atlas for submitted data  
**Tip 4:** Save registration IDs for tracking  

---

**That's it! Simple as 1-2-3! 🚀**

Start with `start.bat` → Open `http://localhost:5173` → Register scholars! 🎓
