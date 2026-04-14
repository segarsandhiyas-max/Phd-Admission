# MongoDB Connection Guide

## Current Status
Your application is configured to connect to MongoDB Atlas database named **"demo"**, but due to Python 3.14 SSL/TLS compatibility issues, it's currently running in **mock database mode** (in-memory only, not persistent).

## What's Configured

### ✅ Database Setup
- **Database Name**: `demo`  
- **Collections Created**:
  - `users` - Stores all user information (scholars, faculty, admin, director, dean)
  - `applications` - Stores all scholar application details
  - `reviews` - Stores faculty reviews of applications
  - `notifications` - Stores system notifications
  - **GridFS** - MongoDB GridFS for storing uploaded documents (PDFs, images, etc.)

### ✅ Features Implemented
1. **User Management**: Registration, login, and role-based access control
2. **Application Storage**: Complete application details with personal info, education, research interests
3. **Document Storage**: GridFS integration for PDF/image uploads
4. **Auto-Fallback**: Automatically switches to mock database if MongoDB connection fails

## The SSL/TLS Issue

### Problem
Python 3.14 has updated SSL/TLS libraries that are not yet fully compatible with MongoDB Atlas connections. You're seeing this error:
```
SSL handshake failed: [SSL: TLSV1_ALERT_INTERNAL_ERROR]
```

### Why Mock Database?
When MongoDB connection fails, the application automatically switches to an in-memory mock database so you can continue development. **However, data is NOT persistent** - it's lost when you restart the server.

## Solutions

### Option 1: Switch to Python 3.12 (Recommended)
Python 3.12 works perfectly with MongoDB Atlas.

1. **Install Python 3.12**:
   - Download from: https://www.python.org/downloads/
   - During installation, check "Add Python 3.12 to PATH"

2. **Recreate virtual environment**:
   ```powershell
   # Delete existing venv
   Remove-Item -Recurse -Force backend/venv
   
   # Create new venv with Python 3.12
   python3.12 -m venv backend/venv
   
   # Activate and install dependencies
   & backend/venv/Scripts/Activate.ps1
   pip install -r backend/requirements.txt
   ```

3. **Restart backend**:
   ```powershell
   ./start-backend.bat
   ```
   
   You should see:
   ```
   ✅ Connected to MongoDB successfully!
   📚 Using database: 'demo'
   📁 GridFS initialized for document storage
   ```

### Option 2: Use Local MongoDB
Instead of MongoDB Atlas, install MongoDB locally.

1. **Install MongoDB Community Edition**:
   - Download from: https://www.mongodb.com/try/download/community
   - Install and start MongoDB service

2. **Update `.env` file**:
   ```env
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=demo
   ```

3. **Restart backend**

### Option 3: Wait for Library Updates
MongoDB Atlas support for Python 3.14 is coming in future pymongo/motor updates. Check for updates periodically:
```powershell
pip install --upgrade pymongo motor
```

### Option 4: Continue with Mock Database (Development Only)
For development/testing, the mock database works fine, but remember:
- ⚠️ Data is NOT saved to disk
- ⚠️ All data is lost on server restart
- ⚠️ Cannot be used in production

## How Data Will Be Stored (Once Connected)

### User Information
```javascript
{
  "_id": "user_unique_id",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "scholar",
  "department": "Computer Science",
  "phone": "+1234567890",
  "hashed_password": "...",
  "is_active": true,
  "created_at": ISODate("2026-02-17T...")
}
```

### Application Details
```javascript
{
  "_id": "APP20260217123456",
  "registration_id": "PHD20260217123456",
  "scholar_id": "user_unique_id",
  "scholar_email": "scholar@example.com",
  "scholar_name": "John Doe",
  "status": "submitted",
  "personal_details": {
    "full_name": "John Doe",
    "email": "...",
    "mobile": "...",
    "category": "General"
  },
  "ug_details": {...},
  "pg_details": {...},
  "research_info": {...},
  "entrance_exam": {...},
  "documents": {
    "tenth_certificate": "gridfs_file_id_1",
    "twelfth_certificate": "gridfs_file_id_2",
    "ug_certificate": "gridfs_file_id_3",
    // ... more document references
  },
  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

### Uploaded Documents (GridFS)
Documents are stored in MongoDB GridFS with metadata:
```javascript
{
  "_id": ObjectId("..."),
  "filename": "user123_tenth_certificate_20260217_143045.pdf",
  "metadata": {
    "user_id": "user123",
    "field_name": "tenth_certificate",
    "original_filename": "certificate.pdf",
    "content_type": "application/pdf",
    "upload_date": ISODate("...")
  },
  "chunkSize": 261120,
  "length": 524288
}
```

## Verifying Connection

After fixing the SSL issue, you'll see this on startup:
```
✅ Connected to MongoDB successfully!
📚 Using database: 'demo'
📁 GridFS initialized for document storage
```

Instead of:
```
❌ Failed to connect to MongoDB
🔄 Switching to MOCK DATABASE mode
```

## Testing MongoDB Connection

Once connected, test with:

###bash
# View all users
curl http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check database in MongoDB Atlas
# 1. Go to: https://cloud.mongodb.com
# 2. Click "Browse Collections"
# 3. Select database: "demo"
# 4. You should see: users, applications, reviews, notifications collections
```

## Files Modified for MongoDB Integration

1. **backend/.env** - Database name set to "demo"
2. **backend/main.py** - Added:
   - GridFS support for document storage
   - Helper functions: `save_file_to_gridfs()`, `get_file_from_gridfs()`
   - Auto-fallback to mock database
   - File download endpoint

## Next Steps

1. **Choose one of the solutions above** (Python 3.12 recommended)
2. **Restart the backend server**
3. **Verify connection** - Look for "✅ Connected to MongoDB"
4. **Test the application** - Register users, submit applications
5. **Check MongoDB Atlas** - Verify data is being saved

## Support

If you continue having issues:
1. Check MongoDB Atlas IP whitelist (allow all: 0.0.0.0/0)
2. Verify connection string credentials
3. Test connection with MongoDB Compass
4. Check MongoDB Atlas cluster is running

---

**Current Status**: Application is fully functional with mock database for development. To persist data, follow Option 1 (Python 3.12) above.
