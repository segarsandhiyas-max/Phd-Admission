import { useState } from 'react';
import './FormI_NOC.css';

function FormI_NOC() {
  const [formData, setFormData] = useState({
    candidateName: '',
    institutionName: '',
    yearsOfService: '',
    monthsOfService: '',
    candidateNameRepeat: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="form-i-container">
      <div className="form-i-page">
        <div className="form-i-header-note">
          (This should be typed on the letter head of the sponsoring organisation where the candidate is currently working)
        </div>

        <h2 className="form-i-title">Form –I</h2>

        <h3 className="form-i-subtitle">NO OBJECTION CERTIFICATE</h3>
        <p className="form-i-subtext">(To be produced at the time of Interview)</p>

        <div className="form-i-body">
          <p className="form-i-to">To</p>
          <p className="form-i-to">Director (Research)</p>
          <p className="form-i-to">Puducherry Technological University</p>
          <p className="form-i-to">Puducherry -14</p>

          <p className="form-i-paragraph">
            This is to certify that Mr./Ms. <input 
              type="text" 
              name="candidateName" 
              value={formData.candidateName} 
              onChange={handleChange}
              className="form-i-input"
              placeholder="______________________________________"
            />, is a full time Regular employee of <input 
              type="text" 
              name="institutionName" 
              value={formData.institutionName} 
              onChange={handleChange}
              className="form-i-input"
              placeholder="___________________________"
            /> (name of the institution / organisation).
          </p>

          <p className="form-i-paragraph">
            It is certified that he/she has completed <input 
              type="number" 
              name="yearsOfService" 
              value={formData.yearsOfService} 
              onChange={handleChange}
              className="form-i-input-small"
              placeholder="________"
              min="0"
              max="50"
            /> years <input 
              type="number" 
              name="monthsOfService" 
              value={formData.monthsOfService} 
              onChange={handleChange}
              className="form-i-input-small"
              placeholder="_____"
              min="0"
              max="11"
            /> months of service in our Organisation/ Institute as a regular employee without any break in service. This institution / organisation has no objection in allowing Mr/Ms <input 
              type="text" 
              name="candidateNameRepeat" 
              value={formData.candidateNameRepeat} 
              onChange={handleChange}
              className="form-i-input"
              placeholder="____________________________________________________"
            /> to carry out his / her Ph.D. research work at Puducherry Technological University.
          </p>

          <p className="form-i-paragraph">
            This certificate is issued for the purpose of applying for the Ph.D programme at Puducherry Technological University.
          </p>

          <div className="form-i-signature-section">
            <p className="form-i-signature">(Signature and seal of Head of the Institution/<br/>Organization)</p>
            <p className="form-i-date">Date:</p>
          </div>
        </div>

        <div className="form-i-actions no-print">
          <button onClick={handlePrint} className="btn-print">Print / Save as PDF</button>
        </div>
      </div>
    </div>
  );
}

export default FormI_NOC;
