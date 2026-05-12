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
const MIN_CGPA_BY_CATEGORY = {
  sc: 7.5,
  bc: 7.0,
  mbc: 7.0,
  obc: 7.5,
  general: 7.5,
};
const MIN_PERCENTAGE_BY_CATEGORY = {
  sc: 50,
  bc: 50,
  mbc: 50,
  obc: 50,
  general: 55,
};

const getEvaluationStateFromApp = (app) => {
  const attendanceStatus = String(app?.attendanceStatus || '').trim() || 'Present';
  // When loading an already-evaluated app, show stored marks in the calculated field
  // but leave correct/wrong blank so the user re-enters them if they want to change
  return {
    attendanceStatus,
    correctAnswers: app?.correctAnswers !== undefined && app?.correctAnswers !== null ? String(app.correctAnswers) : '',
    wrongAnswers: app?.wrongAnswers !== undefined && app?.wrongAnswers !== null ? String(app.wrongAnswers) : '',
    entranceMarks: attendanceStatus === 'Present' && app?.entranceMarks !== null && app?.entranceMarks !== undefined
      ? String(app.entranceMarks)
      : '',
    remarks: String(app?.entranceEvaluationRemarks || '')
  };
};

// Formula: correct × 1.5 − wrong × 1  (max 150)
const calcEntranceScore = (correct, wrong) => {
  const c = Number(correct);
  const w = Number(wrong);
  if (!Number.isFinite(c) || !Number.isFinite(w)) return null;
  const score = c * 1.5 - w * 1;
  return Math.min(Math.max(score, 0), 150);
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
    correctAnswers: '',
    wrongAnswers: '',
    entranceMarks: '',   // auto-calculated, read-only display
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
    setEvaluationData((prev) => {
      const updated = { ...prev, [name]: value };
      // Recalculate score whenever correct or wrong answers change
      if (name === 'correctAnswers' || name === 'wrongAnswers') {
        const correct = name === 'correctAnswers' ? value : prev.correctAnswers;
        const wrong   = name === 'wrongAnswers'   ? value : prev.wrongAnswers;
        const score = calcEntranceScore(correct, wrong);
        updated.entranceMarks = score !== null ? String(score) : '';
      }
      return updated;
    });
  };

  const handleSubmitEntranceEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    if ((selectedApp.examStatus || '').trim() !== EXAM_COMPLETED_STATUS) {
      alert('Evaluation is allowed only when exam status is Completed.');
      return;
    }

    if (evaluationData.attendanceStatus === 'Present') {
      const correct = String(evaluationData.correctAnswers).trim();
      const wrong   = String(evaluationData.wrongAnswers).trim();
      if (correct === '' || wrong === '') {
        alert('Please enter both the number of correct and wrong answers.');
        return;
      }
      if (String(evaluationData.entranceMarks).trim() === '') {
        alert('Could not calculate entrance marks. Please check your inputs.');
        return;
      }
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
        payload.correctAnswers = Number(evaluationData.correctAnswers);
        payload.wrongAnswers = Number(evaluationData.wrongAnswers);
      }

      const response = await api.post('/api/scrutiny/entrance-evaluation', payload);
      alert(response.data?.message || 'Entrance evaluation saved successfully.');

      setSelectedApp((prev) => prev ? {
        ...prev,
        attendanceStatus: response.data?.attendanceStatus,
        entranceMarks: response.data?.entranceMarks,
        correctAnswers: response.data?.correctAnswers,
        wrongAnswers: response.data?.wrongAnswers,
        qualified: response.data?.qualified,
        candidateStatus: response.data?.candidateStatus,
        entranceRank: response.data?.entranceRank,
        entranceEvaluationRemarks: evaluationData.remarks,
      } : prev);

      setEvaluationData((prev) => ({
        attendanceStatus: response.data?.attendanceStatus || prev.attendanceStatus || 'Present',
        correctAnswers: '',
        wrongAnswers: '',
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
    const raw = app?.pgPercentage ?? app?.pgMarks ?? app?.pg_details?.cgpa_percentage;
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    const match = String(raw).match(/\d+(\.\d+)?/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : null;
  };

  const getEligibilityStatus = (app) => {
    const pgMarks = parsePgMarks(app);
    const category = String(app?.personal_details?.category || '').trim().toLowerCase();
    const requiredCgpa = MIN_CGPA_BY_CATEGORY[category] ?? MIN_CGPA_BY_CATEGORY.general;
    const requiredPercentage = MIN_PERCENTAGE_BY_CATEGORY[category] ?? MIN_PERCENTAGE_BY_CATEGORY.general;

    if (pgMarks === null) {
      return {
        pgMarks: null,
        percentageEquivalent: null,
        category,
        requiredCgpa,
        requiredPercentage,
        evaluatedUsing: 'Missing',
        status: 'Not Eligible',
        statusType: 'missing',
        isEligible: false
      };
    }

    const evaluatedUsing = pgMarks <= 10 ? 'CGPA' : 'Percentage';
    const percentageEquivalent = evaluatedUsing === 'CGPA' ? Number((pgMarks * 9.5).toFixed(2)) : pgMarks;
    const isEligible = evaluatedUsing === 'CGPA'
      ? pgMarks >= requiredCgpa
      : pgMarks >= requiredPercentage;
    const status = isEligible ? 'Eligible' : 'Not Eligible';

    return {
      pgMarks,
      percentageEquivalent,
      category,
      requiredCgpa,
      requiredPercentage,
      evaluatedUsing,
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

  // ── Entrance Scores threshold logic ────────────────────────────────────────
  // Only consider present candidates who have a numeric entranceMarks
  const scoredApps = applications.filter(
    (app) => String(app.attendanceStatus || '').trim() === 'Present'
      && app.entranceMarks !== null && app.entranceMarks !== undefined
      && String(app.entranceMarks).trim() !== ''
      && Number.isFinite(Number(app.entranceMarks))
  );
  const allScores = scoredApps.map((app) => Number(app.entranceMarks));
  const scoreMax  = allScores.length ? Math.max(...allScores) : null;
  const scoreMin  = allScores.length ? Math.min(...allScores) : null;
  const scoreThreshold = (scoreMax !== null && scoreMin !== null) ? parseFloat((scoreMax - scoreMin).toFixed(4)) : null;
  // Include all applications in the scores table (absent shown as N/A, no marks shown as N/A)
  const scoresTableApps = applications
    .slice()
    .sort((a, b) => Number(b.entranceMarks || 0) - Number(a.entranceMarks || 0));
  // Determine eligibility per candidate
  const getScoreEligibility = (app) => {
    const attendance = String(app.attendanceStatus || '').trim();
    if (attendance === 'Absent') return 'absent';
    const marks = Number(app.entranceMarks);
    if (!Number.isFinite(marks) || app.entranceMarks === null || app.entranceMarks === undefined || String(app.entranceMarks).trim() === '') return 'not-evaluated';
    if (scoreThreshold === null) return 'not-evaluated';
    return marks >= scoreThreshold ? 'eligible' : 'excluded';
  };
  const scoreEligibleCount  = scoresTableApps.filter((a) => getScoreEligibility(a) === 'eligible').length;
  const scoreExcludedCount  = scoresTableApps.filter((a) => getScoreEligibility(a) === 'excluded').length;
  // Assign rank only to eligible candidates (descending marks)
  const scoreRankedIds = scoresTableApps
    .filter((a) => getScoreEligibility(a) === 'eligible')
    .sort((a, b) => Number(b.entranceMarks) - Number(a.entranceMarks))
    .map((a, i) => ({ id: a.id, rank: i + 1 }));
  const scoreRankMap = Object.fromEntries(scoreRankedIds.map(({ id, rank }) => [id, rank]));
  const getCandidateStateTypeLabel = (candidate) => {
    const rawStateType = String(
      candidate?.stateType
      || candidate?.candidate_state_type
      || candidate?.personal_details?.candidate_state_type
      || ''
    ).trim().toLowerCase();

    // Flexible check: handle "Puducherry (UT)", "Puducherry UT", etc.
    const normalized = rawStateType.replace(/[()]/g, '').replace(/\s+/g, ' ');
    if (normalized.includes('puducherry ut') || normalized.includes('puducherry')) {
      return 'Puducherry UT';
    }
    return 'Other State';
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
  // Changed if attendance changed, or computed marks differ from saved, or remarks changed
  // Also consider "correct" or "wrong" being filled as a change intent
  const hasEvaluationChanges = Boolean(selectedEvaluationState) && (
    normalizedCurrentAttendance !== selectedEvaluationState.attendanceStatus
    || normalizedCurrentMarks !== normalizedSelectedMarks
    || String(evaluationData.correctAnswers ?? '').trim() !== ''
    || String(evaluationData.wrongAnswers ?? '').trim() !== ''
    || String(evaluationData.remarks ?? '').trim() !== String(selectedEvaluationState.remarks ?? '').trim()
  );
  const canSaveEntranceEvaluation = canEvaluateEntrance
    && !loading
    && hasEvaluationChanges
    && (normalizedCurrentAttendance === 'Absent' || normalizedCurrentMarks !== '');
  const eligibilityInfo = selectedApp ? getEligibilityStatus(selectedApp) : null;
  const categoryLabel = (eligibilityInfo?.category || 'general').toUpperCase();
  const evaluatedUsingLabel = String(
    selectedApp?.scrutiny?.eligibility_rule
    || selectedApp?.eligibility_rule
    || eligibilityInfo?.evaluatedUsing
    || 'Missing'
  );
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
          <button
            className={`tab ${filter === 'scores' ? 'active' : ''}`}
            onClick={() => setFilter('scores')}
          >
            📊 Entrance Scores
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

        {/* ── Entrance Examination Scores Panel ─────────────────────────── */}
        {filter === 'scores' && (
          <div className="detail-section" style={{ marginTop: '8px' }}>
            {/* Panel header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>📊 Entrance Examination Scores</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Consolidated list · threshold auto-computed as <strong>Max − Min</strong>
                  {scoreMax !== null && ` · Last synced: ${new Date().toLocaleTimeString()}`}
                </p>
              </div>
              <button
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={fetchApplications}
                disabled={loading}
              >
                🔄 Refresh
              </button>
            </div>

            {/* ── Stat cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', margin: '16px 0' }}>
              {/* Highest Mark */}
              <div style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', border: '1px solid #86efac', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#166534', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Highest Mark</p>
                <p style={{ fontSize: '32px', fontWeight: 800, color: '#14532d', margin: '0 0 2px', lineHeight: 1 }}>
                  {scoreMax !== null ? scoreMax : '—'}
                </p>
                <p style={{ fontSize: '11px', color: '#4ade80', margin: 0 }}>out of 150</p>
              </div>
              {/* Lowest Mark */}
              <div style={{ background: 'linear-gradient(135deg,#fee2e2,#fecaca)', border: '1px solid #f87171', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#991b1b', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lowest Mark</p>
                <p style={{ fontSize: '32px', fontWeight: 800, color: '#7f1d1d', margin: '0 0 2px', lineHeight: 1 }}>
                  {scoreMin !== null ? scoreMin : '—'}
                </p>
                <p style={{ fontSize: '11px', color: '#f87171', margin: 0 }}>out of 150</p>
              </div>
              {/* Threshold */}
              <div style={{ background: 'linear-gradient(135deg,#eff6ff,#bfdbfe)', border: '1px solid #60a5fa', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Threshold</p>
                <p style={{ fontSize: '32px', fontWeight: 800, color: '#1e3a8a', margin: '0 0 2px', lineHeight: 1 }}>
                  {scoreThreshold !== null ? scoreThreshold : '—'}
                </p>
                <p style={{ fontSize: '11px', color: '#3b82f6', margin: 0 }}>{scoreMax !== null ? `${scoreMax} − ${scoreMin}` : 'N/A'}</p>
              </div>
              {/* Eligible */}
              <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #4ade80', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#166534', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eligible</p>
                <p style={{ fontSize: '32px', fontWeight: 800, color: '#15803d', margin: '0 0 2px', lineHeight: 1 }}>
                  {scoreEligibleCount}
                </p>
                <p style={{ fontSize: '11px', color: '#4ade80', margin: 0 }}>marks ≥ threshold</p>
              </div>
              {/* Excluded */}
              <div style={{ background: 'linear-gradient(135deg,#fff7ed,#fed7aa)', border: '1px solid #fb923c', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#9a3412', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Excluded</p>
                <p style={{ fontSize: '32px', fontWeight: 800, color: '#7c2d12', margin: '0 0 2px', lineHeight: 1 }}>
                  {scoreExcludedCount}
                </p>
                <p style={{ fontSize: '11px', color: '#fb923c', margin: 0 }}>marks &lt; threshold</p>
              </div>
            </div>

            {/* ── Eligibility rule banner ── */}
            {scoreThreshold !== null && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
                🔔 <strong>Eligibility Rule:</strong> Threshold = Max ({scoreMax}) − Min ({scoreMin}) = {scoreThreshold}.
                &nbsp;Candidates scoring ≥ {scoreThreshold} are <strong style={{ color: '#15803d' }}>Eligible</strong>;
                those scoring below are <strong style={{ color: '#b91c1c' }}>Excluded</strong>.
                &nbsp;· Eligible: <strong>{scoreEligibleCount}</strong> / {allScores.length} evaluated.
              </div>
            )}

            {/* ── Scores table ── */}
            {scoresTableApps.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>No candidates to display. Evaluate entrance scores first.</p>
            ) : (
              <div className="qualified-table-container" style={{ overflowX: 'auto' }}>
                <table className="qualified-results-table" style={{ fontSize: '13px', minWidth: '860px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}>#</th>
                      <th>Student Name</th>
                      <th>Reg. ID</th>
                      <th>Department</th>
                      <th>Category</th>
                      <th>Attendance</th>
                      <th style={{ color: '#15803d' }}>✔ Correct</th>
                      <th style={{ color: '#b91c1c' }}>✖ Wrong</th>
                      <th>Total Marks</th>
                      <th>Eligibility</th>
                      <th>Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoresTableApps.map((app, idx) => {
                      const eligStatus   = getScoreEligibility(app);
                      const rank         = scoreRankMap[app.id] ?? null;
                      const marks        = Number(app.entranceMarks);
                      const hasMarks     = Number.isFinite(marks) && String(app.entranceMarks ?? '').trim() !== '';
                      const isPresent    = String(app.attendanceStatus || '').trim() === 'Present';
                      const isAbsent     = String(app.attendanceStatus || '').trim() === 'Absent';
                      const badgeStyle   = {
                        eligible:      { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
                        excluded:      { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
                        absent:        { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' },
                        'not-evaluated': { background: '#fefce8', color: '#713f12', border: '1px solid #fde68a' },
                      }[eligStatus] || {};
                      const badgeLabel   = {
                        eligible: '✓ Eligible',
                        excluded: '✗ Excluded',
                        absent:   '— Absent',
                        'not-evaluated': '⏳ Not Evaluated',
                      }[eligStatus] || eligStatus;
                      return (
                        <tr key={`score-${app.id}`}
                          style={{
                            background: eligStatus === 'eligible' ? 'rgba(220,252,231,0.25)'
                              : eligStatus === 'excluded' ? 'rgba(254,226,226,0.2)' : 'transparent'
                          }}
                        >
                          <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{app.personal_details?.full_name || app.scholar_name || 'N/A'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#475569' }}>{app.registration_id || 'N/A'}</td>
                          <td>{app.department || 'N/A'}</td>
                          <td style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}>
                            {String(app.personal_details?.category || '').toUpperCase() || 'N/A'}
                          </td>
                          <td>
                            {isPresent ? (
                              <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Present</span>
                            ) : isAbsent ? (
                              <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Absent</span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                            )}
                          </td>
                          {/* Correct answers (stored on app if available, else show dash) */}
                          <td style={{ textAlign: 'center', color: '#15803d', fontWeight: 700 }}>
                            {app.correctAnswers !== undefined && app.correctAnswers !== null && String(app.correctAnswers).trim() !== ''
                              ? app.correctAnswers : (hasMarks && isPresent ? '—' : '—')}
                          </td>
                          {/* Wrong answers */}
                          <td style={{ textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>
                            {app.wrongAnswers !== undefined && app.wrongAnswers !== null && String(app.wrongAnswers).trim() !== ''
                              ? app.wrongAnswers : (hasMarks && isPresent ? '—' : '—')}
                          </td>
                          {/* Total marks */}
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {hasMarks && isPresent ? (
                              <span style={{ fontWeight: 800, fontSize: '15px' }}>
                                {Number.isInteger(marks) ? marks : marks.toFixed(2)}
                                <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '10px' }}> /150</span>
                              </span>
                            ) : '—'}
                          </td>
                          {/* Eligibility badge */}
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ ...badgeStyle, padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {badgeLabel}
                            </span>
                          </td>
                          {/* Rank */}
                          <td style={{ textAlign: 'center' }}>
                            {rank !== null
                              ? <span className="rank-pill" style={{ fontWeight: 800 }}>#{rank}</span>
                              : <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px', textAlign: 'right' }}>
              Eligible: <strong style={{ color: '#15803d' }}>{scoreEligibleCount}</strong> &nbsp;·&nbsp;
              Excluded: <strong style={{ color: '#b91c1c' }}>{scoreExcludedCount}</strong> &nbsp;·&nbsp;
              Total evaluated: <strong>{allScores.length}</strong>
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

                  <div className="applicant-details scrutiny-section-card" style={{ marginTop: '16px', background: '#f8fafc', borderLeft: '4px solid #3b82f6' }}>
                    <h3>Visvesvaraya Scheme Eligibility</h3>
                    {(() => {
                      const visConfig = {
                        "Computer Science": 1,
                        "Information Technology": 0,
                        "Electronics and Communication Engineering": 0,
                        "Electrical and Instrumentation Engineering": 0,
                        "Mechanical Engineering": 0,
                        "Mechatronics": 0,
                        "Civil Engineering": 0,
                        "Chemical Engineering": 0
                      };
                      const deptKey = String(selectedApp.department || '').trim();
                      const isDeptEligible = visConfig[deptKey] > 0;
                      const hasApplied = Boolean(selectedApp.apply_vish);
                      const isStatusAccepted = String(selectedApp.status || '').trim().toLowerCase() === "admission_confirmed";
                      const isNewPhd = selectedApp.is_new_phd !== false;
                      const hasNoOtherFellowship = !selectedApp.has_other_fellowship;

                      const isVishEligible = isDeptEligible && hasApplied && isStatusAccepted && isNewPhd && hasNoOtherFellowship;

                      return (
                        <>
                          <p><strong>Visvesvaraya Applied:</strong> {hasApplied ? 'YES' : 'NO'}</p>
                          <div style={{ margin: '12px 0', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <p style={{ marginBottom: '8px', fontWeight: 600 }}>Eligibility Conditions:</p>
                            <p style={{ color: isDeptEligible ? '#15803d' : '#b91c1c', margin: '4px 0' }}>
                              {isDeptEligible ? '✔' : '✖'} Department matches configured department
                            </p>
                            <p style={{ color: isStatusAccepted ? '#15803d' : '#b91c1c', margin: '4px 0' }}>
                              {isStatusAccepted ? '✔' : '✖'} Status = admission_confirmed
                            </p>
                            <p style={{ color: isNewPhd ? '#15803d' : '#b91c1c', margin: '4px 0' }}>
                              {isNewPhd ? '✔' : '✖'} New PhD = Yes
                            </p>
                            <p style={{ color: hasNoOtherFellowship ? '#15803d' : '#b91c1c', margin: '4px 0' }}>
                              {hasNoOtherFellowship ? '✔' : '✖'} No Other Fellowship
                            </p>
                          </div>
                          <p>
                            <strong>Final Status: </strong> 
                            <span style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontWeight: 600,
                              background: isVishEligible ? '#dcfce7' : '#fee2e2',
                              color: isVishEligible ? '#166534' : '#991b1b'
                            }}>
                              {isVishEligible ? 'Eligible' : 'Not Eligible'}
                            </span>
                          </p>
                          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', fontStyle: 'italic' }}>
                            (This is DISPLAY ONLY, do not affect approval flow)
                          </p>
                        </>
                      );
                    })()}
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
                        <p><strong>PG Value:</strong> {eligibilityInfo.pgMarks === null ? 'Not Provided' : `${eligibilityInfo.pgMarks}`}</p>
                        <p><strong>Evaluated using:</strong> {evaluatedUsingLabel === 'Missing' ? 'CGPA/Percentage not provided' : evaluatedUsingLabel}</p>
                        {eligibilityInfo.percentageEquivalent !== null && (
                          <p><strong>Percentage Equivalent:</strong> {eligibilityInfo.percentageEquivalent}</p>
                        )}
                        <p>
                          <strong>Eligibility Status:</strong>
                          <span className={`eligibility-badge status-${eligibilityInfo.statusType}`}>{eligibilityInfo.status}</span>
                        </p>
                        <p>
                          <strong>Category Threshold Applied:</strong> {categoryLabel} requires minimum CGPA {eligibilityInfo.requiredCgpa} or minimum Percentage {eligibilityInfo.requiredPercentage}
                        </p>
                        <p><strong>Reference Rule:</strong> SC/OBC/General CGPA: 7.5 | BC/MBC CGPA: 7.0 | SC/BC/MBC/OBC Percentage: 50 | General Percentage: 55</p>
                        <p><strong>Final Decision Rule:</strong> documentsVerified = true and eligibilityStatus = Eligible → Approved, otherwise Rejected.</p>
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
                            ? `I confirm PG ${evaluatedUsingLabel} meets the applied threshold for ${categoryLabel}.`
                            : eligibilityInfo?.statusType === 'missing'
                              ? `I confirm PG CGPA/Percentage is missing for this application and treated as Not Eligible for scrutiny.`
                              : `I confirm PG ${evaluatedUsingLabel} was verified and does not meet the applied threshold for ${categoryLabel}.`
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

                    {evaluationData.attendanceStatus === 'Present' && (() => {
                      const totalScore = evaluationData.entranceMarks !== '' ? Number(evaluationData.entranceMarks) : null;
                      const correct = String(evaluationData.correctAnswers).trim();
                      const wrong   = String(evaluationData.wrongAnswers).trim();
                      return (
                        <>
                          {/* Marking scheme hint */}
                          <div style={{
                            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
                            padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#1e40af'
                          }}>
                            📋 <strong>Marking Scheme:</strong> Total Marks = (Correct Answers × +1.5) − (Wrong Answers × 1)
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            {/* Correct Answers */}
                            <div className="form-group scrutiny-remarks-group" style={{ margin: 0 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#15803d', fontWeight: 700 }}>✔ Correct Answers</span>
                                <span style={{ fontWeight: 400, color: '#64748b', fontSize: '12px' }}>(max 100)</span>
                              </label>
                              <input
                                type="number"
                                name="correctAnswers"
                                min="0"
                                max="100"
                                step="1"
                                value={evaluationData.correctAnswers}
                                onChange={handleEvaluationChange}
                                disabled={!canEvaluateEntrance || loading}
                                placeholder="e.g. 80"
                              />
                            </div>

                            {/* Wrong Answers */}
                            <div className="form-group scrutiny-remarks-group" style={{ margin: 0 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#b91c1c', fontWeight: 700 }}>✖ Wrong Answers</span>
                                <span style={{ fontWeight: 400, color: '#64748b', fontSize: '12px' }}>(max 100)</span>
                              </label>
                              <input
                                type="number"
                                name="wrongAnswers"
                                min="0"
                                max="100"
                                step="1"
                                value={evaluationData.wrongAnswers}
                                onChange={handleEvaluationChange}
                                disabled={!canEvaluateEntrance || loading}
                                placeholder="e.g. 5"
                              />
                            </div>
                          </div>

                          {/* Auto-calculated result */}
                          <div style={{
                            border: `2px solid ${totalScore !== null ? '#10b981' : '#e2e8f0'}`,
                            borderRadius: '10px', padding: '14px 18px',
                            background: totalScore !== null ? '#f0fdf4' : '#f8fafc',
                            marginBottom: '4px', transition: 'all 0.25s ease'
                          }}>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px', fontWeight: 500, letterSpacing: '0.03em' }}>
                              Auto-Calculated Total Marks
                            </p>
                            {totalScore !== null ? (
                              <>
                                <p style={{ fontSize: '22px', fontWeight: 800, color: '#065f46', margin: '0 0 4px' }}>
                                  🧮 {totalScore.toFixed(totalScore % 1 === 0 ? 0 : 2)} / 150
                                </p>
                                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                                  {correct} correct × (+1.5) − {wrong} wrong × (1) = {totalScore.toFixed(totalScore % 1 === 0 ? 0 : 2)}
                                </p>
                              </>
                            ) : (
                              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                                Enter correct and wrong answers above to calculate score
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}

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
