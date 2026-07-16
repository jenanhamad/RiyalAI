import React from 'react';
import { NavLink } from 'react-router-dom';
import { useMode } from '../../context/ModeContext';

const personalTabs = [
  { to: '/', label: 'صوت', icon: '🎤', end: true },
  { to: '/home', label: 'الرئيسية', icon: '🏠' },
  { to: '/story', label: 'قصتي', icon: '📖' },
  { to: '/challenges', label: 'التحديات', icon: '⚔️' },
  { to: '/leaderboard', label: 'الصدارة', icon: '🏆' },
];

const businessTabs = [
  { to: '/', label: 'صوت', icon: '🎤', end: true },
  { to: '/home', label: 'لوحة العمل', icon: '📊' },
  { to: '/glance', label: 'نظرة', icon: '👁' },
  { to: '/add', label: 'إضافة', icon: '➕' },
];

const BottomNav = () => {
  const { isBusiness } = useMode();
  const tabs = isBusiness ? businessTabs : personalTabs;

  return (
    <nav className="bottom-nav" aria-label="التنقل الرئيسي">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `bottom-nav-item${isActive ? ' active' : ''}`
          }
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
