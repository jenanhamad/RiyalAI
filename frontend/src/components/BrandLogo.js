import React from 'react';

const BrandLogo = ({ compact = false, className = '' }) => (
  <img
    className={`brand-logo${compact ? ' brand-logo-compact' : ''}${className ? ` ${className}` : ''}`}
    src="/riyal-logo.png"
    alt="شعار ريالي"
  />
);

export default BrandLogo;
