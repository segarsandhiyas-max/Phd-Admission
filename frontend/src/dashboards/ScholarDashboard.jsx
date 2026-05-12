import { useState, useEffect, useRef } from 'react';
import api, { getApiErrorMessage } from '../api';
import '../App.css';
import FormI_NOC from '../FormI_NOC';
import FormII_ExperienceCertificate from '../FormII_ExperienceCertificate';
import EntranceApplicationForm from './EntranceApplicationForm';
import {
  ACTIVE_APPLICATION_STATUSES,
  formatApplicationStatus,
  formatDateOnly,
  formatDateTime,
  getDisplayValue
} from '../applicationHelpers';

function ScholarDashboard({ user, onLogout }) {
  const DEFAULT_APPLICATION_FEE_AMOUNT = 2000;
  const CONCESSION_CATEGORIES = new Set(['SC', 'ST', 'OBC', 'PwD', 'Women']);
  const PTU_ENTRANCE_TOTAL_MARKS = 150;
  const [view, setView] = useState('home'); // home, apply, my-applications, form-i, form-ii, entrance-application
  const [selectedApplicationForEntrance, setSelectedApplicationForEntrance] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationsSectionRef = useRef(null);
  const [notificationBanner, setNotificationBanner] = useState('');

  // Application form state  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    date_of_birth: '',
    gender: '',
    nationality: '',
    institution: '',
    mode_of_study: '',
    candidate_state_type: '',
    category: '',
    aadhaar_passport: '',
    mobile: user.phone || '',
    email: user.email,
    permanent_address: '',
    communication_address: '',
    ug_degree_name: '',
    ug_college_university: '',
    ug_branch_department: '',
    ug_year_of_passing: '',
    ug_cgpa_percentage: '',
    pg_degree_name: '',
    pg_college_university: '',
    pg_specialization: '',
    pg_year_of_passing: '',
    pg_cgpa_percentage: '',
    exam_name: '',
    registration_number: '',
    year_of_exam: '',
    score_rank: '',
    validity_period: '',
    area_of_interest: '',
    proposed_topic: '',
    statement_of_purpose: '',
    preferred_supervisor: '',
    previous_research: '',
    publications: '',
    company_name: '',
    job_role: '',
    years_of_experience: '',
    field_of_work: ''
  });

  const [uploadedFiles, setUploadedFiles] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentInfo, setPaymentInfo] = useState({
    paymentStatus: 'Pending',
    paymentDate: '',
    paymentAmount: DEFAULT_APPLICATION_FEE_AMOUNT,
    paymentMethod: '',
    transactionId: ''
  });
  const [entranceExamPolicy, setEntranceExamPolicy] = useState(null);

  const calculatedApplicationFee = CONCESSION_CATEGORIES.has(formData.category) ? 1000 : 2000;
  const minCgpaByCategory = {
    SC: 7.5,
    BC: 7.0,
    MBC: 7.0,
    OBC: 7.5,
    GENERAL: 7.5
  };
  const minPercentageByCategory = {
    SC: 50,
    BC: 50,
    MBC: 50,
    OBC: 50,
    GENERAL: 55
  };

  const requiredFieldsByStep = {
    1: ['full_name', 'date_of_birth', 'gender', 'nationality', 'institution', 'mode_of_study', 'candidate_state_type', 'category', 'aadhaar_passport', 'mobile', 'email', 'permanent_address', 'communication_address'],
    2: ['ug_degree_name', 'ug_college_university', 'ug_branch_department', 'ug_year_of_passing', 'ug_cgpa_percentage'],
    3: ['pg_degree_name', 'pg_college_university', 'pg_specialization', 'pg_year_of_passing', 'pg_cgpa_percentage'],
    4: ['exam_name', 'registration_number', 'year_of_exam', 'score_rank', 'validity_period'],
    5: ['area_of_interest', 'proposed_topic', 'statement_of_purpose', 'preferred_supervisor']
  };

  const fieldLabels = {
    full_name: 'Full Name',
    date_of_birth: 'Date of Birth',
    gender: 'Gender',
    nationality: 'Nationality',
    institution: 'Institution',
    mode_of_study: 'Mode of Study',
    candidate_state_type: 'Candidate State Type',
    category: 'Category',
    aadhaar_passport: 'Aadhaar/Passport',
    mobile: 'Mobile',
    email: 'Email',
    permanent_address: 'Permanent Address',
    communication_address: 'Communication Address',
    ug_degree_name: 'UG Degree Name',
    ug_college_university: 'UG College/University',
    ug_branch_department: 'UG Branch/Department',
    ug_year_of_passing: 'UG Year of Passing',
    ug_cgpa_percentage: 'UG CGPA/Percentage',
    pg_degree_name: 'PG Degree Name',
    pg_college_university: 'PG College/University',
    pg_specialization: 'PG Specialization',
    pg_year_of_passing: 'PG Year of Passing',
    pg_cgpa_percentage: 'PG CGPA/Percentage',
    exam_name: 'Exam Name',
    registration_number: 'Registration Number',
    year_of_exam: 'Year of Exam',
    score_rank: 'Score/Rank',
    validity_period: 'Validity Period',
    area_of_interest: 'Area of Interest',
    proposed_topic: 'Proposed Topic',
    statement_of_purpose: 'Statement of Purpose',
    preferred_supervisor: 'Preferred Supervisor'
  };

  const findMissingFields = (fields) => {
    return fields.filter((field) => !String(formData[field] || '').trim());
  };

  const validatePgAcademicEligibility = (category, pgValueInput) => {
    const normalizedCategory = String(category || '').trim().toUpperCase();
    const rawValue = String(pgValueInput || '').trim();

    if (!rawValue) {
      return {
        valid: false,
        message: 'Enter CGPA or Percentage'
      };
    }

    const numericValue = parseFloat(rawValue);
    if (!Number.isFinite(numericValue)) {
      return {
        valid: false,
        message: 'Enter CGPA or Percentage'
      };
    }

    const minCgpa = minCgpaByCategory[normalizedCategory] ?? minCgpaByCategory.GENERAL;
    const minPercentage = minPercentageByCategory[normalizedCategory] ?? minPercentageByCategory.GENERAL;

    const isPercentageInput = rawValue.includes('%') || numericValue > 10;

    if (!isPercentageInput) {
      if (numericValue < minCgpa) {
        return {
          valid: false,
          message: `Minimum CGPA not met (minimum ${minCgpa})`
        };
      }

      return {
        valid: true,
        rule: 'CGPA'
      };
    }

    if (numericValue < minPercentage) {
      return {
        valid: false,
        message: `Minimum Percentage not met (minimum ${minPercentage})`
      };
    }

    return {
      valid: true,
      rule: 'Percentage'
    };
  };

  useEffect(() => {
    fetchMyApplications();
    fetchNotifications();
    fetchEntranceExamPolicy();
  }, []);

  const fetchMyApplications = async () => {
    try {
      const response = await api.get('/api/scholar/my-applications');
      setApplications(response.data.applications);
      console.log('Applications fetched:', response.data.applications);
      return response.data.applications;
    } catch (error) {
      console.error('Error fetching applications:', error);
      return [];
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/notifications');
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchEntranceExamPolicy = async () => {
    try {
      const response = await api.get('/api/entrance-exam/policy');
      setEntranceExamPolicy(response.data);
      console.log('Entrance exam policy fetched:', response.data);
    } catch (error) {
      console.error('Error fetching entrance exam policy:', error);
    }
  };

  const hasGeneratedFeeReceipt = applications.some((app) => {
    const paymentStatus = String(app?.paymentStatus || '').trim().toLowerCase();
    return Boolean(app?.paymentReceiptPath) || paymentStatus === 'paid';
  });

  const handleNotificationsClick = () => {
    const receiptNotification = notifications.find((notif) => notif.type === 'payment_receipt_generated');
    if (receiptNotification?.message) {
      setNotificationBanner(receiptNotification.message);
    } else if (hasGeneratedFeeReceipt) {
      setNotificationBanner('Your fee receipt has been generated.');
    } else {
      setNotificationBanner('No notifications yet.');
    }
    notificationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'category') {
      const nextFee = CONCESSION_CATEGORIES.has(value) ? 1000 : 2000;
      setPaymentInfo((prev) => ({
        paymentStatus: 'Pending',
        paymentDate: '',
        paymentAmount: nextFee,
        paymentMethod: prev.paymentMethod,
        transactionId: ''
      }));
    }
  };

  const handlePaymentMethodChange = (e) => {
    const method = e.target.value;
    setPaymentInfo((prev) => ({
      ...prev,
      paymentMethod: method,
      paymentStatus: 'Pending',
      paymentDate: '',
      transactionId: ''
    }));
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataToSend = new FormData();
    formDataToSend.append('file', file);
    formDataToSend.append('field_name', fieldName);

    try {
      const response = await api.post('/api/upload-file', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploadedFileId = response.data?.file_id || response.data?.filename;
      if (!uploadedFileId) {
        throw new Error('Upload response did not include a file identifier');
      }
      
      setUploadedFiles(prev => ({
        ...prev,
        [fieldName]: uploadedFileId
      }));
      
      alert(`${response.data?.filename || file.name || fieldName} uploaded successfully!`);
    } catch (error) {
      console.error('File upload error:', error);
      alert('File upload failed. Please try again.');
    }
  };

  const nextStep = () => {
    const requiredFields = requiredFieldsByStep[currentStep] || [];
    const missingFields = findMissingFields(requiredFields);
    if (missingFields.length > 0) {
      const labelPreview = missingFields.slice(0, 3).map((field) => fieldLabels[field] || field).join(', ');
      const suffix = missingFields.length > 3 ? ', ...' : '';
      setErrorMessage(`Please fill all required fields before continuing: ${labelPreview}${suffix}`);
      return;
    }

    if (currentStep === 3) {
      const category = formData.category;
      const result = validatePgAcademicEligibility(category, formData.pg_cgpa_percentage);

      if (!result.valid) {
        setErrorMessage(result.message || 'Enter CGPA or Percentage');
        return;
      }
    }

    setErrorMessage('');
    setCurrentStep(prev => Math.min(prev + 1, 7));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveApplication = () => {
    return applications.some((app) => ACTIVE_APPLICATION_STATUSES.has(app.status));
  };

  const isScrutinyApproved = (app) => {
    const normalized = String(
      app?.scrutinyStatus || app?.scrutiny_status || app?.scrutiny?.status || ''
    ).toLowerCase();
    return normalized === 'approved' || normalized === 'verified';
  };

  const canDownloadOfferLetter = (app) => {
    return isSeatAllocated(app)
      && ['final_approved', 'accepted', 'admission_confirmed'].includes(String(app?.status || '').toLowerCase());
  };

  const canRespondToOffer = (app) => {
    return String(app?.status || '').toLowerCase() === 'final_approved'
      && isSeatAllocated(app)
      && !String(app?.admissionDecision || '').trim();
  };

  const canDownloadJoiningLetter = (app) => {
    return isSeatAllocated(app)
      && String(app?.status || '').toLowerCase() === 'admission_confirmed'
      && (
        String(app?.joiningLetterGeneratedAt || '').trim() !== ''
        || Boolean(app?.joiningLetterGenerated)
        || String(app?.joiningLetterPath || '').trim() !== ''
        || String(app?.registrationNumber || '').trim() === ''
      );
  };

  const canDownloadFinalFeeReceipt = (app) => {
    return isSeatAllocated(app) && String(getCandidateFeeDetails(app).feeStatus).toLowerCase() === 'paid';
  };

  const isSeatAllocated = (app) => {
    const seatStatus = String(
      app?.seatAllocationStatus
      || app?.seat_status
      || app?.seatStatus
      || ''
    ).trim().toLowerCase();

    return seatStatus === 'seat allocated' || seatStatus === 'allocated';
  };

  const isAdmissionAccepted = (app) => {
    const admissionDecision = String(app?.admissionDecision || '').trim().toLowerCase();
    const status = String(app?.status || '').trim().toLowerCase();

    return admissionDecision === 'accept' || status === 'accepted' || status === 'admission_confirmed';
  };

  const canDownloadScrutinyVerificationReceipt = (app) => {
    return isScrutinyApproved(app);
  };

  // ============ STAGE-BASED RENDERING LOGIC ============

  const WORKFLOW_STAGES = [
    'Submitted',
    'Scrutiny Approved',
    'Entrance Applied',
    'Hall Ticket Generated',
    'Exam Completed',
    'Exam Evaluated',
    'Qualified',
    'Faculty Review',
    'Interview Completed',
    'Ranked',
    'Dean Approved',
    'Research Director Approved',
    'Seat Allocated',
    'Offer Letter Generated',
    'Accepted',
    'Admission Confirmed'
  ];

  const valueOrDash = (value) => {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : '-';
    }
    return String(value);
  };

  const normalizeScrutinyStatus = (app) => {
    const scrutinyRaw = String(app?.scrutinyStatus || app?.scrutiny_status || app?.scrutiny?.status || '').toLowerCase().trim();
    if (scrutinyRaw === 'approved' || scrutinyRaw === 'verified') return 'Approved';
    if (scrutinyRaw === 'rejected') return 'Rejected';
    if (scrutinyRaw) return formatApplicationStatus(scrutinyRaw);

    const statusRaw = String(app?.status || '').toLowerCase().trim();
    if (statusRaw === 'under_scrutiny' || statusRaw === 'under_verification' || statusRaw === 'submitted') return 'Pending';
    if (statusRaw === 'rejected') return 'Rejected';
    if (statusRaw === 'faculty_review' || statusRaw === 'recommended_for_interview' || statusRaw === 'interview_scheduled' || statusRaw === 'interview_completed') {
      return 'Approved';
    }
    return 'Pending';
  };

  const mapBackendStatusToWorkflow = (status) => {
    const normalized = String(status || '').toLowerCase().trim();
    const map = {
      submitted: 'Submitted',
      under_verification: 'Submitted',
      under_scrutiny: 'Submitted',
      scrutiny_approved: 'Scrutiny Approved',
      entrance_applied: 'Entrance Applied',
      hall_ticket_generated: 'Hall Ticket Generated',
      exam_completed: 'Exam Completed',
      reviewed: 'Exam Evaluated',
      qualified: 'Qualified',
      faculty_review: 'Faculty Review',
      recommended_for_interview: 'Faculty Review',
      interview_scheduled: 'Faculty Review',
      interview_completed: 'Interview Completed',
      ranked: 'Ranked',
      seat_allocated: 'Seat Allocated',
      dean_review: 'Dean Approved',
      dean_approved: 'Dean Approved',
      shortlisted: 'Dean Approved',
      final_approved: 'Research Director Approved',
      accepted: 'Accepted',
      admission_confirmed: 'Admission Confirmed'
    };

    return map[normalized] || null;
  };

  const getWorkflowIndex = (app) => {
    const statusRaw = String(app?.status || '').toLowerCase().trim();
    let index = 0;

    const hasEntranceApplied = String(app?.entranceApplicationStatus || '').toLowerCase().includes('submit')
      || String(app?.entranceApplicationStatus || '').toLowerCase().includes('apply')
      || Boolean(app?.entranceFormSubmitted)
      || statusRaw === 'entrance_applied';

    const hasHallTicket = Boolean(app?.hallTicketGenerated || app?.hallTicketPath) || statusRaw === 'hall_ticket_generated';

    const hasExamCompleted = String(app?.examStatus || '').toLowerCase() === 'completed'
      || statusRaw === 'exam_completed'
      || app?.attendanceStatus !== null
      || app?.attendanceStatus !== undefined;

    const hasExamEvaluated = app?.examScore !== null
      || app?.examScore !== undefined
      || app?.candidateStatus !== null
      || app?.candidateStatus !== undefined
      || statusRaw === 'reviewed';

    const candidateStatus = String(app?.candidateStatus || '').toLowerCase().trim();
    const isQualified = Boolean(app?.qualified)
      || candidateStatus === 'qualified'
      || candidateStatus === 'eligible'
      || statusRaw === 'qualified';

    const hasInterviewCompleted = statusRaw === 'interview_completed'
      || app?.interviewMarks !== null
      || app?.interviewMarks !== undefined;

    const hasRanking = statusRaw === 'ranked'
      || app?.finalRank !== null
      || app?.finalRank !== undefined
      || app?.finalScore !== null
      || app?.finalScore !== undefined;

    const directorDecision = String(app?.finalDecision?.decision || app?.final_decision?.decision || '').toLowerCase().trim();
    const directorApproved = statusRaw === 'final_approved'
      || directorDecision === 'approve'
      || directorDecision === 'final_approved';

    const hasSeatAllocated = (
      statusRaw === 'seat_allocated'
      || valueOrDash(app?.seatType) !== '-'
      || String(app?.seatAllocationStatus || '').trim().toLowerCase() === 'seat allocated'
    ) && (
      directorApproved
      || statusRaw === 'accepted'
      || statusRaw === 'admission_confirmed'
    );

    const hasDeanApproved = statusRaw === 'dean_approved'
      || statusRaw === 'shortlisted'
      || statusRaw === 'dean_review'
      || String(app?.dean_review?.decision || app?.deanReview?.decision || '').toLowerCase().trim() === 'approve';
    const hasDirectorApproved = directorApproved;
    const hasOfferLetter = isSeatAllocated(app)
      && (
        statusRaw === 'final_approved'
        || statusRaw === 'accepted'
        || statusRaw === 'admission_confirmed'
        || directorDecision === 'approve'
        || directorDecision === 'final_approved'
      );
    const hasAccepted = hasSeatAllocated
      && (
        statusRaw === 'accepted'
        || statusRaw === 'admission_confirmed'
        || String(app?.admissionDecision || '').toLowerCase().trim() === 'accept'
      );
    const hasAdmissionConfirmed = hasAccepted
      && (
        statusRaw === 'admission_confirmed'
        || valueOrDash(app?.registrationNumber) !== '-'
        || Boolean(app?.joiningLetterGenerated || app?.joiningLetterPath)
      );

    if (normalizeScrutinyStatus(app) === 'Approved') index = Math.max(index, 1);
    if (hasEntranceApplied) index = Math.max(index, 2);
    if (hasHallTicket) index = Math.max(index, 3);
    if (hasExamCompleted) index = Math.max(index, 4);
    if (hasExamEvaluated) index = Math.max(index, 5);
    if (isQualified) index = Math.max(index, 6);
    if (statusRaw === 'faculty_review' || statusRaw === 'recommended_for_interview' || statusRaw === 'interview_scheduled' || (app?.reviews || []).length > 0) {
      index = Math.max(index, 7);
    }
    if (hasInterviewCompleted) index = Math.max(index, 8);
    if (hasRanking) index = Math.max(index, 9);
    if (hasDeanApproved) index = Math.max(index, 10);
    if (hasDirectorApproved) index = Math.max(index, 11);
    if (hasSeatAllocated) index = Math.max(index, 12);
    if (hasOfferLetter) index = Math.max(index, 13);
    if (hasAccepted) index = Math.max(index, 14);
    if (hasAdmissionConfirmed) index = Math.max(index, 15);

    return Math.max(index, 0);
  };

  const getCandidateKey = (candidate) => {
    return String(
      candidate?.id
      || candidate?.applicationId
      || candidate?.registration_id
      || candidate?.registrationNumber
      || ''
    ).trim();
  };

  const getCandidateStateType = (candidate) => {
    return String(
      candidate?.stateType
      || candidate?.candidate_state_type
      || candidate?.personal_details?.candidate_state_type
      || ''
    ).trim();
  };

  const getCandidateFeeDetails = (candidate) => {
    const stateType = getCandidateStateType(candidate);
    const defaultFeeAmount = stateType === 'Puducherry UT' ? 56160 : 100000;
    const feeAmount = Number(candidate?.finalFeeAmount ?? candidate?.feeAmount ?? defaultFeeAmount);
    const feeStatus = String(candidate?.finalFeeStatus || candidate?.feeStatus || 'Pending');
    const paymentDate = candidate?.finalFeePaymentDate || candidate?.paymentDate || '';
    const paymentMode = candidate?.finalFeePaymentMethod || candidate?.paymentMode || 'UPI / Card / Net Banking';
    const transactionId = candidate?.finalFeeTransactionId || candidate?.transactionId || '';

    return {
      feeAmount,
      feeStatus,
      paymentDate,
      paymentMode,
      transactionId
    };
  };

  const payFees = async (candidate) => {
    const key = getCandidateKey(candidate);
    if (!key) {
      return;
    }

    setLoading(true);
    try {
      const feeDetails = getCandidateFeeDetails(candidate);
      const response = await api.post(`/api/scholar/final-fee/pay/${encodeURIComponent(candidate.id)}`, {
        payment_method: feeDetails.paymentMode || 'UPI / Card / Net Banking'
      });
      const emailNotice = response.data?.emailSent ? ' Receipt has also been sent to your email.' : '';
      alert(`Final fee paid successfully.${emailNotice}`);
      await fetchMyApplications();
    } catch (error) {
      alert(getApiErrorMessage(error, 'Unable to complete final fee payment.'));
    } finally {
      setLoading(false);
    }
  };

  const downloadFeeReceipt = async (candidate) => {
    try {
      const response = await api.get(`/api/scholar/final-fee-receipt/${encodeURIComponent(candidate.id)}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `final_fee_receipt_${candidate.registration_id || candidate.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(getApiErrorMessage(error, 'Unable to download final fee receipt.'));
    }
  };

  const renderApplicationStage = (app) => {
    const displayName = valueOrDash(app.registration_id);
    const currentIndex = getWorkflowIndex(app);
    const currentStage = WORKFLOW_STAGES[currentIndex] || 'Submitted';
    const scrutinyStatus = normalizeScrutinyStatus(app);
    const statusRaw = String(app?.status || '').toLowerCase().trim();
    const deanApproved = statusRaw === 'dean_approved'
      || statusRaw === 'dean_review'
      || statusRaw === 'shortlisted'
      || String(app?.dean_review?.decision || app?.deanReview?.decision || '').toLowerCase().trim() === 'approve';
    const directorDecision = String(app?.finalDecision?.decision || app?.final_decision?.decision || '').toLowerCase().trim();
    const directorApproved = statusRaw === 'final_approved'
      || directorDecision === 'approve'
      || directorDecision === 'final_approved';
    const paymentStatus = valueOrDash(app.paymentStatus);
    const paymentInfo = [
      valueOrDash(app.paymentMethod),
      valueOrDash(app.transactionId),
      valueOrDash(formatDateTime(app.paymentDate))
    ].filter((item) => item !== '-').join(' | ') || '-';
    const entranceApplicationStatus = valueOrDash(app.entranceApplicationStatus || (currentIndex >= 2 ? 'Submitted' : 'Pending'));
    const hallTicketStatus = valueOrDash(app.hallTicketGenerated || app.hallTicketPath ? 'Generated' : (currentIndex >= 3 ? 'Pending' : '-'));
    const attendance = valueOrDash(app.attendanceStatus);
    const entranceMarks = valueOrDash(app.entranceMarks);
    const qualificationStatus = valueOrDash(app.qualified ? 'Qualified' : app.candidateStatus);
    const facultyReviewStatus = valueOrDash((app.reviews || []).length > 0 ? `Completed (${app.reviews.length})` : app.status === 'faculty_review' ? 'In Progress' : '-');
    const interviewMarks = valueOrDash(app.interviewMarks);
    const finalScore = valueOrDash(app.finalScore);
    const finalRank = valueOrDash(app.finalRank);
    const seatType = valueOrDash(app.seatType);
    const waitlistStatus = valueOrDash(app.waitlist_status);
    const waitlistRank = valueOrDash(app.waitlist_rank);
    const seatAllocationStatus = valueOrDash(app.seatAllocationStatus);
    const seatStatus = valueOrDash(
      seatAllocationStatus === 'Seat Lapsed'
        ? 'Seat Lapsed'
        : seatType !== '-'
        ? 'Allocated'
        : waitlistStatus !== '-'
          ? waitlistStatus
          : (currentIndex >= 10 ? 'Pending' : '-')
    );
    const deanStatus = valueOrDash(deanApproved ? 'Approved' : '-');
    const directorStatus = valueOrDash(directorApproved ? 'Approved' : '-');
    const registrationNumber = valueOrDash(app.registrationNumber);
    const registrationNumberDisplay = isSeatAllocated(app) && isAdmissionAccepted(app) && registrationNumber !== '-'
      ? registrationNumber
      : 'Not Generated';
    const admissionStatus = valueOrDash(currentIndex >= 14 ? 'Accepted' : '-');
    const institute = valueOrDash(getDisplayValue(app.institute, app.personal_details?.institution));
    const researchArea = valueOrDash(getDisplayValue(app.research_info?.area_of_interest, app.area_of_interest));
    const feeDetails = getCandidateFeeDetails(app);
    const feeStatusText = valueOrDash(feeDetails.feeStatus);
    const feeAmountText = `INR ${feeDetails.feeAmount}`;
    const feePaymentDateText = valueOrDash(formatDateTime(feeDetails.paymentDate));
    const feeTxnText = valueOrDash(feeDetails.transactionId);

    return (
      <div key={app.id} className="application-card-clean">
        <div className="card-header-clean">
          <div>
            <h3 className="app-id-clean">{displayName}</h3>
          </div>
          <span className={`status-clean status-${String(app.status || '').toLowerCase().replace(/\s+/g, '_')}`}>
            {valueOrDash(currentStage)}
          </span>
        </div>

        {currentIndex >= 0 && (
          <div className="info-section-clean">
            <h4 className="section-title-clean">Application Details</h4>
            <div className="info-row-clean">
              <span className="info-label-clean">Application ID</span>
              <span className="info-value-clean">{displayName}</span>
            </div>
            <div className="info-row-clean">
              <span className="info-label-clean">Status</span>
              <span className="info-value-clean">{valueOrDash(currentStage)}</span>
            </div>
            <div className="info-row-clean">
              <span className="info-label-clean">Submission Date</span>
              <span className="info-value-clean">{valueOrDash(formatDateOnly(app.created_at))}</span>
            </div>
            <div className="info-row-clean">
              <span className="info-label-clean">Payment Status</span>
              <span className={`info-value-clean ${String(paymentStatus).toLowerCase() === 'paid' ? 'status-green' : 'status-pending'}`}>{paymentStatus}</span>
            </div>
            <div className="info-row-clean">
              <span className="info-label-clean">Payment Info</span>
              <span className="info-value-clean">{paymentInfo}</span>
            </div>
            <div className="info-row-clean">
              <span className="info-label-clean">Institute</span>
              <span className="info-value-clean">{institute}</span>
            </div>
            <div className="info-row-clean">
              <span className="info-label-clean">Research Area</span>
              <span className="info-value-clean">{researchArea}</span>
            </div>
            {String(paymentStatus).toLowerCase() === 'paid' && (
              <button type="button" className="btn-clean secondary" onClick={() => downloadPaymentReceipt(app.id)}>
                Download Payment Receipt
              </button>
            )}
          </div>
        )}

        {(currentIndex >= 1 || currentIndex >= 2 || currentIndex >= 3 || currentIndex >= 4) && (
          <div className="info-section-clean">
            <h4 className="section-title-clean">Entrance Process</h4>

            {currentIndex >= 1 && (
              <div className="info-row-clean">
                <span className="info-label-clean">Scrutiny Status</span>
                <span className={`info-value-clean ${scrutinyStatus === 'Approved' ? 'status-green' : 'status-pending'}`}>{scrutinyStatus}</span>
              </div>
            )}

            {currentIndex >= 2 && (
              <>
                <div className="info-row-clean">
                  <span className="info-label-clean">Entrance Application Status</span>
                  <span className="info-value-clean">{entranceApplicationStatus}</span>
                </div>
                {isScrutinyApproved(app) && !String(entranceApplicationStatus).toLowerCase().includes('submit') && (
                  <button
                    type="button"
                    className="btn-clean primary"
                    onClick={() => setSelectedApplicationForEntrance(app) || setView('entrance-application')}
                  >
                    Apply for Entrance Exam
                  </button>
                )}
              </>
            )}

            {currentIndex >= 3 && (
              <>
                <div className="info-row-clean">
                  <span className="info-label-clean">Hall Ticket Status</span>
                  <span className="info-value-clean">{hallTicketStatus}</span>
                </div>
                <button type="button" className="btn-clean primary" onClick={() => downloadHallTicket(app.id)}>
                  Download Hall Ticket
                </button>
              </>
            )}

            {currentIndex >= 4 && (
              <>
                <div className="info-row-clean">
                  <span className="info-label-clean">Attendance</span>
                  <span className="info-value-clean">{attendance}</span>
                </div>
                <div className="info-row-clean">
                  <span className="info-label-clean">Entrance Marks</span>
                  <span className="info-value-clean">{entranceMarks}</span>
                </div>
              </>
            )}
          </div>
        )}

        {currentIndex >= 5 && (
          <div className="info-section-clean">
            <h4 className="section-title-clean">Evaluation</h4>

            <div className="info-row-clean">
              <span className="info-label-clean">Qualification Status</span>
              <span className="info-value-clean">{qualificationStatus}</span>
            </div>

            {currentIndex >= 7 && (
              <div className="info-row-clean">
                <span className="info-label-clean">Faculty Review Status</span>
                <span className="info-value-clean">{facultyReviewStatus}</span>
              </div>
            )}

            {currentIndex >= 8 && (
              <div className="info-row-clean">
                <span className="info-label-clean">Interview Marks</span>
                <span className="info-value-clean">{interviewMarks}</span>
              </div>
            )}

            {currentIndex >= 9 && (
              <>
                <div className="info-row-clean">
                  <span className="info-label-clean">Final Score</span>
                  <span className="info-value-clean">{finalScore}</span>
                </div>
                <div className="info-row-clean">
                  <span className="info-label-clean">Final Rank</span>
                  <span className="info-value-clean">{finalRank}</span>
                </div>
              </>
            )}
          </div>
        )}

        {currentIndex >= 7 && (
          <div className="info-section-clean">
            <h4 className="section-title-clean">Admission Process</h4>

            {deanApproved && (
              <div className="info-row-clean">
                <span className="info-label-clean">Dean Approval Status</span>
                <span className="info-value-clean">{deanStatus}</span>
              </div>
            )}

            {directorApproved && (
              <div className="info-row-clean">
                <span className="info-label-clean">Research Director Approval Status</span>
                <span className="info-value-clean">{directorStatus}</span>
              </div>
            )}

            {currentIndex >= 12 && (
              <>
                <div className="info-row-clean">
                  <span className="info-label-clean">Seat Type</span>
                  <span className="info-value-clean">{seatType}</span>
                </div>
                <div className="info-row-clean">
                  <span className="info-label-clean">Seat Status</span>
                  <span className="info-value-clean">{seatStatus}</span>
                </div>
                {waitlistStatus !== '-' && (
                  <div className="info-row-clean">
                    <span className="info-label-clean">Waitlist Rank</span>
                    <span className="info-value-clean">{waitlistRank}</span>
                  </div>
                )}
                
                {/* ===== VISVESVARAYA SCHEME FELLOWSHIP DETAILS ===== */}
                {String(seatType).toUpperCase() === 'VISVESVARAYA' && (
                  <div style={{ marginTop: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#333' }}>Visvesvaraya PhD Scheme (Phase-II) - Fellowship Support</h5>
                    <div className="info-row-clean">
                      <span className="info-label-clean">Fellowship Type</span>
                      <span className="info-value-clean">{valueOrDash(app.fellowship_type || 'Visvesvaraya')}</span>
                    </div>
                    <div className="info-row-clean">
                      <span className="info-label-clean">Scheme Phase</span>
                      <span className="info-value-clean">{valueOrDash(app.visvesvaraya_scheme_phase || 'Phase-II')}</span>
                    </div>
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                      <h6 style={{ margin: '5px 0', color: '#555', fontSize: '13px' }}>Financial Support</h6>
                      <div className="info-row-clean">
                        <span className="info-label-clean">Stipend (Year 1-2)</span>
                        <span className="info-value-clean">₹{valueOrDash(app.stipend_year1_2 ? app.stipend_year1_2.toLocaleString() : '38,750')}/month</span>
                      </div>
                      <div className="info-row-clean">
                        <span className="info-label-clean">Stipend (Year 3-5)</span>
                        <span className="info-value-clean">₹{valueOrDash(app.stipend_year3_5 ? app.stipend_year3_5.toLocaleString() : '43,750')}/month</span>
                      </div>
                      <div className="info-row-clean">
                        <span className="info-label-clean">Research Grant (Annual)</span>
                        <span className="info-value-clean">₹{valueOrDash(app.research_grant_annual ? app.research_grant_annual.toLocaleString() : '1,20,000')}</span>
                      </div>
                      <div className="info-row-clean">
                        <span className="info-label-clean">Rent Support</span>
                        <span className="info-value-clean">{valueOrDash(app.rent_support || 'As per govt norms')}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                      <h6 style={{ margin: '5px 0', color: '#555', fontSize: '13px' }}>Additional Support</h6>
                      <div className="info-row-clean">
                        <span className="info-label-clean">International Conference Support</span>
                        <span className="info-value-clean">{valueOrDash(app.international_conference_support || 'From 3rd year onwards')}</span>
                      </div>
                      <div className="info-row-clean">
                        <span className="info-label-clean">Lab Visit Abroad Support</span>
                        <span className="info-value-clean">{valueOrDash(app.lab_visit_abroad_support || '6 months support')}</span>
                      </div>
                      <div className="info-row-clean">
                        <span className="info-label-clean">Fellowship Duration</span>
                        <span className="info-value-clean">Up to {valueOrDash(app.fellowship_duration_years || '5')} years or PhD completion</span>
                      </div>
                      <div className="info-row-clean">
                        <span className="info-label-clean">Fellowship Status</span>
                        <span className="info-value-clean" style={{ color: '#27ae60', fontWeight: 'bold' }}>{valueOrDash(app.fellowship_status || 'Active')}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc', fontSize: '12px', color: '#666' }}>
                      <strong>Scheme Rules & Conditions:</strong>
                      <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                        <li>Fellowship is allocated based on merit and scheme eligibility</li>
                        <li>Candidate must maintain good academic progress throughout the program</li>
                        <li>Fellowship can be terminated for poor progress or policy violation</li>
                        <li>Annual performance monitoring is mandatory</li>
                        <li>Seat allocation is final - no replacement after allocation</li>
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}

            {currentIndex >= 13 && (
              <>
                <div className="info-row-clean">
                  <span className="info-label-clean">Offer Letter</span>
                  <span className="info-value-clean">{canDownloadOfferLetter(app) ? 'Available' : 'Pending'}</span>
                </div>
                {canDownloadOfferLetter(app) && (
                  <button type="button" className="btn-clean primary" onClick={() => downloadOfferLetter(app.id)}>
                    Download Offer Letter
                  </button>
                )}
                {canRespondToOffer(app) && (
                  <div className="button-group-clean" style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      className="btn-clean accept"
                      onClick={() => submitAdmissionDecision(app.id, 'accept')}
                      disabled={loading}
                    >
                      Accept Admission
                    </button>
                    <button
                      type="button"
                      className="btn-clean reject"
                      onClick={() => submitAdmissionDecision(app.id, 'reject')}
                      disabled={loading}
                    >
                      Reject Admission
                    </button>
                  </div>
                )}
              </>
            )}

            {currentIndex >= 15 && (
              <>
                {canDownloadJoiningLetter(app) && (
                  <button type="button" className="btn-clean primary" onClick={() => downloadJoiningLetter(app.id)}>
                    Download Joining Letter
                  </button>
                )}
                <div className="info-row-clean">
                  <span className="info-label-clean">Registration Number</span>
                  <span className="info-value-clean register-badge">{registrationNumberDisplay}</span>
                </div>
              </>
            )}

            {currentIndex >= 14 && (
              <div className="info-row-clean">
                <span className="info-label-clean">Admission Status</span>
                <span className="info-value-clean">{admissionStatus}</span>
              </div>
            )}
          </div>
        )}

        {currentStage === 'Admission Confirmed' && (
          <div className="info-section-clean highlight-section-clean success-bg">
            <h4 className="section-title-clean success-title">Final Application Summary</h4>

            <div className="info-row-clean"><span className="info-label-clean">Application ID</span><span className="info-value-clean">{displayName}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Status</span><span className="info-value-clean">{valueOrDash(currentStage)}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Submission Date</span><span className="info-value-clean">{valueOrDash(formatDateOnly(app.created_at))}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Payment Status & Info</span><span className="info-value-clean">{paymentStatus} | {paymentInfo}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Scrutiny Status</span><span className="info-value-clean">{scrutinyStatus}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Entrance Application</span><span className="info-value-clean">{entranceApplicationStatus}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Hall Ticket</span><span className="info-value-clean">{hallTicketStatus}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Entrance Exam Status</span><span className="info-value-clean">{valueOrDash(app.examStatus)}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Attendance</span><span className="info-value-clean">{attendance}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Entrance Marks</span><span className="info-value-clean">{entranceMarks}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Qualification Status</span><span className="info-value-clean">{qualificationStatus}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Entrance Rank</span><span className="info-value-clean">{valueOrDash(app.entranceRank)}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Interview Marks</span><span className="info-value-clean">{interviewMarks}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Final Score</span><span className="info-value-clean">{finalScore}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Final Rank</span><span className="info-value-clean">{finalRank}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Seat Type</span><span className="info-value-clean">{seatType}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Seat Status</span><span className="info-value-clean">{seatStatus}</span></div>
            {waitlistStatus !== '-' && (
              <div className="info-row-clean"><span className="info-label-clean">Waitlist Rank</span><span className="info-value-clean">{waitlistRank}</span></div>
            )}
            
            {/* ===== VISVESVARAYA SCHEME SUMMARY ===== */}
            {String(seatType).toUpperCase() === 'VISVESVARAYA' && (
              <>
                <div style={{ marginTop: '15px', marginBottom: '15px', padding: '12px', border: '2px solid #27ae60', borderRadius: '5px', backgroundColor: '#ecfdf5' }}>
                  <h5 style={{ margin: '0 0 12px 0', color: '#27ae60' }}>Visvesvaraya PhD Scheme (Phase-II) Fellowship Award</h5>
                  
                  <div className="info-row-clean">
                    <span className="info-label-clean">Fellowship Type</span>
                    <span className="info-value-clean" style={{ color: '#27ae60', fontWeight: 'bold' }}>{valueOrDash(app.fellowship_type || 'Visvesvaraya')}</span>
                  </div>
                  <div className="info-row-clean">
                    <span className="info-label-clean">Scheme Phase</span>
                    <span className="info-value-clean">{valueOrDash(app.visvesvaraya_scheme_phase || 'Phase-II')}</span>
                  </div>
                  <div className="info-row-clean">
                    <span className="info-label-clean">Fellowship Status</span>
                    <span className="info-value-clean" style={{ color: '#27ae60', fontWeight: 'bold' }}>{valueOrDash(app.fellowship_status || 'Active')}</span>
                  </div>
                  
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #27ae60' }}>
                    <h6 style={{ margin: '5px 0 8px 0', color: '#27ae60', fontSize: '14px' }}>Financial Support Package</h6>
                    <div className="info-row-clean">
                      <span className="info-label-clean">Monthly Stipend (Year 1-2)</span>
                      <span className="info-value-clean" style={{ fontWeight: 'bold' }}>₹{valueOrDash(app.stipend_year1_2 ? app.stipend_year1_2.toLocaleString() : '38,750')}</span>
                    </div>
                    <div className="info-row-clean">
                      <span className="info-label-clean">Monthly Stipend (Year 3-5)</span>
                      <span className="info-value-clean" style={{ fontWeight: 'bold' }}>₹{valueOrDash(app.stipend_year3_5 ? app.stipend_year3_5.toLocaleString() : '43,750')}</span>
                    </div>
                    <div className="info-row-clean">
                      <span className="info-label-clean">Annual Research Grant</span>
                      <span className="info-value-clean" style={{ fontWeight: 'bold' }}>₹{valueOrDash(app.research_grant_annual ? app.research_grant_annual.toLocaleString() : '1,20,000')}</span>
                    </div>
                    <div className="info-row-clean">
                      <span className="info-label-clean">Rent Support</span>
                      <span className="info-value-clean">{valueOrDash(app.rent_support || 'As per govt norms')}</span>
                    </div>
                    <div className="info-row-clean">
                      <span className="info-label-clean">International Conference Support</span>
                      <span className="info-value-clean">{valueOrDash(app.international_conference_support || 'From 3rd year onwards')}</span>
                    </div>
                    <div className="info-row-clean">
                      <span className="info-label-clean">Lab Visit Abroad Support</span>
                      <span className="info-value-clean">{valueOrDash(app.lab_visit_abroad_support || '6 months support')}</span>
                    </div>
                    <div className="info-row-clean">
                      <span className="info-label-clean">Fellowship Duration</span>
                      <span className="info-value-clean">Up to {valueOrDash(app.fellowship_duration_years || '5')} years</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            <div className="info-row-clean"><span className="info-label-clean">Institute</span><span className="info-value-clean">{institute}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Admission Status</span><span className="info-value-clean">{admissionStatus}</span></div>
            {canDownloadJoiningLetter(app) && (
              <div className="info-row-clean"><span className="info-label-clean">Joining Letter</span><span className="info-value-clean">Available</span></div>
            )}
            <div className="info-row-clean"><span className="info-label-clean">Registration Number</span><span className="info-value-clean">{registrationNumberDisplay}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Fee Amount</span><span className="info-value-clean">{feeAmountText}</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Fee Status</span><span className={`info-value-clean ${String(feeDetails.feeStatus).toLowerCase() === 'paid' ? 'status-green' : 'status-pending'}`}>{feeStatusText}</span></div>
            {String(feeDetails.feeStatus).toLowerCase() === 'paid' && (
              <>
                <div className="info-row-clean"><span className="info-label-clean">Payment Date</span><span className="info-value-clean">{feePaymentDateText}</span></div>
                <div className="info-row-clean"><span className="info-label-clean">Payment Mode</span><span className="info-value-clean">{valueOrDash(feeDetails.paymentMode)}</span></div>
                <div className="info-row-clean"><span className="info-label-clean">Transaction ID</span><span className="info-value-clean">{feeTxnText}</span></div>
              </>
            )}
            {isSeatAllocated(app) && (
              canDownloadFinalFeeReceipt(app) ? (
                <button type="button" className="btn-clean secondary" onClick={() => downloadFeeReceipt(app)}>
                  Download Receipt
                </button>
              ) : String(feeDetails.feeStatus).toLowerCase() !== 'paid' ? (
                <button type="button" className="btn-clean primary" onClick={() => payFees(app)}>
                  Pay Fees
                </button>
              ) : (
                null
              )
            )}
            <div className="info-row-clean"><span className="info-label-clean">Final Status</span><span className="info-value-clean">Admission Confirmed</span></div>
            <div className="info-row-clean"><span className="info-label-clean">Research Area</span><span className="info-value-clean">{researchArea}</span></div>
          </div>
        )}
      </div>
    );
  };

  const getEntranceEligibleApplications = () => {
    return applications.filter((app) => app.paymentStatus === 'Paid' && app.status !== 'rejected');
  };

  const handleApplyClick = () => {
    if (hasActiveApplication()) {
      alert('You already have an active application under review. Please wait for the decision.');
      return;
    }
    setView('apply');
    setErrorMessage('');
  };

  const handlePayFee = async () => {
    if (!paymentInfo.paymentMethod) {
      setErrorMessage('Please select a payment method before clicking Pay Now.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
      setPaymentInfo({
        paymentStatus: 'Paid',
        paymentDate: new Date().toISOString(),
        paymentAmount: calculatedApplicationFee,
        paymentMethod: paymentInfo.paymentMethod,
        transactionId
      });
      setSuccessMessage(`Payment successful. Transaction ID: ${transactionId}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadHallTicket = async (applicationId) => {
    try {
      const response = await api.get(`/api/scholar/hall-ticket/${applicationId}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'hall_ticket.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      await fetchMyApplications();
    } catch (error) {
      alert(getApiErrorMessage(error, 'Unable to download hall ticket.'));
    }
  };

  const downloadPaymentReceipt = async (applicationId) => {
    try {
      const response = await api.get(`/api/scholar/payment-receipt/${applicationId}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'payment_receipt.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(getApiErrorMessage(error, 'Unable to download payment receipt.'));
    }
  };

  const downloadScrutinyVerificationReceipt = async (applicationId) => {
    try {
      const response = await api.get(`/api/scholar/scrutiny-verification-receipt/${applicationId}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'scrutiny_verification_receipt.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      await fetchMyApplications();
    } catch (error) {
      alert(getApiErrorMessage(error, 'Unable to download scrutiny verification receipt.'));
    }
  };

  const downloadOfferLetter = async (applicationId) => {
    try {
      const response = await api.get(`/api/scholar/offer-letter/${applicationId}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'offer_letter.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      await fetchMyApplications();
    } catch (error) {
      alert(getApiErrorMessage(error, 'Unable to download offer letter.'));
    }
  };

  const downloadJoiningLetter = async (applicationId) => {
    try {
      const response = await api.get(`/api/scholar/joining-letter/${applicationId}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'joining_letter.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      await fetchMyApplications();
    } catch (error) {
      alert(getApiErrorMessage(error, 'Unable to download joining letter.'));
    }
  };

  const submitAdmissionDecision = async (applicationId, decision) => {
    const actionLabel = decision === 'accept' ? 'accept' : 'reject';
    if (!window.confirm(`Are you sure you want to ${actionLabel} the admission offer?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.post(`/api/scholar/admission-decision/${applicationId}`, { decision });
      alert(decision === 'accept'
        ? 'Admission accepted successfully. Your admission is now confirmed.'
        : 'Admission offer rejected successfully.');
      await fetchMyApplications();
    } catch (error) {
      alert(getApiErrorMessage(error, 'Unable to submit admission decision.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedPaymentStatus = String(paymentInfo.paymentStatus || '').trim().toLowerCase();
    const hasPaymentProof = Boolean(String(paymentInfo.transactionId || '').trim()) || Boolean(String(paymentInfo.paymentDate || '').trim());
    const effectivePaymentStatus = (normalizedPaymentStatus === 'paid' || hasPaymentProof) ? 'Paid' : 'Pending';

    // Final submit is allowed from current step without forcing a full refill from step 1.

    if (effectivePaymentStatus !== 'Paid') {
      setErrorMessage('Please pay the application fee before final submission.');
      setLoading(false);
      return;
    }

    try {
      const applicationData = {
        personal_details: {
          full_name: formData.full_name,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
          nationality: formData.nationality,
          institution: formData.institution,
          mode_of_study: formData.mode_of_study,
          candidate_state_type: formData.candidate_state_type,
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
        uploaded_files: uploadedFiles,
        paymentStatus: effectivePaymentStatus,
        paymentDate: paymentInfo.paymentDate || new Date().toISOString(),
        paymentAmount: paymentInfo.paymentAmount,
        paymentMethod: paymentInfo.paymentMethod,
        transactionId: paymentInfo.transactionId
      };

      const response = await api.post('/api/scholar/application', applicationData);
      
      console.log('Application submitted successfully:', response.data);
      setSuccessMessage(`Application submitted successfully! Registration ID: ${response.data.registration_id}`);
      
      // Reset form data after successful submission
      setFormData({
        full_name: user.full_name || '',
        date_of_birth: '',
        gender: '',
        nationality: '',
        institution: '',
        mode_of_study: '',
        candidate_state_type: '',
        category: '',
        aadhaar_passport: '',
        mobile: user.phone || '',
        email: user.email,
        permanent_address: '',
        communication_address: '',
        ug_degree_name: '',
        ug_college_university: '',
        ug_branch_department: '',
        ug_year_of_passing: '',
        ug_cgpa_percentage: '',
        pg_degree_name: '',
        pg_college_university: '',
        pg_specialization: '',
        pg_year_of_passing: '',
        pg_cgpa_percentage: '',
        exam_name: '',
        registration_number: '',
        year_of_exam: '',
        score_rank: '',
        validity_period: '',
        area_of_interest: '',
        proposed_topic: '',
        statement_of_purpose: '',
        preferred_supervisor: '',
        previous_research: '',
        publications: '',
        company_name: '',
        job_role: '',
        years_of_experience: '',
        field_of_work: ''
      });
      setUploadedFiles({});
      setPaymentInfo({
        paymentStatus: 'Pending',
        paymentDate: '',
        paymentAmount: DEFAULT_APPLICATION_FEE_AMOUNT,
        paymentMethod: '',
        transactionId: ''
      });
      setCurrentStep(1);
      
      // Wait for applications to be fetched before switching view
      await fetchMyApplications();
      
      // Give it a small delay to ensure state is updated
      setTimeout(() => {
        setView('my-applications');
        setSuccessMessage('');
      }, 1000);
      
    } catch (error) {
      console.error('Submission error:', error);
      const submitErrorMessage = getApiErrorMessage(error, 'Application submission failed. Please try again.');

      // If backend reports an already-active submission, treat it as idempotent success
      // so the user can proceed from Review & Submit without refilling the whole form.
      if (/already have an active application/i.test(submitErrorMessage) || /already submitted/i.test(submitErrorMessage)) {
        setSuccessMessage('Application already submitted. Opening your application list.');
        setErrorMessage('');
        await fetchMyApplications();
        setTimeout(() => {
          setView('my-applications');
          setSuccessMessage('');
        }, 600);
        return;
      }

      setErrorMessage(submitErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderApplicationForm = () => {
    const normalizedPaymentStatus = String(paymentInfo.paymentStatus || '').trim().toLowerCase();
    const hasPaymentProof = Boolean(String(paymentInfo.transactionId || '').trim()) || Boolean(String(paymentInfo.paymentDate || '').trim());
    const canSubmitFromCurrentStep = normalizedPaymentStatus === 'paid' || hasPaymentProof;

    return (
      <div className="application-form-container">
        <button onClick={() => setView('home')} className="back-btn">← Back to Dashboard</button>
        
        <h2>PhD Application Form</h2>
        
        <div className="progress-bar">
          {[1, 2, 3, 4, 5, 6, 7].map((step) => (
            <div key={step} className={`progress-step ${currentStep >= step ? 'active' : ''}`}>
              <div className="step-number">{step}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmitApplication} className="dashboard-form">
          {currentStep === 1 && (
            <div className="form-section">
              <h3>Personal Details</h3>
              <div className="form-grid">
                <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="Full Name *" required />
                <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />
                <select name="gender" value={formData.gender} onChange={handleChange} required>
                  <option value="">Select Gender *</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} placeholder="Nationality *" required />
                <select name="mode_of_study" value={formData.mode_of_study} onChange={handleChange} required>
                  <option value="">Select Mode of Study *</option>
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                </select>
                <select name="institution" value={formData.institution} onChange={handleChange} required>
                  <option value="">Select Institution *</option>
                  <option value="PTU">PTU</option>
                  <option value="PKIT">PKIT</option>
                </select>
                <select name="candidate_state_type" value={formData.candidate_state_type} onChange={handleChange} required>
                  <option value="">Select Candidate State Type *</option>
                  <option value="Puducherry UT">Puducherry UT</option>
                  <option value="Other State">Other State</option>
                </select>
                <select name="category" value={formData.category} onChange={handleChange} required>
                  <option value="">Select Category *</option>
                  <option value="General">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="PwD">PwD</option>
                  <option value="Women">Women</option>
                  <option value="EWS">EWS</option>
                  <option value="FN">FN (Foreign National)</option>
                </select>
                <input type="text" name="aadhaar_passport" value={formData.aadhaar_passport} onChange={handleChange} placeholder="Aadhaar/Passport *" required />
                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="Mobile *" required />
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email *" required />
                <textarea name="permanent_address" value={formData.permanent_address} onChange={handleChange} placeholder="Permanent Address *" required style={{gridColumn: '1/-1'}} />
                <textarea name="communication_address" value={formData.communication_address} onChange={handleChange} placeholder="Communication Address *" required style={{gridColumn: '1/-1'}} />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="form-section">
              <h3>UG Academic Details</h3>
              <div className="form-grid">
                <input type="text" name="ug_degree_name" value={formData.ug_degree_name} onChange={handleChange} placeholder="Degree Name *" required />
                <input type="text" name="ug_college_university" value={formData.ug_college_university} onChange={handleChange} placeholder="College/University *" required />
                <input type="text" name="ug_branch_department" value={formData.ug_branch_department} onChange={handleChange} placeholder="Branch/Department *" required />
                <input type="text" name="ug_year_of_passing" value={formData.ug_year_of_passing} onChange={handleChange} placeholder="Year of Passing *" required />
                <input type="text" name="ug_cgpa_percentage" value={formData.ug_cgpa_percentage} onChange={handleChange} placeholder="CGPA/Percentage *" required />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="form-section">
              <h3>PG Academic Details</h3>
              <div className="form-grid">
                <input type="text" name="pg_degree_name" value={formData.pg_degree_name} onChange={handleChange} placeholder="Degree Name *" required />
                <input type="text" name="pg_college_university" value={formData.pg_college_university} onChange={handleChange} placeholder="College/University *" required />
                <input type="text" name="pg_specialization" value={formData.pg_specialization} onChange={handleChange} placeholder="Specialization *" required />
                <input type="text" name="pg_year_of_passing" value={formData.pg_year_of_passing} onChange={handleChange} placeholder="Year of Passing *" required />
                <input type="text" name="pg_cgpa_percentage" value={formData.pg_cgpa_percentage} onChange={handleChange} placeholder="CGPA/Percentage *" required />
              </div>
              {errorMessage && (
                <p style={{ color: 'red', marginTop: '8px' }}>{errorMessage}</p>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="form-section">
              <h3>Entrance Examination Details</h3>
              <div className="form-grid">
                <input type="text" name="exam_name" value={formData.exam_name} onChange={handleChange} placeholder="Exam Name (GATE/NET/JRF) *" required />
                <input type="text" name="registration_number" value={formData.registration_number} onChange={handleChange} placeholder="Registration Number *" required />
                <input type="text" name="year_of_exam" value={formData.year_of_exam} onChange={handleChange} placeholder="Year of Exam *" required />
                <input type="text" name="score_rank" value={formData.score_rank} onChange={handleChange} placeholder="Score/Rank *" required />
                <input type="text" name="validity_period" value={formData.validity_period} onChange={handleChange} placeholder="Validity Period *" required />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="form-section">
              <h3>Research Information</h3>
              <div className="form-grid">
                <input type="text" name="area_of_interest" value={formData.area_of_interest} onChange={handleChange} placeholder="Area of Interest *" required style={{gridColumn: '1/-1'}} />
                <input type="text" name="proposed_topic" value={formData.proposed_topic} onChange={handleChange} placeholder="Proposed Research Topic *" required style={{gridColumn: '1/-1'}} />
                <textarea name="statement_of_purpose" value={formData.statement_of_purpose} onChange={handleChange} placeholder="Statement of Purpose *" required rows="6" style={{gridColumn: '1/-1'}} />
                <input type="text" name="preferred_supervisor" value={formData.preferred_supervisor} onChange={handleChange} placeholder="Preferred Supervisor *" required style={{gridColumn: '1/-1'}} />
                <textarea name="previous_research" value={formData.previous_research} onChange={handleChange} placeholder="Previous Research (Optional)" rows="3" style={{gridColumn: '1/-1'}} />
                <textarea name="publications" value={formData.publications} onChange={handleChange} placeholder="Publications (Optional)" rows="3" style={{gridColumn: '1/-1'}} />
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="form-section">
              <h3>Work Experience & Documents</h3>
              <div className="form-grid">
                <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} placeholder="Company Name (Optional)" />
                <input type="text" name="job_role" value={formData.job_role} onChange={handleChange} placeholder="Job Role (Optional)" />
                <input type="text" name="years_of_experience" value={formData.years_of_experience} onChange={handleChange} placeholder="Years of Experience" />
                <input type="text" name="field_of_work" value={formData.field_of_work} onChange={handleChange} placeholder="Field of Work" />
              </div>
              
              <h4 style={{marginTop: '30px', marginBottom: '15px', fontSize: '20px', fontWeight: '600'}}>Upload Required Documents</h4>
              
              {/* GROUP 1 - Academic Documents (Always Visible) */}
              <div style={{marginBottom: '25px'}}>
                <h5 style={{color: '#2563eb', fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '2px solid #dbeafe', paddingBottom: '6px'}}>📚 Academic Documents (Required)</h5>
                <div className="upload-grid">
                  <div className="upload-item">
                    <label>Date of Birth Proof <span style={{color: 'red'}}>*</span></label>
                    <small style={{display: 'block', color: '#666', marginBottom: '5px'}}>High School / Higher Secondary / Birth Certificate</small>
                    <input type="file" id="file_dob_proof" onChange={(e) => handleFileUpload(e, 'dob_proof')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_dob_proof').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                    {uploadedFiles['dob_proof'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                  <div className="upload-item">
                    <label>HSC Mark Sheet <span style={{color: 'red'}}>*</span></label>
                    <input type="file" id="file_hsc_marksheet" onChange={(e) => handleFileUpload(e, 'hsc_marksheet')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_hsc_marksheet').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                    {uploadedFiles['hsc_marksheet'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                  <div className="upload-item">
                    <label>UG Degree Certificate <span style={{color: 'red'}}>*</span></label>
                    <small style={{display: 'block', color: '#666', marginBottom: '5px'}}>B.E / B.Tech / B.Sc / B.A</small>
                    <input type="file" id="file_ug_degree_certificate" onChange={(e) => handleFileUpload(e, 'ug_degree_certificate')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_ug_degree_certificate').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                    {uploadedFiles['ug_degree_certificate'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                  <div className="upload-item">
                    <label>PG Degree Certificate <span style={{color: 'red'}}>*</span></label>
                    <small style={{display: 'block', color: '#666', marginBottom: '5px'}}>M.E / M.Tech / M.Sc / MCA / M.A</small>
                    <input type="file" id="file_pg_degree_certificate" onChange={(e) => handleFileUpload(e, 'pg_degree_certificate')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_pg_degree_certificate').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                    {uploadedFiles['pg_degree_certificate'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                  <div className="upload-item">
                    <label>PG Mark Sheets <span style={{color: 'red'}}>*</span></label>
                    <input type="file" id="file_pg_marksheets" onChange={(e) => handleFileUpload(e, 'pg_marksheets')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_pg_marksheets').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                    {uploadedFiles['pg_marksheets'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                  <div className="upload-item">
                    <label>Transfer Certificate <span style={{color: 'red'}}>*</span></label>
                    <input type="file" id="file_transfer_certificate" onChange={(e) => handleFileUpload(e, 'transfer_certificate')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_transfer_certificate').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                    {uploadedFiles['transfer_certificate'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                  <div className="upload-item">
                    <label>Conduct Certificate <span style={{color: 'red'}}>*</span></label>
                    <input type="file" id="file_conduct_certificate" onChange={(e) => handleFileUpload(e, 'conduct_certificate')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_conduct_certificate').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                    {uploadedFiles['conduct_certificate'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                  <div className="upload-item">
                    <label>Research Proposal <span style={{color: 'red'}}>*</span></label>
                    <small style={{display: 'block', color: '#666', marginBottom: '5px'}}>Maximum 2 pages</small>
                    <input type="file" id="file_research_proposal" onChange={(e) => handleFileUpload(e, 'research_proposal')} accept=".pdf" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_research_proposal').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Format: PDF only</small>
                    {uploadedFiles['research_proposal'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                  <div className="upload-item">
                    <label>Research Publications</label>
                    <small style={{display: 'block', color: '#666', marginBottom: '5px'}}>If any (Optional)</small>
                    <input type="file" id="file_research_publications" onChange={(e) => handleFileUpload(e, 'research_publications')} accept=".pdf" style={{display: 'none'}} />
                    <button type="button" onClick={() => document.getElementById('file_research_publications').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                    <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Format: PDF only</small>
                    {uploadedFiles['research_publications'] && <span className="file-uploaded">✓ Uploaded</span>}
                  </div>
                </div>
              </div>

              {/* GROUP 2 - State / Category Based Certificates (Conditional) */}
              {(formData.candidate_state_type === 'Puducherry UT' || formData.category === 'OBC' || (formData.category !== 'General' && formData.category !== '')) && (
                <div style={{marginBottom: '25px'}}>
                  <h5 style={{color: '#059669', fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '2px solid #d1fae5', paddingBottom: '6px'}}>📋 State / Category Based Certificates</h5>
                  <div className="upload-grid">
                    {formData.candidate_state_type === 'Puducherry UT' && (
                      <div className="upload-item">
                        <label>Residence Certificate <span style={{color: 'red'}}>*</span></label>
                        <small style={{display: 'block', color: '#666', marginBottom: '5px'}}>Required for Puducherry UT candidates</small>
                        <input type="file" id="file_residence_certificate" onChange={(e) => handleFileUpload(e, 'residence_certificate')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                        <button type="button" onClick={() => document.getElementById('file_residence_certificate').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                        <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                        {uploadedFiles['residence_certificate'] && <span className="file-uploaded">✓ Uploaded</span>}
                      </div>
                    )}
                    {formData.category !== 'General' && formData.category !== '' && formData.category !== 'FN' && (
                      <div className="upload-item">
                        <label>Community Certificate <span style={{color: 'red'}}>*</span></label>
                        <small style={{display: 'block', color: '#666', marginBottom: '5px'}}>Required for non-General category</small>
                        <input type="file" id="file_community_certificate" onChange={(e) => handleFileUpload(e, 'community_certificate')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                        <button type="button" onClick={() => document.getElementById('file_community_certificate').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                        <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                        {uploadedFiles['community_certificate'] && <span className="file-uploaded">✓ Uploaded</span>}
                      </div>
                    )}
                    {formData.category === 'OBC' && (
                      <div className="upload-item">
                        <label>OBC Non-Creamy Layer Certificate <span style={{color: 'red'}}>*</span></label>
                        <small style={{display: 'block', color: '#666', marginBottom: '5px'}}>Required for OBC (Both Puducherry UT & Other State)</small>
                        <input type="file" id="file_obc_certificate" onChange={(e) => handleFileUpload(e, 'obc_certificate')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                        <button type="button" onClick={() => document.getElementById('file_obc_certificate').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                        <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                        {uploadedFiles['obc_certificate'] && <span className="file-uploaded">✓ Uploaded</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* GROUP 3 - Part Time Candidates Only */}
              {formData.mode_of_study === 'Part Time' && (
                <div style={{marginBottom: '25px'}}>
                  <h5 style={{color: '#dc2626', fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '2px solid #fee2e2', paddingBottom: '6px'}}>💼 Part-Time Candidate Documents (Required)</h5>
                  <div className="upload-grid">
                    <div className="upload-item">
                      <label>No Objection Certificate (Form I) <span style={{color: 'red'}}>*</span></label>
                      <button type="button" onClick={() => setView('form-i')} style={{padding: '8px 16px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500'}}>📝 Fill Form-I Online</button>
                      <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Click to fill and download the NOC form</small>
                    </div>
                    <div className="upload-item">
                      <label>Experience Certificate (Form II) <span style={{color: 'red'}}>*</span></label>
                      <button type="button" onClick={() => setView('form-ii')} style={{padding: '8px 16px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500'}}>📝 Fill Form-II Online</button>
                      <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Click to fill and download the Experience Certificate</small>
                    </div>
                    <div className="upload-item">
                      <label>AICTE Affiliation Proof <span style={{color: 'red'}}>*</span></label>
                      <input type="file" id="file_aicte_affiliation" onChange={(e) => handleFileUpload(e, 'aicte_affiliation')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                      <button type="button" onClick={() => document.getElementById('file_aicte_affiliation').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                      <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                      {uploadedFiles['aicte_affiliation'] && <span className="file-uploaded">✓ Uploaded</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* GROUP 4 - Foreign National Only */}
              {formData.category === 'FN' && (
                <div style={{marginBottom: '25px'}}>
                  <h5 style={{color: '#7c3aed', fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '2px solid #ede9fe', paddingBottom: '6px'}}>🌍 Foreign National Documents (Required)</h5>
                  <div className="upload-grid">
                    <div className="upload-item">
                      <label>Sponsorship Certificate <span style={{color: 'red'}}>*</span></label>
                      <input type="file" id="file_sponsorship_certificate" onChange={(e) => handleFileUpload(e, 'sponsorship_certificate')} accept=".pdf,.jpg,.jpeg,.png" style={{display: 'none'}} />
                      <button type="button" onClick={() => document.getElementById('file_sponsorship_certificate').click()} style={{padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'}}>Attach Document</button>
                      <small style={{display: 'block', color: '#888', fontSize: '11px', marginTop: '4px'}}>Max size: 5MB | Formats: PDF, JPG, JPEG, PNG</small>
                      {uploadedFiles['sponsorship_certificate'] && <span className="file-uploaded">✓ Uploaded</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 7 && (
            <div className="form-section">
              <h3>Review & Submit</h3>
              <div className="review-info">
                <p>Please review all your information before submitting.</p>
                <p>Once submitted, your application will be sent for review.</p>
                <p><strong>Status:</strong> Will be set to "Submitted" after submission.</p>
                <p><strong>Application Fee:</strong> ₹{calculatedApplicationFee}</p>
                <p><strong>Payment Status:</strong> {paymentInfo.paymentStatus}</p>
                <div className="payment-method-block">
                  <p className="payment-method-title"><strong>Select Payment Method:</strong></p>
                  <label className={`payment-option ${paymentInfo.paymentMethod === 'UPI (GPay / PhonePe / Paytm)' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="UPI (GPay / PhonePe / Paytm)"
                      checked={paymentInfo.paymentMethod === 'UPI (GPay / PhonePe / Paytm)'}
                      onChange={handlePaymentMethodChange}
                      disabled={paymentInfo.paymentStatus === 'Paid'}
                    />
                    <span>UPI (GPay / PhonePe / Paytm)</span>
                  </label>
                  <label className={`payment-option ${paymentInfo.paymentMethod === 'Credit / Debit Card' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="Credit / Debit Card"
                      checked={paymentInfo.paymentMethod === 'Credit / Debit Card'}
                      onChange={handlePaymentMethodChange}
                      disabled={paymentInfo.paymentStatus === 'Paid'}
                    />
                    <span>Credit / Debit Card</span>
                  </label>
                  <label className={`payment-option ${paymentInfo.paymentMethod === 'Net Banking' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="Net Banking"
                      checked={paymentInfo.paymentMethod === 'Net Banking'}
                      onChange={handlePaymentMethodChange}
                      disabled={paymentInfo.paymentStatus === 'Paid'}
                    />
                    <span>Net Banking</span>
                  </label>
                </div>
                {paymentInfo.paymentDate && (
                  <p><strong>Payment Date:</strong> {formatDateTime(paymentInfo.paymentDate)}</p>
                )}
                {paymentInfo.paymentMethod && (
                  <p><strong>Payment Method:</strong> {paymentInfo.paymentMethod}</p>
                )}
                {paymentInfo.transactionId && (
                  <p><strong>Transaction ID:</strong> {paymentInfo.transactionId}</p>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePayFee}
                  disabled={loading || paymentInfo.paymentStatus === 'Paid'}
                  style={{ marginTop: '12px', minWidth: '132px' }}
                >
                  {paymentInfo.paymentStatus === 'Paid' ? 'Fee Paid' : 'Pay Now'}
                </button>
              </div>
            </div>
          )}

          <div className="button-group">
            {currentStep > 1 && <button type="button" onClick={prevStep} className="btn btn-secondary">Previous</button>}
            {currentStep < 7 ? (
              <button type="button" onClick={nextStep} className="btn btn-primary">Next</button>
            ) : (
              <button type="submit" className="btn btn-success" disabled={loading || !canSubmitFromCurrentStep}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>

          {successMessage && <div className="alert alert-success">{successMessage}</div>}
          {errorMessage && currentStep !== 3 && <p style={{ color: 'red' }}>{errorMessage}</p>}
        </form>
      </div>
    );
  };

  if (view === 'apply') {
    return renderApplicationForm();
  }

  if (view === 'form-i') {
    return (
      <div className="dashboard">
        <nav className="dashboard-nav">
          <h2>Form-I (NOC)</h2>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </nav>
        <div className="dashboard-content">
          <button onClick={() => setView('home')} className="back-btn">← Back to Dashboard</button>
          <FormI_NOC />
        </div>
      </div>
    );
  }

  if (view === 'form-ii') {
    return (
      <div className="dashboard">
        <nav className="dashboard-nav">
          <h2>Form-II (Experience Certificate)</h2>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </nav>
        <div className="dashboard-content">
          <button onClick={() => setView('home')} className="back-btn">← Back to Dashboard</button>
          <FormII_ExperienceCertificate />
        </div>
      </div>
    );
  }

  if (view === 'my-applications') {
    return (
      <div className="dashboard">
        <nav className="dashboard-nav">
          <h2>My Applications</h2>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </nav>
        
        <div className="dashboard-content">
          <button onClick={() => setView('home')} className="back-btn">← Back</button>
          
          <div className="applications-list">
            {applications.length === 0 ? (
              <div className="empty-state">
                <p>You haven't submitted any applications yet.</p>
                <button onClick={handleApplyClick} className="btn btn-primary">Submit New Application</button>
              </div>
            ) : (
              applications.map(app => renderApplicationStage(app))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'entrance-application') {
    return (
      <div className="dashboard">
        <nav className="dashboard-nav">
          <h2>Entrance Application</h2>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </nav>
        <div className="dashboard-content">
          <button onClick={() => setView('entrance-dashboard')} className="back-btn">← Back</button>
          {selectedApplicationForEntrance && (
            <EntranceApplicationForm
              application={selectedApplicationForEntrance}
              onSubmitSuccess={() => {
                setSelectedApplicationForEntrance(null);
                setView('entrance-dashboard');
                fetchMyApplications();
              }}
              onCancel={() => setView('entrance-dashboard')}
            />
          )}
        </div>
      </div>
    );
  }

  if (view === 'entrance-dashboard') {
    const applicationsEligibleForEntrance = getEntranceEligibleApplications();
    const entrancePolicy = entranceExamPolicy?.policy || {};
    const entranceTest = entrancePolicy.entranceTest || {};
    const patternSummary = entrancePolicy.pattern || [
      entranceTest.questionType ? `${entranceTest.questionType} format` : 'MCQ format',
      `${entranceTest.totalQuestions || 100} questions`,
      `${entranceTest.totalMarks || 100} marks`,
      `Duration: ${entranceExamPolicy?.examDuration || `${entranceTest.durationHours || 2} Hours`}`,
      `Qualifying: ${entranceTest.qualifyingMarks || 50} marks`
    ].join(' | ');
    const entrancePolicyPanelStyle = {
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
      color: '#1a2a44',
      padding: '22px 24px',
      borderRadius: '14px',
      marginBottom: '24px',
      border: '1px solid #cfe0ff',
      borderLeft: '6px solid #2563eb',
      boxShadow: '0 8px 24px rgba(37, 99, 235, 0.10)'
    };
    const entranceCardStatusStyle = {
      display: 'inline-block',
      padding: '6px 12px',
      borderRadius: '999px',
      background: '#e8f1ff',
      color: '#1d4ed8',
      fontWeight: 700,
      marginLeft: '6px'
    };

    return (
      <div className="dashboard">
        <nav className="dashboard-nav">
          <h2>Entrance Examination</h2>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </nav>
        
        <div className="dashboard-content">
          <button onClick={() => setView('home')} className="back-btn">← Back</button>
          
          {entranceExamPolicy && (
            <div style={entrancePolicyPanelStyle}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#1a2a44', fontSize: '22px' }}>📋 Entrance Exam Details</h3>
              <p style={{ marginBottom: '8px', color: '#1f2937' }}><strong>Exam Date:</strong> {entranceExamPolicy.examDate}</p>
              <p style={{ marginBottom: '8px', color: '#1f2937' }}><strong>Exam Time:</strong> {entranceExamPolicy.examTime}</p>
              <p style={{ marginBottom: '8px', color: '#1f2937' }}><strong>Exam Centre:</strong> {entranceExamPolicy.examCentre}</p>
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #dbeafe', color: '#1f2937', fontSize: '15px' }}>
                <strong>Pattern:</strong> {patternSummary}
              </div>
            </div>
          )}

          <div className="applications-list">
            {applicationsEligibleForEntrance.length === 0 ? (
              <div className="empty-state">
                <p>No applications ready</p>
                <p style={{ fontSize: '14px', color: '#666' }}>You are not eligible for entrance exam.</p>
                <button onClick={() => setView('my-applications')} className="btn btn-primary">View My Applications</button>
              </div>
            ) : (
              applicationsEligibleForEntrance.map(app => (
                <div key={app.id} className="application-card">
                  <h3>{app.registration_id}</h3>
                  <p><strong>Department:</strong> {getDisplayValue(app.personal_details?.branch_department, app.department)}</p>
                  <p><strong>Mode:</strong> {getDisplayValue(app.personal_details?.mode_of_study, 'Full Time')}</p>
                  <p><strong>Status:</strong> <span className={`status status-${app.status}`}>{formatApplicationStatus(app.status)}</span></p>
                  <p><strong>Entrance Application Status:</strong> <span style={entranceCardStatusStyle}>{app.entranceApplicationStatus || 'Not Started'}</span></p>
                  <p><strong>Scrutiny:</strong> <span style={entranceCardStatusStyle}>{app.scrutinyStatus || app.scrutiny_status || 'Pending'}</span></p>
                  {isScrutinyApproved(app) && app.paymentStatus === 'Paid' && (!app.entranceApplicationStatus || app.entranceApplicationStatus === 'Pending') ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ marginTop: '10px' }}
                      onClick={() => {
                        setSelectedApplicationForEntrance(app);
                        setView('entrance-application');
                      }}
                    >
                      Apply for Entrance Exam
                    </button>
                  ) : (!isScrutinyApproved(app) ? (
                    <p style={{ marginTop: '10px', color: '#b45309', fontWeight: 600 }}>You are not eligible for entrance exam</p>
                  ) : (
                    <p style={{ marginTop: '10px', color: '#22863a' }}>✓ Entrance application submitted</p>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <h2>Scholar Dashboard</h2>
        <div className="nav-right">
          <span className="user-name">{user.full_name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>
      
      <div className="dashboard-content">
        <div className="welcome-banner">
          <h1>Welcome, {user.full_name}!</h1>
          <p>Manage your PhD applications and track their status</p>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            {errorMessage}
          </div>
        )}

        <div className="dashboard-cards">
          <div 
            className={`dashboard-card ${hasActiveApplication() ? 'disabled' : ''}`} 
            onClick={handleApplyClick}
            style={{opacity: hasActiveApplication() ? 0.6 : 1, cursor: hasActiveApplication() ? 'not-allowed' : 'pointer'}}
          >
            <h3>📝 Submit New Application</h3>
            <p>{hasActiveApplication() ? '⚠️ Active application in the review workflow' : 'Fill out your PhD application form'}</p>
          </div>

          <div className="dashboard-card" onClick={() => setView('my-applications')}>
            <h3>📋 My Applications</h3>
            <p>View and track your submissions</p>
            <span className="card-badge">{applications.length}</span>
          </div>

          {applications.length > 0 && (
            <div className="dashboard-card" onClick={() => setView('entrance-dashboard')}>
              <h3>Entrance Examination</h3>
              <p>{getEntranceEligibleApplications().some((app) => isScrutinyApproved(app)) ? 'Apply for the entrance exam' : 'You are not eligible for entrance exam'}</p>
              <span className="card-badge">{getEntranceEligibleApplications().length}</span>
            </div>
          )}

          <div className="dashboard-card" onClick={handleNotificationsClick} style={{ cursor: 'pointer' }}>
            <h3>🔔 Notifications</h3>
            <p>View important updates</p>
            <span className="card-badge">{notifications.filter(n => !n.read).length}</span>
          </div>
        </div>

        <div className="notifications-section" ref={notificationsSectionRef}>
          <h3>Recent Notifications</h3>
          {notificationBanner && (
            <div className="info-section-clean highlight-section-clean" style={{ marginBottom: '16px' }}>
              <p className="status-message-clean"><strong>{notificationBanner}</strong></p>
            </div>
          )}
          {notifications.length === 0 && hasGeneratedFeeReceipt && (
            <div className="notification unread">
              <p>Fee Receipt Generated: Your fee receipt has been generated.</p>
              <small>{new Date().toLocaleString()}</small>
            </div>
          )}
          {notifications.slice(0, 5).map(notif => (
            <div key={notif.id} className={`notification ${notif.read ? 'read' : 'unread'}`}>
              <p>{notif.type === 'payment_receipt_generated' ? 'Fee Receipt Generated: ' + notif.message : notif.message}</p>
              <small>{new Date(notif.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScholarDashboard;
