// src/pages/Dashboard.tsx — Role-router: shows the right dashboard per user
import React from 'react';
import { useAuthStore } from '../store/auth.store';
import ManagerDashboard  from './dashboards/ManagerDashboard';
import NurseDashboard    from './dashboards/NurseDashboard';
import CarerDashboard    from './dashboards/CarerDashboard';
import FinanceDashboard  from './dashboards/FinanceDashboard';
import CleaningDashboard from './dashboards/CleaningDashboard';
import KitchenDashboard  from './dashboards/KitchenDashboard';
import MaintenanceDashboard from './dashboards/MaintenanceDashboard';

export default function Dashboard() {
  const { user } = useAuthStore();
  const role = user?.role;

  if (role === 'home_manager' || role === 'deputy_manager' || role === 'super_admin' || role === 'group_admin') {
    return <ManagerDashboard />;
  }
  if (role === 'registered_nurse') {
    return <NurseDashboard />;
  }
  // carers, senior carers AND activities all get the carer dashboard
  if (role === 'carer' || role === 'senior_carer' || role === 'activities') {
    return <CarerDashboard />;
  }
  if (role === 'finance' || role === 'admin') {
    return <FinanceDashboard />;
  }
  if (role === 'cleaning') {
    return <CleaningDashboard />;
  }
  if (role === 'kitchen') {
    return <KitchenDashboard />;
  }
  if (role === 'maintenance') {
    return <MaintenanceDashboard />;
  }
  // fallback — show manager dashboard
  return <ManagerDashboard />;
}
