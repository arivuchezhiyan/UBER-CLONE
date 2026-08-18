import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverDocuments, uploadDriverDocuments } from '../services/api';
import './DriverDocuments.css';

function DriverDocuments({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState({
    approvalStatus: 'PENDING',
    rejectionReason: '',
    suspensionReason: ''
  });

  // Vehicle Details State
  const [vehicleType, setVehicleType] = useState('UberGo');
  const [model, setModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('2022');
  const [vehiclePhoto, setVehiclePhoto] = useState('');

  // KYC Documents State
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [drivingLicensePhoto, setDrivingLicensePhoto] = useState('');
  const [rcNumber, setRcNumber] = useState('');
  const [rcPhoto, setRcPhoto] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [insurancePhoto, setInsurancePhoto] = useState('');

  const [toast, setToast] = useState(null);

  const vehicleOptions = [
    { id: 'UberGo', label: '🚗 UberGo', desc: 'Compact & Hatchbacks (4 seats)' },
    { id: 'Premier', label: '🚘 Premier', desc: 'Comfortable Sedans (4 seats)' },
    { id: 'UberXL', label: '🚐 UberXL', desc: 'SUVs & 6 Seaters' },
    { id: 'Uber Auto', label: '🛺 Uber Auto', desc: '3-Wheeler Auto Rickshaws' },
    { id: 'Uber Moto', label: '🏍️ Uber Moto', desc: 'Motorcycles & Bikes (1 seat)' }
  ];

  useEffect(() => {
    loadExistingDocuments();
  }, []);

  const loadExistingDocuments = async () => {
    try {
      const res = await getDriverDocuments();
      if (res.data?.success) {
        setStatusInfo({
          approvalStatus: res.data.approvalStatus || 'PENDING',
          rejectionReason: res.data.rejectionReason || '',
          suspensionReason: res.data.suspensionReason || ''
        });

        if (res.data.vehicleDetails) {
          const vd = res.data.vehicleDetails;
          setVehicleType(vd.vehicleType || 'UberGo');
          setModel(vd.model || '');
          setLicensePlate(vd.licensePlate || '');
          setColor(vd.color || '');
          setYear(vd.year || '2022');
          setVehiclePhoto(vd.vehiclePhoto || '');
        }

        if (res.data.documents) {
          const docs = res.data.documents;
          setDrivingLicenseNumber(docs.drivingLicense?.documentNumber || '');
          setDrivingLicensePhoto(docs.drivingLicense?.fileUrl || '');
          setRcNumber(docs.vehicleRC?.documentNumber || '');
          setRcPhoto(docs.vehicleRC?.fileUrl || '');
          setInsuranceNumber(docs.vehicleInsurance?.documentNumber || '');
          setInsurancePhoto(docs.vehicleInsurance?.fileUrl || '');
        }
      }
    } catch (err) {
      console.warn('Error loading driver documents:', err);
    }
  };

  const handleFileUpload = (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickFillDemo = () => {
    setModel('Maruti Swift Dzire');
    setLicensePlate('TN 07 CB 4567');
    setColor('Pearl White');
    setYear('2023');
    setVehiclePhoto('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=500&auto=format&fit=crop&q=60');
    setDrivingLicenseNumber('DL-TN07-20210088991');
    setDrivingLicensePhoto('https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?w=500&auto=format&fit=crop&q=60');
    setRcNumber('RC-TN07-4567-2023');
    setRcPhoto('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop&q=60');
    setInsuranceNumber('POL-HDFC-9928172');
    setInsurancePhoto('https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500&auto=format&fit=crop&q=60');
    showToast('Demo KYC data pre-filled!', 'success');
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!licensePlate || !model) {
      showToast('Please fill in vehicle model and license plate number', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        vehicleType,
        model,
        licensePlate: licensePlate.toUpperCase(),
        color,
        year: Number(year),
        vehiclePhoto,
        drivingLicenseNumber,
        drivingLicensePhoto,
        rcNumber,
        rcPhoto,
        insuranceNumber,
        insurancePhoto
      };

      const res = await uploadDriverDocuments(payload);
      if (res.data?.success) {
        showToast('✅ Documents submitted successfully! Verification pending.', 'success');
        setStatusInfo(prev => ({ ...prev, approvalStatus: 'PENDING' }));
        setTimeout(() => {
          navigate('/driver');
        }, 1800);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="driver-docs-page">
      {/* Top Header */}
      <header className="docs-top-bar">
        <button className="back-btn" onClick={() => navigate(-1)} title="Go Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Back</span>
        </button>
        <h2>Captain Registration & KYC</h2>
        <div style={{ width: 40 }}></div>
      </header>

      {toast && (
        <div className={`docs-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div className="docs-content">
        {/* Verification Status Card */}
        <div className={`status-card ${statusInfo.approvalStatus.toLowerCase()}`}>
          <div className="status-card-header">
            <span className="status-icon">
              {statusInfo.approvalStatus === 'APPROVED' ? '✅' : statusInfo.approvalStatus === 'REJECTED' ? '❌' : '⏳'}
            </span>
            <div>
              <h3>Account Status: {statusInfo.approvalStatus}</h3>
              <p>
                {statusInfo.approvalStatus === 'APPROVED' && 'Your documents are fully verified. You can go online and accept customer rides!'}
                {statusInfo.approvalStatus === 'PENDING' && 'Your KYC and vehicle documents are currently under review by the admin team.'}
                {statusInfo.approvalStatus === 'REJECTED' && `Verification rejected: ${statusInfo.rejectionReason || 'Documents mismatch. Please re-upload.'}`}
                {statusInfo.approvalStatus === 'SUSPENDED' && `Account suspended: ${statusInfo.suspensionReason || 'Contact support.'}`}
              </p>
            </div>
          </div>
          {statusInfo.approvalStatus !== 'APPROVED' && (
            <button className="btn-quick-fill" type="button" onClick={handleQuickFillDemo}>
              ⚡ Quick Fill Sample KYC Data
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* 1. Vehicle Type Selection */}
          <section className="form-section">
            <h3 className="section-title">1. Select Your Vehicle Category</h3>
            <p className="section-subtext">You will only receive ride requests matching your vehicle category</p>
            
            <div className="vehicle-type-grid">
              {vehicleOptions.map((opt) => (
                <div
                  key={opt.id}
                  className={`vehicle-type-card ${vehicleType === opt.id ? 'selected' : ''}`}
                  onClick={() => setVehicleType(opt.id)}
                >
                  <div className="vehicle-card-radio">
                    {vehicleType === opt.id && <div className="radio-dot"></div>}
                  </div>
                  <div className="vehicle-card-info">
                    <h4>{opt.label}</h4>
                    <p>{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Vehicle Details & Photo */}
          <section className="form-section">
            <h3 className="section-title">2. Vehicle Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Vehicle Model *</label>
                <input
                  type="text"
                  placeholder="e.g. Maruti Suzuki Dzire"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>License Plate Number *</label>
                <input
                  type="text"
                  placeholder="e.g. KA 01 AB 1234"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Color</label>
                <input
                  type="text"
                  placeholder="e.g. White / Silver"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Manufacturing Year</label>
                <input
                  type="number"
                  placeholder="2022"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            </div>

            {/* Vehicle Photo Upload */}
            <div className="file-upload-box">
              <label className="upload-label">🚗 Vehicle Exterior Photo (with Number Plate)</label>
              <div className="upload-dropzone">
                {vehiclePhoto ? (
                  <div className="preview-container">
                    <img src={vehiclePhoto} alt="Vehicle Preview" className="doc-preview-img" />
                    <button type="button" className="btn-remove-photo" onClick={() => setVehiclePhoto('')}>✕ Remove</button>
                  </div>
                ) : (
                  <label className="file-input-label">
                    <span>📷 Tap to upload Vehicle Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setVehiclePhoto)} />
                  </label>
                )}
              </div>
            </div>
          </section>

          {/* 3. KYC Documents */}
          <section className="form-section">
            <h3 className="section-title">3. Driver KYC & Legal Documents</h3>

            {/* Driver License */}
            <div className="doc-upload-item">
              <h4>🪪 Driver License (DL)</h4>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Driving License Number (e.g. DL-1420110012345)"
                  value={drivingLicenseNumber}
                  onChange={(e) => setDrivingLicenseNumber(e.target.value)}
                />
              </div>
              <div className="upload-dropzone small">
                {drivingLicensePhoto ? (
                  <div className="preview-container">
                    <img src={drivingLicensePhoto} alt="DL Preview" className="doc-preview-img" />
                    <button type="button" className="btn-remove-photo" onClick={() => setDrivingLicensePhoto('')}>✕ Remove</button>
                  </div>
                ) : (
                  <label className="file-input-label">
                    <span>📄 Upload Driver License Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setDrivingLicensePhoto)} />
                  </label>
                )}
              </div>
            </div>

            {/* Vehicle RC */}
            <div className="doc-upload-item">
              <h4>📋 Vehicle Registration Certificate (RC)</h4>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="RC Number"
                  value={rcNumber}
                  onChange={(e) => setRcNumber(e.target.value)}
                />
              </div>
              <div className="upload-dropzone small">
                {rcPhoto ? (
                  <div className="preview-container">
                    <img src={rcPhoto} alt="RC Preview" className="doc-preview-img" />
                    <button type="button" className="btn-remove-photo" onClick={() => setRcPhoto('')}>✕ Remove</button>
                  </div>
                ) : (
                  <label className="file-input-label">
                    <span>📄 Upload RC Document Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setRcPhoto)} />
                  </label>
                )}
              </div>
            </div>

            {/* Insurance */}
            <div className="doc-upload-item">
              <h4>🛡️ Vehicle Insurance Policy</h4>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Insurance Policy Number"
                  value={insuranceNumber}
                  onChange={(e) => setInsuranceNumber(e.target.value)}
                />
              </div>
              <div className="upload-dropzone small">
                {insurancePhoto ? (
                  <div className="preview-container">
                    <img src={insurancePhoto} alt="Insurance Preview" className="doc-preview-img" />
                    <button type="button" className="btn-remove-photo" onClick={() => setInsurancePhoto('')}>✕ Remove</button>
                  </div>
                ) : (
                  <label className="file-input-label">
                    <span>📄 Upload Insurance Copy Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setInsurancePhoto)} />
                  </label>
                )}
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="submit-section">
            <button className="btn-submit-docs" type="submit" disabled={loading}>
              {loading ? 'Submitting Verification...' : 'Submit Documents for Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DriverDocuments;
