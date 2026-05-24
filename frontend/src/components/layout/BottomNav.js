import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'صوت', icon: '🎤', end: true },
  { to: '/home', label: 'الرئيسية', icon: '🏠' },
  { to: '/challenges', label: 'التحديات', icon: '⚔️' },
  { to: '/friends', label: 'الأصدقاء', icon: '👥' },
  { to: '/leaderboard', label: 'الصدارة', icon: '🏆' },
];

const BottomNav = () => (
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

export default BottomNav;
