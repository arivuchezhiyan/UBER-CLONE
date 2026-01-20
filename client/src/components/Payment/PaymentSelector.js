import React, { useState, useEffect } from 'react';
import './PaymentSelector.css';

// Get saved payment methods from localStorage
const getInitialSavedMethods = () => {
  const saved = localStorage.getItem('savedPaymentMethods');
  if (saved) return JSON.parse(saved);
  return {
    cards: [],
    upiIds: [],
    walletBalance: 500
  };
};

function PaymentSelector({ selectedMethod, onSelect, onClose, showModal, fare = 0 }) {
  const [savedMethods, setSavedMethods] = useState(getInitialSavedMethods);
  const [activeView, setActiveView] = useState('main');
  const [upiId, setUpiId] = useState('');
  const [upiError, setUpiError] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  const [cardErrors, setCardErrors] = useState({});
  const [saveCard, setSaveCard] = useState(true);
  
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    localStorage.setItem('savedPaymentMethods', JSON.stringify(savedMethods));
  }, [savedMethods]);

  const upiApps = [
    { id: 'gpay', name: 'Google Pay', icon: '🔵', color: '#4285f4' },
    { id: 'phonepe', name: 'PhonePe', icon: '🟣', color: '#5f259f' },
    { id: 'paytm', name: 'Paytm', icon: '🔷', color: '#00baf2' },
    { id: 'bhim', name: 'BHIM', icon: '🇮🇳', color: '#00796b' },
  ];

  const validateUpiId = (id) => {
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    return upiRegex.test(id);
  };

  const verifyUpiId = async () => {
    if (!upiId) {
      setUpiError('Please enter UPI ID');
      return;
    }
    if (!validateUpiId(upiId)) {
      setUpiError('Invalid format. Use: name@bank');
      return;
    }
    
    setVerifying(true);
    setUpiError('');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setUpiVerified(true);
    if (!savedMethods.upiIds.includes(upiId)) {
      setSavedMethods(prev => ({
        ...prev,
        upiIds: [...prev.upiIds, upiId]
      }));
    }
    setVerifying(false);
  };

  const validateCardNumber = (number) => {
    const cleanNumber = number.replace(/\s/g, '');
    if (cleanNumber.length < 13 || cleanNumber.length > 19) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber[i], 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  const getCardBrand = (number) => {
    const cleanNumber = number.replace(/\s/g, '');
    if (/^4/.test(cleanNumber)) return 'Visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'Mastercard';
    if (/^6/.test(cleanNumber)) return 'RuPay';
    if (/^3[47]/.test(cleanNumber)) return 'Amex';
    return 'Card';
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const parts = [];
    for (let i = 0; i < v.length && i < 16; i += 4) {
      parts.push(v.substring(i, i + 4));
    }
    return parts.join(' ');
  };

  const handleAddCard = () => {
    const errors = {};
    const cleanNumber = cardDetails.number.replace(/\s/g, '');
    
    if (!cleanNumber || !validateCardNumber(cleanNumber)) {
      errors.number = 'Invalid card number';
    }
    if (!cardDetails.expiry || !/^\d{2}\/\d{2}$/.test(cardDetails.expiry)) {
      errors.expiry = 'Invalid expiry';
    } else {
      const [month, year] = cardDetails.expiry.split('/');
      const expDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
      if (expDate < new Date()) {
        errors.expiry = 'Card expired';
      }
    }
    if (!cardDetails.cvv || cardDetails.cvv.length < 3) {
      errors.cvv = 'Invalid CVV';
    }
    if (!cardDetails.name || cardDetails.name.length < 3) {
      errors.name = 'Enter cardholder name';
    }

    setCardErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      const newCard = {
        id: Date.now(),
        last4: cleanNumber.slice(-4),
        brand: getCardBrand(cleanNumber),
        expiry: cardDetails.expiry,
        name: cardDetails.name
      };
      
      if (saveCard) {
        setSavedMethods(prev => ({
          ...prev,
          cards: [...prev.cards, newCard]
        }));
      }
      
      onSelect('card');
      onClose && onClose();
    }
  };

  const applyPromoCode = () => {
    const validCodes = {
      'FIRST50': { discount: 50, type: 'flat', description: '₹50 off' },
      'UBER20': { discount: 20, type: 'percent', description: '20% off' },
      'NEWUSER': { discount: 100, type: 'flat', description: '₹100 off' },
    };
    
    const code = promoCode.toUpperCase();
    if (validCodes[code]) {
      setPromoApplied(validCodes[code]);
      setPromoError('');
    } else {
      setPromoError('Invalid promo code');
      setPromoApplied(null);
    }
  };

  const handleUpiAppSelect = (app) => {
    onSelect('upi');
    onClose && onClose();
  };

  const handleSavedUpiSelect = () => {
    onSelect('upi');
    onClose && onClose();
  };

  const handleSavedCardSelect = () => {
    onSelect('card');
    onClose && onClose();
  };

  const deleteSavedCard = (cardId) => {
    setSavedMethods(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== cardId)
    }));
  };

  const deleteSavedUpi = (upi) => {
    setSavedMethods(prev => ({
      ...prev,
      upiIds: prev.upiIds.filter(u => u !== upi)
    }));
  };

  const handleWalletSelect = () => {
    if (savedMethods.walletBalance >= fare) {
      onSelect('wallet');
      onClose && onClose();
    }
  };

  if (!showModal) {
    const getMethodDisplay = () => {
      switch (selectedMethod) {
        case 'cash': return { icon: '💵', name: 'Cash' };
        case 'upi': return { icon: '📱', name: 'UPI' };
        case 'card': return { icon: '💳', name: 'Card' };
        case 'wallet': return { icon: '👛', name: `Uber Cash (₹${savedMethods.walletBalance})` };
        default: return { icon: '💵', name: 'Cash' };
      }
    };
    const display = getMethodDisplay();
    
    return (
      <div className="payment-compact" onClick={() => onClose && onClose()}>
        <span className="payment-icon">{display.icon}</span>
        <span className="payment-name">{display.name}</span>
        <span className="payment-arrow">›</span>
      </div>
    );
  }

  return (
    <div className="payment-modal-overlay" onClick={onClose}>
      <div className="payment-modal uber-style" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-header">
          {activeView !== 'main' && (
            <button className="back-btn" onClick={() => setActiveView('main')}>←</button>
          )}
          <h3>
            {activeView === 'main' && 'Payment'}
            {activeView === 'upi' && 'Pay with UPI'}
            {activeView === 'card' && 'Add Card'}
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {activeView === 'main' && (
          <div className="payment-main-view">
            {/* Cash Option */}
            <div className="payment-section">
              <div 
                className={`payment-option ${selectedMethod === 'cash' ? 'selected' : ''}`}
                onClick={() => { onSelect('cash'); onClose && onClose(); }}
              >
                <div className="option-left">
                  <span className="option-icon cash-icon">💵</span>
                  <div className="option-info">
                    <span className="option-name">Cash</span>
                    <span className="option-desc">Pay driver in cash</span>
                  </div>
                </div>
                {selectedMethod === 'cash' && <span className="check-mark">✓</span>}
              </div>
            </div>

            {/* UPI Section */}
            <div className="payment-section">
              <div className="section-header">
                <span>UPI</span>
                <span className="section-badge">Instant</span>
              </div>
              
              {savedMethods.upiIds.length > 0 && (
                <div className="saved-items">
                  {savedMethods.upiIds.map((upi, idx) => (
                    <div 
                      key={idx}
                      className={`payment-option saved ${selectedMethod === 'upi' ? 'selected' : ''}`}
                      onClick={handleSavedUpiSelect}
                    >
                      <div className="option-left">
                        <span className="option-icon upi-icon">📱</span>
                        <div className="option-info">
                          <span className="option-name">{upi}</span>
                          <span className="option-desc verified">✓ Verified</span>
                        </div>
                      </div>
                      <button 
                        className="delete-btn" 
                        onClick={(e) => { e.stopPropagation(); deleteSavedUpi(upi); }}
                      >🗑️</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="upi-apps-grid">
                {upiApps.map((app) => (
                  <div 
                    key={app.id}
                    className="upi-app-btn"
                    onClick={() => handleUpiAppSelect(app)}
                    style={{ '--app-color': app.color }}
                  >
                    <span className="app-icon">{app.icon}</span>
                    <span className="app-name">{app.name}</span>
                  </div>
                ))}
              </div>

              <button className="add-new-btn" onClick={() => setActiveView('upi')}>
                <span>+</span> Add UPI ID
              </button>
            </div>

            {/* Cards Section */}
            <div className="payment-section">
              <div className="section-header">
                <span>Cards</span>
                <span className="section-badge secure">🔒 Secure</span>
              </div>

              {savedMethods.cards.length > 0 && (
                <div className="saved-items">
                  {savedMethods.cards.map((card) => (
                    <div 
                      key={card.id}
                      className={`payment-option saved ${selectedMethod === 'card' ? 'selected' : ''}`}
                      onClick={handleSavedCardSelect}
                    >
                      <div className="option-left">
                        <span className="option-icon card-icon">💳</span>
                        <div className="option-info">
                          <span className="option-name">{card.brand} •••• {card.last4}</span>
                          <span className="option-desc">Expires {card.expiry}</span>
                        </div>
                      </div>
                      <button 
                        className="delete-btn" 
                        onClick={(e) => { e.stopPropagation(); deleteSavedCard(card.id); }}
                      >🗑️</button>
                    </div>
                  ))}
                </div>
              )}

              <button className="add-new-btn" onClick={() => setActiveView('card')}>
                <span>+</span> Add Debit/Credit Card
              </button>
            </div>

            {/* Wallet */}
            <div className="payment-section">
              <div 
                className={`payment-option wallet ${selectedMethod === 'wallet' ? 'selected' : ''} ${savedMethods.walletBalance < fare ? 'insufficient' : ''}`}
                onClick={handleWalletSelect}
              >
                <div className="option-left">
                  <span className="option-icon wallet-icon">👛</span>
                  <div className="option-info">
                    <span className="option-name">Uber Cash</span>
                    <span className="option-desc">
                      Balance: ₹{savedMethods.walletBalance.toFixed(2)}
                      {savedMethods.walletBalance < fare && <span className="insufficient-tag"> (Low balance)</span>}
                    </span>
                  </div>
                </div>
                {selectedMethod === 'wallet' && <span className="check-mark">✓</span>}
              </div>
            </div>

            {/* Promo Code */}
            <div className="promo-section">
              <div className="promo-input-wrapper">
                <input
                  type="text"
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="promo-input"
                />
                <button className="promo-apply-btn" onClick={applyPromoCode}>Apply</button>
              </div>
              {promoError && <span className="promo-error">{promoError}</span>}
              {promoApplied && (
                <div className="promo-success">✓ {promoApplied.description} applied!</div>
              )}
              <p className="promo-hint">Try: FIRST50, UBER20, NEWUSER</p>
            </div>
          </div>
        )}

        {/* UPI View */}
        {activeView === 'upi' && (
          <div className="payment-upi-view">
            <div className="upi-instruction">
              <p>Enter your UPI ID to pay directly from your bank account</p>
            </div>

            <div className="upi-input-group">
              <label>UPI ID</label>
              <div className="upi-input-wrapper">
                <input
                  type="text"
                  placeholder="yourname@upi"
                  value={upiId}
                  onChange={(e) => {
                    setUpiId(e.target.value.toLowerCase());
                    setUpiVerified(false);
                    setUpiError('');
                  }}
                  className={`upi-input ${upiError ? 'error' : ''} ${upiVerified ? 'verified' : ''}`}
                />
                {upiVerified && <span className="verified-icon">✓</span>}
              </div>
              {upiError && <span className="input-error">{upiError}</span>}
              <span className="upi-hint">Example: name@okaxis, phone@ybl, email@paytm</span>
            </div>

            <button 
              className={`verify-upi-btn ${verifying ? 'loading' : ''} ${upiVerified ? 'verified' : ''}`}
              onClick={upiVerified ? handleSavedUpiSelect : verifyUpiId}
              disabled={verifying}
            >
              {verifying ? (
                <span className="spinner"></span>
              ) : upiVerified ? (
                'Continue with this UPI'
              ) : (
                'Verify & Add'
              )}
            </button>

            <div className="upi-apps-section">
              <p className="or-divider"><span>or pay using app</span></p>
              <div className="upi-apps-list">
                {upiApps.map((app) => (
                  <div 
                    key={app.id}
                    className="upi-app-option"
                    onClick={() => handleUpiAppSelect(app)}
                  >
                    <span className="app-icon-large" style={{ background: app.color }}>{app.icon}</span>
                    <span>{app.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Card View */}
        {activeView === 'card' && (
          <div className="payment-card-view">
            <div className="card-preview">
              <div className="card-visual">
                <div className="card-brand">{getCardBrand(cardDetails.number)}</div>
                <div className="card-number-preview">
                  {cardDetails.number || '•••• •••• •••• ••••'}
                </div>
                <div className="card-details-preview">
                  <span>{cardDetails.name || 'CARDHOLDER NAME'}</span>
                  <span>{cardDetails.expiry || 'MM/YY'}</span>
                </div>
              </div>
            </div>

            <div className="card-form">
              <div className="input-group">
                <label>Card Number</label>
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={cardDetails.number}
                  onChange={(e) => setCardDetails({
                    ...cardDetails,
                    number: formatCardNumber(e.target.value)
                  })}
                  maxLength={19}
                  className={cardErrors.number ? 'error' : ''}
                />
                {cardErrors.number && <span className="input-error">{cardErrors.number}</span>}
              </div>

              <div className="input-row">
                <div className="input-group half">
                  <label>Expiry</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={cardDetails.expiry}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length >= 2) val = val.slice(0, 2) + '/' + val.slice(2);
                      setCardDetails({ ...cardDetails, expiry: val });
                    }}
                    maxLength={5}
                    className={cardErrors.expiry ? 'error' : ''}
                  />
                  {cardErrors.expiry && <span className="input-error">{cardErrors.expiry}</span>}
                </div>
                <div className="input-group half">
                  <label>CVV</label>
                  <input
                    type="password"
                    placeholder="•••"
                    value={cardDetails.cvv}
                    onChange={(e) => setCardDetails({
                      ...cardDetails,
                      cvv: e.target.value.replace(/\D/g, '')
                    })}
                    maxLength={4}
                    className={cardErrors.cvv ? 'error' : ''}
                  />
                  {cardErrors.cvv && <span className="input-error">{cardErrors.cvv}</span>}
                </div>
              </div>

              <div className="input-group">
                <label>Name on Card</label>
                <input
                  type="text"
                  placeholder="JOHN DOE"
                  value={cardDetails.name}
                  onChange={(e) => setCardDetails({
                    ...cardDetails,
                    name: e.target.value.toUpperCase()
                  })}
                  className={cardErrors.name ? 'error' : ''}
                />
                {cardErrors.name && <span className="input-error">{cardErrors.name}</span>}
              </div>

              <div className="save-card-option">
                <input
                  type="checkbox"
                  id="saveCard"
                  checked={saveCard}
                  onChange={(e) => setSaveCard(e.target.checked)}
                />
                <label htmlFor="saveCard">Save card for future payments</label>
              </div>

              <button className="add-card-btn" onClick={handleAddCard}>
                Add Card
              </button>

              <p className="security-note">
                🔒 Your card details are encrypted and secure
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentSelector;
