import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../api';
import '../App.css';
import './DirectorDashboard.css';
import {
  calculateAverageReviewScore,
  formatApplicationStatus,
  formatDateTime,
  formatTextLabel,
  getDisplayValue,
  getDocumentLabel,
  getUploadedDocuments
} from '../applicationHelpers';

function DirectorDashboard({ user, onLogout }) {
  const [applications, setApplications] = useState([]);
  const [expandedDepartment, setExpandedDepartment] = useState(null);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingFolder, setExportingFolder] = useState(false);
  const [view, setView] = useState('applications');
  const [filter, setFilter] = useState('all');
  const [rankDepartmentFilter, setRankDepartmentFilter] = useState('all');
  const [rankInstituteFilter, setRankInstituteFilter] = useState('all');
  const [finalRankList, setFinalRankList] = useState([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [seatAllocating, setSeatAllocating] = useState(false);
  const [lastAllocation, setLastAllocation] = useState(null);
  const [seatConfig, setSeatConfig] = useState({
    totalSeats: 11,
    distribution: {
      visvesvaraya: 1,
      merit: 3,
      general: 2,
      obc: 2,
      mbc: 1,
      sc_st: 2,
    },
  });
  const [decisionData, setDecisionData] = useState({
    decision: '',
    remarks: ''
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (view === 'applications') {
      fetchApplications();
    }
    if (view === 'final-rank') {
      fetchFinalRankList();
    }
    fetchStatistics();
  }, [filter, view, rankDepartmentFilter, rankInstituteFilter]);

  useEffect(() => {
    setDecisionData({
      decision: '',
      remarks: ''
    });
    setShowConfirmModal(false);
  }, [expandedStudent]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/api/director/applications', { params });
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
      const params = {};
      if (rankDepartmentFilter !== 'all') {
        params.department = rankDepartmentFilter;
      }
      if (rankInstituteFilter !== 'all') {
        params.institute = rankInstituteFilter;
      }
      const response = await api.get('/api/final-rank-list', { params });
      setFinalRankList(response.data.rankList || []);
    } catch (error) {
      console.error('Error fetching final rank list:', error);
      setFinalRankList([]);
    } finally {
      setRankLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get('/api/director/statistics');
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
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
  const rankDepartments = Array.from(new Set(finalRankList.map((row) => row.department).filter(Boolean))).sort();
  const rankInstitutes = Array.from(
    new Set(['PTU', 'PKIT', ...finalRankList.map((row) => row.institute).filter(Boolean)])
  );
  const groupedRankList = finalRankList.reduce((acc, row) => {
    const department = row.department || 'Not Specified';
    if (!acc[department]) {
      acc[department] = [];
    }
    acc[department].push(row);
    return acc;
  }, {});
  const seatSummaryByGroup = finalRankList.reduce((acc, row) => {
    const department = row.department || 'Not Specified';
    const institute = row.institute || 'PTU';
    const key = `${department}|||${institute}`;

    if (!acc[key]) {
      acc[key] = {
        department,
        institute,
        total: 0,
        allocated: 0,
        lapsed: 0,
        notSelected: 0,
        categories: {
          VISVESVARAYA: 0,
          MERIT: 0,
          GENERAL: 0,
          OBC: 0,
          MBC: 0,
          SC_ST: 0,
          LAPSE: 0,
        },
      };
    }

    acc[key].total += 1;
    const status = String(row.seatAllocationStatus || '').toLowerCase();
    const seatType = String(row.seatType || '').toUpperCase();

    if (status === 'seat allocated') {
      acc[key].allocated += 1;
      if (seatType.startsWith('LAPSE')) {
        acc[key].lapsed += 1;
        acc[key].categories.LAPSE += 1;
      } else if (acc[key].categories[seatType] !== undefined) {
        acc[key].categories[seatType] += 1;
      }
    } else {
      acc[key].notSelected += 1;
    }

    return acc;
  }, {});
  const seatSummaryRows = Object.values(seatSummaryByGroup).sort((a, b) => {
    const departmentCompare = String(a.department).localeCompare(String(b.department));
    if (departmentCompare !== 0) {
      return departmentCompare;
    }
    return String(a.institute).localeCompare(String(b.institute));
  });
  const seatDistributionTotal = Object.values(seatConfig.distribution || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const rankCardStyle = {
    marginBottom: '20px',
    borderRadius: '16px',
    border: '1px solid #b9d9ff',
    background: 'linear-gradient(135deg, #f8fbff 0%, #eef7ff 100%)',
    boxShadow: '0 8px 22px rgba(13, 71, 161, 0.12)',
    padding: '16px',
  };
  const rankCardHeadingStyle = {
    marginBottom: '12px',
    color: '#0f3f7f',
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '0.2px',
  };
  const rankInputLabelStyle = {
    color: '#1e3554',
    fontWeight: 700,
    fontSize: '14px',
    display: 'block',
    marginBottom: '6px',
  };
  const rankInputStyle = {
    borderColor: '#91c0ff',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    color: '#102a43',
    fontWeight: 600,
  };
  const rankPrimaryButtonStyle = {
    background: 'linear-gradient(135deg, #1662c4 0%, #0c4da2 100%)',
    border: 'none',
    color: '#ffffff',
    fontWeight: 700,
    borderRadius: '10px',
    padding: '10px 20px',
    boxShadow: '0 8px 18px rgba(12, 77, 162, 0.28)',
  };
  const rankSectionTitleStyle = {
    color: '#0f4f9d',
    fontSize: '28px',
    fontWeight: 800,
    borderBottom: '3px solid #2f80ed',
    paddingBottom: '8px',
    marginBottom: '16px',
    letterSpacing: '0.3px',
  };
  const selectedApp = applications.find((app) => app.id === expandedStudent) || null;

  const updateSeatDistribution = (key, value) => {
    const nextValue = Math.max(0, Number(value || 0));
    setSeatConfig((prev) => ({
      ...prev,
      distribution: {
        ...prev.distribution,
        [key]: nextValue,
      },
    }));
  };

  const handleSeatAllocation = async () => {
    if (Number(seatConfig.totalSeats || 0) !== seatDistributionTotal) {
      alert(`Seat configuration mismatch: totalSeats is ${seatConfig.totalSeats} but distribution total is ${seatDistributionTotal}.`);
      return;
    }

    if (rankDepartmentFilter === 'all') {
      alert('Please select a department before running seat allocation.');
      return;
    }

    if (rankInstituteFilter === 'all') {
      alert('Please select an institution before running seat allocation.');
      return;
    }

    setSeatAllocating(true);
    try {
      const response = await api.post('/api/seat-allocation/run', {
        seatConfig,
        department: rankDepartmentFilter,
        institute: rankInstituteFilter,
      });
      setLastAllocation(response.data?.allocation || null);
      await fetchFinalRankList();
      const allocated = response.data?.allocation?.allocatedCandidates ?? 0;
      const notSelected = response.data?.allocation?.notSelectedCandidates ?? 0;
      alert(`Seat allocation completed. Allocated: ${allocated}, Not Selected: ${notSelected}.`);
    } catch (error) {
      console.error('Seat allocation failed:', error);
      alert(getApiErrorMessage(error, 'Failed to run seat allocation'));
    } finally {
      setSeatAllocating(false);
    }
  };

  const toggleDepartment = (departmentName) => {
    setExpandedDepartment((prev) => {
      const isSameDepartment = prev === departmentName;
      setExpandedStudent(null);
      return isSameDepartment ? null : departmentName;
    });
  };

  const toggleStudent = (applicationId) => {
    setExpandedStudent((prev) => (prev === applicationId ? null : applicationId));
  };

  const handleDecisionChange = (event) => {
    const { name, value } = event.target;
    setDecisionData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConfirmDirectorDecision = async () => {
    if (!selectedApp) {
      return;
    }

    setShowConfirmModal(false);
    setLoading(true);
    try {
      await api.post(`/api/director/final-decision/${selectedApp.id}`, decisionData);
      alert('Research Director decision submitted successfully.');
      setExpandedStudent(null);
      await fetchApplications();
      await fetchStatistics();
    } catch (error) {
      console.error('Error submitting director decision:', error);
      alert(getApiErrorMessage(error, 'Failed to submit director decision'));
    } finally {
      setLoading(false);
    }
  };

  const handleDirectorDecision = (event) => {
    event.preventDefault();

    if (!selectedApp) {
      return;
    }

    if (!decisionData.decision || !decisionData.remarks.trim()) {
      alert('Please select a decision and enter remarks.');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleDownloadDocument = async (fileId, fieldKey) => {
    const getExtensionFromContentType = (contentType) => {
      const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
      const extensionMap = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      };

      return extensionMap[normalizedType] || '';
    };

    const resolveDownloadName = (headers, fallbackField, reference, blobType) => {
      const disposition = headers['content-disposition'] || headers['Content-Disposition'] || '';
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i);

      if (filenameMatch?.[1]) {
        const decodedName = decodeURIComponent(filenameMatch[1]).trim();
        if (decodedName) {
          return decodedName;
        }
      }

      const referenceName = String(reference || '').split(/[\\/]/).pop()?.trim() || '';
      if (referenceName && /\.[A-Za-z0-9]{2,6}$/.test(referenceName)) {
        return referenceName;
      }

      const ext = getExtensionFromContentType(blobType || headers['content-type'] || headers['Content-Type']);
      return ext ? `${fallbackField}.${ext}` : fallbackField;
    };

    const rawReference = String(fileId || '').trim();
    if (!rawReference) {
      alert('Document reference is missing for this file.');
      return;
    }

    const referenceCandidates = [];
    const addCandidate = (value) => {
      const normalized = String(value || '').trim();
      if (normalized && !referenceCandidates.includes(normalized)) {
        referenceCandidates.push(normalized);
      }
    };

    addCandidate(rawReference);
    addCandidate(rawReference.replace(/^['"]|['"]$/g, ''));
    addCandidate(rawReference.replace(/^uploads[\\/]+/i, ''));

    const baseName = rawReference.split(/[\\/]/).pop();
    if (baseName) {
      addCandidate(baseName);
    }

    let lastError = null;

    try {
      for (const reference of referenceCandidates) {
        try {
          const response = await api.get(`/api/download-file/${encodeURIComponent(reference)}`, {
            responseType: 'blob'
          });

          const blob = response.data instanceof Blob
            ? response.data
            : new Blob([response.data], {
              type: response.headers['content-type'] || 'application/octet-stream'
            });
          const downloadName = resolveDownloadName(response.headers || {}, fieldKey, reference, blob.type);

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', downloadName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          return;
        } catch (primaryError) {
          lastError = primaryError;

          try {
            const legacyResponse = await api.get(`/api/download/${encodeURIComponent(reference)}`, {
              responseType: 'blob'
            });

            const blob = legacyResponse.data instanceof Blob
              ? legacyResponse.data
              : new Blob([legacyResponse.data], {
                type: legacyResponse.headers['content-type'] || 'application/octet-stream'
              });
            const downloadName = resolveDownloadName(legacyResponse.headers || {}, fieldKey, reference, blob.type);

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', downloadName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            return;
          } catch (legacyError) {
            lastError = legacyError;
          }
        }
      }

      alert('File reference exists, but the document could not be fetched. Please re-upload this document once and try again.');
    } catch (error) {
      console.error('Error downloading document:', error);
      alert(getApiErrorMessage(lastError || error, 'Failed to download document'));
    }
  };

  const handleExportScholarFolder = async (applicationId) => {
    setExportingFolder(true);
    try {
      const response = await api.get(`/api/director/export-scholar-folder/${applicationId}`, {
        responseType: 'blob'
      });

      const disposition = response.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const downloadName = filenameMatch?.[1] || `${applicationId}_scholar_folder.zip`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating scholar folder:', error);
      alert(getApiErrorMessage(error, 'Failed to create scholar folder'));
    } finally {
      setExportingFolder(false);
    }
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <h2>Director Dashboard</h2>
        <div className="nav-right">
          <span className="user-name">{user.full_name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="welcome-banner">
          <h1>Welcome, {user.full_name}!</h1>
          <p>View all applications by department, issue final decisions for Dean-approved candidates, and export scholar folders.</p>
        </div>

        {statistics && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Applications</h3>
              <div className="stat-number">{statistics.total_applications}</div>
            </div>
            <div className="stat-card">
              <h3>Under Scrutiny</h3>
              <div className="stat-number">{statistics.applications_by_status?.under_scrutiny || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Faculty Review</h3>
              <div className="stat-number">{statistics.applications_by_status?.faculty_review || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Interview Scheduled</h3>
              <div className="stat-number">{statistics.applications_by_status?.interview_scheduled || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Interview Completed</h3>
              <div className="stat-number">{statistics.applications_by_status?.interview_completed || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Dean Approved</h3>
              <div className="stat-number">{statistics.applications_by_status?.dean_approved || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Final Approved</h3>
              <div className="stat-number">{statistics.applications_by_status?.final_approved || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Total Reviews</h3>
              <div className="stat-number">{statistics.total_reviews}</div>
            </div>
          </div>
        )}

        <div className="view-tabs" style={{ marginBottom: '16px' }}>
          <button
            className={`tab-btn ${view === 'applications' ? 'active' : ''}`}
            onClick={() => setView('applications')}
          >
            Applications
          </button>
          <button
            className={`tab-btn ${view === 'final-rank' ? 'active' : ''}`}
            onClick={() => setView('final-rank')}
          >
            Final Rank List
          </button>
        </div>

        {view === 'applications' && (
          <>

        <div className="tabs">
          <button
            className={`tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Applications
          </button>
          <button
            className={`tab ${filter === 'dean_approved' ? 'active' : ''}`}
            onClick={() => setFilter('dean_approved')}
          >
            Dean Approved
          </button>
          <button
            className={`tab ${filter === 'final_approved' ? 'active' : ''}`}
            onClick={() => setFilter('final_approved')}
          >
            Final Approved
          </button>
        </div>

        <h3 className="section-title">Applications ({applications.length})</h3>

        {loading && <div className="loading-message">Loading applications...</div>}

        {!loading && applications.length === 0 && (
          <div className="empty-state">
            <p>No applications found</p>
          </div>
        )}

        {!loading && applications.length > 0 && (
          <div className="director-folder-tree">
            {Object.entries(groupedApplications).map(([department, deptApps]) => {
              const isDepartmentExpanded = expandedDepartment === department;

              return (
                <div key={department} className="department-folder-card">
                  <button
                    type="button"
                    className="department-folder-header"
                    onClick={() => toggleDepartment(department)}
                  >
                    <div className="department-folder-title">
                      <span className="folder-icon" aria-hidden="true">{isDepartmentExpanded ? '📂' : '📁'}</span>
                      <span className="department-name">{department}</span>
                    </div>
                    <div className="department-folder-meta">
                      <span className="department-count">
                        {deptApps.length} Application{deptApps.length !== 1 ? 's' : ''}
                      </span>
                      <span className="folder-chevron" aria-hidden="true">{isDepartmentExpanded ? '▾' : '▸'}</span>
                    </div>
                  </button>

                  <div className={`department-folder-content ${isDepartmentExpanded ? 'expanded' : ''}`}>
                    <div className="student-folder-list">
                      {deptApps.map((app) => {
                        const isStudentExpanded = expandedStudent === app.id;
                        const appDocuments = getUploadedDocuments(app);
                        const averageReviewScore = calculateAverageReviewScore(app.reviews);
                        const canSubmitDirectorDecision = app.status === 'dean_approved';
                        const showDirectorViewOnly = !canSubmitDirectorDecision;

                        return (
                          <div key={app.id} className="student-folder-card">
                            <button
                              type="button"
                              className="student-folder-header"
                              onClick={() => toggleStudent(app.id)}
                            >
                              <div className="student-folder-title">
                                <span className="student-icon" aria-hidden="true">{isStudentExpanded ? '📂' : '📄'}</span>
                                <span className="student-registration">{app.registration_id}</span>
                                <span className="student-name">- {getDisplayValue(app.personal_details?.full_name, app.scholar_name)}</span>
                              </div>
                              <div className="student-folder-meta">
                                <span className={`status status-${app.status}`}>{formatApplicationStatus(app.status)}</span>
                                <span className="folder-chevron" aria-hidden="true">{isStudentExpanded ? '▾' : '▸'}</span>
                              </div>
                            </button>

                            <div className={`student-folder-content ${isStudentExpanded ? 'expanded' : ''}`}>
                              {isStudentExpanded && (
                                <div className="student-details-panel">
                                  <div className="student-detail-sections">
                                    <div className="director-detail-section">
                                      <h4>Applicant Details</h4>
                                      <div className="detail-grid">
                                        <p><strong>Name:</strong> {getDisplayValue(app.personal_details?.full_name, app.scholar_name)}</p>
                                        <p><strong>Email:</strong> {getDisplayValue(app.personal_details?.email, app.scholar_email)}</p>
                                        <p><strong>Department:</strong> {getDisplayValue(app.department)}</p>
                                        <p><strong>Mode:</strong> {getDisplayValue(app.personal_details?.mode_of_study, app.mode_of_study)}</p>
                                        <p><strong>Category:</strong> {getDisplayValue(app.personal_details?.category, app.category)}</p>
                                        <p><strong>Research Area:</strong> {getDisplayValue(app.research_info?.area_of_interest, app.area_of_interest)}</p>
                                        <p><strong>Status:</strong> {formatApplicationStatus(app.status)}</p>
                                      </div>
                                    </div>

                                    <div className="director-detail-section">
                                      <h4>Interview Information</h4>
                                      <div className="detail-grid">
                                        <p><strong>Date:</strong> {formatDateTime(app.interviewDate)}</p>
                                        <p><strong>Mode:</strong> {getDisplayValue(app.interviewMode)}</p>
                                        <p><strong>Panel:</strong> {getDisplayValue(app.interviewPanel)}</p>
                                        <p><strong>Result:</strong> {app.interviewResult ? formatTextLabel(app.interviewResult) : 'N/A'}</p>
                                      </div>
                                      <p><strong>Interview Remarks:</strong> {getDisplayValue(app.interviewRemarks)}</p>
                                    </div>

                                    {appDocuments.length > 0 && (
                                      <div className="director-detail-section">
                                        <h4>Uploaded Documents</h4>
                                        <ul className="documents-list">
                                          {appDocuments.map((doc, index) => (
                                            <li key={`${doc.key}-${index}`}>
                                              <button
                                                type="button"
                                                className="doc-link-btn"
                                                onClick={() => handleDownloadDocument(doc.fileId, doc.key)}
                                              >
                                                View {getDocumentLabel(doc.key)}
                                              </button>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {app.dean_review && (
                                      <div className="director-detail-section">
                                        <h4>Dean Review</h4>
                                        <div className="detail-grid">
                                          <p><strong>Decision:</strong> {formatTextLabel(app.dean_review.decision)}</p>
                                          <p><strong>Dean:</strong> {getDisplayValue(app.dean_review.dean_name)}</p>
                                          <p><strong>Date:</strong> {formatDateTime(app.dean_review.decided_at)}</p>
                                        </div>
                                        <p><strong>Remarks:</strong> {getDisplayValue(app.dean_review.remarks)}</p>
                                      </div>
                                    )}

                                    {app.final_decision && (
                                      <div className="director-detail-section">
                                        <h4>Final Decision</h4>
                                        <div className="detail-grid">
                                          <p><strong>Decision:</strong> {formatApplicationStatus(app.final_decision.decision)}</p>
                                          <p><strong>Director:</strong> {getDisplayValue(app.final_decision.director_name)}</p>
                                          <p><strong>Date:</strong> {formatDateTime(app.final_decision.decided_at)}</p>
                                        </div>
                                        <p><strong>Remarks:</strong> {getDisplayValue(app.final_decision.remarks)}</p>
                                      </div>
                                    )}

                                    <div className="director-detail-section">
                                      <h4>Faculty Reviews ({app.reviews?.length || 0})</h4>
                                      {app.reviews && app.reviews.length > 0 ? (
                                        <>
                                          {averageReviewScore !== 'N/A' && (
                                            <div className="score-summary">
                                              <h4>Average Review Score: {averageReviewScore}</h4>
                                            </div>
                                          )}
                                          {app.reviews.map((review, index) => (
                                            <div key={index} className="review-card">
                                              <p><strong>Reviewer:</strong> {getDisplayValue(review.reviewer_name, review.faculty_name)}</p>
                                              <div className="scores">
                                                <span>Academic: {getDisplayValue(review.academic_score, review.technical_score)}</span>
                                                <span>Research: {getDisplayValue(review.research_score)}</span>
                                                <span>Overall: {getDisplayValue(review.overall_score)}</span>
                                              </div>
                                              <p><strong>Recommendation:</strong> {formatTextLabel(getDisplayValue(review.recommendation, review.decision))}</p>
                                              <p><strong>Remarks:</strong> {getDisplayValue(review.remarks)}</p>
                                              <p><small>{formatDateTime(review.created_at || review.reviewed_at)}</small></p>
                                            </div>
                                          ))}
                                        </>
                                      ) : (
                                        <p>No reviews submitted yet.</p>
                                      )}
                                    </div>

                                    <div className="form-actions folder-action-row">
                                      <button
                                        type="button"
                                        onClick={() => toggleStudent(app.id)}
                                        className="btn-secondary"
                                      >
                                        Close Details
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() => handleExportScholarFolder(app.id)}
                                        disabled={exportingFolder}
                                      >
                                        {exportingFolder ? 'Creating Folder...' : 'Create Scholar Folder (ZIP)'}
                                      </button>
                                    </div>

                                    {canSubmitDirectorDecision && (
                                      <form onSubmit={handleDirectorDecision} className="decision-form">
                                        <div
                                          style={{
                                            backgroundColor: '#eaf3ff',
                                            border: '2px solid #1d4ed8',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            marginBottom: '18px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                          }}
                                        >
                                          <span style={{ fontSize: '22px' }}>🧭</span>
                                          <div>
                                            <p style={{ margin: 0, color: '#0f3f7f', fontWeight: 700 }}>
                                              Status: Dean Approved → Forwarded to Research Director
                                            </p>
                                            <p style={{ margin: '4px 0 0 0', color: '#1e3a8a', fontSize: '13px' }}>
                                              Pending Research Director Final Decision
                                            </p>
                                          </div>
                                        </div>

                                        <div
                                          style={{
                                            backgroundColor: '#f8fbff',
                                            border: '1px solid #cfe3ff',
                                            borderRadius: '12px',
                                            padding: '18px',
                                            marginBottom: '18px'
                                          }}
                                        >
                                          <h3 style={{ marginTop: 0, color: '#0f3f7f', marginBottom: '14px' }}>
                                            Research Director Final Decision
                                          </h3>
                                          <div
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                              gap: '12px'
                                            }}
                                          >
                                            <div>
                                              <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '3px' }}>APPLICATION ID</span>
                                              <span style={{ color: '#1e293b', fontWeight: 600 }}>{app.registration_id || 'N/A'}</span>
                                            </div>
                                            <div>
                                              <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '3px' }}>CANDIDATE NAME</span>
                                              <span style={{ color: '#1e293b', fontWeight: 600 }}>{getDisplayValue(app.personal_details?.full_name, app.scholar_name)}</span>
                                            </div>
                                            <div>
                                              <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '3px' }}>DEPARTMENT</span>
                                              <span style={{ color: '#1e293b', fontWeight: 600 }}>{getDisplayValue(app.department)}</span>
                                            </div>
                                            <div>
                                              <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '3px' }}>FINAL RANK</span>
                                              <span style={{ color: '#1e293b', fontWeight: 600 }}>
                                                {getDisplayValue(app.final_rank, app.rank, app.finalRank)}
                                              </span>
                                            </div>
                                            <div>
                                              <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '3px' }}>SEAT TYPE</span>
                                              <span style={{ color: '#1e293b', fontWeight: 600 }}>
                                                {getDisplayValue(app.seat_type, app.seatType, app.category)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        <div
                                          style={{
                                            backgroundColor: '#ffffff',
                                            border: '2px solid #dbeafe',
                                            borderRadius: '12px',
                                            padding: '18px',
                                            marginBottom: '18px'
                                          }}
                                        >
                                          <h4 style={{ marginTop: 0, marginBottom: '14px', color: '#0f3f7f' }}>Decision *</h4>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <label
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                border: decisionData.decision === 'approve' ? '2px solid #16a34a' : '2px solid #e2e8f0',
                                                backgroundColor: decisionData.decision === 'approve' ? '#f0fdf4' : '#ffffff',
                                                borderRadius: '10px',
                                                padding: '12px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              <input
                                                type="radio"
                                                name="decision"
                                                value="approve"
                                                checked={decisionData.decision === 'approve'}
                                                onChange={handleDecisionChange}
                                              />
                                              <span style={{ color: '#15803d', fontWeight: 700 }}>Final Approve</span>
                                            </label>
                                            <label
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                border: decisionData.decision === 'reject' ? '2px solid #dc2626' : '2px solid #e2e8f0',
                                                backgroundColor: decisionData.decision === 'reject' ? '#fef2f2' : '#ffffff',
                                                borderRadius: '10px',
                                                padding: '12px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              <input
                                                type="radio"
                                                name="decision"
                                                value="reject"
                                                checked={decisionData.decision === 'reject'}
                                                onChange={handleDecisionChange}
                                              />
                                              <span style={{ color: '#b91c1c', fontWeight: 700 }}>Reject</span>
                                            </label>
                                          </div>
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                          <label style={{ display: 'block', fontWeight: 700, color: '#0f3f7f', marginBottom: '8px' }}>
                                            Director Remarks *
                                          </label>
                                          <textarea
                                            name="remarks"
                                            value={decisionData.remarks}
                                            onChange={handleDecisionChange}
                                            rows="5"
                                            required
                                            placeholder="Provide the reason for the final decision"
                                            style={{
                                              width: '100%',
                                              boxSizing: 'border-box',
                                              border: '1px solid #cbd5e1',
                                              borderRadius: '8px',
                                              padding: '10px',
                                              fontFamily: 'inherit',
                                              fontSize: '14px'
                                            }}
                                          />
                                        </div>

                                        <button
                                          type="submit"
                                          className="btn btn-primary btn-lg"
                                          disabled={!decisionData.decision || !decisionData.remarks.trim() || loading}
                                          style={{
                                            backgroundColor: (!decisionData.decision || !decisionData.remarks.trim() || loading) ? '#94a3b8' : '#1662c4',
                                            borderColor: (!decisionData.decision || !decisionData.remarks.trim() || loading) ? '#94a3b8' : '#1662c4',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            cursor: (!decisionData.decision || !decisionData.remarks.trim() || loading) ? 'not-allowed' : 'pointer'
                                          }}
                                        >
                                          {loading ? 'Submitting...' : 'Submit Final Decision'}
                                        </button>
                                      </form>
                                    )}

                                    {showDirectorViewOnly && (
                                      <>
                                        <div className="alert alert-info director-view-only">
                                          View Only: Research Director final action is enabled only when status is Dean Approved.
                                        </div>
                                        <div className="form-actions">
                                          <button type="button" className="decision-btn approve" disabled>
                                            Final Approve
                                          </button>
                                          <button type="button" className="decision-btn reject" disabled>
                                            Reject
                                          </button>
                                        </div>
                                      </>
                                    )}

                                    {showConfirmModal && selectedApp?.id === app.id && (
                                      <div
                                        style={{
                                          position: 'fixed',
                                          inset: 0,
                                          backgroundColor: 'rgba(2, 6, 23, 0.45)',
                                          zIndex: 3000,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          padding: '16px'
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: '100%',
                                            maxWidth: '560px',
                                            backgroundColor: '#ffffff',
                                            borderRadius: '12px',
                                            border: '1px solid #cbd5e1',
                                            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
                                            padding: '20px'
                                          }}
                                        >
                                          <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#0f3f7f' }}>Confirm Final Decision</h3>
                                          <p style={{ margin: '0 0 8px 0', color: '#334155' }}>Are you sure you want to proceed?</p>
                                          <p style={{ margin: '0 0 8px 0', color: '#334155' }}>
                                            <strong>Application:</strong> {app.registration_id}
                                          </p>
                                          <p style={{ margin: '0 0 8px 0', color: '#334155' }}>
                                            <strong>Decision:</strong> {decisionData.decision === 'approve' ? 'Final Approve' : 'Reject'}
                                          </p>
                                          <p style={{ margin: '0 0 16px 0', color: '#334155' }}>
                                            <strong>Remarks:</strong> {decisionData.remarks}
                                          </p>
                                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                            <button
                                              type="button"
                                              onClick={() => setShowConfirmModal(false)}
                                              style={{
                                                padding: '9px 16px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: '#ffffff',
                                                color: '#334155',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                              }}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleConfirmDirectorDecision}
                                              disabled={loading}
                                              style={{
                                                padding: '9px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: decisionData.decision === 'approve' ? '#16a34a' : '#dc2626',
                                                color: '#ffffff',
                                                cursor: loading ? 'not-allowed' : 'pointer',
                                                fontWeight: 700
                                              }}
                                            >
                                              {loading ? 'Processing...' : (decisionData.decision === 'approve' ? 'Approve' : 'Reject')}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </>
        )}

        {view === 'final-rank' && (
          <>
            <div className="detail-section" style={rankCardStyle}>
              <h3 style={rankCardHeadingStyle}>Seat Allocation Configuration</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <label>
                  <span style={rankInputLabelStyle}>Total Seats</span>
                  <input
                    type="number"
                    min="1"
                    className="search-input"
                    style={rankInputStyle}
                    value={seatConfig.totalSeats}
                    onChange={(event) => setSeatConfig((prev) => ({ ...prev, totalSeats: Math.max(1, Number(event.target.value || 1)) }))}
                  />
                </label>
                <label>
                  <span style={rankInputLabelStyle}>Visvesvaraya</span>
                  <input
                    type="number"
                    min="0"
                    className="search-input"
                    style={rankInputStyle}
                    value={seatConfig.distribution.visvesvaraya}
                    onChange={(event) => updateSeatDistribution('visvesvaraya', event.target.value)}
                  />
                </label>
                <label>
                  <span style={rankInputLabelStyle}>Merit</span>
                  <input
                    type="number"
                    min="0"
                    className="search-input"
                    style={rankInputStyle}
                    value={seatConfig.distribution.merit}
                    onChange={(event) => updateSeatDistribution('merit', event.target.value)}
                  />
                </label>
                <label>
                  <span style={rankInputLabelStyle}>General</span>
                  <input
                    type="number"
                    min="0"
                    className="search-input"
                    style={rankInputStyle}
                    value={seatConfig.distribution.general}
                    onChange={(event) => updateSeatDistribution('general', event.target.value)}
                  />
                </label>
                <label>
                  <span style={rankInputLabelStyle}>OBC</span>
                  <input
                    type="number"
                    min="0"
                    className="search-input"
                    style={rankInputStyle}
                    value={seatConfig.distribution.obc}
                    onChange={(event) => updateSeatDistribution('obc', event.target.value)}
                  />
                </label>
                <label>
                  <span style={rankInputLabelStyle}>MBC</span>
                  <input
                    type="number"
                    min="0"
                    className="search-input"
                    style={rankInputStyle}
                    value={seatConfig.distribution.mbc}
                    onChange={(event) => updateSeatDistribution('mbc', event.target.value)}
                  />
                </label>
                <label>
                  <span style={rankInputLabelStyle}>SC/ST</span>
                  <input
                    type="number"
                    min="0"
                    className="search-input"
                    style={rankInputStyle}
                    value={seatConfig.distribution.sc_st}
                    onChange={(event) => updateSeatDistribution('sc_st', event.target.value)}
                  />
                </label>
              </div>
              <p style={{ marginTop: '12px', color: seatDistributionTotal === Number(seatConfig.totalSeats) ? '#0f766e' : '#b91c1c', fontWeight: 700 }}>
                Distribution Total: {seatDistributionTotal} / Total Seats: {seatConfig.totalSeats}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={rankPrimaryButtonStyle}
                onClick={handleSeatAllocation}
                disabled={seatAllocating || finalRankList.length === 0}
              >
                {seatAllocating ? 'Allocating Seats...' : 'Run Seat Allocation'}
              </button>
            </div>

            <div className="table-controls" style={rankCardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ ...rankInputLabelStyle, marginBottom: '10px' }}>
                    Filter by Department
                  </label>
                  <select
                    className="search-input"
                    value={rankDepartmentFilter}
                    onChange={(event) => setRankDepartmentFilter(event.target.value)}
                    style={{ ...rankInputStyle, maxWidth: '360px' }}
                  >
                    <option value="all">All Departments</option>
                    {rankDepartments.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ ...rankInputLabelStyle, marginBottom: '10px' }}>
                    Filter by Institution
                  </label>
                  <select
                    className="search-input"
                    value={rankInstituteFilter}
                    onChange={(event) => setRankInstituteFilter(event.target.value)}
                    style={{ ...rankInputStyle, maxWidth: '360px' }}
                  >
                    <option value="all">All Institutions</option>
                    {rankInstitutes.map((institute) => (
                      <option key={institute} value={institute}>{institute}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {(seatSummaryRows.length > 0 || lastAllocation) && (
              <div className="detail-section" style={rankCardStyle}>
                <h3 style={rankCardHeadingStyle}>Seat Allocation Summary</h3>
                {lastAllocation && (
                  <p style={{ marginBottom: '10px', color: '#0a4d98', fontWeight: 700 }}>
                    Last Run: Allocated {lastAllocation.allocatedCandidates || 0} | Not Selected {lastAllocation.notSelectedCandidates || 0}
                  </p>
                )}
                {seatSummaryRows.length > 0 ? (
                  <div className="qualified-table-container">
                    <table className="qualified-results-table">
                      <thead>
                        <tr>
                          <th>Department</th>
                          <th>Institute</th>
                          <th>Total Seats</th>
                          <th>Allocated</th>
                          <th>Lapsed</th>
                          <th>Not Selected</th>
                          <th>Vacancy</th>
                          <th>VISVESVARAYA</th>
                          <th>MERIT</th>
                          <th>GENERAL</th>
                          <th>OBC</th>
                          <th>MBC</th>
                          <th>SC_ST</th>
                          <th>LAPSE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seatSummaryRows.map((row) => {
                          const vacancy = Math.max(0, Number(seatConfig.totalSeats || 0) - Number(row.allocated || 0));
                          return (
                            <tr key={`summary-${row.department}-${row.institute}`}>
                              <td>{row.department}</td>
                              <td>{row.institute}</td>
                              <td>{seatConfig.totalSeats}</td>
                              <td style={{ fontWeight: 700, color: '#1662c4' }}>{row.allocated}</td>
                              <td style={{ fontWeight: 700, color: '#ca8a04' }}>{row.lapsed}</td>
                              <td>{row.notSelected}</td>
                              <td style={{ fontWeight: 800, color: vacancy > 0 ? '#dc2626' : '#15803d' }}>
                                {vacancy}
                              </td>
                              <td>{row.categories.VISVESVARAYA}</td>
                              <td>{row.categories.MERIT}</td>
                              <td>{row.categories.GENERAL}</td>
                              <td>{row.categories.OBC}</td>
                              <td>{row.categories.MBC}</td>
                              <td>{row.categories.SC_ST}</td>
                              <td>{row.categories.LAPSE}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No summary available yet.</p>
                )}
              </div>
            )}

            <h3 style={rankSectionTitleStyle}>Final Rank List ({finalRankList.length})</h3>
            {rankLoading ? (
              <div className="loading-message">Loading final rank list...</div>
            ) : finalRankList.length === 0 ? (
              <div className="empty-state">
                <p>No ranked candidates found.</p>
              </div>
            ) : (
              Object.entries(groupedRankList)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([department, rows]) => (
                  <div key={`director-rank-dept-${department}`} style={{ marginBottom: '24px' }}>
                    <h3 style={rankSectionTitleStyle}>
                      {department} ({rows.length})
                    </h3>
                    <div className="qualified-table-container" style={{ borderRadius: '14px', border: '1px solid #b9d9ff', boxShadow: '0 8px 20px rgba(13, 71, 161, 0.10)' }}>
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
                          {rows
                            .slice()
                            .sort((a, b) => Number(a.finalRank || 0) - Number(b.finalRank || 0))
                            .map((row) => (
                              <tr key={`director-rank-${row.applicationId}`}>
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
                  </div>
                ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DirectorDashboard;