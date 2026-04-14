import { useState, useEffect, useRef } from 'react';
import './App.css';
import api, { getApiErrorMessage } from './api';
import { getUser, setAuthData, clearAuthData, isAuthenticated, getUserRole } from './auth';
import ScholarDashboard from './dashboards/ScholarDashboard';
import FacultyDashboard from './dashboards/FacultyDashboard';
import AdminDashboard from './dashboards/AdminDashboard';
import DirectorDashboard from './dashboards/DirectorDashboard';
import DeanDashboard from './dashboards/DeanDashboard';
import ScrutinyDashboard from './dashboards/ScrutinyDashboard';
import LandingPage from './LandingPage';
import UserTypeSelection from './UserTypeSelection';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [currentUser, setCurrentUser] = useState(getUser());
  const [currentPage, setCurrentPage] = useState(isAuthenticated() ? 'dashboard' : 'landing');
  const googleButtonRef = useRef(null);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  
  // Login/Register state
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'scholar',
    department: '',
    phone: ''
  });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [associateDeanCount, setAssociateDeanCount] = useState(4);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [authFlow, setAuthFlow] = useState('auth');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({
    email: '',
    token: '',
    new_password: '',
    confirm_password: ''
  });

  // Department list
  const departments = [
    'Computer Science',
    'Information Technology',
    'Electronics and Communication',
    'Electrical and Electronics Engineering',
    'Chemical Engineering',
    'Electrical and Instrumentation Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Mechatronics',
    'Physics',
    'Chemistry',
    'Mathematics',
    'HSS'
  ];

  useEffect(() => {
    if (isAuthenticated()) {
      const user = getUser();
      if (user && user.role) {
        setIsLoggedIn(true);
        setCurrentUser(user);
        setCurrentPage('dashboard');
      } else {
        // Stale/invalid auth data — clear it
        clearAuthData();
        setIsLoggedIn(false);
        setCurrentPage('landing');
      }
    }
  }, []);

  useEffect(() => {
    // URL-link based reset is no longer used (OTP flow replaced it)
    // Kept as no-op to avoid breaking any bookmarked links
    const params = new URLSearchParams(window.location.search);
    const reset = params.get('reset');
    if (reset === 'true') {
      setCurrentPage('auth');
      setIsLogin(true);
      setAuthFlow('forgot');
    }
  }, []);

  useEffect(() => {
    if (currentPage !== 'auth' || authFlow !== 'auth' || !isLogin || !googleClientId) {
      return undefined;
    }

    if (window.google?.accounts?.id) {
      setGoogleScriptLoaded(true);
      return undefined;
    }

    const existingScript = document.querySelector('script[data-google-identity="true"]');
    if (existingScript) {
      const handleLoad = () => setGoogleScriptLoaded(true);
      existingScript.addEventListener('load', handleLoad);
      return () => existingScript.removeEventListener('load', handleLoad);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => setGoogleScriptLoaded(true);
    script.onerror = () => setAuthError('Unable to load Google sign in right now. Please try again later.');
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [currentPage, authFlow, isLogin, googleClientId]);

  const completeAuth = (authData) => {
    setAuthData(authData.access_token, authData.user);
    setCurrentUser(authData.user);
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
  };

  const handleAuthChange = (e) => {
    const { name, value } = e.target;
    setAuthForm(prev => ({ ...prev, [name]: value }));
  };

  const handleGoogleLogin = async (googleResponse) => {
    if (!googleResponse?.credential) {
      setAuthError('Google sign in did not return a credential.');
      return;
    }

    setAuthError('');
    setAuthLoading(true);

    try {
      const response = await api.post('/api/google-login', {
        credential: googleResponse.credential
      });

      completeAuth(response.data);
    } catch (error) {
      console.error('Google login error FULL:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error data:', error.response?.data);
      setAuthError(getApiErrorMessage(error, 'Google sign in failed. Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (currentPage !== 'auth' || authFlow !== 'auth' || !isLogin || !googleClientId || !googleScriptLoaded || !googleButtonRef.current || !window.google?.accounts?.id) {
      return;
    }

    googleButtonRef.current.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleLogin,
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: Math.min(440, googleButtonRef.current.offsetWidth || 440),
    });
  }, [currentPage, authFlow, isLogin, googleClientId, googleScriptLoaded]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      console.log('Attempting login with email:', authForm.email);
      
      const formData = new FormData();
      formData.append('username', authForm.email);
      formData.append('password', authForm.password);

      console.log('Sending login request...');
      const response = await api.post('/api/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('Login successful:', response.data);

      completeAuth(response.data);
    } catch (error) {
      console.error('Login error FULL:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error data:', error.response?.data);
      setAuthError(getApiErrorMessage(error, 'Login failed. Please check your credentials.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      console.log('Attempting registration with data:', {
        email: authForm.email,
        full_name: authForm.full_name,
        role: authForm.role,
        department: authForm.department || null,
        phone: authForm.phone || null
      });

      const registerResponse = await api.post('/api/register', {
        email: authForm.email,
        password: authForm.password,
        full_name: authForm.full_name,
        role: authForm.role,
        department: authForm.department || null,
        phone: authForm.phone || null
      });

      console.log('Registration successful:', registerResponse.data);

      // Auto login after registration
      const formData = new FormData();
      formData.append('username', authForm.email);
      formData.append('password', authForm.password);

      const loginResponse = await api.post('/api/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      completeAuth(loginResponse.data);
    } catch (error) {
      console.error('Registration error FULL:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error data:', error.response?.data);
      setAuthError(getApiErrorMessage(error, 'Registration failed. Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const clearResetQueryParams = () => {
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const startForgotPasswordFlow = () => {
    setAuthFlow('forgot');
    setAuthError('');
    setAuthSuccess('');
    setForgotEmail((authForm.email || '').trim().toLowerCase());
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setAuthError('Please enter your email address.');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await api.post('/api/forgot-password', {
        email: normalizedEmail
      });

      const serverMessage = response.data?.message || 'OTP sent. Check your email.';
      const devOtp = response.data?.reset_token || '';

      setResetForm(prev => ({
        ...prev,
        email: normalizedEmail,
        token: devOtp,
        new_password: '',
        confirm_password: ''
      }));
      setAuthFlow('reset');
      setAuthSuccess(devOtp
        ? `Development OTP: ${devOtp} (pre-filled below)`
        : serverMessage
      );
    } catch (error) {
      setAuthError(getApiErrorMessage(error, 'Unable to process forgot password right now.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPasswordChange = (e) => {
    const { name, value } = e.target;
    setResetForm(prev => ({ ...prev, [name]: value }));
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const normalizedEmail = resetForm.email.trim().toLowerCase();
    const token = resetForm.token.trim();

    if (!normalizedEmail) {
      setAuthError('Email is required.');
      return;
    }
    if (!token) {
      setAuthError('OTP is required.');
      return;
    }
    if (resetForm.new_password.length < 6) {
      setAuthError('New password must be at least 6 characters.');
      return;
    }
    if (resetForm.new_password !== resetForm.confirm_password) {
      setAuthError('New password and confirm password do not match.');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await api.post('/api/reset-password', {
        email: normalizedEmail,
        token,
        new_password: resetForm.new_password
      });

      setAuthSuccess(response.data?.message || 'Password reset successful. Please sign in.');
      setAuthFlow('auth');
      setIsLogin(true);
      setShowPassword(false);
      setShowResetPassword(false);
      setShowResetConfirmPassword(false);
      setAuthForm(prev => ({
        ...prev,
        email: normalizedEmail,
        password: ''
      }));
      setResetForm({
        email: '',
        token: '',
        new_password: '',
        confirm_password: ''
      });
      clearResetQueryParams();
    } catch (error) {
      setAuthError(getApiErrorMessage(error, 'Password reset failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = (e) => {
    if (authFlow === 'forgot') {
      return handleForgotPassword(e);
    }
    if (authFlow === 'reset') {
      return handleResetPassword(e);
    }
    return isLogin ? handleLogin(e) : handleRegister(e);
  };

  const handleLogout = () => {
    clearAuthData();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('landing');
    setAuthFlow('auth');
    setAuthSuccess('');
    setAuthError('');
    setAuthForm({
      email: '',
      password: '',
      full_name: '',
      role: 'scholar',
      department: '',
      phone: ''
    });
  };

  const handleNavigateToAdmission = () => {
    setCurrentPage('userSelection');
  };

  const handleSelectUserType = (userType) => {
    if (userType === 'new') {
      setIsLogin(false);
      setAuthFlow('auth');
      setAuthSuccess('');
      setAuthError('');
      setCurrentPage('auth');
    } else {
      setIsLogin(true);
      setAuthFlow('auth');
      setAuthSuccess('');
      setAuthError('');
      setCurrentPage('auth');
    }
  };

  const handleBackToLanding = () => {
    setCurrentPage('landing');
    setAuthFlow('auth');
    setAuthError('');
    setAuthSuccess('');
  };

  const renderDashboard = () => {
    // Check state first, then fallback to localStorage
    const user = currentUser || getUser();
    
    if (!user || !user.role) {
      // No valid user in storage — clear and go to landing
      console.log('No valid user found, logging out');
      handleLogout();
      return null;
    }

    const dashboardProps = {
      user: user,
      onLogout: handleLogout
    };

    // Check if role starts with 'scrutiny_'
    if (user.role && user.role.startsWith('scrutiny_')) {
      return <ScrutinyDashboard {...dashboardProps} />;
    }

    switch (user.role) {
      case 'scholar':
        return <ScholarDashboard {...dashboardProps} />;
      case 'faculty':
        return <FacultyDashboard {...dashboardProps} />;
      case 'admin':
        return <AdminDashboard {...dashboardProps} />;
      case 'director':
        return <DirectorDashboard {...dashboardProps} />;
      case 'dean':
      case 'associate_dean':
        return <DeanDashboard {...dashboardProps} />;
      default:
        // Handle dean_1, dean_2, etc.
        if (user.role && (user.role.startsWith('dean_') || user.role.startsWith('associate_dean'))) {
          return <DeanDashboard {...dashboardProps} />;
        }
        // Unknown role — clear auth and redirect to landing
        console.log('Unknown role:', user.role);
        handleLogout();
        return null;
    }
  };

  if (isLoggedIn && currentPage === 'dashboard') {
    return renderDashboard();
  }

  // Landing Page
  if (currentPage === 'landing') {
    return <LandingPage onNavigateToAdmission={handleNavigateToAdmission} />;
  }

  // User Type Selection
  if (currentPage === 'userSelection') {
    return <UserTypeSelection onSelectUserType={handleSelectUserType} onBack={handleBackToLanding} />;
  }

  // Auth Page (Login/Register)
  return (
    <div className="app-container">
      <header className="auth-header">
        <div className="header-content">
          <h1 className="main-title">PhD Admission Scrutinization System</h1>
          <p className="university-name">Puducherry Technological University</p>
          <p className="university-location">Puducherry - 605014</p>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-container">
          
          {/* Mock Database Notice */}
          <div style={{
            backgroundColor: '#d4edda',
            border: '1px solid #28a745',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '15px',
            color: '#155724',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            📚 2026 - 2027 Admission Open
          </div>

          <div className="auth-tabs">
            <button
              className={`auth-tab ${authFlow === 'auth' && isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(true);
                setAuthError('');
                setAuthSuccess('');
                setAuthFlow('auth');
              }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${authFlow === 'auth' && !isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(false);
                setAuthError('');
                setAuthSuccess('');
                setAuthFlow('auth');
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authFlow === 'forgot' && (
              <>
                <div className="auth-flow-heading">
                  <h3>Forgot Password</h3>
                  <p>Enter your email address and we will send a secure reset link. This also works for accounts created with Google sign-in.</p>
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="Enter your registered email"
                  />
                </div>
              </>
            )}

            {authFlow === 'reset' && (
              <>
                <div className="auth-flow-heading">
                  <h3>Reset Password</h3>
                  <p>Enter the OTP sent to your email and choose a new password.</p>
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={resetForm.email}
                    onChange={handleResetPasswordChange}
                    required
                    placeholder="Enter your registered email"
                  />
                </div>

                <div className="form-group">
                  <label>OTP *</label>
                  <input
                    type="text"
                    name="token"
                    value={resetForm.token}
                    onChange={handleResetPasswordChange}
                    required
                    placeholder="Enter 6-digit OTP from your email"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                  />
                </div>

                <div className="form-group">
                  <label>New Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      name="new_password"
                      value={resetForm.new_password}
                      onChange={handleResetPasswordChange}
                      required
                      minLength="6"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowResetPassword(prev => !prev)}
                      tabIndex={-1}
                      aria-label={showResetPassword ? 'Hide new password' : 'Show new password'}
                    >
                      {showResetPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm New Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      name="confirm_password"
                      value={resetForm.confirm_password}
                      onChange={handleResetPasswordChange}
                      required
                      minLength="6"
                      placeholder="Re-enter new password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowResetConfirmPassword(prev => !prev)}
                      tabIndex={-1}
                      aria-label={showResetConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showResetConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {authFlow === 'auth' && (
              <>
                {!isLogin && (
                  <>
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        name="full_name"
                        value={authForm.full_name}
                        onChange={handleAuthChange}
                        required={!isLogin}
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div className="form-group">
                      <label>Select Your Role *</label>
                      <select
                        name="role"
                        value={authForm.role}
                        onChange={handleAuthChange}
                        required={!isLogin}
                      >
                        <option value="scholar">Scholar (Applicant)</option>
                        <option value="faculty">Faculty (Reviewer)</option>
                        <option value="admin">Admin (System Administrator)</option>
                        <option value="director">Research Director</option>
                        {[...Array(associateDeanCount)].map((_, index) => (
                          <option key={index} value={`dean_${index + 1}`}>
                            Associate Dean {index + 1}
                          </option>
                        ))}
                        <optgroup label="Scrutiny Officers">
                          {departments.map((dept, index) => (
                            <option key={`scrutiny_${index}`} value={`scrutiny_${dept.toLowerCase().replace(/\s+/g, '_')}`}>
                              {dept} Scrutiny
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      {!isLogin && (
                        <button
                          type="button"
                          onClick={() => setAssociateDeanCount(prev => prev + 1)}
                          style={{
                            marginTop: '8px',
                            padding: '6px 12px',
                            backgroundColor: '#2c5f9a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onMouseOver={(e) => e.target.style.backgroundColor = '#1e4d7d'}
                          onMouseOut={(e) => e.target.style.backgroundColor = '#2c5f9a'}
                        >
                          ➕ Add More Associate Dean
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Department (Optional)</label>
                      <select
                        name="department"
                        value={authForm.department}
                        onChange={handleAuthChange}
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept, index) => (
                          <option key={index} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Phone Number (Optional)</label>
                      <input
                        type="tel"
                        name="phone"
                        value={authForm.phone}
                        onChange={handleAuthChange}
                        placeholder="10-digit mobile number"
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={authForm.email}
                    onChange={handleAuthChange}
                    required
                    placeholder="Enter your email"
                  />
                </div>

                <div className="form-group">
                  <div className="password-label-row">
                    <label>Password *</label>
                    {isLogin && (
                      <button type="button" className="forgot-password-btn" onClick={startForgotPasswordFlow}>Forgot password?</button>
                    )}
                  </div>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={authForm.password}
                      onChange={handleAuthChange}
                      required
                      minLength="6"
                      placeholder="Enter password (min 6 characters)"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(prev => !prev)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {authError && (
              <div className="auth-error">
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="auth-success">
                {authSuccess}
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={authLoading}>
              {authLoading ? 'Please wait...' : (
                authFlow === 'forgot'
                  ? 'Send Reset Link'
                  : authFlow === 'reset'
                    ? 'Reset Password'
                    : (isLogin ? 'Sign In' : 'Sign Up')
              )}
            </button>

            {authFlow === 'forgot' && (
              <div className="auth-inline-actions">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setAuthFlow('auth');
                    setIsLogin(true);
                    setAuthError('');
                    setAuthSuccess('');
                    clearResetQueryParams();
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {authFlow === 'reset' && (
              <div className="auth-inline-actions">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setAuthFlow('forgot');
                    setAuthError('');
                    setAuthSuccess('');
                  }}
                >
                  Send New Reset Link
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setAuthFlow('auth');
                    setIsLogin(true);
                    setAuthError('');
                    setAuthSuccess('');
                    clearResetQueryParams();
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {authFlow === 'auth' && isLogin && (
              <>
                <div className="auth-divider">
                  <span>Or continue with</span>
                </div>

                {googleClientId ? (
                  <div className={`google-signin-section ${authLoading ? 'is-loading' : ''}`}>
                    <div ref={googleButtonRef} className="google-button-slot" />
                  </div>
                ) : (
                  <button type="button" className="google-custom-btn" disabled title="Configure VITE_GOOGLE_CLIENT_ID to enable Google sign in">
                    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.2z"/>
                      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.6v6.2C6.6 42.8 14.7 48 24 48z"/>
                      <path fill="#FBBC05" d="M10.8 28.8A14.7 14.7 0 0110 24c0-1.7.3-3.3.8-4.8v-6.2H2.6A23.9 23.9 0 000 24c0 3.9.9 7.5 2.6 10.8l8.2-6z"/>
                      <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.5 30.5 0 24 0 14.7 0 6.6 5.2 2.6 13.2l8.2 6.2C12.7 13.6 17.9 9.5 24 9.5z"/>
                    </svg>
                    Sign in with Google
                  </button>
                )}
              </>
            )}
          </form>

          <div className="auth-footer">
            {authFlow === 'auth' ? (
              isLogin ? (
                <p>Don't have an account? <button onClick={() => { setIsLogin(false); setAuthError(''); setAuthSuccess(''); }} className="link-btn">Sign Up</button></p>
              ) : (
                <p>Already have an account? <button onClick={() => { setIsLogin(true); setAuthError(''); setAuthSuccess(''); }} className="link-btn">Sign In</button></p>
              )
            ) : (
              <p>
                Need to login? <button onClick={() => { setAuthFlow('auth'); setIsLogin(true); setAuthError(''); setAuthSuccess(''); clearResetQueryParams(); }} className="link-btn">Sign In</button>
              </p>
            )}
            <p style={{ marginTop: '10px' }}>
              <button onClick={() => setCurrentPage('userSelection')} className="link-btn">← Back to User Selection</button>
            </p>
          </div>
        </div>
      </main>

      <footer className="auth-footer-page">
        <p>&copy; 2026 Puducherry Technological University. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
