import { useState } from 'react';
import './FormII_ExperienceCertificate.css';

function FormII_ExperienceCertificate() {
  const [formData, setFormData] = useState({
    employeeName: '',
    startDate: '',
    endDate: '',
    yearsOfService: '',
    monthsOfService: '',
    designation: '',
    pgDegreeMonthYear: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="form-ii-container">
      <div className="form-ii-page">
        <h2 className="form-ii-title">Form –II Experience Certificate</h2>
        <p className="form-ii-subtext">(To be produced at the time of Interview)</p>
        <p className="form-ii-subtext">(For all Part-Time category)</p>
        <div className="form-ii-header-note">
          (This should be typed on the letter head of the sponsoring organisation where the candidate is currently working)
        </div>

        <h3 className="form-ii-subtitle">Experience Certificate</h3>

        <div className="form-ii-body">
          <p className="form-ii-paragraph">
            This is to certify that <input 
              type="text" 
              name="employeeName" 
              value={formData.employeeName} 
              onChange={handleChange}
              className="form-ii-input"
              placeholder="--------------------------------------------------"
            /> has been working in our organisation/ Institute as a regular employee without any break in service from <input 
              type="date" 
              name="startDate" 
              value={formData.startDate} 
              onChange={handleChange}
              className="form-ii-input-date"
            /> to <input 
              type="date" 
              name="endDate" 
              value={formData.endDate} 
              onChange={handleChange}
              className="form-ii-input-date"
            /> for a period of <input 
              type="number" 
              name="yearsOfService" 
              value={formData.yearsOfService} 
              onChange={handleChange}
              className="form-ii-input-small"
              placeholder="________________"
              min="0"
              max="50"
            /> years and <input 
              type="number" 
              name="monthsOfService" 
              value={formData.monthsOfService} 
              onChange={handleChange}
              className="form-ii-input-small"
              placeholder="________"
              min="0"
              max="11"
            /> months.
          </p>

          <p className="form-ii-paragraph">
            His current designation is <input 
              type="text" 
              name="designation" 
              value={formData.designation} 
              onChange={handleChange}
              className="form-ii-input"
              placeholder="<Designation>"
            />. He /She obtained his PG degree in <input 
              type="text" 
              name="pgDegreeMonthYear" 
              value={formData.pgDegreeMonthYear} 
              onChange={handleChange}
              className="form-ii-input"
              placeholder="< month/Year>"
            />.
          </p>

          <p className="form-ii-paragraph">
            **The work responsibility includes teaching theory/ laboratory courses for Undergraduate Programme and/or Postgraduate Programme.
          </p>

          <p className="form-ii-paragraph">
            This certificate is issued for the purpose of applying for the Ph.D Part-time programme at Puducherry Technological University.
          </p>

          <div className="form-ii-signature-section">
            <p className="form-ii-signature">(Signature and seal of Head of the Institution/<br/>Organization)</p>
            <p className="form-ii-date">Date:</p>
          </div>

          <p className="form-ii-footnote">
            ** For faculty working in /non-teaching staff of College/ Universities / Employees of Government/ Public Sector / Quasi-government should define their job responsibilities during the period of service. This is mandatory to determine relevant experience.
          </p>
        </div>

        <div className="form-ii-actions no-print">
          <button onClick={handlePrint} className="btn-print">Print / Save as PDF</button>
        </div>
      </div>
    </div>
  );
}

export default FormII_ExperienceCertificate;
