import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../api';
import { getUser as getLoggedInUser } from '../auth';
import '../App.css';
import {
  calculateAverageReviewScore,
  formatApplicationStatus,
  formatDateOnly,
  formatDateTime,
  formatTextLabel,
  getDisplayValue,
  getDocumentLabel,
  getUploadedDocuments,
  joinDisplayValues,
  toDateTimeInputValue
} from '../applicationHelpers';

function FacultyDashboard({ user: propsUser, onLogout }) {
  const user = getLoggedInUser() || propsUser;
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [reviewData, setReviewData] = useState({
    academic_score: '',
    research_score: '',
    remarks: '',
    decision: ''
  });
  const [interviewSchedule, setInterviewSchedule] = useState({
    interviewDate: '',
    interviewMode: 'Online',
    interviewPanel: '',
    remarks: ''
  });
  const [interviewEvaluation, setInterviewEvaluation] = useState({
    interview_marks: '',
    remarks: ''
  });
  const [finalRankList, setFinalRankList] = useState([]);
  const [rankLoading, setRankLoading] = useState(false);

  const originalApplications = applications;
  const originalRankList = finalRankList;

  const safeFilter = (data) => {
    if (!user || String(user.role || '').toLowerCase() !== 'faculty') return data;
    if (!user.department) return data;

    return data.filter((item) => item.department === user.department);
  };

  const displayApplications = safeFilter(originalApplications);
  const displayRankList = safeFilter(originalRankList);

  useEffect(() => {
    fetchApplications();
    fetchFinalRankList();
  }, [filter]);

  useEffect(() => {
    if (!selectedApp) {
      return;
    }

    setReviewData({
      academic_score: '',
      research_score: '',
      remarks: '',
      decision: ''
    });
    setInterviewSchedule({
      interviewDate: toDateTimeInputValue(selectedApp.interviewDate),
      interviewMode: selectedApp.interviewMode || 'Online',
      interviewPanel: selectedApp.interviewPanel || '',
      remarks: selectedApp.interviewRemarks || ''
    });
    setInterviewEvaluation({
      interview_marks: selectedApp.interviewMarks ?? '',
      remarks: selectedApp.interviewRemarks || ''
    });
  }, [selectedApp]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/api/faculty/applications', { params });
      setApplications(response.data.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinalRankList = async () => {
    setRankLoading(true);
    try {
      const response = await api.get('/api/final-rank-list');
      setFinalRankList(response.data.rankList || []);
    } catch (error) {
      console.error('Error fetching final rank list:', error);
      setFinalRankList([]);
    } finally {
      setRankLoading(false);
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

  const groupedApplications = groupByDepartment(displayApplications);

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

  const handleReviewChange = (event) => {
    const { name, value } = event.target;
    setReviewData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInterviewScheduleChange = (event) => {
    const { name, value } = event.target;
    setInterviewSchedule((prev) => ({ ...prev, [name]: value }));
  };

  const handleInterviewEvaluationChange = (event) => {
    const { name, value } = event.target;
    setInterviewEvaluation((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitInterviewEvaluation = async (event) => {
    event.preventDefault();
    if (!selectedApp) {
      return;
    }

    const marksText = String(interviewEvaluation.interview_marks ?? '').trim();
    if (!marksText) {
      alert('Interview marks are required.');
      return;
    }

    const marksValue = Number(marksText);
    if (!Number.isFinite(marksValue) || marksValue < 0 || marksValue > 50) {
      alert('Interview marks must be between 0 and 50.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/faculty/interview-evaluation', {
        application_id: selectedApp.id,
        interview_marks: marksValue,
        remarks: interviewEvaluation.remarks,
      });

      alert(response.data?.message || 'Interview evaluation saved successfully.');
      setSelectedApp((prev) => prev ? {
        ...prev,
        interviewMarks: response.data?.interviewMarks,
        finalScore: response.data?.finalScore,
        finalRank: response.data?.finalRank,
        candidateStatus: response.data?.candidateStatus,
      } : prev);
      await fetchFinalRankList();
      await fetchApplications();
    } catch (error) {
      console.error('Error submitting interview evaluation:', error);
      alert(getApiErrorMessage(error, 'Failed to save interview evaluation'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      await api.post('/api/faculty/review', {
        application_id: selectedApp.id,
        remarks: reviewData.remarks,
        decision: reviewData.decision,
        academic_score: parseInt(reviewData.academic_score, 10),
        research_score: parseInt(reviewData.research_score, 10)
      });

      alert('Faculty review submitted successfully.');
      setSelectedApp(null);
      await fetchApplications();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert(getApiErrorMessage(error, 'Failed to submit review'));
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleInterview = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      await api.post('/api/interview/schedule', {
        application_id: selectedApp.id,
        interviewDate: interviewSchedule.interviewDate,
        interviewMode: interviewSchedule.interviewMode,
        interviewPanel: interviewSchedule.interviewPanel,
        remarks: interviewSchedule.remarks
      });

      alert('Interview scheduled successfully.');
      setSelectedApp(null);
      await fetchApplications();
    } catch (error) {
      console.error('Error scheduling interview:', error);
      alert(getApiErrorMessage(error, 'Failed to schedule interview'));
    } finally {
      setLoading(false);
    }
  };

  const selectedDocuments = selectedApp ? getUploadedDocuments(selectedApp) : [];
  const selectedAverageScore = selectedApp ? calculateAverageReviewScore(selectedApp.reviews) : 'N/A';
  const canReviewSelectedApp = Boolean(selectedApp)
    && !selectedApp.reviewed_by_me
    && selectedApp.status === 'faculty_review';
  const canScheduleSelectedInterview = Boolean(selectedApp)
    && selectedApp.status === 'recommended_for_interview';
  const canSubmitSelectedInterviewEvaluation = Boolean(selectedApp)
    && selectedApp.status === 'interview_scheduled'
    && Boolean(selectedApp.interviewDate);
  const showInterviewSection = Boolean(selectedApp)
    && (
      ['recommended_for_interview', 'interview_scheduled', 'interview_completed'].includes(selectedApp.status)
      || Boolean(selectedApp.interviewDate)
      || Boolean(selectedApp.interviewResult)
    );
  const showFacultyViewOnly = Boolean(selectedApp)
    && !canReviewSelectedApp
    && !canScheduleSelectedInterview
    && !canSubmitSelectedInterviewEvaluation;

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <h2>Faculty Dashboard</h2>
        <div className="nav-right">
          <span className="user-name">{user.full_name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="welcome-banner">
          <h1>Welcome, Prof. {user.full_name}!</h1>
          <p>Review scrutiny-verified applications, recommend candidates for interview, and manage interview outcomes.</p>
          {user?.department && String(user.role || '').toLowerCase() === 'faculty' && (
            <p><strong>Viewing:</strong> {user.department} Department</p>
          )}
        </div>

        <div className="tabs">
          <button
            className={`tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Applications
          </button>
          <button
            className={`tab ${filter === 'faculty_review' ? 'active' : ''}`}
            onClick={() => setFilter('faculty_review')}
          >
            Pending Faculty Review
          </button>
          <button
            className={`tab ${filter === 'interview_stage' ? 'active' : ''}`}
            onClick={() => setFilter('interview_stage')}
          >
            Interview Stage
          </button>
        </div>

        <h3 className="section-title">Applications for Review ({displayApplications.length})</h3>

        <div className="detail-section qualified-evaluation-section" style={{ marginBottom: '24px' }}>
          <div className="qualified-evaluation-header">
            <h3>Department Final Rank List</h3>
            <span className="qualified-count-pill">Ranked: {finalRankList.length}</span>
          </div>
          {rankLoading ? (
            <p className="qualified-empty-text">Loading final ranks...</p>
          ) : displayRankList.length === 0 ? (
            <p className="qualified-empty-text">No ranked candidates available for your department yet.</p>
          ) : (
            <div className="qualified-table-container">
              <table className="qualified-results-table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Institute</th>
                    <th>Entrance Marks</th>
                    <th>Interview Marks</th>
                    <th>Final Score</th>
                    <th>Final Rank</th>
                    <th>Seat Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRankList.map((row) => (
                    <tr key={`rank-${row.applicationId}`}>
                      <td>{row.registrationId || row.applicationId}</td>
                      <td>{row.name}</td>
                      <td>{row.department}</td>
                      <td>{row.institute || 'PTU'}</td>
                      <td>{row.entranceMarks ?? 'N/A'}</td>
                      <td>{row.interviewMarks ?? 'N/A'}</td>
                      <td>{row.finalScore ?? 'N/A'}</td>
                      <td><span className="rank-pill">#{row.finalRank}</span></td>
                      <td>{row.seatType || '-'}</td>
                      <td>{row.seatAllocationStatus || 'Not Selected'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {loading && <div className="loading-message">Loading applications...</div>}

        {!loading && applications.length === 0 && (
          <div className="empty-state">
            <p>No applications are currently available for Faculty review.</p>
            <p>Verify the application in the Scrutiny dashboard first so its status moves to Faculty Review.</p>
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
                        <p><strong>Applicant:</strong> {getDisplayValue(app.personal_details?.full_name, app.scholar_name)}</p>
                        <p><strong>Email:</strong> {getDisplayValue(app.personal_details?.email, app.scholar_email)}</p>
                        <p><strong>Department:</strong> {getDisplayValue(app.department)}</p>
                        <p><strong>Mode:</strong> {getDisplayValue(app.personal_details?.mode_of_study, app.mode_of_study)}</p>
                        <p><strong>Category:</strong> {getDisplayValue(app.personal_details?.category, app.category)}</p>
                        <p><strong>Research Area:</strong> {getDisplayValue(app.research_info?.area_of_interest, app.area_of_interest)}</p>
                        <p><strong>Submitted:</strong> {formatDateOnly(app.created_at)}</p>
                        <p><strong>Reviews:</strong> {app.reviews?.length || 0}</p>
                        {app.reviews?.length > 0 && (
                          <p><strong>Average Review Score:</strong> {calculateAverageReviewScore(app.reviews)}</p>
                        )}
                        {app.interviewDate && (
                          <p><strong>Interview:</strong> {formatDateTime(app.interviewDate)} ({getDisplayValue(app.interviewMode)})</p>
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
              <h2>Application Review: {selectedApp.registration_id}</h2>

              <div className="applicant-details">
                <h3>Applicant Information</h3>
                <p><strong>Name:</strong> {getDisplayValue(selectedApp.personal_details?.full_name, selectedApp.scholar_name)}</p>
                <p><strong>Email:</strong> {getDisplayValue(selectedApp.personal_details?.email, selectedApp.scholar_email)}</p>
                <p><strong>Phone:</strong> {getDisplayValue(selectedApp.personal_details?.mobile, selectedApp.mobile)}</p>
                <p><strong>Department:</strong> {getDisplayValue(selectedApp.department)}</p>
                <p><strong>Status:</strong> {formatApplicationStatus(selectedApp.status)}</p>
                <p><strong>UG Qualification:</strong> {joinDisplayValues(selectedApp.ug_details?.degree_name, selectedApp.ug_details?.branch_department)}</p>
                <p><strong>Research Area:</strong> {getDisplayValue(selectedApp.research_info?.area_of_interest, selectedApp.area_of_interest)}</p>
                <p><strong>Proposed Topic:</strong> {getDisplayValue(selectedApp.research_info?.proposed_topic, selectedApp.proposed_topic)}</p>
              </div>

              <div className="detail-section">
                <h3>Personal Details</h3>
                <div className="detail-grid">
                  <p><strong>Name:</strong> {getDisplayValue(selectedApp.personal_details?.full_name, selectedApp.scholar_name)}</p>
                  <p><strong>Email:</strong> {getDisplayValue(selectedApp.personal_details?.email, selectedApp.scholar_email)}</p>
                  <p><strong>Mobile:</strong> {getDisplayValue(selectedApp.personal_details?.mobile, selectedApp.mobile)}</p>
                  <p><strong>DOB:</strong> {getDisplayValue(selectedApp.personal_details?.date_of_birth, selectedApp.date_of_birth)}</p>
                  <p><strong>Gender:</strong> {getDisplayValue(selectedApp.personal_details?.gender, selectedApp.gender)}</p>
                  <p><strong>Category:</strong> {getDisplayValue(selectedApp.personal_details?.category, selectedApp.category)}</p>
                  <p><strong>Mode:</strong> {getDisplayValue(selectedApp.personal_details?.mode_of_study, selectedApp.mode_of_study)}</p>
                  <p><strong>State Type:</strong> {getDisplayValue(selectedApp.personal_details?.candidate_state_type, selectedApp.candidate_state_type)}</p>
                </div>
              </div>

              <div className="detail-section">
                <h3>Academic Background</h3>
                <div className="sub-section">
                  <h4>UG Details</h4>
                  <p><strong>Degree:</strong> {getDisplayValue(selectedApp.ug_details?.degree_name, selectedApp.ug_degree_name)}</p>
                  <p><strong>University:</strong> {getDisplayValue(selectedApp.ug_details?.college_university, selectedApp.ug_college_university)}</p>
                  <p><strong>Branch:</strong> {getDisplayValue(selectedApp.ug_details?.branch_department, selectedApp.ug_branch_department)}</p>
                  <p><strong>CGPA/Percentage:</strong> {getDisplayValue(selectedApp.ug_details?.cgpa_percentage, selectedApp.ug_cgpa_percentage)}</p>
                  <p><strong>Year:</strong> {getDisplayValue(selectedApp.ug_details?.year_of_passing, selectedApp.ug_year_of_passing)}</p>
                </div>
                {(selectedApp.pg_details || selectedApp.pg_degree_name || selectedApp.pg_college_university || selectedApp.pg_specialization || selectedApp.pg_cgpa_percentage || selectedApp.pg_year_of_passing) && (
                  <div className="sub-section">
                    <h4>PG Details</h4>
                    <p><strong>Degree:</strong> {getDisplayValue(selectedApp.pg_details?.degree_name, selectedApp.pg_degree_name)}</p>
                    <p><strong>University:</strong> {getDisplayValue(selectedApp.pg_details?.college_university, selectedApp.pg_college_university)}</p>
                    <p><strong>Specialization:</strong> {getDisplayValue(selectedApp.pg_details?.specialization, selectedApp.pg_specialization)}</p>
                    <p><strong>CGPA/Percentage:</strong> {getDisplayValue(selectedApp.pg_details?.cgpa_percentage, selectedApp.pg_cgpa_percentage)}</p>
                    <p><strong>Year:</strong> {getDisplayValue(selectedApp.pg_details?.year_of_passing, selectedApp.pg_year_of_passing)}</p>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Research Information</h3>
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
                <h3>Entrance Exam</h3>
                <p><strong>Exam:</strong> {getDisplayValue(selectedApp.entrance_exam?.exam_name, selectedApp.exam_name)}</p>
                <p><strong>Registration Number:</strong> {getDisplayValue(selectedApp.entrance_exam?.registration_number, selectedApp.registration_number)}</p>
                <p><strong>Score/Rank:</strong> {getDisplayValue(selectedApp.entrance_exam?.score_rank, selectedApp.score_rank)}</p>
                <p><strong>Year:</strong> {getDisplayValue(selectedApp.entrance_exam?.year_of_exam, selectedApp.year_of_exam)}</p>
                <p><strong>Validity:</strong> {getDisplayValue(selectedApp.entrance_exam?.validity_period, selectedApp.validity_period)}</p>
              </div>

              <div className="documents-section">
                <h3>Uploaded Documents</h3>
                {selectedDocuments.length > 0 ? (
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
                ) : (
                  <p>No uploaded documents available for this application.</p>
                )}
              </div>

              {selectedApp.reviews && selectedApp.reviews.length > 0 && (
                <div className="detail-section">
                  <h3>Previous Reviews</h3>
                  {selectedAverageScore !== 'N/A' && (
                    <div className="score-summary">
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
                      <p><strong>Decision:</strong> {formatTextLabel(getDisplayValue(review.recommendation, review.decision))}</p>
                      <p><strong>Remarks:</strong> {getDisplayValue(review.remarks)}</p>
                      <p><small>{formatDateTime(review.created_at || review.reviewed_at)}</small></p>
                    </div>
                  ))}
                </div>
              )}

              {showInterviewSection && (
                <div className="detail-section">
                  <h3>Interview Stage</h3>
                  <div className="detail-grid">
                    <p><strong>Status:</strong> {formatApplicationStatus(selectedApp.status)}</p>
                    <p><strong>Interview Date:</strong> {formatDateTime(selectedApp.interviewDate)}</p>
                    <p><strong>Mode:</strong> {getDisplayValue(selectedApp.interviewMode)}</p>
                    <p><strong>Panel:</strong> {getDisplayValue(selectedApp.interviewPanel)}</p>
                    <p><strong>Result:</strong> {selectedApp.interviewResult ? formatTextLabel(selectedApp.interviewResult) : 'N/A'}</p>
                  </div>
                  <p><strong>Remarks:</strong> {getDisplayValue(selectedApp.interviewRemarks)}</p>
                </div>
              )}

              {selectedApp.reviewed_by_me && (
                <div className="alert alert-info">
                  You have already submitted your faculty review for this application.
                </div>
              )}

              {canReviewSelectedApp && (
                <form onSubmit={handleSubmitReview} className="review-form">
                  <h3>Submit Faculty Review</h3>

                  <div className="form-grid">
                    <div>
                      <label>Academic Score (0-100) *</label>
                      <input
                        type="number"
                        name="academic_score"
                        value={reviewData.academic_score}
                        onChange={handleReviewChange}
                        min="0"
                        max="100"
                        required
                        placeholder="Score based on academic qualifications"
                      />
                    </div>

                    <div>
                      <label>Research Score (0-100) *</label>
                      <input
                        type="number"
                        name="research_score"
                        value={reviewData.research_score}
                        onChange={handleReviewChange}
                        min="0"
                        max="100"
                        required
                        placeholder="Score based on research potential"
                      />
                    </div>
                  </div>

                  <div>
                    <label>Decision *</label>
                    <select name="decision" value={reviewData.decision} onChange={handleReviewChange} required>
                      <option value="">Select Decision</option>
                      <option value="recommend_for_interview">Recommend for Interview</option>
                      <option value="reject">Reject</option>
                    </select>
                  </div>

                  <div>
                    <label>Remarks *</label>
                    <textarea
                      name="remarks"
                      value={reviewData.remarks}
                      onChange={handleReviewChange}
                      rows="6"
                      required
                      placeholder="Provide detailed feedback on the candidate's academic background, research proposal, and interview recommendation."
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => setSelectedApp(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </form>
              )}

              {canScheduleSelectedInterview && (
                <form onSubmit={handleScheduleInterview} className="review-form">
                  <h3>{selectedApp.interviewDate ? 'Update Interview Schedule' : 'Schedule Interview'}</h3>

                  <div className="form-grid">
                    <div>
                      <label>Interview Date & Time *</label>
                      <input
                        type="datetime-local"
                        name="interviewDate"
                        value={interviewSchedule.interviewDate}
                        onChange={handleInterviewScheduleChange}
                        required
                      />
                    </div>

                    <div>
                      <label>Interview Mode *</label>
                      <select
                        name="interviewMode"
                        value={interviewSchedule.interviewMode}
                        onChange={handleInterviewScheduleChange}
                        required
                      >
                        <option value="Online">Online</option>
                        <option value="Offline">Offline</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label>Interview Panel *</label>
                    <input
                      type="text"
                      name="interviewPanel"
                      value={interviewSchedule.interviewPanel}
                      onChange={handleInterviewScheduleChange}
                      required
                      placeholder="Enter interview panel members"
                    />
                  </div>

                  <div>
                    <label>Interview Remarks</label>
                    <textarea
                      name="remarks"
                      value={interviewSchedule.remarks}
                      onChange={handleInterviewScheduleChange}
                      rows="4"
                      placeholder="Add any scheduling notes for the interview"
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => setSelectedApp(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Saving...' : 'Save Interview Schedule'}
                    </button>
                  </div>
                </form>
              )}

              {canSubmitSelectedInterviewEvaluation && (
                <form onSubmit={handleSubmitInterviewEvaluation} className="review-form">
                  <h3>Interview Evaluation</h3>

                  <div>
                    <label>Interview Marks (Out of 50) *</label>
                    <input
                      type="number"
                      name="interview_marks"
                      min="0"
                      max="50"
                      step="0.01"
                      value={interviewEvaluation.interview_marks}
                      onChange={handleInterviewEvaluationChange}
                      required
                      placeholder="Enter interview marks out of 50"
                    />
                  </div>

                  <div>
                    <label>Interview Remarks</label>
                    <textarea
                      name="remarks"
                      value={interviewEvaluation.remarks}
                      onChange={handleInterviewEvaluationChange}
                      rows="5"
                      placeholder="Enter remarks for interview evaluation"
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => setSelectedApp(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading || String(interviewEvaluation.interview_marks ?? '').trim() === ''}
                    >
                      {loading ? 'Saving...' : 'Save Interview Evaluation'}
                    </button>
                  </div>
                </form>
              )}

              {showFacultyViewOnly && (
                <>
                  <div className="alert alert-info">
                    View Only: Faculty actions are enabled only for Faculty Review, Recommended for Interview (schedule), and Interview Scheduled (result).
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-primary" disabled>
                      Recommend for Interview
                    </button>
                    <button type="button" className="btn-secondary" disabled>
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
      </div>
    </div>
  );
}

export default FacultyDashboard;