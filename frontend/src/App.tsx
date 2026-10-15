// src/App.tsx — Fully responsive: desktop sidebar, tablet drawer, phone bottom nav
import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useLang, LanguageSwitcher } from './i18n';
import { Routes, Route, NavLink, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { useDashboard, useHome } from './hooks';
import { OfflineBanner } from './components/OfflineBanner';
import { InstallPrompt } from './components/InstallPrompt';
import { Icon } from './components/Icon';
import { Avatar } from './components/ds';
import { navIcon } from './utils/navIcons';
import { queueSummary, clearForUser, startOfflineSync } from './services/offlineSync';

import SimpleHome      from './pages/simple/SimpleHome';
import { useSimpleMode, canUseSimpleMode } from './hooks/useSimpleMode';
import NotificationCentre from './components/NotificationCentre';
import { useIntakeToday } from './hooks/useIntakeToday';
import ErrorBoundary from './components/ErrorBoundary';
import { ROLE_LABELS } from './utils/formatters';

// Screens load on demand. Before this, all of them were downloaded before the
// first one appeared - slow on a cheap phone over care home Wi-Fi. Each now
// arrives only when someone opens it.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Residents = lazy(() => import('./pages/Residents'));
const ResidentDetail = lazy(() => import('./pages/ResidentDetail'));
const CareNotes = lazy(() => import('./pages/CareNotes'));
const Emar = lazy(() => import('./pages/Emar'));
const Incidents = lazy(() => import('./pages/Incidents'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Staff = lazy(() => import('./pages/Staff'));
const Training = lazy(() => import('./pages/Training'));
const Compliance = lazy(() => import('./pages/Compliance'));
const FamilyPortal = lazy(() => import('./pages/FamilyPortal'));
const Billing = lazy(() => import('./pages/Billing'));
const AiTools = lazy(() => import('./pages/AiTools'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const RecordIntegrity = lazy(() => import('./pages/RecordIntegrity'));
const CareDeck = lazy(() => import('./pages/simple/CareDeck'));
const SimpleHandover = lazy(() => import('./pages/simple/SimpleHandover'));
const CarerPreview = lazy(() => import('./pages/simple/CarerPreview'));
const SomethingDifferent = lazy(() => import('./pages/simple/SomethingDifferent'));
const SoftSignsBoard = lazy(() => import('./pages/SoftSignsBoard'));
const PilotEvidence = lazy(() => import('./pages/PilotEvidence'));
const RecordCare = lazy(() => import('./pages/RecordCare'));
const Policies = lazy(() => import('./pages/Policies'));
const Profile = lazy(() => import('./pages/Profile'));
const TaskBoard = lazy(() => import('./pages/TaskBoard'));
const CDRegister = lazy(() => import('./pages/CDRegister'));
const AiInsights = lazy(() => import('./pages/AiInsights'));
const PredictiveCare = lazy(() => import('./pages/PredictiveCare'));
const Activities = lazy(() => import('./pages/Activities'));
const WellbeingHub = lazy(() => import('./pages/WellbeingHub'));
const SbarHandover = lazy(() => import('./pages/SbarHandover'));
const News2Calculator = lazy(() => import('./pages/News2Calculator'));
const WoundTracker = lazy(() => import('./pages/WoundTracker'));
const InfectionTracker = lazy(() => import('./pages/InfectionTracker'));
const ContinenceAssessment = lazy(() => import('./pages/ContinenceAssessment'));
const SmartRota = lazy(() => import('./pages/SmartRota'));
const NaturalLanguageSearch = lazy(() => import('./pages/NaturalLanguageSearch'));
const RiskAssessments = lazy(() => import('./pages/RiskAssessments'));
const FireGrabSheet = lazy(() => import('./pages/FireGrabSheet'));
const HomeSafety = lazy(() => import('./pages/HomeSafety'));
const CarePlanSetup = lazy(() => import('./pages/CarePlanSetup'));
const AssessmentBuilder = lazy(() => import('./pages/AssessmentBuilder'));
const PrintCarePlan = lazy(() => import('./pages/PrintCarePlan'));
const CarePlans = lazy(() => import('./pages/CarePlans'));
const NightSensing = lazy(() => import('./pages/NightSensing'));
const AboutThisSoftware = lazy(() => import('./pages/AboutThisSoftware'));
const Appointments = lazy(() => import('./pages/Appointments'));
const ComplaintsCompliments = lazy(() => import('./pages/ComplaintsCompliments'));
const DolsRegister = lazy(() => import('./pages/DolsRegister'));
const Supervisions = lazy(() => import('./pages/Supervisions'));
const MonitoringCharts = lazy(() => import('./pages/MonitoringCharts'));
const IntakeOutput = lazy(() => import('./pages/IntakeOutput'));
const MentalCapacity = lazy(() => import('./pages/MentalCapacity'));
const McaAssessment = lazy(() => import('./pages/McaAssessment'));
const ResidentFinance = lazy(() => import('./pages/ResidentFinance'));
const MedInteractionChecker = lazy(() => import('./pages/MedInteractionChecker'));
const AutomatedInvoicing = lazy(() => import('./pages/AutomatedInvoicing'));
const OccupancyForecasting = lazy(() => import('./pages/OccupancyForecasting'));
const StaffCostAnalytics = lazy(() => import('./pages/StaffCostAnalytics'));
const RecruitmentPipeline = lazy(() => import('./pages/RecruitmentPipeline'));
const CompetencyMatrix = lazy(() => import('./pages/CompetencyMatrix'));
const SicknessAbsence = lazy(() => import('./pages/SicknessAbsence'));
const FireLogBook = lazy(() => import('./pages/FireLogBook'));
const VisitorSignIn = lazy(() => import('./pages/VisitorSignIn'));
const RoomTurnoverManager = lazy(() => import('./pages/RoomTurnoverManager'));
const Housekeeping = lazy(() => import('./pages/Housekeeping'));
const CareTaskManager = lazy(() => import('./pages/CareTaskManager'));
const OutcomesDashboard = lazy(() => import('./pages/OutcomesDashboard'));
const FamilyAccessManager = lazy(() => import('./pages/FamilyAccessManager'));
const MenuManager = lazy(() => import('./pages/MenuManager'));
const HousekeepingManager = lazy(() => import('./pages/HousekeepingManager'));
const HomeSettings = lazy(() => import('./pages/HomeSettings'));
const ReportBuilder = lazy(() => import('./pages/ReportBuilder'));
const OfflineMode = lazy(() => import('./pages/OfflineMode'));
const ResidentTablet = lazy(() => import('./pages/ResidentTablet'));
const QrRoomScanning = lazy(() => import('./pages/QrRoomScanning'));
const BenchmarkingDashboard = lazy(() => import('./pages/BenchmarkingDashboard'));
const BoardPackGenerator = lazy(() => import('./pages/BoardPackGenerator'));
const StaffPerformanceInsights = lazy(() => import('./pages/StaffPerformanceInsights'));
const ElearningModule = lazy(() => import('./pages/ElearningModule'));
const CompetencySignoff = lazy(() => import('./pages/CompetencySignoff'));
const DiabetesManagement = lazy(() => import('./pages/DiabetesManagement'));
const PalliativeCarePathway = lazy(() => import('./pages/PalliativeCarePathway'));
const MusicTherapy = lazy(() => import('./pages/MusicTherapy'));
const MenuChoiceSystem = lazy(() => import('./pages/MenuChoiceSystem'));
const FriendshipMapper = lazy(() => import('./pages/FriendshipMapper'));
const DailyPurposePlanner = lazy(() => import('./pages/DailyPurposePlanner'));
const MoodEnvironment = lazy(() => import('./pages/MoodEnvironment'));
const PhotoFrameFeed = lazy(() => import('./pages/PhotoFrameFeed'));
const SleepQualityTracker = lazy(() => import('./pages/SleepQualityTracker'));
const IntergenerationalProgramme = lazy(() => import('./pages/IntergenerationalProgramme'));
const RehabGoalTracker = lazy(() => import('./pages/RehabGoalTracker'));
const CelebrationPlanner = lazy(() => import('./pages/CelebrationPlanner'));
const AiCarePlanWriter = lazy(() => import('./pages/AiCarePlanWriter'));
const AdmissionMatching = lazy(() => import('./pages/AdmissionMatching'));
const WellbeingHeatmap = lazy(() => import('./pages/WellbeingHeatmap'));
const RegulatoryReporting = lazy(() => import('./pages/RegulatoryReporting'));
const SmartHandover = lazy(() => import('./pages/SmartHandover'));
const ConsentManager = lazy(() => import('./pages/ConsentManager'));
const ResidentDigitalTwin = lazy(() => import('./pages/ResidentDigitalTwin'));
const EnvironmentalIntelligence = lazy(() => import('./pages/EnvironmentalIntelligence'));

// ── Nav config ────────────────────────────────────────────────────────────
// Menu tiers. The full menu had 87 items for a manager — a training wall for
// a new home, and unfocused to anyone evaluating the product.
//   labs:   experimental and analytics extras, shown only when a manager turns
//           Labs on for the home (Home Settings). Their pages still work by link.
//   setup:  configuration, folded into one collapsible group.
//   folded: reachable from another screen, so not repeated in the menu
//           (the fluid charts open from the intake board).
const NAV_ALL = [
  { section: 'Overview' },
  { path: '/',           label: 'Dashboard',    icon: '📊', roles: null },
  { section: 'Care' },
  { path: '/tasks',      label: 'Task Board',   icon: '📋', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'], badge: 'tasks' },
  { path: '/care-tasks', label: 'Care Tasks', icon: '🗂️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'], setup: true },
  { path: '/outcomes', label: 'Outcomes & Impact', icon: '📈', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/family-access', label: 'Family Access', icon: '👨‍👩‍👧', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'], setup: true },
  { path: '/menu-admin', label: 'Menu Setup', icon: '🍽️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','kitchen'], setup: true },
  { path: '/housekeeping-admin', label: 'Housekeeping Setup', icon: '🧹', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','cleaning'], setup: true },
  { path: '/settings', label: 'Home Settings', icon: '⚙️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'], setup: true },
  { path: '/residents',  label: 'Residents',    icon: '👥', roles: null },
  { path: '/record', label: 'Record care', icon: '', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/care-plans', label: 'Care Plans', icon: '📖', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin','activities'] },
  { path: '/care-notes', label: 'Care Notes',   icon: '📝', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/intake', label: 'Fluids, Food & Bowels', icon: '🚰', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/soft-signs', label: 'Soft Signs', icon: '📣', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/something-different', label: "Something's not right", icon: '🙋', roles: ['carer','activities','cleaning','kitchen','maintenance'] },
  { path: '/charts', label: 'Fluid & Food Charts', icon: '💧', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], folded: true },
  { path: '/appointments', label: 'Appointments', icon: '🩺', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/emar',       label: 'Medications',  icon: '💊', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], badge: 'meds' },
  { path: '/incidents',  label: 'Incidents',    icon: '⚠️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], badge: 'incidents' },
  { path: '/activities', label: 'Activities',   icon: '🎯', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/wellbeing',  label: 'Wellbeing Hub', icon: '💚', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'], labs: true },
  { path: '/news2',     label: 'NEWS2 Vitals', icon: '💓', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/wounds',    label: 'Wound Tracker', icon: '🩹', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/continence', label: 'Continence Care', icon: '📋', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/room-turnover', label: 'Room Turnover', icon: '🛏️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','maintenance'] },
  { path: '/housekeeping', label: 'Housekeeping', icon: '🧹', roles: ['cleaning','maintenance','home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/qr-scanning', label: 'QR Scanning', icon: '📱', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], labs: true },
  { path: '/diabetes', label: 'Diabetes', icon: '🩸', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/palliative-care', label: 'Palliative Care', icon: '🕊️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/resident-tablet', label: 'Resident Tablet', icon: '📲', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], labs: true },
  { path: '/care-plan-setup', label: 'Care plan setup', icon: '⚡', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/assessment-builder', label: 'Assessment builder', icon: '⚡', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/home-safety', label: 'Home safety', icon: '⚡', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/risk-assessments', label: 'Assessments', icon: '⚡', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/dols', label: 'DoLS & Restrictions', icon: '⚖️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/carer-view', label: 'Preview carer view', icon: '👁', roles: ['home_manager','deputy_manager','registered_nurse','admin','super_admin','group_admin'], setup: true },
  { path: '/mca', label: 'Mental Capacity (MCA)', icon: '🧠', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/med-interactions', label: 'Med Interactions', icon: '💊', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { section: 'Team', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse','senior_carer'] },
  { path: '/schedule',   label: 'Rota',         icon: '📅', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse','senior_carer'] },
  { path: '/staff',      label: 'Staff',        icon: '👤', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/training',   label: 'Training',     icon: '🎓', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'], badge: 'training' },
  { path: '/smart-rota', label: 'AI Smart Rota', icon: '🤖', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'], labs: true },
  { path: '/recruitment', label: 'Recruitment', icon: '📢', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'], labs: true },
  { path: '/competency-matrix', label: 'Competencies', icon: '🎯', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/competency-signoff', label: 'Sign-Offs', icon: '✍️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse'], labs: true },
  { path: '/elearning', label: 'E-Learning', icon: '📚', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse','senior_carer','carer'], labs: true },
  { path: '/staff-performance', label: 'Performance', icon: '📈', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'], labs: true },
  { path: '/supervisions', label: 'Supervision', icon: '🗣️', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','registered_nurse','senior_carer','carer','activities','kitchen','cleaning','maintenance','finance'] },
  { path: '/sickness-absence', label: 'Absence', icon: '📊', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { section: 'Governance', roles: ['home_manager','deputy_manager','super_admin','group_admin','registered_nurse'] },
  { path: '/compliance', label: 'CQC Compliance', icon: '✅', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/feedback', label: 'Complaints & Compliments', icon: '💬', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'] },
  { path: '/policies',   label: 'Policies',     icon: '📋', roles: null },
  { path: '/infections', label: 'Infection Control', icon: '🦠', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','admin','super_admin','group_admin'] },
  { path: '/fire-log', label: 'Fire Log', icon: '🔥', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin'] },
  { path: '/visitor-sign-in', label: 'Visitors', icon: '🚪', roles: ['home_manager','deputy_manager','admin','super_admin','group_admin','senior_carer','carer','registered_nurse'] },
  { path: '/benchmarking', label: 'Benchmarking', icon: '📊', roles: ['home_manager','deputy_manager','super_admin','group_admin'], labs: true },
  { path: '/board-packs', label: 'Board Packs', icon: '📑', roles: ['home_manager','deputy_manager','super_admin','group_admin'], labs: true },
  { section: 'Quality of Life', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'] },
  { path: '/music-therapy', label: 'Music Therapy', icon: '🎵', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'], labs: true },
  { path: '/menu-choices', label: 'Menu Choices', icon: '🍽️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin','kitchen'] },
  { path: '/friendship-mapper', label: 'Friendship Mapper', icon: '🤝', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'], labs: true },
  { path: '/purpose-planner', label: 'Purpose Planner', icon: '🌱', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'], labs: true },
  { path: '/mood-environment', label: 'Mood Environment', icon: '🌤️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], labs: true },
  { path: '/photo-frames', label: 'Photo Frames', icon: '🖼️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'], labs: true },
  { path: '/sleep-tracker', label: 'Sleep Tracker', icon: '😴', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], labs: true },
  { path: '/night-sensing', label: 'Night Sensing', icon: '📡', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], labs: true },
  { path: '/intergenerational', label: 'Intergenerational', icon: '👶', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','activities','admin','super_admin','group_admin'], labs: true },
  { path: '/rehab-goals', label: 'Rehab Goals', icon: '🏋️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], labs: true },
  { path: '/celebrations', label: 'Celebrations', icon: '🎉', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'], labs: true },
  { section: 'Communications' },
  { path: '/family',     label: 'Family Portal', icon: '💬', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','activities','admin','super_admin','group_admin'], badge: 'messages' },
  { section: 'Finance', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'] },
  { path: '/billing',    label: 'Billing',      icon: '💷', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'] },
  { path: '/resident-finance', label: 'Personal Allowance', icon: '👛', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin','senior_carer','registered_nurse'] },
  { path: '/invoicing',  label: 'Invoicing',    icon: '🧾', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'], labs: true },
  { path: '/occupancy',  label: 'Occupancy',    icon: '🏠', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'], labs: true },
  { path: '/staff-costs', label: 'Staff Costs', icon: '💰', roles: ['home_manager','deputy_manager','admin','finance','super_admin','group_admin'], labs: true },
  { path: '/cd-register', label: 'CD Register',   icon: '💊', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'] },
  { section: 'Tools', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'] },
  { path: '/nl-search', label: 'Smart Search', icon: '🔍', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], labs: true },
  { path: '/ai-tools',   label: 'AI Tools',     icon: '🤖', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'], labs: true },
  { path: '/ai-care-plans', label: 'AI Care Plan Drafts', icon: '📄', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'], labs: true },
  { path: '/ai-insights', label: 'AI Insights',   icon: '🧠', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'], labs: true },
  { path: '/about-software', label: 'About This Software', icon: 'ℹ️', roles: null, setup: true },
  { path: '/predictive-care', label: 'Risk Indicators', icon: '🎯', roles: ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'], labs: true },
  { path: '/admission-matching', label: 'Admission Match', icon: '🏠', roles: ['home_manager','deputy_manager','super_admin','group_admin'], labs: true },
  { path: '/smart-handover', label: 'Smart Handover', icon: '🧠', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','super_admin','group_admin'], labs: true },
  { path: '/sbar-handover', label: 'SBAR Handover', icon: '📋', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','super_admin','group_admin'] },
  { path: '/digital-twin', label: 'Digital Twin', icon: '🧬', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','super_admin','group_admin'], labs: true },
  { path: '/wellbeing-heatmap', label: 'Wellbeing Map', icon: '🗺️', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','super_admin','group_admin'], labs: true },
  { path: '/environmental', label: 'Environment', icon: '🌍', roles: ['home_manager','deputy_manager','super_admin','group_admin','maintenance'], labs: true },
  { path: '/regulatory', label: 'Regulatory', icon: '🏛️', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/consent-manager', label: 'Consents', icon: '📝', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','super_admin','group_admin'] },
  { path: '/audit-log',  label: 'Audit Log',    icon: '🔍', roles: ['home_manager','super_admin','group_admin'] },
  { path: '/record-integrity', label: 'Record Integrity', icon: '🔒', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/report-builder', label: 'Report Builder', icon: '📑', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/pilot-evidence', label: 'Pilot Evidence', icon: '🗂️', roles: ['home_manager','deputy_manager','super_admin','group_admin'] },
  { path: '/offline-mode', label: 'Offline Mode', icon: '📴', roles: ['home_manager','deputy_manager','registered_nurse','senior_carer','carer','admin','super_admin','group_admin'], labs: true },
];

// Bottom nav — most important 5 items for phone
// Simple mode shows only what a carer acts on during a shift. Everything else
// is still reachable by switching back to the full view, which is why that
// toggle sits below the menu and not inside it.
// '/emar' because senior carers often give medication; the role filter still
// hides it from anyone without eMAR access.
// Who gets the "Start my round" button at the top of the menu.
const ROUND_ROLES = ['carer', 'senior_carer', 'registered_nurse'];
const SIMPLE_NAV_PATHS = ['/', '/round', '/record', '/shift', '/emar', '/intake', '/something-different', '/soft-signs', '/residents', '/care-notes', '/profile'];

// Nurses and managers get the intake board in the fifth slot: "who needs a
// drink, who hasn't opened their bowels" is the question they are asked most
// on the floor. Everyone else keeps Incidents there.
const CLINICAL_LEADS = ['home_manager','deputy_manager','registered_nurse','super_admin','group_admin'];
const BOTTOM_NAV: { path: string; label: string; icon: string; badge: string | null; roles?: string[]; hideFor?: string[] }[] = [
  { path: '/',           label: 'Home',      icon: '📊', badge: null },
  { path: '/residents',  label: 'Residents', icon: '👥', badge: null },
  { path: '/care-notes', label: 'Notes',     icon: '📝', badge: null },
  { path: '/emar',       label: 'Meds',      icon: '💊', badge: 'meds' },
  { path: '/intake',     label: 'Intake',    icon: '💧', badge: 'intake', roles: CLINICAL_LEADS },
  { path: '/incidents',  label: 'Incidents', icon: '⚠️', badge: 'incidents', hideFor: CLINICAL_LEADS },
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
  // Simple mode is a per-person preference, not a role, so a manager can
  // switch it on to see exactly what their carers see.
  const { simple, setSimple } = useSimpleMode(user?.id, user?.role);
  
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
      // A home's own colour replaces the brand colour everywhere it is used.
      // (Dark mode keeps its lighter tint so text on it stays readable.)
      if (!darkMode) {
        for (const v of ['--primary', '--primary-dark', '--brand', '--brand-700']) document.documentElement.style.setProperty(v, c);
      } else {
        for (const v of ['--primary', '--primary-dark', '--brand', '--brand-700']) document.documentElement.style.removeProperty(v);
      }
    }
  }, [homeCfg, darkMode]);
  const navigate         = useNavigate();
  const location         = useLocation();
  const { isPhone, isTablet, isDesktop } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen]  = useState(false);
  const [collapsed, setCollapsed]      = useState(false);
  const [searchQuery, setSearchQuery]  = useState('');
  // Setup (configuration) is folded away; remember whether it was left open.
  const [setupOpen, setSetupOpenState] = useState(() => { try { return localStorage.getItem('cv-setup-open') === '1'; } catch { return false; } });
  const setSetupOpen = (v: boolean) => { setSetupOpenState(v); try { localStorage.setItem('cv-setup-open', v ? '1' : '0'); } catch { /* private mode */ } };
  // Send anything recorded offline as soon as there is a signal.
  useEffect(() => { startOfflineSync(); }, []);
  // Labs features are off unless a manager switches them on for the home.
  const labsOn = !!homeCfg?.settings?.labs_enabled;
  const { t: tr } = useLang();

  // Close drawer on route change (mobile/tablet)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  // Close drawer on desktop resize
  useEffect(() => { if (isDesktop) setSidebarOpen(false); }, [isDesktop]);

  // While the drawer is open, freeze the page behind it.
  //
  // Without this, two scrollable surfaces are stacked: swiping in the menu
  // scrolls the menu until it reaches the end, then silently starts scrolling
  // the page underneath — so closing the drawer leaves you somewhere you never
  // meant to be. Pinning the body position (not just overflow:hidden, which
  // iOS Safari ignores) stops it, and the saved offset is restored on close so
  // the page does not jump back to the top.
  useEffect(() => {
    if (isDesktop) return;
    if (!sidebarOpen) return;
    const y = window.scrollY;
    document.body.classList.add('drawer-open');
    document.body.style.top = `-${y}px`;
    return () => {
      document.body.classList.remove('drawer-open');
      document.body.style.top = '';
      window.scrollTo(0, y);
    };
  }, [sidebarOpen, isDesktop]);

  // The phone back gesture should close the drawer, not leave the app.
  useEffect(() => {
    if (!sidebarOpen) return;
    window.history.pushState({ drawer: true }, '');
    const onPop = () => setSidebarOpen(false);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (window.history.state?.drawer) window.history.back();
    };
  }, [sidebarOpen]);

  // Escape closes it too (tablets with keyboards, and desktop testing).
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);
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
  // Red count for the Intake tab badge. Only fetched for nurses and managers.
  const { red: intakeRed } = useIntakeToday(CLINICAL_LEADS.includes(role));

  // Set when any request hits a table that has not been migrated yet.
  const [migrationMsg, setMigrationMsg] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setMigrationMsg((e as CustomEvent).detail || 'The database needs updating.');
    window.addEventListener('cv-migration-pending', on);
    return () => window.removeEventListener('cv-migration-pending', on);
  }, []);
  const roleColor = ROLE_COLORS[role] || '#2563eb';

  const getBadge = (key?: string | null): number => {
    if (key === 'intake') return intakeRed;
    if (!dash || !key) return 0;
    if (key === 'incidents') return parseInt(dash.openIncidents)    || 0;
    if (key === 'messages')  return parseInt(dash.unreadMessages)   || 0;
    if (key === 'training')  return parseInt(dash.expiringTraining) || 0;
    if (key === 'tasks')     return parseInt(dash.overdueTasksCount) || 0;
    return 0;
  };

  const handleLogout = async () => {
    // Records still on this phone would be lost with the session. Say so.
    const q = user?.id ? queueSummary(user.id) : { waiting: 0, failed: 0 };
    if (q.waiting + q.failed > 0) {
      const n = q.waiting + q.failed;
      const ok = window.confirm(`${n} record${n === 1 ? ' has' : 's have'} not been sent from this phone yet.\n\n` +
        `Get a signal and wait for them to send before signing out.\n\nSign out anyway and THROW THEM AWAY?`);
      if (!ok) return;
      clearForUser(user!.id);
    }
    await logout(); navigate('/login');
  };

  const sidebarW = isDesktop ? (collapsed ? 68 : 256) : 280;
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
  const SidebarContent = () => {
    const mini = isDesktop && collapsed;
    type NavItem = { path: string; label: string; icon: string; roles: string[] | null; badge?: string; labs?: boolean; setup?: boolean; folded?: boolean };
    const q = searchQuery.toLowerCase();
    const shows = (n: NavItem) => {
      if (n.roles && !n.roles.includes(role)) return false;
      if (simple) return SIMPLE_NAV_PATHS.includes(n.path);
      if (n.labs && !labsOn) return false;
      if (n.folded && !q) return false;
      if (q && !n.label.toLowerCase().includes(q) && !tr(n.label).toLowerCase().includes(q)) return false;
      return true;
    };
    const renderLink = (n: NavItem) => {
      const badgeCount = getBadge(n.badge);
      const isActive = n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path);
      return (
        <NavLink key={n.path} to={n.path} end={n.path === '/'} onClick={handleNavClick}
          className={`cv-nav-item${isActive ? ' active' : ''}`} title={mini ? tr(n.label) : undefined}
          style={mini ? { justifyContent: 'center', padding: '9px 0' } : undefined}>
          <Icon name={navIcon(n.path)} size={19} />
          {!mini && <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr(n.label)}</span>}
          {!mini && n.labs && <span className="cv-nav-tag" title={tr('Labs: experimental. Not part of the core record.')}>LABS</span>}
          {!mini && badgeCount > 0 && <span className="cv-nav-count">{badgeCount > 99 ? '99+' : badgeCount}</span>}
          {mini && badgeCount > 0 && <span style={{ position: 'absolute', top: 6, right: 10, width: 8, height: 8, borderRadius: '50%', background: 'var(--red-600)' }} />}
        </NavLink>
      );
    };

    // Group items under their section; drop sections left empty by role,
    // Labs or search, so no header sits over nothing.
    const items: React.ReactNode[] = [];
    const setupItems: NavItem[] = [];
    let pending: { key: number; section: string } | null = null;
    NAV_ALL.forEach((item, i) => {
      if ('section' in item && !('path' in item)) {
        const sec = item as { section: string; roles?: string[] | null };
        pending = (sec.roles && !sec.roles.includes(role)) ? { key: -1, section: '' } : { key: i, section: sec.section };
        return;
      }
      const n = item as NavItem;
      if (!shows(n)) return;
      if (n.setup && !simple && !q) { setupItems.push(n); return; }
      if (pending && !simple && !q) {
        if (pending.key >= 0) {
          items.push(mini
            ? <div key={`s${pending.key}`} style={{ borderTop: '1px solid var(--border)', margin: '8px 14px' }} />
            : <div key={`s${pending.key}`} className="cv-nav-section">{tr(pending.section)}</div>);
        }
        pending = null;
      }
      items.push(renderLink(n));
    });
    if (setupItems.length) {
      const onSetupPage = setupItems.some(n => location.pathname.startsWith(n.path));
      const open = setupOpen || onSetupPage;
      items.push(
        <button key="setup-toggle" onClick={() => setSetupOpen(!setupOpen)} aria-expanded={open}
          className="cv-nav-item" style={{ width: 'calc(100% - 20px)', border: 'none', background: 'none', marginTop: 10, cursor: 'pointer', justifyContent: mini ? 'center' : undefined }}>
          <Icon name="settings" size={19} />
          {!mini && <span style={{ flex: 1, textAlign: 'left' }}>{tr('Setup')}</span>}
          {!mini && <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} />}
        </button>
      );
      if (open) setupItems.forEach(n => items.push(renderLink(n)));
    }

    const footBtn: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 40, padding: '8px 10px', borderRadius: 10,
      border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: '.88rem', fontWeight: 500, cursor: 'pointer',
      justifyContent: mini ? 'center' : 'flex-start',
    };

    return (
      <>
        <div className="cv-brand" style={mini ? { justifyContent: 'center', padding: '16px 0 10px' } : undefined}>
          <div className="cv-brand-mark"><Icon name="hand-heart" size={20} /></div>
          {!mini && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="cv-brand-name">CareVista</div>
              <div className="cv-brand-home">{user?.careHomeName}</div>
            </div>
          )}
          {isDesktop && !collapsed && (
            <button onClick={() => setCollapsed(true)} title={tr('Collapse menu')} aria-label="Collapse menu"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'grid' }}>
              <Icon name="arrow-left" size={18} />
            </button>
          )}
          {!isDesktop && (
            <button onClick={() => setSidebarOpen(false)} aria-label="Close menu"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, marginLeft: 'auto', display: 'grid' }}>
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
        {mini && (
          <button onClick={() => setCollapsed(false)} title={tr('Expand menu')} aria-label="Expand sidebar menu"
            style={{ ...footBtn, width: 40, margin: '0 auto 6px', border: '1px solid var(--border)' }}>
            <Icon name="menu" size={18} />
          </button>
        )}

        {!mini && !simple && (
          <div style={{ padding: '2px 14px 8px' }}>
            <div className="cv-search">
              <Icon name="search" size={16} />
              <input id="sidebar-search-input" type="text" placeholder={tr('Search menu')} value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} autoComplete="off"
                style={{ minHeight: 38, fontSize: '.88rem', paddingLeft: 36, borderRadius: 10 }} />
            </div>
          </div>
        )}

        {(simple || ROUND_ROLES.includes(role)) && (
          <NavLink to="/round" className="cv-primary-action" style={mini ? { justifyContent: 'center', padding: '12px 0', margin: '6px 10px' } : undefined}
            title={mini ? tr('Start my round') : undefined}>
            <Icon name="hand-heart" size={21} />
            {!mini && <span>{tr('Start my round')}</span>}
          </NavLink>
        )}

        <div ref={navScrollRef} style={{ flex: 1, padding: '2px 0 10px', overflowY: 'auto' }}>
          {items}
        </div>

        <div style={{ padding: mini ? '10px 8px' : '10px 12px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {!mini && <div style={{ padding: '2px 4px 8px' }}><LanguageSwitcher /></div>}
          {!mini && <div style={{ paddingBottom: 6 }}><NotificationCentre /></div>}
          <NavLink to="/profile" style={{ ...footBtn, textDecoration: 'none', minHeight: 48 }} title={mini ? tr('My profile') : undefined}>
            <Avatar name={`${user?.firstName || ''} ${user?.lastName || ''}`} size={34} />
            {!mini && (
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.firstName} {user?.lastName}</span>
                <span style={{ display: 'block', fontSize: '.76rem', color: 'var(--text-muted)' }}>{tr(ROLE_LABELS[role] || role)}</span>
              </span>
            )}
          </NavLink>
          {!mini && canUseSimpleMode(role) && (
            <button onClick={() => setSimple(!simple)} style={footBtn}
              title={simple ? tr('Show every screen and every option') : tr('Big buttons, one thing at a time — what carers see')}>
              <Icon name={simple ? 'layout-dashboard' : 'hand'} size={18} />{simple ? tr('Full view') : tr('Simple view')}
            </button>
          )}
          {!mini && (
            <button onClick={() => setDarkMode(d => !d)} style={footBtn}>
              <Icon name={darkMode ? 'sun' : 'moon'} size={18} />{darkMode ? tr('Light mode') : tr('Dark mode')}
            </button>
          )}
          <button onClick={handleLogout} style={footBtn} title={mini ? tr('Sign out') : undefined}>
            <Icon name="log-out" size={18} />{!mini && tr('Sign out')}
          </button>
          {!mini && (
            <div title="Build currently running — use this to confirm a deploy went live"
              style={{ marginTop: 6, fontSize: '.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              build {typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="app-shell">

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      {isDesktop && (
        <div style={{ position: 'relative' }}>
          <nav className={`sidebar cv-sidebar${collapsed ? ' collapsed' : ''}`} style={{ width: sidebarW }}>
            <SidebarContent />
          </nav>
        </div>
      )}

      {/* ── Mobile/Tablet: Slide-over drawer + overlay ─────────── */}
      {!isDesktop && (
        <>
          {/* Overlay */}
          <div
            className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
            onClick={() => setSidebarOpen(false)}
            onTouchMove={e => e.preventDefault()}
            aria-hidden="true"
          />
          {/* Drawer */}
          <nav className={`sidebar cv-sidebar${sidebarOpen ? ' mobile-open' : ''}`} style={{ width: sidebarW }}>
            <SidebarContent />
          </nav>
        </>
      )}

      {/* ── Mobile/Tablet Top Bar ───────────────────────────────── */}
      {!isDesktop && (
        <header className="topbar cv-topbar">
          <button onClick={() => setSidebarOpen(o => !o)} aria-label="Open menu"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 6, display: 'grid', placeItems: 'center', minWidth: 40, minHeight: 40, borderRadius: 10 }}>
            <Icon name="menu" size={22} />
          </button>
          <div className="cv-brand-mark" style={{ width: 30, height: 30, borderRadius: 9 }}><Icon name="hand-heart" size={17} /></div>
          <span className="topbar-title" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>CareVista</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {getBadge('messages') > 0 && (
              <Link to="/family" aria-label="Messages" style={{ width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', position: 'relative', color: 'var(--text-secondary)' }}>
                <Icon name="message-square" size={20} />
                <span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: '50%', background: 'var(--red-600)' }} />
              </Link>
            )}
            <NotificationCentre />
            <Link to="/profile" aria-label="My profile" style={{ textDecoration: 'none' }}>
              <Avatar name={`${user?.firstName || ''} ${user?.lastName || ''}`} size={34} />
            </Link>
          </div>
        </header>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main
        className={`main-content${isDesktop && collapsed ? ' collapsed' : ''}`}
        style={{ marginLeft: mainML, width: `calc(100% - ${mainML}px)` }}
      >
        <OfflineBanner />
        <InstallPrompt />
        {migrationMsg && (
          <div role="alert" style={{
            margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, background: '#fffbeb',
            border: '1px solid #fcd34d', color: '#92400e', fontSize: 14.5, lineHeight: 1.5,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span aria-hidden style={{ fontSize: 18 }}>⚠</span>
            <span style={{ flex: 1 }}><strong>Database update needed.</strong> {migrationMsg}</span>
            <button onClick={() => setMigrationMsg(null)} aria-label="Dismiss"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#92400e', minWidth: 40, minHeight: 40 }}>✕</button>
          </div>
        )}
        <ErrorBoundary>
        <Suspense fallback={<ScreenLoading />}>
        <Routes>
          <Route path="/"               element={simple ? <SimpleHome /> : <Dashboard />} />
          <Route path="/round"          element={<CareDeck />} />
          <Route path="/shift"          element={<SimpleHandover />} />
          <Route path="/full"           element={<Dashboard />} />
          <Route path="/carer-view"     element={<CarerPreview />} />
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
          <Route path="/assessments" element={<RiskAssessments />} />
          <Route path="/assessments/fire-grab-sheet" element={<FireGrabSheet />} />
          <Route path="/home-safety" element={<HomeSafety />} />
          <Route path="/care-plan-setup" element={<CarePlanSetup />} />
          <Route path="/assessment-builder" element={<AssessmentBuilder />} />
          <Route path="/care-plans/:id/print" element={<PrintCarePlan />} />
          <Route path="/care-plans"      element={<CarePlans />} />
          <Route path="/night-sensing"   element={<NightSensing />} />
          <Route path="/about-software"  element={<AboutThisSoftware />} />
          <Route path="/appointments"    element={<Appointments />} />
          <Route path="/feedback"        element={<ComplaintsCompliments />} />
          <Route path="/dols"            element={<DolsRegister />} />
          <Route path="/mca"             element={<MentalCapacity />} />
          <Route path="/mca/:id"         element={<McaAssessment />} />
          <Route path="/supervisions"    element={<Supervisions />} />
          <Route path="/charts"          element={<MonitoringCharts />} />
          <Route path="/intake"          element={<IntakeOutput />} />
          <Route path="/something-different" element={<SomethingDifferent />} />
          <Route path="/soft-signs"      element={<SoftSignsBoard />} />
          <Route path="/pilot-evidence"  element={<PilotEvidence />} />
          <Route path="/record"          element={<RecordCare />} />
          <Route path="/resident-finance" element={<ResidentFinance />} />
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
          <Route path="/record-integrity" element={<RecordIntegrity />} />
          <Route path="/profile"        element={<Profile />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      {/* ── Phone Bottom Nav ─────────────────────────────────────── */}
      {isPhone && (
        <nav className="bottom-nav cv-bottom-nav">
          {BOTTOM_NAV.filter(item =>
              (!item.roles || item.roles.includes(role)) && !(item.hideFor && item.hideFor.includes(role))
            ).map(item => {
            const badgeCount = getBadge(item.badge);
            const isActive   = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <NavLink key={item.path} to={item.path} end={item.path === '/'} className={`bottom-nav-item${isActive ? ' active' : ''}`}>
                <span className="icon" style={{ position: 'relative', display: 'grid' }}>
                  <Icon name={navIcon(item.path)} size={22} strokeWidth={isActive ? 2.25 : 2} />
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
            <span className="icon" style={{ display: 'grid' }}><Icon name="menu" size={22} /></span>
            <span>{tr('More')}</span>
          </button>
        </nav>
      )}

    </div>
  );
}

/** Shown for the moment a screen is being fetched. Deliberately plain. */
function ScreenLoading() {
  return (
    <div role="status" aria-live="polite" style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 15 }}>
      Loading…
    </div>
  );
}
