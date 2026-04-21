import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, ShieldCheck, LogOut, Menu, X, Building2, Kanban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className={styles.shell}>
      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>T</div>
            <span className={styles.logoText}>Taskflow</span>
          </div>
          <button className={styles.closeMobile} onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className={styles.orgBadge}>
          <Building2 size={12} />
          <span>{user?.orgName || 'Organization'}</span>
        </div>

        <nav className={styles.nav}>
          <span className={styles.navSection}>Workspace</span>
          {[
            { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/tasks',     icon: CheckSquare,     label: 'Task List'  },
            { to: '/board',     icon: Kanban,          label: 'Board'      },
            ...(isAdmin ? [{ to: '/admin', icon: ShieldCheck, label: 'Admin' }] : []),
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={16} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user?.name}</span>
              <span className={styles.userRole}>{user?.role}</span>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Logout"><LogOut size={15} /></button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className={styles.headerRight}>
            <span className={styles.headerOrg}>{user?.orgName}</span>
            <div className={styles.headerAvatar}>{user?.name?.[0]?.toUpperCase()}</div>
          </div>
        </header>
        <main className={styles.content}><Outlet /></main>
      </div>
    </div>
  );
}
