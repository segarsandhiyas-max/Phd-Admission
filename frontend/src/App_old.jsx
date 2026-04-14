import { useState } from 'react';
import './App.css';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    // Personal Details
    full_name: '',
    date_of_birth: '',
    gender: '',
    nationality: '',
    category: '',
    aadhaar_passport: '',
    mobile: '',
    email: '',
    permanent_address: '',
    communication_address: '',
    
    // UG Details
    ug_degree_name: '',
    ug_college_university: '',
    ug_branch_department: '',
    ug_year_of_passing: '',
    ug_cgpa_percentage: '',
    
    // PG Details
    pg_degree_name: '',
    pg_college_university: '',
    pg_specialization: '',
    pg_year_of_passing: '',
    pg_cgpa_percentage: '',
    
    // Entrance Exam
    exam_name: '',
    registration_number: '',
    year_of_exam: '',
    score_rank: '',
    validity_period: '',
    
    // Research Info
    area_of_interest: '',
    proposed_topic: '',
    statement_of_purpose: '',
    preferred_supervisor: '',
    previous_research: '',
    publications: '',
    
    // Work Experience
    company_name: '',
    job_role: '',
    years_of_experience: '',
    field_of_work: '',
    
    // Declaration
    declaration_agreed: false,
    digital_signature: '',
    submission_date: new Date().toISOString().split('T')[0]
  });

  const [uploadedFiles, setUploadedFiles] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('field_name', fieldName);

    try {
      const response = await axios.post(`${API_URL}/api/upload-file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadedFiles(prev => ({
        ...prev,
        [fieldName]: response.data.filename
      }));
      
      alert(`${fieldName} uploaded successfully!`);
    } catch (error) {
      console.error('File upload error:', error);
      alert('File upload failed. Please try again.');
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 7));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateStep = (step) => {
    switch(step) {
      case 1:
        if (!formData.full_name || !formData.email || !formData.mobile) {
          alert('Please fill all required fields in Personal Details');
          return false;
        }
        return true;
      case 2:
        if (!formData.ug_degree_name || !formData.ug_college_university) {
          alert('Please fill all required UG Details');
          return false;
        }
        return true;
      case 4:
        if (!formData.exam_name || !formData.registration_number) {
          alert('Please fill all required Entrance Exam Details');
          return false;
        }
        return true;
      case 5:
        if (!formData.area_of_interest || !formData.proposed_topic) {
          alert('Please fill all required Research Information');
          return false;
        }
        return true;
      case 7:
        if (!formData.declaration_agreed || !formData.digital_signature) {
          alert('Please agree to declaration and provide digital signature');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(7)) return;
    
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const registrationData = {
        personal_details: {
          full_name: formData.full_name,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
          nationality: formData.nationality,
          category: formData.category,
          aadhaar_passport: formData.aadhaar_passport,
          mobile: formData.mobile,
          email: formData.email,
          permanent_address: formData.permanent_address,
          communication_address: formData.communication_address
        },
        ug_details: {
          degree_name: formData.ug_degree_name,
          college_university: formData.ug_college_university,
          branch_department: formData.ug_branch_department,
          year_of_passing: formData.ug_year_of_passing,
          cgpa_percentage: formData.ug_cgpa_percentage
        },
        pg_details: formData.pg_degree_name ? {
          degree_name: formData.pg_degree_name,
          college_university: formData.pg_college_university,
          specialization: formData.pg_specialization,
          year_of_passing: formData.pg_year_of_passing,
          cgpa_percentage: formData.pg_cgpa_percentage
        } : null,
        entrance_exam: {
          exam_name: formData.exam_name,
          registration_number: formData.registration_number,
          year_of_exam: formData.year_of_exam,
          score_rank: formData.score_rank,
          validity_period: formData.validity_period
        },
        research_info: {
          area_of_interest: formData.area_of_interest,
          proposed_topic: formData.proposed_topic,
          statement_of_purpose: formData.statement_of_purpose,
          preferred_supervisor: formData.preferred_supervisor,
          previous_research: formData.previous_research,
          publications: formData.publications
        },
        work_experience: formData.company_name ? {
          company_name: formData.company_name,
          job_role: formData.job_role,
          years_of_experience: formData.years_of_experience,
          field_of_work: formData.field_of_work
        } : null,
        declaration_agreed: formData.declaration_agreed,
        digital_signature: formData.digital_signature,
        submission_date: formData.submission_date,
        uploaded_files: uploadedFiles
      };

      const response = await axios.post(`${API_URL}/api/register`, registrationData);
      
      setSuccessMessage(`Registration Successful! Your Registration ID is: ${response.data.registration_id}`);
      
      // Reset form after successful submission
      setTimeout(() => {
        window.location.reload();
      }, 5000);
      
    } catch (error) {
      console.error('Submission error:', error);
      setErrorMessage('Registration failed. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="form-section">
            <h2 className="section-title">Personal Details</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Date of Birth *</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Gender *</label>
                <select name="gender" value={formData.gender} onChange={handleChange} required>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Nationality *</label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select name="category" value={formData.category} onChange={handleChange} required>
                  <option value="">Select Category</option>
                  <option value="OC">OC</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
                </select>
              </div>

              <div className="form-group">
                <label>Aadhaar / Passport Number *</label>
                <input
                  type="text"
                  name="aadhaar_passport"
                  value={formData.aadhaar_passport}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Mobile Number *</label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  pattern="[0-9]{10}"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email ID *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Permanent Address *</label>
                <textarea
                  name="permanent_address"
                  value={formData.permanent_address}
                  onChange={handleChange}
                  rows="3"
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Communication Address *</label>
                <textarea
                  name="communication_address"
                  value={formData.communication_address}
                  onChange={handleChange}
                  rows="3"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="form-section">
            <h2 className="section-title">Academic Details - Undergraduate (UG)</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Degree Name (B.E / B.Tech / B.Sc etc.) *</label>
                <input
                  type="text"
                  name="ug_degree_name"
                  value={formData.ug_degree_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>College / University Name *</label>
                <input
                  type="text"
                  name="ug_college_university"
                  value={formData.ug_college_university}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Branch / Department *</label>
                <input
                  type="text"
                  name="ug_branch_department"
                  value={formData.ug_branch_department}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Year of Passing *</label>
                <input
                  type="text"
                  name="ug_year_of_passing"
                  value={formData.ug_year_of_passing}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>CGPA / Percentage *</label>
                <input
                  type="text"
                  name="ug_cgpa_percentage"
                  value={formData.ug_cgpa_percentage}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="form-section">
            <h2 className="section-title">Academic Details - Postgraduate (PG)</h2>
            <p className="section-subtitle">Optional - Fill if applicable</p>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Degree Name (M.E / M.Tech / M.Sc etc.)</label>
                <input
                  type="text"
                  name="pg_degree_name"
                  value={formData.pg_degree_name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>College / University</label>
                <input
                  type="text"
                  name="pg_college_university"
                  value={formData.pg_college_university}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Specialization</label>
                <input
                  type="text"
                  name="pg_specialization"
                  value={formData.pg_specialization}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Year of Passing</label>
                <input
                  type="text"
                  name="pg_year_of_passing"
                  value={formData.pg_year_of_passing}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>CGPA / Percentage</label>
                <input
                  type="text"
                  name="pg_cgpa_percentage"
                  value={formData.pg_cgpa_percentage}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="form-section">
            <h2 className="section-title">Entrance Examination Details</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Exam Name (GATE / NET / JRF etc.) *</label>
                <input
                  type="text"
                  name="exam_name"
                  value={formData.exam_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Registration Number *</label>
                <input
                  type="text"
                  name="registration_number"
                  value={formData.registration_number}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Year of Exam *</label>
                <input
                  type="text"
                  name="year_of_exam"
                  value={formData.year_of_exam}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Score / Rank *</label>
                <input
                  type="text"
                  name="score_rank"
                  value={formData.score_rank}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Validity Period *</label>
                <input
                  type="text"
                  name="validity_period"
                  value={formData.validity_period}
                  onChange={handleChange}
                  placeholder="e.g., 2024-2027"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="form-section">
            <h2 className="section-title">Research Information</h2>
            
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Area of Interest *</label>
                <input
                  type="text"
                  name="area_of_interest"
                  value={formData.area_of_interest}
                  onChange={handleChange}
                  placeholder="e.g., AI, Data Science, Networks, IoT"
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Proposed Research Topic / Title *</label>
                <input
                  type="text"
                  name="proposed_topic"
                  value={formData.proposed_topic}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Statement of Purpose (SOP) *</label>
                <textarea
                  name="statement_of_purpose"
                  value={formData.statement_of_purpose}
                  onChange={handleChange}
                  rows="6"
                  placeholder="Describe your research interests, goals, and motivation..."
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Preferred Supervisor / Faculty Name *</label>
                <input
                  type="text"
                  name="preferred_supervisor"
                  value={formData.preferred_supervisor}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Previous Research / Projects</label>
                <textarea
                  name="previous_research"
                  value={formData.previous_research}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Describe any previous research work or projects..."
                />
              </div>

              <div className="form-group full-width">
                <label>Publications / Papers</label>
                <textarea
                  name="publications"
                  value={formData.publications}
                  onChange={handleChange}
                  rows="4"
                  placeholder="List any publications or research papers..."
                />
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="form-section">
            <h2 className="section-title">Work Experience & Document Upload</h2>
            
            <div className="subsection">
              <h3 className="subsection-title">Work Experience (Optional)</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Company / Organization Name</label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Job Role</label>
                  <input
                    type="text"
                    name="job_role"
                    value={formData.job_role}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Years of Experience</label>
                  <input
                    type="text"
                    name="years_of_experience"
                    value={formData.years_of_experience}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Field of Work</label>
                  <input
                    type="text"
                    name="field_of_work"
                    value={formData.field_of_work}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="subsection">
              <h3 className="subsection-title">Document Upload</h3>
              <div className="upload-grid">
                <div className="upload-item">
                  <label>UG Mark Sheets & Degree Certificate</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'ug_certificate')}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  {uploadedFiles.ug_certificate && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>PG Mark Sheets & Degree Certificate</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'pg_certificate')}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  {uploadedFiles.pg_certificate && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>Entrance Exam Score Card</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'exam_scorecard')}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  {uploadedFiles.exam_scorecard && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>Resume / CV</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'resume')}
                    accept=".pdf"
                  />
                  {uploadedFiles.resume && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>Statement of Purpose (PDF)</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'sop_document')}
                    accept=".pdf"
                  />
                  {uploadedFiles.sop_document && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>Recommendation Letters (LOR)</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'lor')}
                    accept=".pdf"
                  />
                  {uploadedFiles.lor && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>Category Certificate</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'category_certificate')}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  {uploadedFiles.category_certificate && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>ID Proof</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'id_proof')}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  {uploadedFiles.id_proof && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>Passport Size Photo</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'photo')}
                    accept=".jpg,.jpeg,.png"
                  />
                  {uploadedFiles.photo && <span className="file-uploaded">✓ Uploaded</span>}
                </div>

                <div className="upload-item">
                  <label>Signature</label>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'signature')}
                    accept=".jpg,.jpeg,.png"
                  />
                  {uploadedFiles.signature && <span className="file-uploaded">✓ Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="form-section">
            <h2 className="section-title">Declaration</h2>
            
            <div className="declaration-box">
              <p className="declaration-text">
                I hereby declare that all the information provided by me in this application form is true, 
                complete and correct to the best of my knowledge and belief. I understand that any false 
                information or concealment of facts will render me liable for disqualification from the 
                PhD program and legal action.
              </p>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="declaration_agreed"
                    checked={formData.declaration_agreed}
                    onChange={handleChange}
                    required
                  />
                  <span>I agree to the above declaration *</span>
                </label>
              </div>

              <div className="form-group">
                <label>Digital Signature / Typed Name *</label>
                <input
                  type="text"
                  name="digital_signature"
                  value={formData.digital_signature}
                  onChange={handleChange}
                  placeholder="Type your full name as digital signature"
                  required
                />
              </div>

              <div className="form-group">
                <label>Date of Submission</label>
                <input
                  type="date"
                  name="submission_date"
                  value={formData.submission_date}
                  onChange={handleChange}
                  readOnly
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1 className="main-title">
            Directorate of Academic Research
          </h1>
          <p className="university-name">Puducherry Technological University</p>
          <p className="university-location">Puducherry - 605014</p>
          <h2 className="welcome-title">PhD Scholar Registration Form</h2>
        </div>
      </header>

      <div className="progress-container">
        <div className="progress-bar">
          {[1, 2, 3, 4, 5, 6, 7].map((step) => (
            <div
              key={step}
              className={`progress-step ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
            >
              <div className="step-number">{step}</div>
              <div className="step-label">
                {step === 1 && 'Personal'}
                {step === 2 && 'UG Details'}
                {step === 3 && 'PG Details'}
                {step === 4 && 'Entrance Exam'}
                {step === 5 && 'Research'}
                {step === 6 && 'Documents'}
                {step === 7 && 'Declaration'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <main className="main-content">
        <form onSubmit={handleSubmit} className="registration-form">
          {renderStep()}

          <div className="button-group">
            {currentStep > 1 && (
              <button type="button" onClick={prevStep} className="btn btn-secondary">
                Previous
              </button>
            )}
            
            {currentStep < 7 ? (
              <button type="button" onClick={nextStep} className="btn btn-primary">
                Next
              </button>
            ) : (
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Registration'}
              </button>
            )}
          </div>

          {successMessage && (
            <div className="message success-message">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="message error-message">
              {errorMessage}
            </div>
          )}
        </form>
      </main>

      <footer className="footer">
        <p>&copy; 2026 Puducherry Technological University. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
