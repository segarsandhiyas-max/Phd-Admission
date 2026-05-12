import { useEffect, useRef, useState } from 'react';
import api, { getApiErrorMessage } from '../api';

function EntranceApplicationForm({ application, onSubmitSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);
  const photoInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const [formData, setFormData] = useState({
    confirmParticipation: false,
    mobileNumber: ((application.personal_details || {}).mobile || '').trim(),
    alternateContactNumber: '',
    gender: ((application.personal_details || {}).gender || '').trim(),
    category: ((application.personal_details || {}).category || '').trim(),
    applyVish: false,
    declaration: false
  });

  const PHOTO_MAX_SIZE = 200 * 1024;
  const SIGNATURE_MAX_SIZE = 100 * 1024;
  const PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
  const SIGNATURE_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

  const handleChange = (e) => {
    const { name, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : e.target.value
    }));
  };

  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState('');

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(signatureFile);
    setSignaturePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [signatureFile]);

  const validateFile = (file, allowedTypes, maxSize, fieldLabel) => {
    if (!file) {
      throw new Error(`${fieldLabel} is required`);
    }
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`${fieldLabel} must be JPG or PNG`);
    }
    if (file.size > maxSize) {
      throw new Error(`${fieldLabel} size must be less than ${Math.floor(maxSize / 1024)}KB`);
    }
  };

  const uploadFile = async (file, fieldName) => {
    const uploadPayload = new FormData();
    uploadPayload.append('file', file);
    uploadPayload.append('field_name', fieldName);

    const uploadResponse = await api.post('/api/upload-file', uploadPayload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return uploadResponse.data?.file_id || uploadResponse.data?.filename;
  };

  const handlePhotoSelect = (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      validateFile(file, PHOTO_ALLOWED_TYPES, PHOTO_MAX_SIZE, 'Passport photo');
      setPhotoFile(file);
      setShowPhotoPreview(false);
      setErrorMessage('');
    } catch (error) {
      setPhotoFile(null);
      setErrorMessage(error.message || 'Invalid photo file');
    }
  };

  const handleSignatureSelect = (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      validateFile(file, SIGNATURE_ALLOWED_TYPES, SIGNATURE_MAX_SIZE, 'Signature');
      setSignatureFile(file);
      setShowSignaturePreview(false);
      setErrorMessage('');
    } catch (error) {
      setSignatureFile(null);
      setErrorMessage(error.message || 'Invalid signature file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (!formData.mobileNumber.trim() || !formData.gender.trim() || !formData.category.trim()) {
      setErrorMessage('Please fill all required personal details');
      setLoading(false);
      return;
    }

    try {
      validateFile(photoFile, PHOTO_ALLOWED_TYPES, PHOTO_MAX_SIZE, 'Passport photo');
      validateFile(signatureFile, SIGNATURE_ALLOWED_TYPES, SIGNATURE_MAX_SIZE, 'Signature');
    } catch (error) {
      setErrorMessage(error.message || 'File validation failed');
      setLoading(false);
      return;
    }

    if (!formData.confirmParticipation) {
      setErrorMessage('Please confirm your participation to proceed');
      setLoading(false);
      return;
    }

    if (!formData.declaration) {
      setErrorMessage('You must accept the declaration to proceed');
      setLoading(false);
      return;
    }

    try {
      const photoFileId = await uploadFile(photoFile, 'candidate_photo');
      const signatureFileId = await uploadFile(signatureFile, 'signature');

      const payload = {
        application_id: application.id || application._id,
        exam_centre: 'Puducherry Technological University',
        confirm_participation: formData.confirmParticipation,
        mobile_number: formData.mobileNumber.trim(),
        alternate_contact_number: formData.alternateContactNumber.trim() || null,
        gender: formData.gender.trim(),
        category: formData.category.trim(),
        photo_file_id: photoFileId,
        signature_file_id: signatureFileId,
        declaration: formData.declaration,
        apply_vish: formData.applyVish
      };

      await api.post('/api/scholar/entrance-application', payload);
      
      setSuccessMessage('Entrance application submitted successfully!');
      setTimeout(() => {
        onSubmitSuccess();
      }, 1500);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Failed to submit entrance application'));
    } finally {
      setLoading(false);
    }
  };

  const department = application.department || ((application.ug_details || {}).branch_department) || 'Not Specified';
  const mode = ((application.personal_details || {}).mode_of_study) || 'Not Specified';
  const applicantName = (application.personal_details || {}).full_name || application.scholar_name || 'N/A';
  const applicantEmail = (application.personal_details || {}).email || application.scholar_email || 'N/A';
  const examCentre = application.entranceExamCentre || 'Puducherry Technological University';
  const examDate = application.entranceExamDate || '2025-06-20';
  const examTime = application.entranceExamTime || '10:00 AM';
  const reportingTime = application.entranceExamReportingTime || '09:30 AM';
  const examDuration = application.entranceExamDuration || '3 Hours';

  const shellStyle = {
    width: '100%',
    maxWidth: '1180px',
    margin: '0 auto',
    background: 'linear-gradient(180deg, #fffdf7 0%, #f3f7ff 100%)',
    color: '#1f2937',
    border: '1px solid #d8e2f0',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 22px 60px rgba(15, 23, 42, 0.12)'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '22px'
  };

  const statusPillStyle = {
    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    color: '#92400e',
    border: '1px solid #f59e0b',
    borderRadius: '999px',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.2px'
  };

  const bannerStyle = {
    borderRadius: '20px',
    padding: '22px',
    marginBottom: '20px',
    color: '#0f172a',
    background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #fefce8 100%)',
    border: '1px solid #dbe7f6',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)'
  };

  const bannerTitleStyle = {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    letterSpacing: '0.2px',
    color: '#0f172a'
  };

  const bannerNoteStyle = {
    margin: '8px 0 0',
    color: '#475569',
    fontSize: '14px',
    lineHeight: 1.6,
    maxWidth: '820px'
  };

  const metaGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginTop: '16px'
  };

  const metaCardStyle = {
    borderRadius: '14px',
    padding: '12px 14px',
    border: '1px solid #dbe7f6',
    background: '#ffffff',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)'
  };

  const metaLabelStyle = {
    display: 'block',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '4px'
  };

  const metaValueStyle = {
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1.4
  };

  const sectionStyle = {
    border: '1px solid #dbe7f6',
    borderRadius: '18px',
    padding: '20px',
    marginBottom: '16px',
    background: '#ffffff',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)'
  };

  const readOnlySectionStyle = {
    ...sectionStyle,
    background: '#f8fafc'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '12px'
  };

  const fieldLabelStyle = {
    display: 'block',
    marginBottom: '6px',
    color: '#1f2937',
    fontSize: '14px',
    fontWeight: 600
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    color: '#111827',
    background: '#ffffff'
  };

  const readOnlyItemStyle = {
    background: '#ffffff',
    border: '1px solid #dbe5f2',
    borderRadius: '10px',
    padding: '10px 12px'
  };

  const sectionHeaderStyle = {
    color: '#0f172a',
    marginBottom: '14px',
    fontSize: '20px',
    fontWeight: 800,
    borderLeft: '4px solid #1d4ed8',
    paddingLeft: '10px',
    lineHeight: 1.1
  };

  const uploadPanelStyle = {
    border: '1px solid #dbe7f6',
    borderRadius: '16px',
    padding: '16px',
    background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)'
  };

  const previewBoxStyle = {
    marginTop: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    background: '#fff',
    display: 'inline-flex',
    padding: '6px'
  };

  const attachBtnStyle = {
    display: 'inline-block',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontWeight: 700,
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(37, 99, 235, 0.22)'
  };

  const fileTagStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '10px',
    padding: '7px 10px',
    borderRadius: '999px',
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    color: '#3730a3',
    fontSize: '12px',
    fontWeight: 700,
    maxWidth: '70%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  return (
    <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8" style={shellStyle}>
      <div style={headerStyle}>
        <div>
          <h2 className="mb-2 text-3xl font-bold text-slate-900" style={{ color: '#0f172a', marginBottom: '6px', fontSize: '32px' }}>Entrance Application Form</h2>
          <p className="mb-6 text-sm text-slate-600" style={{ color: '#475569', marginBottom: 0, fontSize: '15px', lineHeight: 1.6 }}>Complete this form after payment to proceed with the entrance examination process.</p>
        </div>
        <span style={statusPillStyle}>PTU EXAM MODULE</span>
      </div>

      <div style={bannerStyle}>
        <h3 style={bannerTitleStyle}>Official entrance submission</h3>
        <p style={bannerNoteStyle}>Use the attached photo and signature controls below. Previews stay hidden until you explicitly click View, so the page remains clean while you prepare the application.</p>
        <div style={metaGridStyle}>
          <div style={metaCardStyle}>
            <span style={metaLabelStyle}>Exam Date</span>
            <div style={metaValueStyle}>{examDate}</div>
          </div>
          <div style={metaCardStyle}>
            <span style={metaLabelStyle}>Exam Time</span>
            <div style={metaValueStyle}>{examTime}</div>
          </div>
          <div style={metaCardStyle}>
            <span style={metaLabelStyle}>Reporting Time</span>
            <div style={metaValueStyle}>{reportingTime}</div>
          </div>
          <div style={metaCardStyle}>
            <span style={metaLabelStyle}>Duration</span>
            <div style={metaValueStyle}>{examDuration}</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" style={{ display: 'block' }}>
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5" style={readOnlySectionStyle}>
          <h3 className="mb-4 text-xl font-semibold text-slate-900" style={sectionHeaderStyle}>Application Details (Read-Only)</h3>
          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2" style={gridStyle}>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Application ID:</span> {application.registration_id || 'N/A'}</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Candidate Name:</span> {applicantName}</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Email:</span> {applicantEmail}</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Department:</span> {department}</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Mode:</span> {mode}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5" style={sectionStyle}>
          <h3 className="mb-4 text-xl font-semibold text-slate-900" style={sectionHeaderStyle}>Personal Details</h3>
          <div className="grid gap-4 sm:grid-cols-2" style={gridStyle}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-800" style={fieldLabelStyle}>Mobile Number <span className="text-red-600">*</span></label>
              <input
                type="tel"
                name="mobileNumber"
                value={formData.mobileNumber}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-800" style={fieldLabelStyle}>Alternate Contact Number</label>
              <input
                type="tel"
                name="alternateContactNumber"
                value={formData.alternateContactNumber}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-800" style={fieldLabelStyle}>Gender <span className="text-red-600">*</span></label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                style={inputStyle}
                required
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-800" style={fieldLabelStyle}>Category <span className="text-red-600">*</span></label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                style={inputStyle}
                required
              >
                <option value="">Select category</option>
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5" style={readOnlySectionStyle}>
          <h3 className="mb-4 text-xl font-semibold text-slate-900" style={sectionHeaderStyle}>Exam Details (Read-Only)</h3>
          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2" style={gridStyle}>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Exam Centre:</span> {examCentre}</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Exam Mode:</span> Offline</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Exam Type:</span> PhD Entrance Exam</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Exam Date:</span> {examDate}</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Exam Time:</span> {examTime}</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Reporting Time:</span> {reportingTime}</p>
            <p style={readOnlyItemStyle}><span className="font-semibold text-slate-900">Duration:</span> {examDuration}</p>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5" style={{ ...sectionStyle, background: '#ecfdf5', borderColor: '#86efac' }}>
          <label className="flex items-start gap-3 text-sm text-slate-800" style={{ color: '#065f46', lineHeight: 1.6 }}>
            <input type="checkbox" name="confirmParticipation" checked={formData.confirmParticipation} onChange={handleChange} className="mt-1 h-4 w-4" style={{ marginTop: '4px' }} required />
            <span>
              I confirm my participation in the PhD Entrance Examination.
            </span>
          </label>
        </section>

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2" style={{ ...sectionStyle, ...gridStyle }}>
          <div>
            <div style={uploadPanelStyle}>
              <label className="mb-2 block text-sm font-medium text-slate-800" style={fieldLabelStyle}>Upload Passport Size Photo <span className="text-red-600">*</span></label>
              <p className="mb-2 text-xs text-slate-500" style={{ color: '#64748b', marginBottom: '8px' }}>Accepted: JPG, JPEG, PNG | Max size: 200KB</p>
              <input
                ref={photoInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  style={{ ...attachBtnStyle, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
                >
                  Attach File
                </button>
                <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>Photo</span>
                {photoFile && <span style={fileTagStyle}>{photoFile.name}</span>}
                {photoFile && (
                  <button
                    type="button"
                    onClick={() => setShowPhotoPreview((prev) => !prev)}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#1e3a8a',
                      borderRadius: '8px',
                      padding: '7px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {showPhotoPreview ? 'Hide' : 'View'}
                  </button>
                )}
              </div>
              {photoPreviewUrl && showPhotoPreview && <div style={previewBoxStyle}><img src={photoPreviewUrl} alt="Photo preview" className="mt-3 h-28 w-28 rounded-md border border-slate-300 object-cover" /></div>}
            </div>
          </div>

          <div>
            <div style={uploadPanelStyle}>
              <label className="mb-2 block text-sm font-medium text-slate-800" style={fieldLabelStyle}>Upload Signature <span className="text-red-600">*</span></label>
              <p className="mb-2 text-xs text-slate-500" style={{ color: '#64748b', marginBottom: '8px' }}>Accepted: JPG, PNG | Max size: 100KB</p>
              <input
                ref={signatureInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleSignatureSelect}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  style={{ ...attachBtnStyle, background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)' }}
                >
                  Attach File
                </button>
                <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>Signature</span>
                {signatureFile && <span style={fileTagStyle}>{signatureFile.name}</span>}
                {signatureFile && (
                  <button
                    type="button"
                    onClick={() => setShowSignaturePreview((prev) => !prev)}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#1e3a8a',
                      borderRadius: '8px',
                      padding: '7px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {showSignaturePreview ? 'Hide' : 'View'}
                  </button>
                )}
              </div>
              {signaturePreviewUrl && showSignaturePreview && <div style={previewBoxStyle}><img src={signaturePreviewUrl} alt="Signature preview" className="mt-3 h-20 w-40 rounded-md border border-slate-300 bg-white object-contain" /></div>}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5" style={{ ...sectionStyle, background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <label className="flex items-start gap-3 text-sm text-slate-800" style={{ color: '#1e3a8a', lineHeight: 1.6 }}>
            <input type="checkbox" name="applyVish" checked={formData.applyVish} onChange={handleChange} className="mt-1 h-4 w-4" style={{ marginTop: '4px' }} />
            <span>
              <strong>Apply for Visvesvaraya Scheme:</strong> I wish to be considered for the Visvesvaraya PhD Scheme (subject to eligibility and seat availability).
            </span>
          </label>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5" style={{ ...sectionStyle, background: '#fffbeb', borderColor: '#fcd34d' }}>
          <label className="flex items-start gap-3 text-sm text-slate-800" style={{ color: '#1f2937', lineHeight: 1.6 }}>
            <input type="checkbox" name="declaration" checked={formData.declaration} onChange={handleChange} className="mt-1 h-4 w-4" style={{ marginTop: '4px' }} required />
            <span>
              I hereby declare that the information provided is true and correct. I agree to appear for the entrance examination as per university rules.
            </span>
          </label>
        </section>

        {errorMessage && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" style={{ color: '#b91c1c' }}>{errorMessage}</div>}
        {successMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" style={{ color: '#047857' }}>{successMessage}</div>}

        <div className="flex flex-wrap justify-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <button type="button" onClick={onCancel} className="rounded-lg bg-slate-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600" style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: '10px', padding: '11px 22px', fontWeight: 700 }} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300" style={{ background: loading || !formData.declaration || !formData.confirmParticipation ? '#cbd5e1' : 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)', color: '#fff', border: 'none', borderRadius: '10px', padding: '11px 22px', cursor: loading || !formData.declaration || !formData.confirmParticipation ? 'not-allowed' : 'pointer', fontWeight: 700, boxShadow: loading || !formData.declaration || !formData.confirmParticipation ? 'none' : '0 10px 20px rgba(30, 64, 175, 0.25)' }} disabled={loading || !formData.declaration || !formData.confirmParticipation}>
            {loading ? 'Submitting...' : 'Submit Entrance Application'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EntranceApplicationForm;
