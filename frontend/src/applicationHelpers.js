export const ACTIVE_APPLICATION_STATUSES = new Set([
  'submitted',
  'under_scrutiny',
  'faculty_review',
  'recommended_for_interview',
  'interview_scheduled',
  'interview_completed',
  'dean_review',
  'dean_approved',
  'final_approved',
  'accepted',
  'admission_confirmed',
  'under_verification',
  'reviewed',
  'shortlisted'
]);

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_scrutiny: 'Under Scrutiny',
  faculty_review: 'Faculty Review',
  recommended_for_interview: 'Recommended for Interview',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  dean_review: 'Dean Review',
  dean_approved: 'Dean Approved',
  final_approved: 'Research Director Approved',
  accepted: 'Accepted',
  admission_confirmed: 'Admission Confirmed',
  under_verification: 'Under Verification',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  approved: 'Approved',
  rejected: 'Rejected',
  waitlist: 'Waitlist'
};

export const documentLabelMap = {
  dob_proof: 'DOB PROOF',
  hsc_marksheet: 'HSC MARK SHEET',
  ug_degree_certificate: 'UG CERTIFICATE',
  pg_degree_certificate: 'PG CERTIFICATE',
  pg_marksheets: 'PG MARK SHEETS',
  transfer_certificate: 'TRANSFER CERTIFICATE',
  conduct_certificate: 'CONDUCT CERTIFICATE',
  research_proposal: 'RESEARCH PROPOSAL',
  research_publications: 'RESEARCH PUBLICATIONS',
  residence_certificate: 'RESIDENCE CERTIFICATE',
  community_certificate: 'COMMUNITY CERTIFICATE',
  obc_certificate: 'OBC CERTIFICATE',
  aicte_affiliation: 'AICTE AFFILIATION',
  sponsorship_certificate: 'SPONSORSHIP CERTIFICATE',
  ug_certificate: 'UG CERTIFICATE',
  pg_certificate: 'PG CERTIFICATE',
  exam_scorecard: 'EXAM SCORECARD',
  resume: 'RESUME',
  sop_document: 'SOP DOCUMENT',
  lor: 'LOR',
  id_proof: 'ID PROOF',
  photo: 'PHOTO'
};

export const orderedDocumentKeys = [
  'dob_proof',
  'hsc_marksheet',
  'ug_degree_certificate',
  'ug_certificate',
  'pg_degree_certificate',
  'pg_certificate',
  'pg_marksheets',
  'transfer_certificate',
  'conduct_certificate',
  'research_proposal',
  'sop_document',
  'research_publications',
  'exam_scorecard',
  'resume',
  'lor',
  'id_proof',
  'photo',
  'residence_certificate',
  'community_certificate',
  'obc_certificate',
  'aicte_affiliation',
  'sponsorship_certificate'
];

export function getDisplayValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
      continue;
    }

    return value;
  }

  return 'N/A';
}

export function joinDisplayValues(...values) {
  const cleaned = values
    .map((value) => (typeof value === 'string' ? value.trim() : value))
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');

  return cleaned.length > 0 ? cleaned.join(' - ') : 'N/A';
}

export function formatTextLabel(value) {
  const text = getDisplayValue(value);
  if (text === 'N/A') {
    return text;
  }

  return String(text)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatApplicationStatus(status) {
  return STATUS_LABELS[status] || formatTextLabel(status);
}

export function getDocumentId(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value && typeof value === 'object') {
    return String(value.file_id || value.id || value.filename || '').trim();
  }

  return '';
}

export function getDocumentLabel(key) {
  return documentLabelMap[key] || String(key || '').replace(/_/g, ' ').toUpperCase();
}

export function getUploadedDocuments(app) {
  const docs = Object.entries(app?.uploaded_files || {})
    .map(([key, value]) => ({ key, fileId: getDocumentId(value) }))
    .filter((item) => item.fileId);

  return docs.sort((a, b) => {
    const indexA = orderedDocumentKeys.indexOf(a.key);
    const indexB = orderedDocumentKeys.indexOf(b.key);
    const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return getDocumentLabel(a.key).localeCompare(getDocumentLabel(b.key));
  });
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getReviewOverallScore(review) {
  const overall = toNumber(review?.overall_score);
  if (overall !== null) {
    return overall;
  }

  const academic = toNumber(review?.academic_score ?? review?.technical_score);
  const research = toNumber(review?.research_score ?? review?.communication_score);
  const scores = [academic, research].filter((value) => value !== null);

  if (scores.length === 0) {
    return null;
  }

  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2));
}

export function calculateAverageReviewScore(reviews) {
  const scores = (reviews || [])
    .map((review) => getReviewOverallScore(review))
    .filter((value) => value !== null);

  if (scores.length === 0) {
    return 'N/A';
  }

  return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2);
}

export function formatDateOnly(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

export function toDateTimeInputValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}