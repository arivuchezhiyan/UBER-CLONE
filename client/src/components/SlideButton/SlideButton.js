import React, { useState, useRef, useEffect } from 'react';
import './SlideButton.css';

function SlideButton({ onSlideComplete, text = "Slide to End Trip", disabled = false }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const containerRef = useRef(null);
  const sliderRef = useRef(null);

  const getMaxDrag = () => {
    if (!containerRef.current || !sliderRef.current) return 200;
    return containerRef.current.clientWidth - sliderRef.current.clientWidth - 8;
  };

  const handleStart = () => {
    if (disabled || isCompleted) return;
    setIsDragging(true);
  };

  const handleMove = (clientX) => {
    if (!isDragging || disabled || isCompleted) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = clientX - rect.left - 25;
    const max = getMaxDrag();

    if (currentX < 0) {
      setDragX(0);
    } else if (currentX >= max) {
      setDragX(max);
      setIsCompleted(true);
      setIsDragging(false);
      if (onSlideComplete) onSlideComplete();
    } else {
      setDragX(currentX);
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const max = getMaxDrag();
    if (dragX < max) {
      // Snap back if not reached the end
      setDragX(0);
    }
  };

  // Mouse event listeners
  const onMouseMove = (e) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();

  // Touch event listeners
  const onTouchMove = (e) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  return (
    <div 
      className={`slide-button-container ${isCompleted ? 'completed' : ''} ${disabled ? 'disabled' : ''}`} 
      ref={containerRef}
    >
      <div 
        className="slide-button-fill" 
        style={{ width: `${dragX + 50}px` }}
      ></div>

      <div className="slide-button-text">
        {isCompleted ? 'Trip Ending...' : text}
      </div>

      <div
        className={`slide-button-handle ${isDragging ? 'dragging' : ''}`}
        ref={sliderRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        style={{ transform: `translateX(${dragX}px)` }}
      >
        <span className="handle-icon">👉</span>
      </div>
    </div>
  );
}

export default SlideButton;
