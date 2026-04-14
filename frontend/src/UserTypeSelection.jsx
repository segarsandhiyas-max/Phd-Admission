import React from 'react';
import './UserTypeSelection.css';

function UserTypeSelection({ onSelectUserType, onBack }) {
  return (
    <div className="user-type-container">
      <header className="user-type-header">
        <div className="header-content">
          <h1 className="main-title">PhD Admission Scrutinization System</h1>
          <p className="university-name">Puducherry Technological University</p>
          <p className="university-location">Puducherry - 605014</p>
        </div>
      </header>

      <main className="user-type-main">
        <div className="selection-container">
          <div className="selection-header">
            <h2 className="selection-title">Welcome to PhD Admission Portal</h2>
            <p className="selection-subtitle">Please select your user type to continue</p>
          </div>

          <div className="user-type-cards">
            <div className="user-card" onClick={() => onSelectUserType('new')}>
              <div className="card-icon new-user">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
              </div>
              <h3 className="card-title">New User</h3>
              <p className="card-description">
                First time applicant? Register to create your account and start your PhD admission process.
              </p>
              <button className="card-button new">
                Register Now
              </button>
            </div>

            <div className="user-card" onClick={() => onSelectUserType('existing')}>
              <div className="card-icon existing-user">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                </svg>
              </div>
              <h3 className="card-title">Existing User</h3>
              <p className="card-description">
                Already have an account? Login to access your dashboard and continue your application.
              </p>
              <button className="card-button existing">
                Login Now
              </button>
            </div>
          </div>

          <div className="back-section">
            <button onClick={onBack} className="back-button">
              ← Back to Home
            </button>
          </div>
        </div>
      </main>

      <footer className="user-type-footer">
        <p>&copy; 2026 Puducherry Technological University. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default UserTypeSelection;
