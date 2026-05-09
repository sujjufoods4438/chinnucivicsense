import React, { useState, useRef } from 'react';

const BeforeAfterSlider = ({ beforeImage, afterImage }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const newPos = Math.max(0, Math.min(100, (x / width) * 100));
    setSliderPos(newPos);
  };

  const handleTouchMove = (e) => {
    if (!containerRef.current || !e.touches[0]) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - left;
    const newPos = Math.max(0, Math.min(100, (x / width) * 100));
    setSliderPos(newPos);
  };

  if (!beforeImage || !afterImage) return null;

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '300px',
        overflow: 'hidden',
        borderRadius: '8px',
        cursor: 'ew-resize',
        userSelect: 'none'
      }}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* Before Image (Background) */}
      <img 
        src={beforeImage} 
        alt="Before" 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
      <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
        Before
      </div>

      {/* After Image (Clipped) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
      }}>
        <img 
          src={afterImage} 
          alt="After" 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(16, 185, 129, 0.8)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
          After (Fixed)
        </div>
      </div>

      {/* Slider Line */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${sliderPos}%`,
        width: '4px',
        background: '#fff',
        transform: 'translateX(-50%)',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Slider Handle */}
        <div style={{
          width: '30px',
          height: '30px',
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            <div style={{ width: '2px', height: '10px', background: '#94a3b8' }}></div>
            <div style={{ width: '2px', height: '10px', background: '#94a3b8' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
