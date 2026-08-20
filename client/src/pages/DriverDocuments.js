import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverDocuments, uploadDriverDocuments } from '../services/api';
import BackButton from '../components/BackButton/BackButton';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CarIcon,
  DocumentIcon,
  ShieldIcon,
  ZapIcon,
  CameraIcon,
  UploadCloudIcon
} from '../components/Icons';
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
    { id: 'UberGo', label: 'UberGo Compact', desc: 'Hatchbacks & Minis (4 seats)', icon: <CarIcon size={22} color="#61d4fb" /> },
    { id: 'Premier', label: 'Premier Sedan', desc: 'Premium Sedans & City Cars (4 seats)', icon: <CarIcon size={22} color="#b5c4ff" /> },
    { id: 'UberXL', label: 'UberXL SUV', desc: 'Spacious SUVs & 6 Seater MPVs', icon: <CarIcon size={22} color="#a855f7" /> },
    { id: 'Uber Auto', label: 'Auto Rickshaw', desc: '3-Wheeler Auto Transit', icon: <CarIcon size={22} color="#fbbf24" /> },
    { id: 'Uber Moto', label: 'Moto Bike', desc: 'Motorcycles & Scooters (1 passenger)', icon: <CarIcon size={22} color="#34d399" /> }
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
    showToast('Demo KYC data pre-filled successfully', 'success');
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
        showToast('Documents submitted successfully! Verification in progress.', 'success');
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
        <BackButton to="/driver" label="Cockpit" theme="light" />
        <h2>Captain KYC & Vehicle Documents</h2>
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
            <div className="status-icon-wrap">
              {statusInfo.approvalStatus === 'APPROVED' && <CheckCircleIcon size={32} color="#10b981" />}
              {statusInfo.approvalStatus === 'REJECTED' && <XCircleIcon size={32} color="#ef4444" />}
              {statusInfo.approvalStatus !== 'APPROVED' && statusInfo.approvalStatus !== 'REJECTED' && <ClockIcon size={32} color="#f59e0b" />}
            </div>
            <div>
              <h3>Captain Status: {statusInfo.approvalStatus}</h3>
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
              <ZapIcon size={14} color="#61d4fb" />
              <span>Quick Fill Verified Demo KYC</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* 1. Vehicle Type Selection */}
          <section className="form-section">
            <h3 className="section-title">1. Select Vehicle Category</h3>
            <p className="section-subtext">You will only receive ride requests matching your verified vehicle category</p>
            
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
                  <div className="veh-icon-holder">{opt.icon}</div>
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
                  placeholder="e.g. TN 07 CB 4567"
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
                  placeholder="e.g. Pearl White / Silver"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Manufacturing Year</label>
                <input
                  type="number"
                  placeholder="2023"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            </div>

            {/* Vehicle Photo Upload */}
            <div className="file-upload-box">
              <label className="upload-label">Vehicle Exterior Photo (with Number Plate)</label>
              <div className="upload-dropzone">
                {vehiclePhoto ? (
                  <div className="preview-container">
                    <img src={vehiclePhoto} alt="Vehicle Preview" className="doc-preview-img" />
                    <button type="button" className="btn-remove-photo" onClick={() => setVehiclePhoto('')}>✕ Remove Photo</button>
                  </div>
                ) : (
                  <label className="file-input-label">
                    <CameraIcon size={22} color="#61d4fb" />
                    <span>Tap to upload Vehicle Exterior Photo</span>
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
              <div className="doc-item-title-row">
                <DocumentIcon size={18} color="#61d4fb" />
                <h4>Driving License (DL)</h4>
              </div>
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
                    <UploadCloudIcon size={18} color="#b5c4ff" />
                    <span>Upload Driver License Front Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setDrivingLicensePhoto)} />
                  </label>
                )}
              </div>
            </div>

            {/* Vehicle RC */}
            <div className="doc-upload-item">
              <div className="doc-item-title-row">
                <DocumentIcon size={18} color="#b5c4ff" />
                <h4>Vehicle Registration Certificate (RC)</h4>
              </div>
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
                    <UploadCloudIcon size={18} color="#b5c4ff" />
                    <span>Upload RC Document Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setRcPhoto)} />
                  </label>
                )}
              </div>
            </div>

            {/* Insurance */}
            <div className="doc-upload-item">
              <div className="doc-item-title-row">
                <ShieldIcon size={18} color="#34d399" />
                <h4>Vehicle Insurance Policy</h4>
              </div>
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
                    <UploadCloudIcon size={18} color="#b5c4ff" />
                    <span>Upload Insurance Certificate Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setInsurancePhoto)} />
                  </label>
                )}
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="submit-section">
            <button className="btn-submit-docs" type="submit" disabled={loading}>
              <ZapIcon size={16} color="#090d16" />
              <span>{loading ? 'Submitting Verification...' : 'Submit Documents for Verification'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DriverDocuments;
