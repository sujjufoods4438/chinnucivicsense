import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSelector = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('preferredLanguage', lng);
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
        {t('common.language')}:
      </label>
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        style={{
          padding: '6px 10px',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          fontSize: '14px',
          cursor: 'pointer',
          background: '#fff',
          color: '#1f2937'
        }}
      >
<option value="en">{t('common.english')}</option>
        <option value="hi">{t('common.hindi')}</option>
        <option value="te">{t('common.telugu')}</option>
      </select>
    </div>
  );
};

export default LanguageSelector;
