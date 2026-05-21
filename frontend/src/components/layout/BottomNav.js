import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'الرئيسية', icon: '🏠', end: true },
  { to: '/challenges', label: 'التحديات', icon: '⚔️' },
  { to: '/voice', label: 'صوت', icon: '🎤', center: true },
  { to: '/leaderboard', label: 'الصدارة', icon: '🏆' },
  { to: '/analytics', label: 'التحليلات', icon: '📊' },
];

const BottomNav = () => (
  <nav className="bottom-nav" aria-label="التنقل الرئيسي">
    {tabs.map((tab) => (
      <NavLink
        key={tab.to}
        to={tab.to}
        end={tab.end}
        className={({ isActive }) =>
          `bottom-nav-item${tab.center ? ' bottom-nav-center' : ''}${isActive ? ' active' : ''}`
        }
      >
        <span className="bottom-nav-icon">{tab.icon}</span>
        <span className="bottom-nav-label">{tab.label}</span>
      </NavLink>
    ))}
  </nav>
);

export default BottomNav;
