// src/App.tsx — Fully responsive: desktop sidebar, tablet drawer, phone bottom nav
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLang, LanguageSwitcher } from './i18n';
import { Routes, Route, NavLink, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { useDashboard, useHome } from './hooks';

import Dashboard      from './pages/Dashboard';
import Residents      from './pages/Residents';
import ResidentDetail from './pages/ResidentDetail';
import CareNotes      from './pages/CareNotes';
import Emar           from './pages/Emar';
import Incidents      from './pages/Incidents';
import Schedule       from './pages/Schedule';
import Staff          from './pages/Staff';
import Training       from './pages/Training';
import Compliance     from './pages/Compliance';
import FamilyPortal   from './pages/FamilyPortal';
import Billing        from './pages/Billing';
import AiTools        from './pages/AiTools';
import AuditLog       from './pages/AuditLog';
import Policies       from './pages/Policies';
import Profile        from './pages/Profile';
import TaskBoard      from './pages/TaskBoard';
import CDRegister     from './pages/CDRegister';
import AiInsights     from './pages/AiInsights';
import PredictiveCare from './pages/PredictiveCare';
import Activities     from './pages/Activities';
import WellbeingHub   from './pages/WellbeingHub';
import NotificationCentre from './components/NotificationCentre';
import SbarHandover from './pages/SbarHandover';
import News2Calculator from './pages/News2Calculator';
import WoundTracker from './pages/WoundTracker';
import InfectionTracker from './pages/InfectionTracker';
import ContinenceAssessment from './pages/ContinenceAssessment';
import SmartRota from './pages/SmartRota';
import NaturalLanguageSearch from './pages/NaturalLanguageSearch';
import RiskAssessments from './pages/RiskAssessments';
import MedInteractionChecker from './pages/MedInteractionChecker';
import AutomatedInvoicing from './pages/AutomatedInvoicing';
import OccupancyForecasting from './pages/OccupancyForecasting';
import StaffCostAnalytics from './pages/StaffCostAnalytics';
import RecruitmentPipeline from './pages/RecruitmentPipeline';
import CompetencyMatrix from './pages/CompetencyMatrix';
import SicknessAbsence from './pages/SicknessAbsence';
import FireLogBook from './pages/FireLogBook';
import VisitorSignIn from './pages/VisitorSignIn';
import RoomTurnoverManager from './pages/RoomTurnoverManager';
import Housekeeping from './pages/Housekeeping';
import CareTaskManager from './pages/CareTaskManager';
import OutcomesDashboard from './pages/OutcomesDashboard';
import FamilyAccessManager from './pages/FamilyAccessManager';
import MenuManager from './pages/MenuManager';
import HousekeepingManager from './pages/HousekeepingManager';
import HomeSettings from './pages/HomeSettings';
import ReportBuilder from './pages/ReportBuilder';
import OfflineMode from './pages/OfflineMode';
import ResidentTablet from './pages/ResidentTablet';
import QrRoomScanning from './pages/QrRoomScanning';
import BenchmarkingDashboard from './pages/BenchmarkingDashboard';
import BoardPackGenerator from './pages/BoardPackGenerator';
import StaffPerformanceInsights from './pages/StaffPerformanceInsights';
import ElearningModule from './pages/ElearningModule';
import CompetencySignoff from './pages/CompetencySignoff';
import DiabetesManagement from './pages/DiabetesManagement';
import PalliativeCarePathway from './pages/PalliativeCarePathway';
import MusicTherapy from './pages/MusicTherapy';
import MenuChoiceSystem from './pages/MenuChoiceSystem';
import FriendshipMapper from './pages/FriendshipMapper';
import DailyPurposePlanner from './pages/DailyPurposePlanner';
import MoodEnvironment from './pages/MoodEnvironment';
import PhotoFrameFeed from './pages/PhotoFrameFeed';
import SleepQualityTracker from './pages/SleepQualityTracker';
import IntergenerationalProgramme from './pages/IntergenerationalProgramme';
import RehabGoalTracker from './pages/RehabGoalTracker';
import CelebrationPlanner from './pages/CelebrationPlanner';
import AiCarePlanWriter from './pages/AiCarePlanWriter';
import AdmissionMatching from './pages/AdmissionMatching';
import WellbeingHeatmap from './pages/WellbeingHeatmap';
import RegulatoryReporting from './pages/RegulatoryReporting';
import SmartHandover from './pages/SmartHandover';
import ConsentManager from './pages/ConsentManager';
import ResidentDigitalTwin from './pages/ResidentDigitalTwin';
import EnvironmentalIntelligence from './pages/EnvironmentalIntelligence';
import ErrorBoundary from './components/ErrorBoundary';
import { ROLE_LABELS } from './utils/formatters';

// ── Nav config ────────────────────────────────────────────────────────────
const NAV_ALL = [
  { section: 'Overview' },
  { path: '/',           label: 'Dashboard',    icon: '📊', roles: null },
  { section: 'Care' },
  { path: '/tasks',      label: 'Task Board',   icon: '📋', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'], badge: 'tasks' },
  { path: '/care-tasks', label: 'Care Tasks', icon: '🗂️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/outcomes', label: 'Outcomes & Impact', icon: '📈', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/family-access', label: 'Family Access', icon: '👨‍👩‍👧', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/menu-admin', label: 'Menu Setup', icon: '🍽️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','kitchen'] },
  { path: '/housekeeping-admin', label: 'Housekeeping Setup', icon: '🧹', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','cleaning'] },
  { path: '/settings', label: 'Home Settings', icon: '⚙️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/residents',  label: 'Residents',    icon: '👥', roles: null },
  { path: '/care-notes', label: 'Care Notes',   icon: '📝', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/emar',       label: 'Medications',  icon: '💊', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], badge: 'meds' },
  { path: '/incidents',  label: 'Incidents',    icon: '⚠️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], badge: 'incidents' },
  { path: '/activities', label: 'Activities',   icon: '🎯', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/wellbeing',  label: 'Wellbeing Hub', icon: '💚', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/news2',     label: 'NEWS2 Vitals', icon: '🫀', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/wounds',    label: 'Wound Tracker', icon: '🩹', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/continence', label: 'Continence Care', icon: '📋', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/room-turnover', label: 'Room Turnover', icon: '🛏️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','maintenance'] },
  { path: '/housekeeping', label: 'Housekeeping', icon: '🧹', roles: ['cleaning','maintenance','home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/qr-scanning', label: 'QR Scanning', icon: '📱', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/diabetes', label: 'Diabetes', icon: '🩸', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/palliative-care', label: 'Palliative Care', icon: '🕊️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/resident-tablet', label: 'Resident Tablet', icon: '📲', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/risk-assessments', label: 'Risk Assessments', icon: '⚡', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/med-interactions', label: 'Med Interactions', icon: '💊', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { section: 'Team', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse','senior_carer'] },
  { path: '/schedule',   label: 'Rota',         icon: '📅', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse','senior_carer'] },
  { path: '/staff',      label: 'Staff',        icon: '👤', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/training',   label: 'Training',     icon: '🎓', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'], badge: 'training' },
  { path: '/smart-rota', label: 'AI Smart Rota', icon: '🤖', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/recruitment', label: 'Recruitment', icon: '📢', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/competency-matrix', label: 'Competencies', icon: '🎯', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/competency-signoff', label: 'Sign-Offs', icon: '✍️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse'] },
  { path: '/elearning', label: 'E-Learning', icon: '📚', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse','senior_carer','carer'] },
  { path: '/staff-performance', label: 'Performance', icon: '📈', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/sickness-absence', label: 'Absence', icon: '📊', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { section: 'Governance', roles: ['home_manager','deputy_manager','super_admin','group_admin','registered_nurse'] },
  { path: '/compliance', label: 'CQC Compliance', icon: '✅', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/policies',   label: 'Policies',     icon: '📋', roles: null },
  { path: '/infections', label: 'Infection Control', icon: '🦠', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/fire-log', label: 'Fire Log', icon: '🔥', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/visitor-sign-in', label: 'Visitors', icon: '🚪', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','senior_carer','carer','registered_nurse'] },
  { path: '/benchmarking', label: 'Benchmarking', icon: '📊', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/board-packs', label: 'Board Packs', icon: '📑', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { section: 'Quality of Life', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/music-therapy', label: 'Music Therapy', icon: '🎵', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/menu-choices', label: 'Menu Choices', icon: '🍽️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin','kitchen'] },
  { path: '/friendship-mapper', label: 'Friendship Mapper', icon: '🤝', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/purpose-planner', label: 'Purpose Planner', icon: '🌱', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/mood-environment', label: 'Mood Environment', icon: '🌤️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/photo-frames', label: 'Photo Frames', icon: '🖼️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/sleep-tracker', label: 'Sleep Tracker', icon: '😴', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/intergenerational', label: 'Intergenerational', icon: '👶', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','activities','admin','super_admin','group_admin'] },
  { path: '/rehab-goals', label: 'Rehab Goals', icon: '🏋️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/celebrations', label: 'Celebrations', icon: '🎉', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { section: 'Communications' },
  { path: '/family',     label: 'Family Portal', icon: '💬', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'], badge: 'messages' },
  { section: 'Finance', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'] },
  { path: '/billing',    label: 'Billing',      icon: '💷', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'] },
  { path: '/invoicing',  label: 'Invoicing',    icon: '🧾', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'] },
  { path: '/occupancy',  label: 'Occupancy',    icon: '🏠', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'] },
  { path: '/staff-costs', label: 'Staff Costs', icon: '💰', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'] },
  { path: '/cd-register', label: 'CD Register',   icon: '💊', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'] },
  { section: 'Tools', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'] },
  { path: '/nl-search', label: 'Smart Search', icon: '🔍', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/ai-tools',   label: 'AI Tools',     icon: '🤖', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'] },
  { path: '/ai-care-plans', label: 'AI Care Plans', icon: '📄', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'] },
  { path: '/ai-insights', label: 'AI Insights',   icon: '🧠', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'] },
  { path: '/predictive-care', label: 'Falls & Risk AI', icon: '🎯', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'] },
  { path: '/admission-matching', label: 'Admission Match', icon: '🏠', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/smart-handover', label: 'Smart Handover', icon: '🧠', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','super_admin','group_admin'] },
  { path: '/sbar-handover', label: 'SBAR Handover', icon: '📋', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','super_admin','group_admin'] },
  { path: '/digital-twin', label: 'Digital Twin', icon: '🧬', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','super_admin','group_admin'] },
  { path: '/wellbeing-heatmap', label: 'Wellbeing Map', icon: '🗺️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','super_admin','group_admin'] },
  { path: '/environmental', label: 'Environment', icon: '🌍', roles: ['home_manager','deputy_manager','super_admin','group_admin','maintenance'] },
  { path: '/regulatory', label: 'Regulatory', icon: '🏛️', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/consent-manager', label: 'Consents', icon: '📝', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','super_admin','group_admin'] },
  { path: '/audit-log',  label: 'Audit Log',    icon: '🔍', roles: ['home_manager','super_admin','group_admin'] },
  { path: '/report-builder', label: 'Report Builder', icon: '📑', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/offline-mode', label: 'Offline Mode', icon: '📴', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
];

// Bottom nav — most important 5 items for phone
const BOTTOM_NAV = [
  { path: '/',           label: 'Home',      icon: '📊', badge: null },
  { path: '/residents',  label: 'Residents', icon: '👥', badge: null },
  { path: '/care-notes', label: 'Notes',     icon: '📝', badge: null },
  { path: '/emar',       label: 'Meds',      icon: '💊', badge: 'meds' },
  { path: '/incidents',  label: 'Incidents', icon: '⚠️', badge: 'incidents' },
];

const ROLE_COLORS: Record<string, string> = {
  home_manager: '#7c3aed',   deputy_manager: '#2563eb',
  registered_nurse: '#0891b2', senior_carer: '#059669',
  carer: '#d97706',          activities: '#ec4899',
  finance: '#dc2626',        admin: '#6366f1',
  super_admin: '#1e40af',    group_admin: '#1e40af',
  cleaning: '#14b8a6',       kitchen: '#f97316',
  maintenance: '#64748b',
};

// ── Hook: detect screen size ──────────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState(() => ({
    isPhone:  window.innerWidth < 640,
    isTablet: window.innerWidth >= 640 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
  }));
  useEffect(() => {
    const handler = () => setBp({
      isPhone:   window.innerWidth < 640,
      isTablet:  window.innerWidth >= 640 && window.innerWidth < 1024,
      isDesktop: window.innerWidth >= 1024,
    });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return bp;
}

export default function App() {
  const { user, logout } = useAuthStore();
  
  // Dark mode
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem('darkMode') === 'true');
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);
  const { data: dash }   = useDashboard();
  const { data: homeCfg } = useHome();
  React.useEffect(() => {
    const c = homeCfg?.settings?.brand_color;
    if (c && /^#[0-9a-fA-F]{6}$/.test(c)) {
      document.documentElement.style.setProperty('--primary', c);
      document.documentElement.style.setProperty('--primary-dark', c);
    }
  }, [homeCfg]);
  const navigate         = useNavigate();
  const location         = useLocation();
  const { isPhone, isTablet, isDesktop } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen]  = useState(false);
  const [collapsed, setCollapsed]      = useState(false);
  const [searchQuery, setSearchQuery]  = useState('');
  const { t: tr } = useLang();

  // Close drawer on route change (mobile/tablet)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  // Close drawer on desktop resize
  useEffect(() => { if (isDesktop) setSidebarOpen(false); }, [isDesktop]);
  // Clear search when sidebar collapses
  useEffect(() => { if (collapsed) setSearchQuery(''); }, [collapsed]);

  // Keep search input focused while typing
  useEffect(() => {
    if (searchQuery) {
      const el = document.getElementById('sidebar-search-input');
      if (el && document.activeElement !== el) el.focus();
    }
  }, [searchQuery]);

  const role      = user?.role || '';
  const roleColor = ROLE_COLORS[role] || '#2563eb';

  const getBadge = (key?: string | null): number => {
    if (!dash || !key) return 0;
    if (key === 'incidents') return parseInt(dash.openIncidents)    || 0;
    if (key === 'messages')  return parseInt(dash.unreadMessages)   || 0;
    if (key === 'training')  return parseInt(dash.expiringTraining) || 0;
    if (key === 'tasks')     return parseInt(dash.overdueTasksCount) || 0;
    return 0;
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const sidebarW = isDesktop ? (collapsed ? 60 : 240) : 240;
  const mainML   = isDesktop ? sidebarW : 0;

  // ── Scroll position preservation ────────────────────────────────────────
  const navScrollRef = useRef<HTMLDivElement>(null);
  const scrollKey = 'carevista_sidebar_scroll';

  // Save scroll position before navigation
  const handleNavClick = useCallback(() => {
    if (navScrollRef.current) {
      sessionStorage.setItem(scrollKey, String(navScrollRef.current.scrollTop));
    }
  }, []);

  // Restore scroll position after render
  useEffect(() => {
    const saved = sessionStorage.getItem(scrollKey);
    if (saved && navScrollRef.current) {
      navScrollRef.current.scrollTop = parseInt(saved, 10);
    }
  }, [location.pathname]);

  // ── Sidebar content (shared between desktop + mobile drawer) ────────────
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: (isDesktop && collapsed) ? '16px 14px' : '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.06)', minHeight: 64, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${roleColor},${roleColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: `0 0 12px ${roleColor}50` }}>⚕</div>
        {!(isDesktop && collapsed) && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>CareVista</div>
            <div style={{ fontSize: '0.65rem', color: '#5a6a7f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.careHomeName}</div>
          </div>
        )}
        {isDesktop && !collapsed && (
          <button onClick={() => setCollapsed(true)} title="Collapse menu" style={{ background: 'none', border: 'none', color: '#5a6a7f', cursor: 'pointer', padding: 4, borderRadius: 4, flexShrink: 0, fontSize: 14 }}>
            {'←'}
          </button>
        )}
        {!isDesktop && (
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#5a6a7f', cursor: 'pointer', padding: 4, borderRadius: 4, marginLeft: 'auto', fontSize: 18 }}>&#10005;</button>
        )}
      </div>

      {/* Expand toggle - prominent button when collapsed */}
      {isDesktop && collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="Expand menu"
          aria-label="Expand sidebar menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            margin: '10px auto',
            background: 'rgba(255,255,255,.08)',
            border: '1px solid rgba(255,255,255,.15)',
            borderRadius: 8,
            color: '#9aa5b4',
            cursor: 'pointer',
            fontSize: 16,
            transition: 'all 150ms',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.15)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#9aa5b4'; }}
        >
          &#9776;
        </button>
      )}

      {/* Role badge */}
      {!(isDesktop && collapsed) && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          <div style={{ padding: '5px 10px', borderRadius: 20, background: roleColor + '20', border: `1px solid ${roleColor}40`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor, flexShrink: 0 }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: roleColor, whiteSpace: 'nowrap' }}>{ROLE_LABELS[role] || role}</span>
          </div>
        </div>
      )}

      {/* Search input */}
      {!(isDesktop && collapsed) && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.04)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              id="sidebar-search-input"
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoComplete="off"
              style={{
                width: '100%',
                padding: '7px 30px 7px 10px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,.12)',
                background: 'rgba(255,255,255,.05)',
                color: '#e2e8f0',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#9aa5b4',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: '2px 4px',
                  lineHeight: 1,
                }}
                title="Clear search"
              >
                &#10005;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav items */}
      <div ref={navScrollRef} style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}><LanguageSwitcher /></div>
        {NAV_ALL.map((item, i) => {
          if ('section' in item && !('path' in item)) {
            if (item.roles && !item.roles.includes(role)) return null;
            // Hide section headers when searching
            if (searchQuery) return null;
            if (isDesktop && collapsed) return <div key={i} style={{ borderTop: '1px solid rgba(255,255,255,.05)', margin: '6px 0' }} />;
            return <div key={i} style={{ padding: '12px 16px 4px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#3d4f66', borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: '8px' }}>{tr(item.section)}</div>;
          }
          const navItem = item as { path: string; label: string; icon: string; roles: string[] | null; badge?: string };
          if (navItem.roles && !navItem.roles.includes(role)) return null;
          // Filter by search query
          if (searchQuery && !navItem.label.toLowerCase().includes(searchQuery.toLowerCase())) return null;
          const badgeCount = getBadge(navItem.badge);
          const isActive   = navItem.path === '/' ? location.pathname === '/' : location.pathname.startsWith(navItem.path);
          return (
            <NavLink key={navItem.path} to={navItem.path} end={navItem.path === '/'}
              onClick={handleNavClick}
              style={{
                display: 'flex', alignItems: 'center',
                gap: (isDesktop && collapsed) ? 0 : 10,
                padding: (isDesktop && collapsed) ? '10px 14px' : '10px 16px',
                justifyContent: (isDesktop && collapsed) ? 'center' : 'flex-start',
                color: isActive ? '#fff' : '#9aa5b4', fontSize: '0.87rem',
                textDecoration: 'none', transition: 'all 150ms', position: 'relative',
                background: isActive ? roleColor + '30' : 'transparent',
                borderLeft: `4px solid ${isActive ? roleColor : 'transparent'}`,
                minHeight: 44,
              }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{navItem.icon}</span>
              {!(isDesktop && collapsed) && <span style={{ fontWeight: isActive ? 600 : 400, flex: 1 }}>{tr(navItem.label)}</span>}
              {!(isDesktop && collapsed) && badgeCount > 0 && (
                <span style={{ background: '#dc2626', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{badgeCount}</span>
              )}
              {(isDesktop && collapsed) && badgeCount > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
              )}
            </NavLink>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{ padding: (isDesktop && collapsed) ? '12px 10px' : '12px 14px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        {!(isDesktop && collapsed) && (
          <div style={{ paddingBottom: 8 }}>
            <NotificationCentre />
          </div>
        )}
        <NavLink to="/profile" style={{ display: 'flex', alignItems: 'center', gap: (isDesktop && collapsed) ? 0 : 10, textDecoration: 'none', justifyContent: (isDesktop && collapsed) ? 'center' : 'flex-start', marginBottom: (isDesktop && collapsed) ? 0 : 10, minHeight: 44 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor},${roleColor}aa)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          {!(isDesktop && collapsed) && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.firstName} {user?.lastName}</div>
              <div style={{ fontSize: '0.68rem', color: '#4a5568' }}>My Profile</div>
            </div>
          )}
        </NavLink>
        {!(isDesktop && collapsed) && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button onClick={() => setDarkMode(d => !d)} style={{ flex: 1, padding: '7px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
              {darkMode ? '\u2600\uFE0F Light Mode' : '\uD83C\uDF19 Dark Mode'}
            </button>
          </div>
        )}
        {!(isDesktop && collapsed) && (
          <button onClick={handleLogout} style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
            🚪 Sign Out
          </button>
        )}
        {(isDesktop && collapsed) && (
          <button onClick={handleLogout} title="Sign out" style={{ width: '100%', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '6px 0', marginTop: 8, fontSize: 18 }}>🚪</button>
        )}
      </div>
    </>
  );

  return (
    <div className="app-shell">

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      {isDesktop && (
        <div style={{ position: 'relative' }}>
          <nav className={`sidebar${collapsed ? ' collapsed' : ''}`} style={{ width: sidebarW }}>
            <SidebarContent />
          </nav>
          {/* Floating expand button on sidebar edge - always visible when collapsed */}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              aria-label="Expand sidebar menu"
              style={{
                position: 'fixed',
                top: '50%',
                left: sidebarW - 1,
                transform: 'translateY(-50%)',
                width: 24,
                height: 48,
                background: '#1f2937',
                border: '1px solid rgba(255,255,255,.12)',
                borderLeft: 'none',
                borderRadius: '0 8px 8px 0',
                color: '#9aa5b4',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                zIndex: 201,
                transition: 'all 150ms',
                boxShadow: '2px 0 8px rgba(0,0,0,.15)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#374151'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.width = '28px'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1f2937'; e.currentTarget.style.color = '#9aa5b4'; e.currentTarget.style.width = '24px'; }}
            >
              &#9654;
            </button>
          )}
        </div>
      )}

      {/* ── Mobile/Tablet: Slide-over drawer + overlay ─────────── */}
      {!isDesktop && (
        <>
          {/* Overlay */}
          <div
            className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <nav className={`sidebar${sidebarOpen ? ' mobile-open' : ''}`} style={{ width: sidebarW }}>
            <SidebarContent />
          </nav>
        </>
      )}

      {/* ── Mobile/Tablet Top Bar ───────────────────────────────── */}
      {!isDesktop && (
        <header className="topbar">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: '#9aa5b4', cursor: 'pointer', fontSize: 22, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${roleColor},${roleColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>⚕</div>
          <span className="topbar-title">CareVista</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Unread badge on messages */}
            {getBadge('messages') > 0 && (
              <Link to="/family" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', textDecoration: 'none' }}>
                <span>💬</span>
                <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
              </Link>
            )}
            <NotificationCentre />
            <Link to="/profile" style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor},${roleColor}aa)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Link>
          </div>
        </header>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main
        className={`main-content${isDesktop && collapsed ? ' collapsed' : ''}`}
        style={{ marginLeft: mainML, width: `calc(100% - ${mainML}px)` }}
      >
        <ErrorBoundary>
        <Routes>
          <Route path="/"               element={<Dashboard />} />
          <Route path="/tasks"          element={<TaskBoard />} />
          <Route path="/residents"      element={<Residents />} />
          <Route path="/residents/:id"  element={<ResidentDetail />} />
          <Route path="/care-notes"     element={<CareNotes />} />
          <Route path="/emar"           element={<Emar />} />
          <Route path="/incidents"      element={<Incidents />} />
          <Route path="/activities"     element={<Activities />} />
          <Route path="/wellbeing"      element={<WellbeingHub />} />
          <Route path="/schedule"       element={<Schedule />} />
          <Route path="/staff"          element={<Staff />} />
          <Route path="/training"       element={<Training />} />
          <Route path="/compliance"     element={<Compliance />} />
          <Route path="/policies"       element={<Policies />} />
          <Route path="/family"         element={<FamilyPortal />} />
          <Route path="/billing"        element={<Billing />} />
          <Route path="/invoicing"      element={<AutomatedInvoicing />} />
          <Route path="/occupancy"      element={<OccupancyForecasting />} />
          <Route path="/staff-costs"    element={<StaffCostAnalytics />} />
          <Route path="/ai-tools"       element={<AiTools />} />
          <Route path="/cd-register"    element={<CDRegister />} />
          <Route path="/ai-insights"    element={<AiInsights />} />
          <Route path="/predictive-care" element={<PredictiveCare />} />
          <Route path="/sbar-handover" element={<SbarHandover />} />
          <Route path="/news2"          element={<News2Calculator />} />
          <Route path="/wounds"         element={<WoundTracker />} />
          <Route path="/infections"     element={<InfectionTracker />} />
          <Route path="/continence"     element={<ContinenceAssessment />} />
          <Route path="/smart-rota"      element={<SmartRota />} />
          <Route path="/recruitment"     element={<RecruitmentPipeline />} />
          <Route path="/competency-matrix" element={<CompetencyMatrix />} />
          <Route path="/sickness-absence" element={<SicknessAbsence />} />
          <Route path="/nl-search"       element={<NaturalLanguageSearch />} />
          <Route path="/risk-assessments" element={<RiskAssessments />} />
          <Route path="/med-interactions" element={<MedInteractionChecker />} />
          <Route path="/fire-log"        element={<FireLogBook />} />
          <Route path="/visitor-sign-in" element={<VisitorSignIn />} />
          <Route path="/room-turnover"   element={<RoomTurnoverManager />} />
          <Route path="/housekeeping"   element={<Housekeeping />} />
          <Route path="/care-tasks"     element={<CareTaskManager />} />
          <Route path="/outcomes"      element={<OutcomesDashboard />} />
          <Route path="/family-access"  element={<FamilyAccessManager />} />
          <Route path="/menu-admin"     element={<MenuManager />} />
          <Route path="/housekeeping-admin" element={<HousekeepingManager />} />
          <Route path="/settings"       element={<HomeSettings />} />
          <Route path="/report-builder"  element={<ReportBuilder />} />
          <Route path="/offline-mode"    element={<OfflineMode />} />
          <Route path="/resident-tablet" element={<ResidentTablet />} />
          <Route path="/qr-scanning"     element={<QrRoomScanning />} />
          <Route path="/benchmarking"    element={<BenchmarkingDashboard />} />
          <Route path="/board-packs"     element={<BoardPackGenerator />} />
          <Route path="/staff-performance" element={<StaffPerformanceInsights />} />
          <Route path="/elearning"       element={<ElearningModule />} />
          <Route path="/competency-signoff" element={<CompetencySignoff />} />
          <Route path="/diabetes"        element={<DiabetesManagement />} />
          <Route path="/palliative-care" element={<PalliativeCarePathway />} />
          <Route path="/music-therapy" element={<MusicTherapy />} />
          <Route path="/menu-choices" element={<MenuChoiceSystem />} />
          <Route path="/friendship-mapper" element={<FriendshipMapper />} />
          <Route path="/purpose-planner" element={<DailyPurposePlanner />} />
          <Route path="/mood-environment" element={<MoodEnvironment />} />
          <Route path="/photo-frames" element={<PhotoFrameFeed />} />
          <Route path="/sleep-tracker" element={<SleepQualityTracker />} />
          <Route path="/intergenerational" element={<IntergenerationalProgramme />} />
          <Route path="/rehab-goals" element={<RehabGoalTracker />} />
          <Route path="/celebrations" element={<CelebrationPlanner />} />
          <Route path="/ai-care-plans" element={<AiCarePlanWriter />} />
          <Route path="/admission-matching" element={<AdmissionMatching />} />
          <Route path="/wellbeing-heatmap" element={<WellbeingHeatmap />} />
          <Route path="/regulatory" element={<RegulatoryReporting />} />
          <Route path="/smart-handover" element={<SmartHandover />} />
          <Route path="/consent-manager" element={<ConsentManager />} />
          <Route path="/digital-twin" element={<ResidentDigitalTwin />} />
          <Route path="/environmental" element={<EnvironmentalIntelligence />} />
          <Route path="/audit-log"      element={<AuditLog />} />
          <Route path="/profile"        element={<Profile />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>

      {/* ── Phone Bottom Nav ─────────────────────────────────────── */}
      {isPhone && (
        <nav className="bottom-nav">
          {BOTTOM_NAV.map(item => {
            const badgeCount = getBadge(item.badge);
            const isActive   = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <NavLink key={item.path} to={item.path} end={item.path === '/'} className={`bottom-nav-item${isActive ? ' active' : ''}`}>
                <span className="icon" style={{ position: 'relative' }}>
                  {item.icon}
                  {badgeCount > 0 && (
                    <span className="bottom-nav-badge">{badgeCount > 9 ? '9+' : badgeCount}</span>
                  )}
                </span>
                <span>{tr(item.label)}</span>
              </NavLink>
            );
          })}
          {/* More button — opens drawer */}
          <button
            className="bottom-nav-item"
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none' }}
          >
            <span className="icon">☰</span>
            <span>More</span>
          </button>
        </nav>
      )}

    </div>
  );
}
