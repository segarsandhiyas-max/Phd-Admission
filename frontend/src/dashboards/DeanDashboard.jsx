import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../api';
import '../App.css';
import {
  calculateAverageReviewScore,
  formatApplicationStatus,
  formatDateTime,
  formatTextLabel,
  getDisplayValue,
  getDocumentLabel,
  getUploadedDocuments,
  joinDisplayValues
} from '../applicationHelpers';

function DeanDashboard({ user, onLogout }) {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [decisionData, setDecisionData] = useState({
    decision: '',
    remarks: ''
  });
  const [deanConfirmationChecked, setDeanConfirmationChecked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    fetchDeanReviewApplications();
  }, []);

  useEffect(() => {
    if (!selectedApp) {
      return;
    }

    setDecisionData({
      decision: '',
      remarks: ''
    });
    setDeanConfirmationChecked(false);
  }, [selectedApp]);

  const fetchDeanReviewApplications = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/dean/shortlisted-applications');
      setApplications(response.data.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByDepartment = (apps) => {
    const grouped = {};
    apps.forEach((app) => {
      const department = app.department || 'Not Specified';
      if (!grouped[department]) {
        grouped[department] = [];
      }
      grouped[department].push(app);
    });
    return grouped;
  };

  const groupedApplications = groupByDepartment(applications);

  const handleDownloadDocument = async (fileId, fieldKey) => {
    try {
      const response = await api.get(`/api/download-file/${encodeURIComponent(fileId)}`, {
        responseType: 'blob'
      });

      const disposition = response.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const downloadName = filenameMatch?.[1] || `${fieldKey}.pdf`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Document download failed:', error);
      alert(getApiErrorMessage(error, 'Failed to download document'));
    }
  };

  const handleDecisionChange = (event) => {
    const { name, value } = event.target;
    setDecisionData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConfirmDecision = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    try {
      await api.post(`/api/dean/final-decision/${selectedApp.id}`, decisionData);
      alert('Dean decision submitted successfully.');
      setSelectedApp(null);
      await fetchDeanReviewApplications();
    } catch (error) {
      console.error('Error submitting decision:', error);
      alert(getApiErrorMessage(error, 'Failed to submit decision'));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalDecision = (event) => {
    event.preventDefault();
    if (!decisionData.decision || !decisionData.remarks.trim()) {
      alert('Please select a decision and enter remarks.');
      return;
    }
    if (!deanConfirmationChecked) {
      alert('Please confirm the Dean approval checkbox before submitting.');
      return;
    }
    setShowConfirmModal(true);
  };

  const selectedDocuments = selectedApp ? getUploadedDocuments(selectedApp) : [];
  const selectedAverageScore = selectedApp ? calculateAverageReviewScore(selectedApp.reviews) : 'N/A';
  const deanActionEligibleStatuses = new Set([
    'interview_completed'
  ]);
  const selectedStatusRaw = String(selectedApp?.status || '').toLowerCase();
  const canSubmitDeanDecision = Boolean(selectedApp)
    && deanActionEligibleStatuses.has(selectedStatusRaw);
  const showDeanViewOnly = Boolean(selectedApp) && !canSubmitDeanDecision;

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <h2>Dean Dashboard</h2>
        <div className="nav-right">
          <span className="user-name">{user.full_name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="welcome-banner">
          <h1>Welcome, Dean {user.full_name}!</h1>
          <p>Review all applications and make the Dean-level decision when eligible.</p>
        </div>

        <div className="info-banner">
          <h3>Dean Review Queue</h3>
          <p>All applications are visible and grouped by department. Dean action is enabled only when status is Interview Completed.</p>
        </div>

        <h3 className="section-title">Applications ({applications.length})</h3>

        {loading && <div className="loading-message">Loading applications...</div>}

        {!loading && applications.length === 0 && (
          <div className="empty-state">
            <h3>No Applications Available</h3>
            <p>There are currently no applications to display.</p>
          </div>
        )}

        {!loading && applications.length > 0 && (
          <div>
            {Object.entries(groupedApplications).map(([department, deptApps]) => (
              <div key={department} style={{ marginBottom: '40px' }}>
                <h3
                  style={{
                    color: '#1e40af',
                    fontSize: '20px',
                    borderBottom: '3px solid #3b82f6',
                    paddingBottom: '8px',
                    marginBottom: '20px'
                  }}
                >
                  📚 {department} - {deptApps.length} Application{deptApps.length !== 1 ? 's' : ''}
                </h3>
                <div className="dashboard-cards">
                  {deptApps.map((app) => (
                    <div
                      key={app.id}
                      className="dashboard-card"
                      onClick={() => setSelectedApp(app)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="card-header-row">
                        <h3>{app.registration_id}</h3>
                        <span className={`status status-${app.status}`}>{formatApplicationStatus(app.status)}</span>
                      </div>
                      <div className="card-details">
                        <p><strong>Candidate:</strong> {getDisplayValue(app.personal_details?.full_name, app.scholar_name)}</p>
                        <p><strong>Department:</strong> {getDisplayValue(app.department)}</p>
                        <p><strong>Research Area:</strong> {getDisplayValue(app.research_info?.area_of_interest, app.area_of_interest)}</p>
                        <p><strong>Exam:</strong> {joinDisplayValues(app.entrance_exam?.exam_name, app.entrance_exam?.score_rank)}</p>
                        <p><strong>Category:</strong> {getDisplayValue(app.personal_details?.category, app.category)}</p>
                        <p><strong>Interview:</strong> {formatDateTime(app.interviewDate)}</p>
                        <p><strong>Reviews:</strong> {app.reviews?.length || 0}</p>
                        {app.reviews?.length > 0 && (
                          <p><strong>Average Review Score:</strong> {calculateAverageReviewScore(app.reviews)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedApp && (
          <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
            <div className="modal-content" onClick={(event) => event.stopPropagation()}>
              <h2>Dean Review: {selectedApp.registration_id}</h2>

              <div className="applicant-details">
                <h3>Candidate Overview</h3>
                <div className="detail-grid">
                  <p><strong>Name:</strong> {getDisplayValue(selectedApp.personal_details?.full_name, selectedApp.scholar_name)}</p>
                  <p><strong>Email:</strong> {getDisplayValue(selectedApp.personal_details?.email, selectedApp.scholar_email)}</p>
                  <p><strong>Category:</strong> {getDisplayValue(selectedApp.personal_details?.category, selectedApp.category)}</p>
                  <p><strong>Mobile:</strong> {getDisplayValue(selectedApp.personal_details?.mobile, selectedApp.mobile)}</p>
                  <p><strong>Department:</strong> {getDisplayValue(selectedApp.department)}</p>
                  <p><strong>Status:</strong> {formatApplicationStatus(selectedApp.status)}</p>
                </div>
              </div>

              <div className="detail-section">
                <h3>Academic Qualifications</h3>
                <div className="qualification-card">
                  <h4>Undergraduate</h4>
                  <p><strong>Degree:</strong> {getDisplayValue(selectedApp.ug_details?.degree_name, selectedApp.ug_degree_name)}</p>
                  <p><strong>University:</strong> {getDisplayValue(selectedApp.ug_details?.college_university, selectedApp.ug_college_university)}</p>
                  <p><strong>Branch:</strong> {getDisplayValue(selectedApp.ug_details?.branch_department, selectedApp.ug_branch_department)}</p>
                  <p><strong>CGPA/Percentage:</strong> {getDisplayValue(selectedApp.ug_details?.cgpa_percentage, selectedApp.ug_cgpa_percentage)}</p>
                </div>

                {(selectedApp.pg_details || selectedApp.pg_degree_name || selectedApp.pg_college_university) && (
                  <div className="qualification-card">
                    <h4>Postgraduate</h4>
                    <p><strong>Degree:</strong> {getDisplayValue(selectedApp.pg_details?.degree_name, selectedApp.pg_degree_name)}</p>
                    <p><strong>University:</strong> {getDisplayValue(selectedApp.pg_details?.college_university, selectedApp.pg_college_university)}</p>
                    <p><strong>CGPA/Percentage:</strong> {getDisplayValue(selectedApp.pg_details?.cgpa_percentage, selectedApp.pg_cgpa_percentage)}</p>
                  </div>
                )}

                <div className="qualification-card">
                  <h4>Entrance Examination</h4>
                  <p><strong>Exam:</strong> {getDisplayValue(selectedApp.entrance_exam?.exam_name, selectedApp.exam_name)}</p>
                  <p><strong>Score/Rank:</strong> {getDisplayValue(selectedApp.entrance_exam?.score_rank, selectedApp.score_rank)}</p>
                  <p><strong>Year:</strong> {getDisplayValue(selectedApp.entrance_exam?.year_of_exam, selectedApp.year_of_exam)}</p>
                </div>
              </div>

              <div className="detail-section">
                <h3>Research Proposal</h3>
                <p><strong>Area of Interest:</strong> {getDisplayValue(selectedApp.research_info?.area_of_interest, selectedApp.area_of_interest)}</p>
                <p><strong>Proposed Topic:</strong> {getDisplayValue(selectedApp.research_info?.proposed_topic, selectedApp.proposed_topic)}</p>
                <p><strong>Preferred Supervisor:</strong> {getDisplayValue(selectedApp.research_info?.preferred_supervisor, selectedApp.preferred_supervisor)}</p>

                <div className="sop-box">
                  <h4>Statement of Purpose</h4>
                  <p>{getDisplayValue(selectedApp.research_info?.statement_of_purpose, selectedApp.statement_of_purpose)}</p>
                </div>

                {getDisplayValue(selectedApp.research_info?.publications, selectedApp.publications) !== 'N/A' && (
                  <div className="sop-box">
                    <h4>Publications</h4>
                    <p>{getDisplayValue(selectedApp.research_info?.publications, selectedApp.publications)}</p>
                  </div>
                )}

                {getDisplayValue(selectedApp.research_info?.previous_research, selectedApp.previous_research) !== 'N/A' && (
                  <div className="sop-box">
                    <h4>Previous Research</h4>
                    <p>{getDisplayValue(selectedApp.research_info?.previous_research, selectedApp.previous_research)}</p>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Interview Details</h3>
                <div className="detail-grid">
                  <p><strong>Date:</strong> {formatDateTime(selectedApp.interviewDate)}</p>
                  <p><strong>Mode:</strong> {getDisplayValue(selectedApp.interviewMode)}</p>
                  <p><strong>Panel:</strong> {getDisplayValue(selectedApp.interviewPanel)}</p>
                  <p><strong>Result:</strong> {selectedApp.interviewResult ? formatTextLabel(selectedApp.interviewResult) : 'N/A'}</p>
                </div>
                <p><strong>Interview Remarks:</strong> {getDisplayValue(selectedApp.interviewRemarks)}</p>
              </div>

              {selectedDocuments.length > 0 && (
                <div className="detail-section">
                  <h3>Uploaded Documents</h3>
                  <ul className="documents-list">
                    {selectedDocuments.map((doc, index) => (
                      <li key={`${doc.key}-${index}`}>
                        <button
                          type="button"
                          className="doc-link-btn"
                          onClick={() => handleDownloadDocument(doc.fileId, doc.key)}
                        >
                          📄 {getDocumentLabel(doc.key)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="detail-section">
                <h3>Faculty Reviews ({selectedApp.reviews?.length || 0})</h3>
                {selectedApp.reviews && selectedApp.reviews.length > 0 ? (
                  <>
                    {selectedAverageScore !== 'N/A' && (
                      <div className="score-summary-large">
                        <h4>Average Review Score: {selectedAverageScore}</h4>
                      </div>
                    )}

                    {selectedApp.reviews.map((review, index) => (
                      <div key={index} className="review-card">
                        <p><strong>Reviewer:</strong> {getDisplayValue(review.reviewer_name, review.faculty_name)}</p>
                        <div className="scores">
                          <span>Academic: {getDisplayValue(review.academic_score, review.technical_score)}</span>
                          <span>Research: {getDisplayValue(review.research_score)}</span>
                          <span>Overall: {getDisplayValue(review.overall_score)}</span>
                        </div>
                        <p><strong>Recommendation:</strong> <span className={`recommendation ${getDisplayValue(review.recommendation, review.decision)}`}>{formatTextLabel(getDisplayValue(review.recommendation, review.decision))}</span></p>
                        <p><strong>Remarks:</strong> {getDisplayValue(review.remarks)}</p>
                        <p><small>{formatDateTime(review.created_at || review.reviewed_at)}</small></p>
                      </div>
                    ))}
                  </>
                ) : (
                  <p>No reviews available.</p>
                )}
              </div>

              {canSubmitDeanDecision ? (
                <form onSubmit={handleFinalDecision} className="decision-form">
                  <div className="dean-decision-status-card">
                    <div className="dean-decision-status-icon">Action</div>
                    <div>
                      <p className="dean-decision-status-title">Pending Dean Approval</p>
                      <p className="dean-decision-status-subtitle">Review this application and submit your final Dean-level decision.</p>
                    </div>
                  </div>

                  <div className="dean-application-summary">
                    <h3>Application Details</h3>
                    <div className="dean-application-summary-grid">
                      <div className="dean-summary-item">
                        <span className="dean-summary-label">Application ID</span>
                        <p className="dean-summary-value">{selectedApp.registration_id}</p>
                      </div>
                      <div className="dean-summary-item">
                        <span className="dean-summary-label">Candidate Name</span>
                        <p className="dean-summary-value">{getDisplayValue(selectedApp.personal_details?.full_name, selectedApp.scholar_name)}</p>
                      </div>
                      <div className="dean-summary-item">
                        <span className="dean-summary-label">Department</span>
                        <p className="dean-summary-value">{getDisplayValue(selectedApp.department)}</p>
                      </div>
                      <div className="dean-summary-item">
                        <span className="dean-summary-label">Average Review Score</span>
                        <p className="dean-summary-value dean-summary-value-score">{selectedAverageScore}</p>
                      </div>
                      <div className="dean-summary-item">
                        <span className="dean-summary-label">Category</span>
                        <p className="dean-summary-value">{getDisplayValue(selectedApp.personal_details?.category, selectedApp.category)}</p>
                      </div>
                      <div className="dean-summary-item">
                        <span className="dean-summary-label">Interview Status</span>
                        <p className="dean-summary-value dean-summary-value-success">Completed</p>
                      </div>
                    </div>
                  </div>

                  <div className="dean-decision-block">
                    <h3>Dean Decision</h3>
                    <div className="dean-decision-options">
                      <label
                        className={`dean-decision-option approve ${decisionData.decision === 'approve' ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="decision"
                          value="approve"
                          checked={decisionData.decision === 'approve'}
                          onChange={handleDecisionChange}
                        />
                        <div>
                          <p className="dean-decision-option-title">Approve and Forward</p>
                          <p className="dean-decision-option-note">Candidate will be forwarded to Research Director.</p>
                        </div>
                      </label>

                      <label
                        className={`dean-decision-option reject ${decisionData.decision === 'reject' ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="decision"
                          value="reject"
                          checked={decisionData.decision === 'reject'}
                          onChange={handleDecisionChange}
                        />
                        <div>
                          <p className="dean-decision-option-title">Reject Application</p>
                          <p className="dean-decision-option-note">Application will be closed at Dean level.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="dean-remarks-block">
                    <label htmlFor="dean-remarks" className="dean-remarks-label">Dean Remarks</label>
                    <textarea
                      id="dean-remarks"
                      name="remarks"
                      value={decisionData.remarks}
                      onChange={handleDecisionChange}
                      rows="5"
                      required
                      placeholder="Provide a clear rationale for your decision."
                      className="dean-remarks-input"
                    />
                    <p className="dean-remarks-counter">{decisionData.remarks.length} characters entered</p>

                    <label className="dean-confirm-checkbox">
                      <input
                        type="checkbox"
                        checked={deanConfirmationChecked}
                        onChange={(event) => setDeanConfirmationChecked(event.target.checked)}
                      />
                      <span>I confirm this is my final Dean decision for this application.</span>
                    </label>
                  </div>

                  <div className="dean-decision-actions">
                    <button
                      type="button"
                      onClick={() => setSelectedApp(null)}
                      className="dean-btn dean-btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!decisionData.decision || !decisionData.remarks.trim() || !deanConfirmationChecked || loading}
                      className="dean-btn dean-btn-primary"
                    >
                      {loading ? 'Submitting...' : 'Submit Dean Decision'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {showDeanViewOnly && (
                    <div className="alert alert-info">
                      View Only: Dean action is currently disabled for status "{formatApplicationStatus(selectedStatusRaw)}".
                    </div>
                  )}
                  <div className="form-actions">
                    <button type="button" className="decision-btn approve" disabled>
                      Approve
                    </button>
                    <button type="button" className="decision-btn reject" disabled>
                      Reject
                    </button>
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => setSelectedApp(null)}
                      className="btn-secondary"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="dean-confirm-overlay">
            <div className="dean-confirm-modal">
              <h3>Confirm Dean Decision</h3>

              <div className="dean-confirm-message">
                <p>
                  {decisionData.decision === 'approve'
                    ? 'You are about to approve this candidate and forward to Research Director.'
                    : 'You are about to reject this application.'}
                </p>
              </div>

              <div className="dean-confirm-meta">
                <p><strong>Application:</strong> {selectedApp.registration_id}</p>
                <p><strong>Candidate:</strong> {getDisplayValue(selectedApp.personal_details?.full_name, selectedApp.scholar_name)}</p>
                <p><strong>Your Remarks:</strong></p>
                <p className="dean-confirm-remarks">{decisionData.remarks}</p>
              </div>

              <p className="dean-confirm-note">This action will be recorded in the approval workflow.</p>

              <div className="dean-confirm-actions">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="dean-btn dean-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDecision}
                  disabled={loading}
                  className={`dean-btn ${decisionData.decision === 'approve' ? 'dean-btn-approve' : 'dean-btn-reject'}`}
                >
                  {loading ? 'Processing...' : (decisionData.decision === 'approve' ? 'Approve' : 'Reject')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeanDashboard;