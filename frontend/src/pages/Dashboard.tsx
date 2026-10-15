// src/pages/Dashboard.tsx — Role-router: shows the right dashboard per user
import React, { lazy, Suspense } from 'react';
import { useAuthStore } from '../store/auth.store';

// Each person only ever sees their own role's dashboard, so only that one is fetched.
const ManagerDashboard = lazy(() => import('./dashboards/ManagerDashboard'));
const NurseDashboard = lazy(() => import('./dashboards/NurseDashboard'));
const CarerDashboard = lazy(() => import('./dashboards/CarerDashboard'));
const FinanceDashboard = lazy(() => import('./dashboards/FinanceDashboard'));
const CleaningDashboard = lazy(() => import('./dashboards/CleaningDashboard'));
const KitchenDashboard = lazy(() => import('./dashboards/KitchenDashboard'));
const MaintenanceDashboard = lazy(() => import('./dashboards/MaintenanceDashboard'));
export default function Dashboard() {
  const { user } = useAuthStore();
  const role = user?.role;

  if (role === 'home_manager' || role === 'deputy_manager' || role === 'super_admin' || role === 'group_admin') {
    return <Suspense fallback={null}><ManagerDashboard /></Suspense>;
  }
  if (role === 'registered_nurse') {
    return <Suspense fallback={null}><NurseDashboard /></Suspense>;
  }
  // carers, senior carers AND activities all get the carer dashboard
  if (role === 'carer' || role === 'senior_carer' || role === 'activities') {
    return <Suspense fallback={null}><CarerDashboard /></Suspense>;
  }
  if (role === 'finance' || role === 'admin') {
    return <Suspense fallback={null}><FinanceDashboard /></Suspense>;
  }
  if (role === 'cleaning') {
    return <Suspense fallback={null}><CleaningDashboard /></Suspense>;
  }
  if (role === 'kitchen') {
    return <Suspense fallback={null}><KitchenDashboard /></Suspense>;
  }
  if (role === 'maintenance') {
    return <Suspense fallback={null}><MaintenanceDashboard /></Suspense>;
  }
  // fallback — show manager dashboard
  return <Suspense fallback={null}><ManagerDashboard /></Suspense>;
}
