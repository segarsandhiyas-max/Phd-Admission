import { useState, useEffect } from 'react';
import api from '../api';
import '../App.css';

function AdminDashboard({ user, onLogout }) {
  const [view, setView] = useState('users'); // users, applications
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, scholar, faculty, admin, director, dean
  const [appFilter, setAppFilter] = useState('all'); // all, submitted, under_verification, reviewed, etc.
  const [appDepartmentFilter, setAppDepartmentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [finalRankList, setFinalRankList] = useState([]);
  const [rankDepartmentFilter, setRankDepartmentFilter] = useState('all');
  const [rankInstituteFilter, setRankInstituteFilter] = useState('all');
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

  useEffect(() => {
    console.log('🔄 AdminDashboard useEffect triggered - fetching data...');
    console.log('   Filter:', filter, 'AppFilter:', appFilter);
    fetchStatistics();
    if (view === 'users') {
      fetchUsers();
    }
    if (view === 'applications') {
      fetchApplications();
    }
    if (view === 'final-rank') {
      fetchFinalRankList();
    }
  }, [filter, appFilter, view, rankDepartmentFilter, rankInstituteFilter]);

  const fetchApplications = async () => {
    try {
      const params = appFilter !== 'all' ? { status: appFilter } : {};
      const response = await api.get('/api/admin/applications', { params });
      setApplications(response.data.applications);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const fetchFinalRankList = async () => {
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
    }
  };

  // Group applications by department
  const groupByDepartment = (apps) => {
    const grouped = {};
    apps.forEach(app => {
      const dept = app.department || 'Not Specified';
      if (!grouped[dept]) {
        grouped[dept] = [];
      }
      grouped[dept].push(app);
    });
    return grouped;
  };

  const appDepartments = Array.from(new Set(applications.map((app) => app.department).filter(Boolean))).sort();
  const filteredApplicationsByDepartment = appDepartmentFilter === 'all'
    ? applications
    : applications.filter((app) => (app.department || '').toLowerCase() === appDepartmentFilter.toLowerCase());
  const groupedApplications = groupByDepartment(filteredApplicationsByDepartment);
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
      const waitlisted = response.data?.allocation?.waitlistedCandidates ?? 0;
      const notSelected = response.data?.allocation?.notSelectedCandidates ?? 0;
      alert(`Seat allocation completed. Allocated: ${allocated}, Waitlisted: ${waitlisted}, Not Selected: ${notSelected}.`);
    } catch (error) {
      console.error('Seat allocation failed:', error);
      alert(error?.response?.data?.detail || 'Failed to run seat allocation.');
    } finally {
      setSeatAllocating(false);
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

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Document action failed:', error);
      alert('Failed to access document');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { role: filter } : {};
      console.log('📤 Fetching users with params:', params);
      const response = await api.get('/api/admin/users', { params });
      
      console.log('📊 Admin Users API Response:', response.data);
      console.log('📋 Raw users array:', response.data.users);
      console.log('📊 Response keys:', Object.keys(response.data));
      
      // Ensure all user objects have all required fields with defaults
      const rawUsers = response.data.users || [];
      console.log('📝 Raw users count:', rawUsers.length);
      
      const processedUsers = rawUsers.map((user, idx) => {
        const processed = {
          id: user.id || user._id || Math.random().toString(),
          full_name: user.full_name || user.name || 'Unknown User',
          email: user.email || 'No email',
          role: user.role || 'unknown',
          department: user.department || null,
          phone: user.phone || null,
          is_active: user.is_active !== undefined ? user.is_active : true,
          created_at: user.created_at || new Date().toISOString()
        };
        if (idx === 0) {
          console.log('🔍 First raw user object:', user);
          console.log('🔍 First processed user object:', processed);
        }
        return processed;
      });
      
      console.log('✅ Processed users:', processedUsers);
      console.log('✅ Processed users count:', processedUsers.length);
      
      if (processedUsers.length > 0) {
        console.log('📋 Sample user:', {
          full_name: processedUsers[0].full_name,
          email: processedUsers[0].email,
          role: processedUsers[0].role,
          department: processedUsers[0].department,
          phone: processedUsers[0].phone
        });
      } else {
        console.warn('⚠️ No users returned from API');
      }
      
      setUsers(processedUsers);
      console.log('✅ State updated with', processedUsers.length, 'users');
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      console.error('Error message:', error.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get('/api/admin/statistics');
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) {
      return;
    }

    try {
      await api.patch(`/api/admin/user/${userId}/toggle-active`);
      alert(`User ${currentStatus ? 'deactivated' : 'activated'} successfully!`);
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Failed to update user status');
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If viewing application details
  if (selectedApp) {
    const selectedStatus = String(selectedApp.status || '').toLowerCase();
    const deanDecision = String(selectedApp.dean_review?.decision || '').toLowerCase();
    const deanApproved = deanDecision === 'approve'
      || deanDecision === 'forward'
      || deanDecision === 'forward_to_director'
      || deanDecision === 'forward_to_research_director'
      || ['dean_approved', 'shortlisted', 'final_approved', 'accepted', 'admission_confirmed'].includes(selectedStatus);

    return (
      <div className="dashboard">
        <nav className="dashboard-nav">
          <h2>Application Details</h2>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </nav>

        <div className="dashboard-content">
          <button onClick={() => setSelectedApp(null)} className="back-btn">← Back to Applications</button>

          <div className="application-detail">
            <div className="detail-header">
              <h2>{selectedApp.registration_id}</h2>
              <span className={`status status-${selectedApp.status}`}>{selectedApp.status}</span>
            </div>

            <div className="detail-section">
              <h3>Personal Details</h3>
              <div className="detail-grid">
                <p><strong>Name:</strong> {selectedApp.personal_details?.full_name || selectedApp.scholar_name}</p>
                <p><strong>Email:</strong> {selectedApp.personal_details?.email || selectedApp.scholar_email}</p>
                <p><strong>Mobile:</strong> {selectedApp.personal_details?.mobile || 'N/A'}</p>
                <p><strong>DOB:</strong> {selectedApp.personal_details?.date_of_birth || 'N/A'}</p>
                <p><strong>Gender:</strong> {selectedApp.personal_details?.gender || 'N/A'}</p>
                <p><strong>Category:</strong> {selectedApp.personal_details?.category || 'N/A'}</p>
              </div>
            </div>

            <div className="detail-section">
              <h3>Academic Background</h3>
              <div className="sub-section">
                <h4>UG Details</h4>
                <p><strong>Degree:</strong> {selectedApp.ug_details?.degree_name || 'N/A'}</p>
                <p><strong>University:</strong> {selectedApp.ug_details?.college_university || 'N/A'}</p>
                <p><strong>Branch:</strong> {selectedApp.ug_details?.branch_department || 'N/A'}</p>
                <p><strong>CGPA:</strong> {selectedApp.ug_details?.cgpa_percentage || 'N/A'}</p>
                <p><strong>Year:</strong> {selectedApp.ug_details?.year_of_passing || 'N/A'}</p>
              </div>
              {selectedApp.pg_details && (
                <div className="sub-section">
                  <h4>PG Details</h4>
                  <p><strong>Degree:</strong> {selectedApp.pg_details?.degree_name || 'N/A'}</p>
                  <p><strong>University:</strong> {selectedApp.pg_details?.college_university || 'N/A'}</p>
                  <p><strong>Branch:</strong> {selectedApp.pg_details?.branch_department || 'N/A'}</p>
                  <p><strong>CGPA:</strong> {selectedApp.pg_details?.cgpa_percentage || 'N/A'}</p>
                  <p><strong>Year:</strong> {selectedApp.pg_details?.year_of_passing || 'N/A'}</p>
                </div>
              )}
            </div>

            <div className="detail-section">
              <h3>Research Information</h3>
              <p><strong>Area of Interest:</strong> {selectedApp.research_info?.area_of_interest || 'N/A'}</p>
              <p><strong>Proposed Topic:</strong> {selectedApp.research_info?.proposed_topic || 'N/A'}</p>
              <p><strong>Preferred Supervisor:</strong> {selectedApp.research_info?.preferred_supervisor || 'N/A'}</p>
              <div className="sop-box">
                <h4>Statement of Purpose</h4>
                <p>{selectedApp.research_info?.statement_of_purpose || 'Not provided'}</p>
              </div>
              {selectedApp.research_info?.publications && (
                <div className="sop-box">
                  <h4>Publications</h4>
                  <p>{selectedApp.research_info.publications}</p>
                </div>
              )}
              {selectedApp.research_info?.previous_research && (
                <div className="sop-box">
                  <h4>Previous Research</h4>
                  <p>{selectedApp.research_info.previous_research}</p>
                </div>
              )}
            </div>

            <div className="detail-section">
              <h3>Entrance Exam</h3>
              <p><strong>Exam:</strong> {selectedApp.entrance_exam?.exam_name || 'N/A'}</p>
              <p><strong>Score/Rank:</strong> {selectedApp.entrance_exam?.score_rank || 'N/A'}</p>
              <p><strong>Year:</strong> {selectedApp.entrance_exam?.year_of_exam || 'N/A'}</p>
            </div>

            {selectedApp.work_experience && (
              <div className="detail-section">
                <h3>Work Experience</h3>
                <p><strong>Company:</strong> {selectedApp.work_experience.company_name || 'N/A'}</p>
                <p><strong>Role:</strong> {selectedApp.work_experience.job_role || 'N/A'}</p>
                <p><strong>Experience:</strong> {selectedApp.work_experience.years_of_experience || 'N/A'} years</p>
                <p><strong>Field:</strong> {selectedApp.work_experience.field_of_work || 'N/A'}</p>
              </div>
            )}

            {selectedApp.uploaded_files && Object.keys(selectedApp.uploaded_files).length > 0 && (
              <div className="detail-section">
                <h3>Uploaded Documents</h3>
                <ul className="documents-list">
                  {Object.entries(selectedApp.uploaded_files).map(([key, fileId], idx) => (
                    <li key={idx}>
                      <span>📄 {key.replace(/_/g, ' ').toUpperCase()}</span>
                      <button
                        type="button"
                        className="doc-link-btn"
                        style={{ marginLeft: '12px' }}
                        onClick={() => handleDocumentAction(fileId, key, 'view')}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="doc-link-btn"
                        style={{ marginLeft: '8px' }}
                        onClick={() => handleDocumentAction(fileId, key, 'download')}
                      >
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedApp.reviews && selectedApp.reviews.length > 0 && (
              <div className="detail-section">
                <h3>Faculty Reviews ({selectedApp.reviews.length})</h3>
                {selectedApp.reviews.map((review, idx) => (
                  <div key={idx} className="review-card">
                    <p><strong>Reviewer:</strong> {review.reviewer_name}</p>
                    <p><strong>Academic Score:</strong> {review.academic_score || 'N/A'}</p>
                    <p><strong>Research Score:</strong> {review.research_score || 'N/A'}</p>
                    <p><strong>Overall Score:</strong> {review.overall_score || 'N/A'}/10</p>
                    <p><strong>Decision:</strong> {review.decision || review.recommendation || 'N/A'}</p>
                    <p><strong>Remarks:</strong> {review.remarks || 'No remarks'}</p>
                    <p><small>{new Date(review.created_at).toLocaleString()}</small></p>
                  </div>
                ))}
              </div>
            )}

            {selectedApp.scrutiny && (
              <div className="detail-section">
                <h3>Scrutiny Status</h3>
                <p><strong>Status:</strong> <span className={`status status-${selectedApp.scrutiny_status}`}>{selectedApp.scrutiny_status}</span></p>
                <p><strong>Documents Verified:</strong> {selectedApp.scrutiny.documents_verified ? '✅ Yes' : '❌ No'}</p>
                <p><strong>Eligibility Verified:</strong> {selectedApp.scrutiny.eligibility_verified ? '✅ Yes' : '❌ No'}</p>
                <p><strong>Remarks:</strong> {selectedApp.scrutiny.remarks || 'No remarks'}</p>
                <p><strong>Verified By:</strong> {selectedApp.scrutiny.verified_by_name || 'N/A'}</p>
                <p><small>Verified on: {new Date(selectedApp.scrutiny.verified_at).toLocaleString()}</small></p>
              </div>
            )}

            <div className="detail-section">
              <h3>Dean Approval</h3>
              <p>
                <strong>Dean Approval Checkbox:</strong>{' '}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={deanApproved} readOnly />
                  <span>{deanApproved ? 'Approved / Forwarded by Dean' : 'Pending Dean Approval'}</span>
                </label>
              </p>
              <p><strong>Dean Decision:</strong> {selectedApp.dean_review?.decision || 'Pending'}</p>
              <p><strong>Dean Remarks:</strong> {selectedApp.dean_review?.remarks || 'Not available yet'}</p>
              <p><strong>Dean Name:</strong> {selectedApp.dean_review?.dean_name || 'N/A'}</p>
              <p>
                <small>
                  Decision Time: {selectedApp.dean_review?.decided_at ? new Date(selectedApp.dean_review.decided_at).toLocaleString() : 'Pending'}
                </small>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <h2>Admin Dashboard</h2>
        <div className="nav-right">
          <span className="user-name">{user.full_name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="welcome-banner">
          <h1>Welcome, {user.full_name}!</h1>
          <p>Manage users and monitor system activities</p>
        </div>

        {/* View Tabs */}
        <div className="view-tabs">
          <button 
            className={`tab-btn ${view === 'users' ? 'active' : ''}`}
            onClick={() => setView('users')}
          >
            Users Management
          </button>
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

        {statistics && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Users</h3>
              <div className="stat-number">{statistics.total_users}</div>
            </div>
            <div className="stat-card">
              <h3>Scholars</h3>
              <div className="stat-number">{statistics.users_by_role?.scholar || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Faculty</h3>
              <div className="stat-number">{statistics.users_by_role?.faculty || 0}</div>
            </div>
            <div className="stat-card">
              <h3>Active Users</h3>
              <div className="stat-number">{statistics.active_users}</div>
            </div>
            <div className="stat-card">
              <h3>Total Applications</h3>
              <div className="stat-number">{statistics.total_applications}</div>
            </div>
            <div className="stat-card">
              <h3>Total Reviews</h3>
              <div className="stat-number">{statistics.total_reviews}</div>
            </div>
          </div>
        )}

       {view === 'users' && (
          <>
            <div className="table-controls">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <div className="filters">
            {['all', 'scholar', 'faculty', 'admin', 'director', 'dean'].map(role => (
              <button
                key={role}
                className={`filter-btn ${filter === role ? 'active' : ''}`}
                onClick={() => setFilter(role)}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{textAlign: 'center'}}>Loading...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{textAlign: 'center'}}>
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  console.log('🔍 Rendering user row for:', u.id, u);
                  return (
                    <tr key={u.id}>
                      <td>{u.full_name || '-'}</td>
                      <td>{u.email || '-'}</td>
                    <td>
                      <span className={`role-badge role-${u.role}`}>
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </span>
                    </td>
                    <td>{u.department || '-'}</td>
                    <td>{u.phone || '-'}</td>
                    <td>
                      <span className={`status ${u.is_active ? 'status-active' : 'status-inactive'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="info-section">
          <h3>Admin Capabilities</h3>
          <ul>
            <li>View and manage all users in the system</li>
            <li>Activate or deactivate user accounts</li>
            <li>Monitor system statistics and activities</li>
            <li>Filter users by role and search by name/email</li>
            <li>Track user registrations and account status</li>
          </ul>
        </div>
       </>
      )}

      {view === 'applications' && (
        <>
          <div className="table-controls">
            <div className="filters">
              {['all', 'submitted', 'under_verification', 'reviewed', 'shortlisted', 'approved', 'rejected'].map(status => (
                <button
                  key={status}
                  className={`filter-btn ${appFilter === status ? 'active' : ''}`}
                  onClick={() => setAppFilter(status)}
                >
                  {status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '12px', maxWidth: '340px' }}>
              <label style={{ fontWeight: 600, color: '#1a2a44', marginBottom: '8px', display: 'block' }}>
                Filter by Department
              </label>
              <select
                className="search-input"
                value={appDepartmentFilter}
                onChange={(event) => setAppDepartmentFilter(event.target.value)}
              >
                <option value="all">All Departments</option>
                {appDepartments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="applications-grid">
            {applications.length === 0 ? (
              <div className="empty-state">
                <p>No applications found</p>
              </div>
            ) : (
              Object.entries(groupedApplications).map(([department, deptApps]) => (
                <div key={department} style={{marginBottom: '40px'}}>
                  <h3 style={{
                    color: '#1e40af', 
                    fontSize: '20px', 
                    borderBottom: '3px solid #3b82f6', 
                    paddingBottom: '8px',
                    marginBottom: '20px'
                  }}>
                    📚 {department} - {deptApps.length} Application{deptApps.length !== 1 ? 's' : ''}
                  </h3>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
                    {deptApps.map(app => (
                      <div 
                        key={app.id} 
                        className="application-card"
                        onClick={() => setSelectedApp(app)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="card-header">
                          <h3>{app.scholar_name}</h3>
                          <span className={`status status-${app.status.replace('_', '-')}`}>
                            {app.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          </span>
                        </div>
                        <div className="card-content">
                          <p><strong>Registration ID:</strong> {app.registration_id}</p>
                          <p><strong>Email:</strong> {app.scholar_email}</p>
                          <p><strong>Department:</strong> {app.department}</p>
                          <p><strong>Mode:</strong> {app.personal_details?.mode_of_study || 'N/A'}</p>
                          <p><strong>Category:</strong> {app.personal_details?.category || 'N/A'}</p>
                          <p><strong>Research Area:</strong> {app.research_info?.area_of_interest || 'N/A'}</p>
                          <p><strong>Submitted:</strong> {new Date(app.created_at).toLocaleDateString()}</p>
                          <p><strong>Reviews:</strong> {app.reviews?.length || 0}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
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
                  Last Run: Allocated {lastAllocation.allocatedCandidates || 0} | Waitlisted {lastAllocation.waitlistedCandidates || 0} | Not Selected {lastAllocation.notSelectedCandidates || 0}
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

          {finalRankList.length === 0 ? (
            <div className="empty-state">
              <p>No ranked candidates found.</p>
            </div>
          ) : (
            Object.entries(groupedRankList)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([department, rows]) => (
                <div key={`admin-rank-dept-${department}`} style={{ marginBottom: '24px' }}>
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
                            <tr key={`admin-rank-${row.applicationId}`}>
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

export default AdminDashboard;
