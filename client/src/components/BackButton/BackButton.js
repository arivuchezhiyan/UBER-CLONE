import React from 'react';
import { useNavigate } from 'react-router-dom';
import './BackButton.css';

function BackButton({ to, label = 'Back', onClick, style, className = '', theme = 'light' }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      // Fallback: If history length is short, go to root
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }
  };

  return (
    <button
      type="button"
      className={`universal-back-btn ${theme} ${className}`}
      onClick={handleClick}
      style={style}
      title="Go back to previous page"
      aria-label="Go back"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label && <span className="btn-label">{label}</span>}
    </button>
  );
}

export default BackButton;
