import { useState, useEffect } from 'react';
import api, { getApiErrorMessage } from '../api';
import '../App.css';
import {
  formatApplicationStatus,
  getDocumentLabel,
  getUploadedDocuments
} from '../applicationHelpers';

const SCRUTINY_ACTIONABLE_STATUSES = ['submitted', 'under_scrutiny'];
const EXAM_COMPLETED_STATUS = 'Completed';

const getEvaluationStateFromApp = (app) => {
  const attendanceStatus = String(app?.attendanceStatus || '').trim() || 'Present';
  const entranceMarks = attendanceStatus === 'Present' && app?.entranceMarks !== null && app?.entranceMarks !== undefined
    ? String(app.entranceMarks)
    : '';

  return {
    attendanceStatus,
    entranceMarks,
    remarks: String(app?.entranceEvaluationRemarks || '')
  };
};

function ScrutinyDashboard({ user, onLogout }) {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, actionable, verified, rejected, qualified

  const [scrutinyData, setScrutinyData] = useState({
    documents_review_confirmed: false,
    pg_eligibility_review_confirmed: false,
    remarks: ''
  });

  const [evaluationData, setEvaluationData] = useState({
    attendanceStatus: 'Present',
    entranceMarks: '',
    remarks: ''
  });
  const [examStatusControl, setExamStatusControl] = useState('Scheduled');

  // Extract department from role (e.g., "scrutiny_computer_science" -> "Computer Science")
  const getDepartmentFromRole = (role) => {
    if (!role || !role.startsWith('scrutiny_')) return 'All Departments';
    const deptSlug = role.replace('scrutiny_', '');
    return deptSlug.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const department = user.department || getDepartmentFromRole(user.role);

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/scrutiny/applications');
      let apps = response.data.applications || [];
      
      // Local UI filtering only. Server already limits to scrutiny department.
      if (filter === 'actionable') {
        apps = apps.filter(app => SCRUTINY_ACTIONABLE_STATUSES.includes(app.status));
      } else if (filter === 'verified') {
        apps = apps.filter(app => ['verified', 'approved'].includes(app.scrutiny_status) || app.scrutinyStatus === 'Approved');
      } else if (filter === 'rejected') {
        apps = apps.filter(app => app.scrutiny_status === 'rejected' || app.status === 'rejected');
      } else if (filter === 'qualified') {
        apps = apps.filter(app => app.qualified === true);
      }
      // 'all' shows everything
      
      setApplications(apps);
    } catch (error) {
      console.error('Error fetching applications:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleScrutinyChange = (e) => {
    const { name, value, type, checked } = e.target;
    setScrutinyData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleEvaluationChange = (e) => {
    const { name, value } = e.target;
    setEvaluationData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitEntranceEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    if ((selectedApp.examStatus || '').trim() !== EXAM_COMPLETED_STATUS) {
      alert('Evaluation is allowed only when exam status is Completed.');
      return;
    }

    if (evaluationData.attendanceStatus === 'Present' && String(evaluationData.entranceMarks).trim() === '') {
      alert('Please enter entrance marks for present candidates.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        application_id: selectedApp.id,
        attendance_status: evaluationData.attendanceStatus,
        remarks: evaluationData.remarks,
      };

      if (evaluationData.attendanceStatus === 'Present') {
        payload.entrance_marks = Number(evaluationData.entranceMarks);
      }

      const response = await api.post('/api/scrutiny/entrance-evaluation', payload);
      alert(response.data?.message || 'Entrance evaluation saved successfully.');

      setSelectedApp((prev) => prev ? {
        ...prev,
        attendanceStatus: response.data?.attendanceStatus,
        entranceMarks: response.data?.entranceMarks,
        qualified: response.data?.qualified,
        candidateStatus: response.data?.candidateStatus,
        entranceRank: response.data?.entranceRank,
        entranceEvaluationRemarks: evaluationData.remarks,
      } : prev);

      setEvaluationData((prev) => ({
        attendanceStatus: response.data?.attendanceStatus || prev.attendanceStatus || 'Present',
        entranceMarks: response.data?.attendanceStatus === 'Present'
          ? String(response.data?.entranceMarks ?? prev.entranceMarks ?? '')
          : '',
        remarks: prev.remarks,
      }));

      await fetchApplications();
    } catch (error) {
      console.error('Error saving entrance evaluation:', error);
      alert(getApiErrorMessage(error, 'Failed to save entrance evaluation'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExamStatus = async () => {
    if (!selectedApp) return;
    setLoading(true);
    try {
      const response = await api.post('/api/scrutiny/exam-status', {
        application_id: selectedApp.id,
        status: examStatusControl,
      });

      alert(response.data?.message || 'Exam status updated successfully.');
      setSelectedApp((prev) => prev ? { ...prev, examStatus: response.data?.examStatus || examStatusControl } : prev);
      await fetchApplications();
    } catch (error) {
      console.error('Error updating exam status:', error);
      alert(getApiErrorMessage(error, 'Failed to update exam status'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitScrutiny = async (e) => {
    e.preventDefault();

    if (!selectedApp || !SCRUTINY_ACTIONABLE_STATUSES.includes(selectedApp.status)) {
      alert('This application is in View Only mode. Scrutiny action is not allowed for the current status.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/scrutiny/verify', {
        application_id: selectedApp.id,
        documents_review_confirmed: scrutinyData.documents_review_confirmed,
        pg_eligibility_review_confirmed: scrutinyData.pg_eligibility_review_confirmed,
        remarks: scrutinyData.remarks
      });

      alert(response.data?.message || 'Scrutiny completed successfully.');
      setSelectedApp(null);
      setScrutinyData({
        documents_review_confirmed: false,
        pg_eligibility_review_confirmed: false,
        remarks: ''
      });
      fetchApplications();
    } catch (error) {
      console.error('Error submitting scrutiny:', error);
      alert(getApiErrorMessage(error, 'Failed to submit scrutiny'));
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentAction = async (fileId, fieldKey, action) => {
    try {
      const response = await api.get(`/api/download-file/${encodeURIComponent(fileId)}`, {
        responseType: 'blob'
      });

      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const disposition = response.headers['content-disposition'] || '';
      const filenameStarMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const extensionByType = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/webp': 'webp'
      };
      const fallbackExt = extensionByType[contentType.toLowerCase()] || 'bin';
      const filename = filenameStarMatch?.[1]
        ? decodeURIComponent(filenameStarMatch[1])
        : (filenameMatch?.[1] || `${fieldKey}.${fallbackExt}`);

      const isPdf = contentType.toLowerCase().includes('pdf') || filename.toLowerCase().endsWith('.pdf');
      const blob = new Blob([response.data], { type: isPdf ? 'application/pdf' : contentType });
      const url = window.URL.createObjectURL(blob);

      if (action === 'view') {
        const previewWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!previewWindow) {
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
        }
        return;
      }

      if (action === 'download') {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return;
      }

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Document action failed:', error);
      alert(getApiErrorMessage(error, `Failed to ${action} document`));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const parsePgMarks = (app) => {
    const raw = app?.pgPercentage;
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    const match = String(raw).match(/\d+(\.\d+)?/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : null;
  };

  const getEligibilityStatus = (app) => {
    const pgMarks = parsePgMarks(app);
    const category = String(app?.personal_details?.category || '').trim().toLowerCase();
    const reservedCategories = new Set(['sc', 'st', 'obc', 'ebc', 'pwd', 'women']);
    const requiredMarks = reservedCategories.has(category) ? 50 : 55;

    if (pgMarks === null) {
      return {
        pgMarks: null,
        category,
        requiredMarks,
        status: 'PG Marks Missing',
        statusType: 'missing',
        isEligible: false
      };
    }

    const isEligible = pgMarks >= requiredMarks;
    const status = isEligible ? 'Eligible' : 'Not Eligible';

    return {
      pgMarks,
      category,
      requiredMarks,
      status,
      statusType: isEligible ? 'eligible' : 'ineligible',
      isEligible
    };
  };

  const selectedDocuments = selectedApp ? getUploadedDocuments(selectedApp) : [];
  const evaluatedApplications = applications.filter((app) => app.attendanceStatus || app.entranceMarks !== null && app.entranceMarks !== undefined || app.candidateStatus || app.entranceRank !== null && app.entranceRank !== undefined);
  const qualifiedCandidates = evaluatedApplications
    .filter((app) => app.qualified === true)
    .sort((a, b) => Number(b.entranceMarks || 0) - Number(a.entranceMarks || 0));
  const deptCandidates = applications;
  const getCandidateStateTypeLabel = (candidate) => {
    const rawStateType = String(
      candidate?.stateType
      || candidate?.candidate_state_type
      || candidate?.personal_details?.candidate_state_type
      || ''
    ).trim().toLowerCase();

    return rawStateType === 'puducherry ut' ? 'Puducherry UT' : 'Other State';
  };
  const puducherryCandidates = deptCandidates.filter((candidate) => getCandidateStateTypeLabel(candidate) === 'Puducherry UT');
  const otherStateCandidates = deptCandidates.filter((candidate) => getCandidateStateTypeLabel(candidate) === 'Other State');
  const canTakeScrutinyAction = Boolean(selectedApp)
    && SCRUTINY_ACTIONABLE_STATUSES.includes(selectedApp.status);
  const canEvaluateEntrance = Boolean(selectedApp)
    && String(selectedApp.examStatus || '').trim() === EXAM_COMPLETED_STATUS;
  const selectedEvaluationState = selectedApp ? getEvaluationStateFromApp(selectedApp) : null;
  const normalizedCurrentAttendance = String(evaluationData.attendanceStatus || '').trim() || 'Present';
  const normalizedCurrentMarks = normalizedCurrentAttendance === 'Present'
    ? String(evaluationData.entranceMarks ?? '').trim()
    : '';
  const normalizedSelectedMarks = selectedEvaluationState && selectedEvaluationState.attendanceStatus === 'Present'
    ? String(selectedEvaluationState.entranceMarks ?? '').trim()
    : '';
  const hasEvaluationChanges = Boolean(selectedEvaluationState) && (
    normalizedCurrentAttendance !== selectedEvaluationState.attendanceStatus
    || normalizedCurrentMarks !== normalizedSelectedMarks
    || String(evaluationData.remarks ?? '').trim() !== String(selectedEvaluationState.remarks ?? '').trim()
  );
  const canSaveEntranceEvaluation = canEvaluateEntrance
    && !loading
    && hasEvaluationChanges
    && (normalizedCurrentAttendance === 'Absent' || normalizedCurrentMarks !== '');
  const eligibilityInfo = selectedApp ? getEligibilityStatus(selectedApp) : null;
  const categoryLabel = (eligibilityInfo?.category || 'general').toUpperCase();
  const scrutinySummaryItems = selectedApp ? [
    { label: 'Department', value: selectedApp.department || 'N/A' },
    { label: 'Payment', value: selectedApp.paymentStatus || 'Pending' },
    { label: 'Documents', value: `${selectedDocuments.length} uploaded` },
    { label: 'Eligibility', value: eligibilityInfo?.status || 'Pending' },
  ] : [];

  const renderCandidateCards = (candidates) => {
    if (!candidates.length) {
      return (
        <div className="empty-state scrutiny-state-empty" style={{ marginBottom: '16px' }}>
          <p>No candidates available</p>
        </div>
      );
    }

    return (
      <div className="dashboard-cards">
        {candidates.map((app) => (
          <div
            key={app.id}
            className="dashboard-card"
            onClick={() => {
              setSelectedApp(app);
              setExamStatusControl((app.examStatus || 'Scheduled') === 'Completed' ? 'Completed' : 'Scheduled');
              setEvaluationData(getEvaluationStateFromApp(app));
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-header-row">
              <h3>{app.registration_id}</h3>
              <span className={`status status-${app.status || 'submitted'}`}>
                {formatApplicationStatus(app.status)}
              </span>
            </div>
            <div className="card-details">
              <p><strong>Name:</strong> {app.personal_details?.full_name || app.scholar_name}</p>
              <p><strong>Email:</strong> {app.personal_details?.email || app.scholar_email}</p>
              <p><strong>Department:</strong> {app.department || 'Not specified'}</p>
              <p><strong>State Type:</strong> {getCandidateStateTypeLabel(app)}</p>
              <p><strong>Research Area:</strong> {app.research_info?.area_of_interest || 'Not specified'}</p>
              <p><strong>Submitted:</strong> {formatDate(app.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="dashboard">
      {/* Navigation */}
      <nav className="dashboard-nav">
        <h2>Scrutiny Dashboard - {department}</h2>
        <div className="nav-actions">
          <span className="welcome-text">Welcome, {user.full_name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="dashboard-content">
        
        {/* Filter Tabs */}
        <div className="tabs">
          <button 
            className={`tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Applications
          </button>
          <button 
            className={`tab ${filter === 'actionable' ? 'active' : ''}`}
            onClick={() => setFilter('actionable')}
          >
            Actionable
          </button>
          <button 
            className={`tab ${filter === 'verified' ? 'active' : ''}`}
            onClick={() => setFilter('verified')}
          >
            Verified
          </button>
          <button 
            className={`tab ${filter === 'rejected' ? 'active' : ''}`}
            onClick={() => setFilter('rejected')}
          >
            Rejected
          </button>
          <button
            className={`tab ${filter === 'qualified' ? 'active' : ''}`}
            onClick={() => setFilter('qualified')}
          >
            Qualified Candidates
          </button>
        </div>

        {/* Applications Grid */}
        <h3 className="section-title">
          {filter === 'qualified' ? `Qualified Candidates (${applications.length})` : `Applications for Scrutiny (${applications.length})`}
        </h3>
        
        {loading && <div className="loading-message">Loading applications...</div>}
        
        {!loading && applications.length === 0 && (
          <div className="empty-state">
            <p>No candidates available</p>
          </div>
        )}

        {!loading && applications.length > 0 && (
          <div className="scrutiny-state-groups">
            <section className="scrutiny-state-section">
              <div className="scrutiny-state-header">
                <h4>Candidates from Puducherry UT</h4>
                <span className="scrutiny-state-count">{puducherryCandidates.length}</span>
              </div>
              {renderCandidateCards(puducherryCandidates)}
            </section>
            <section className="scrutiny-state-section">
              <div className="scrutiny-state-header">
                <h4>Candidates from Other States</h4>
                <span className="scrutiny-state-count">{otherStateCandidates.length}</span>
              </div>
              {renderCandidateCards(otherStateCandidates)}
            </section>
          </div>
        )}

        {filter === 'qualified' && (
        <div className="detail-section qualified-evaluation-section">
          <div className="qualified-evaluation-header">
            <h3>Entrance Exam Evaluation</h3>
            <span className="qualified-count-pill">Qualified: {qualifiedCandidates.length}</span>
          </div>
          {evaluatedApplications.length === 0 ? (
            <p className="qualified-empty-text">No evaluated candidates yet for this department.</p>
          ) : (
            <div className="qualified-table-container">
              <table className="qualified-results-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Marks</th>
                    <th>Qualified</th>
                    <th>Entrance Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluatedApplications
                    .slice()
                    .sort((a, b) => {
                      const aRank = Number(a.entranceRank || Number.MAX_SAFE_INTEGER);
                      const bRank = Number(b.entranceRank || Number.MAX_SAFE_INTEGER);
                      if (aRank !== bRank) return aRank - bRank;
                      return Number(b.entranceMarks || 0) - Number(a.entranceMarks || 0);
                    })
                    .map((app) => (
                      <tr key={`eval-${app.id}`}>
                        <td>{app.personal_details?.full_name || app.scholar_name || 'N/A'}</td>
                        <td>{app.department || 'N/A'}</td>
                        <td>{app.entranceMarks ?? 'N/A'}</td>
                        <td>
                          <span className={`qualified-status-pill ${app.qualified ? 'is-qualified' : 'is-not-qualified'}`}>
                            {app.qualified ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          {app.qualified
                            ? <span className="rank-pill">#{app.entranceRank ?? 'Pending'}</span>
                            : '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="qualified-footer-note">
            Qualified candidates in this department: {qualifiedCandidates.length}
          </p>
        </div>
        )}

        {/* Application Detail View */}
        {selectedApp && (
          <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
            <div className="modal-content scrutiny-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="scrutiny-modal-header">
                    <div>
                      <p className="scrutiny-modal-kicker">Scrutiny Review</p>
                      <h2>{selectedApp.registration_id}</h2>
                      <p className="scrutiny-modal-subtitle">
                        Review applicant details, verify uploaded documents, and confirm PG eligibility before submission.
                      </p>
                    </div>
                    <span className={`scrutiny-status-badge status-${selectedApp.status || 'submitted'}`}>
                      {formatApplicationStatus(selectedApp.status)}
                    </span>
                  </div>

                  <div className="scrutiny-summary-grid">
                    {scrutinySummaryItems.map((item) => (
                      <div key={item.label} className="scrutiny-summary-card">
                        <span className="summary-label">{item.label}</span>
                        <strong className="summary-value">{item.value}</strong>
                      </div>
                    ))}
                  </div>
                  
                  <div className="applicant-details scrutiny-section-card">
                    <h3>Applicant Information</h3>
                    <p><strong>Name:</strong> {selectedApp.personal_details?.full_name || selectedApp.scholar_name}</p>
                    <p><strong>Email:</strong> {selectedApp.personal_details?.email || selectedApp.scholar_email}</p>
                    <p><strong>Phone:</strong> {selectedApp.personal_details?.mobile || 'N/A'}</p>
                    <p><strong>Department:</strong> {selectedApp.department || 'N/A'}</p>
                    <p><strong>Status:</strong> {formatApplicationStatus(selectedApp.status)}</p>
                    <p><strong>Payment Status:</strong> {selectedApp.paymentStatus || 'Pending'}</p>
                    <p><strong>Exam Status:</strong> {selectedApp.examStatus || 'Pending'}</p>
                    <p><strong>UG Qualification:</strong> {selectedApp.ug_details?.degree_name} - {selectedApp.ug_details?.branch_department}</p>
                    <p><strong>UG CGPA:</strong> {selectedApp.ug_details?.cgpa_percentage || 'N/A'}</p>
                    {selectedApp.pg_details && (
                      <>
                        <p><strong>PG Qualification:</strong> {selectedApp.pg_details?.degree_name} - {selectedApp.pg_details?.branch_department}</p>
                        <p><strong>PG CGPA:</strong> {selectedApp.pg_details?.cgpa_percentage || 'N/A'}</p>
                      </>
                    )}
                    <p><strong>Research Area:</strong> {selectedApp.research_info?.area_of_interest || 'N/A'}</p>
                    <p><strong>Proposed Topic:</strong> {selectedApp.research_info?.proposed_topic || 'N/A'}</p>
                    {selectedApp.work_experience && selectedApp.work_experience.years_of_experience && (
                      <p><strong>Work Experience:</strong> {selectedApp.work_experience.years_of_experience} years</p>
                    )}
                  </div>

                  {selectedDocuments.length > 0 && (
                    <div className="documents-section scrutiny-docs-card">
                      <h3>Uploaded Documents</h3>
                      <ul className="documents-list">
                        {selectedDocuments.map((doc, idx) => (
                          <li key={`${doc.key}-${idx}`}>
                            <span>📄 {getDocumentLabel(doc.key)}</span>
                            <button
                              type="button"
                              className="doc-link-btn"
                              style={{ marginLeft: '12px' }}
                              onClick={() => handleDocumentAction(doc.fileId, doc.key, 'view')}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="doc-link-btn"
                              style={{ marginLeft: '8px' }}
                              onClick={() => handleDocumentAction(doc.fileId, doc.key, 'download')}
                            >
                              Download
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <form onSubmit={handleSubmitScrutiny} className="review-form scrutiny-review-card">
                    <h3>Scrutiny Verification</h3>
                    {!canTakeScrutinyAction && (
                      <div className="alert alert-info scrutiny-info-note">
                        View Only: Scrutiny action is allowed only when status is Submitted or Under Scrutiny.
                      </div>
                    )}

                    <div className="alert alert-info scrutiny-info-note">
                      Documents verification and eligibility are auto-calculated by system rules during scrutiny submission.
                    </div>

                    {eligibilityInfo && (
                      <div
                        className={`eligibility-panel status-${eligibilityInfo.statusType}`}
                      >
                        <p>
                          <strong>Applicant Category:</strong> {categoryLabel}
                        </p>
                        <p><strong>PG Marks:</strong> {eligibilityInfo.pgMarks === null ? 'Not Provided' : `${eligibilityInfo.pgMarks}%`}</p>
                        <p>
                          <strong>Eligibility Status:</strong>
                          <span className={`eligibility-badge status-${eligibilityInfo.statusType}`}>{eligibilityInfo.status}</span>
                        </p>
                        <p>
                          <strong>Category Threshold Applied:</strong> {categoryLabel} requires minimum {eligibilityInfo.requiredMarks}%
                        </p>
                        <p><strong>Reference Rule:</strong> General → 55% | Reserved (SC/ST/OBC/EBC/PwD/Women) → 50%</p>
                        <p><strong>Final Decision Rule:</strong> documentsVerified = true and eligibilityStatus = Eligible → Approved, otherwise Rejected (including missing PG marks).</p>
                      </div>
                    )}

                    <div className="scrutiny-checklist-item checklist-docs">
                      <label>
                        <input
                          type="checkbox"
                          name="documents_review_confirmed"
                          checked={Boolean(scrutinyData.documents_review_confirmed)}
                          onChange={handleScrutinyChange}
                          disabled={!canTakeScrutinyAction || loading}
                        />
                        <span>I confirm all required documents are present and verified against the applicant category/state/mode rules.</span>
                      </label>
                    </div>

                    <div className="scrutiny-checklist-item checklist-eligibility">
                      <label>
                        <input
                          type="checkbox"
                          name="pg_eligibility_review_confirmed"
                          checked={Boolean(scrutinyData.pg_eligibility_review_confirmed)}
                          onChange={handleScrutinyChange}
                          disabled={!canTakeScrutinyAction || loading}
                        />
                        <span>
                          {eligibilityInfo?.statusType === 'eligible'
                            ? `I confirm PG marks meet the applied threshold for ${categoryLabel} (${eligibilityInfo?.requiredMarks ?? 55}% minimum).`
                            : eligibilityInfo?.statusType === 'missing'
                              ? `I confirm PG marks are missing/unavailable for this application and treated as Not Eligible for scrutiny.`
                              : `I confirm PG marks were verified and do not meet the applied threshold for ${categoryLabel} (${eligibilityInfo?.requiredMarks ?? 55}% minimum).`
                          }
                        </span>
                      </label>
                    </div>
                    
                    <div className="form-group scrutiny-remarks-group">
                      <label>Remarks (Optional)</label>
                      <textarea
                        name="remarks"
                        value={scrutinyData.remarks}
                        onChange={handleScrutinyChange}
                        disabled={!canTakeScrutinyAction || loading}
                        rows="5"
                        placeholder="Enter your scrutiny remarks, observations, or required corrections..."
                      />
                    </div>

                    <div className="form-actions scrutiny-actions">
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
                        disabled={!canTakeScrutinyAction || loading || !scrutinyData.documents_review_confirmed || !scrutinyData.pg_eligibility_review_confirmed}
                      >
                        {canTakeScrutinyAction ? (loading ? 'Submitting...' : 'Submit Scrutiny') : 'View Only'}
                      </button>
                    </div>
                  </form>

                  <form onSubmit={handleSubmitEntranceEvaluation} className="review-form scrutiny-review-card" style={{ marginTop: '16px' }}>
                    <h3>Entrance Exam Evaluation</h3>
                    <div className="form-group scrutiny-remarks-group">
                      <label>Exam Status Control</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                          value={examStatusControl}
                          onChange={(e) => setExamStatusControl(e.target.value)}
                          disabled={loading}
                        >
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                        </select>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleUpdateExamStatus}
                          disabled={loading}
                        >
                          Update Exam Status
                        </button>
                      </div>
                    </div>

                    <div className="alert alert-info scrutiny-info-note">
                      Evaluation is allowed only when Exam Status is Completed.
                    </div>

                    <p><strong>Current Exam Status:</strong> {selectedApp.examStatus || 'Pending'}</p>

                    <div className="form-group scrutiny-remarks-group">
                      <label>Attendance Status</label>
                      <select
                        name="attendanceStatus"
                        value={evaluationData.attendanceStatus}
                        onChange={handleEvaluationChange}
                        disabled={!canEvaluateEntrance || loading}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </div>

                    {evaluationData.attendanceStatus === 'Present' && (
                      <div className="form-group scrutiny-remarks-group">
                        <label>Entrance Marks (Out of 150)</label>
                        <input
                          type="number"
                          name="entranceMarks"
                          min="0"
                          max="150"
                          step="0.01"
                          value={evaluationData.entranceMarks}
                          onChange={handleEvaluationChange}
                          disabled={!canEvaluateEntrance || loading}
                          placeholder="Enter marks out of 150"
                        />
                      </div>
                    )}

                    <div className="form-group scrutiny-remarks-group">
                      <label>Evaluation Remarks (Optional)</label>
                      <textarea
                        name="remarks"
                        value={evaluationData.remarks}
                        onChange={handleEvaluationChange}
                        disabled={!canEvaluateEntrance || loading}
                        rows="3"
                        placeholder="Enter evaluation remarks"
                      />
                    </div>

                    <div style={{ marginBottom: '12px', fontSize: '14px' }}>
                      <p><strong>Current Attendance:</strong> {selectedApp.attendanceStatus || 'Not Evaluated'}</p>
                      <p><strong>Current Marks:</strong> {selectedApp.entranceMarks ?? 'N/A'}</p>
                      <p><strong>Qualification:</strong> {selectedApp.qualified ? 'Qualified for Ranking' : (selectedApp.candidateStatus || 'Not Evaluated')}</p>
                      <p><strong>Entrance Rank:</strong> {selectedApp.qualified ? (selectedApp.entranceRank ?? 'Pending') : '-'}</p>
                    </div>

                    <div className="form-actions scrutiny-actions">
                      <button type="submit" className="btn-primary" disabled={!canSaveEntranceEvaluation}>
                        {loading ? 'Saving...' : 'Save Entrance Evaluation'}
                      </button>
                    </div>
                  </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScrutinyDashboard;
