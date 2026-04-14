import React from 'react';
import './LandingPage.css';

function LandingPage({ onNavigateToAdmission }) {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="header-wrapper">
          <div className="logo-section">
            <h1 className="dor-title">DoR</h1>
          </div>
          <nav className="landing-nav">
            <a href="#home" className="nav-link">Home</a>
            <a href="#about" className="nav-link">About Us</a>
            <a href="#visvesvaraya" className="nav-link">Visvesvaraya Ph.D scheme</a>
            <a href="#admission" className="nav-link active">Admission</a>
            <a href="#registration" className="nav-link">Registration and Fees</a>
            <a href="#supervisors" className="nav-link">Supervisors</a>
            <a href="#research" className="nav-link">Research and Development Cell</a>
            <a href="#areas" className="nav-link">Research Areas</a>
            <a href="#grants" className="nav-link">Research Grants</a>
            <a href="#ptu-iris" className="nav-link">PTU-IRIS</a>
            <a href="#journals" className="nav-link">Journals ▼</a>
            <a href="#notifications" className="nav-link">Ph.D Notifications</a>
            <a href="#more" className="nav-link">More ▼</a>
          </nav>
        </div>
      </header>

      <section className="hero-section">
        <div className="notification-banner">
          <p className="notification-text moving-text">
            The Admissions for the academic Year 2026-27 will be Open in May 2026.
          </p>
        </div>
      </section>

      <section className="content-section">
        <div className="content-wrapper">
          <h2 className="section-title">Ph.D Full time and Part time Programmes</h2>
          
          <p className="program-description">
            Applications are invited from eligible candidates from academia and industry to pursue Ph.D 
            <strong> (Full time & Part time)</strong> research in <strong>Engineering</strong> (ECE,EEE, 
            EIE,ME,CE, Chemical Engg., CSE and IT), <strong>Science</strong> (Computer Science, Physics, 
            disciplines for the academic year 2025-26.
          </p>

          <div className="links-section">
            <a href="#prospectus" className="content-link">Propectus 2025-26</a>
            <a href="#visvesvaraya-scheme" className="content-link">Visvesvaraya Ph.D Scheme</a>
            <button onClick={onNavigateToAdmission} className="admission-link">
              Phd Admission 2026 - 2027 (apply here)
            </button>
            <p className="info-text">
              Single Application for Visvesvaraya Ph.D Scheme and Regular Ph.D admission (FT & PT ))
            </p>
          </div>

          <div className="visvesvaraya-section">
            <h3 className="subsection-title">
              Visvesvaraya Ph.D scheme for Electronics and IT: Phase -II
            </h3>
            <div className="scheme-links">
              <a href="#terms" className="content-link">
                Terms and Conditions and SoP For Visvesvaraya Ph.D.Scheme
              </a>
              <a href="#visvesvaraya-details" className="content-link">
                Visvesvaraya Ph.D scheme
              </a>
            </div>
          </div>

          <div className="admission-forms-section">
            <h3 className="subsection-title">Ph.D Admission Forms</h3>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <p className="footer-heading">Maintained by</p>
          <p className="footer-org">Directorate of Academic Research</p>
          <p className="footer-university">Puducherry Technological University</p>
          <p className="footer-location">Puducherry-6050144.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
