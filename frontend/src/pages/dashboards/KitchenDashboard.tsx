// src/pages/dashboards/KitchenDashboard.tsx — real data, world-class UI
import React from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useResidents, useKitchenDashboard } from '../../hooks';
import { MetricCard, SectionCard, PageHeading } from '../../components/ui';

export default function KitchenDashboard() {
  const { user } = useAuthStore();
  const { data: residents = [] } = useResidents({ active: true });
  const { data: kitchenRaw, isLoading } = useKitchenDashboard();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const residentCount = Array.isArray(residents) ? residents.length : 0;
  const orders: any[] = Array.isArray(kitchenRaw) ? kitchenRaw : [];
  const totalOrders = orders.reduce((n, r) => n + Number(r.total_orders || 0), 0);
  const textureMod = orders.filter(r => r.texture && r.texture !== 'normal' && r.texture !== 'regular').reduce((n, r) => n + Number(r.total_orders || 0), 0);
  const byMeal: Record<string, any[]> = { breakfast: [], lunch: [], dinner: [] };
  orders.forEach(o => { (byMeal[o.meal_type] = byMeal[o.meal_type] || []).push(o); });
  const mealIcon: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };

  return (
    <div>
      <PageHeading
        greeting={`${greeting}, ${user?.firstName || ''}`} emoji="👨‍🍳"
        subtitle={`Kitchen & Catering · ${today}`}
        action={<a href="/menu-choices" style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Menu choices →</a>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <MetricCard icon="👥" label="Residents to cater" value={residentCount} sub="active residents" />
        <MetricCard icon="🍽️" label="Meal orders today" value={totalOrders} sub="across all meals" subTone="accent" />
        <MetricCard icon="🥣" label="Texture-modified" value={textureMod} sub="dysphagia-safe meals" subTone="danger" />
        <MetricCard icon="📋" label="Menu items ordered" value={orders.length} sub="distinct dishes" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {(['breakfast', 'lunch', 'dinner'] as const).map(meal => (
          <SectionCard key={meal} title={`${mealIcon[meal]} ${meal.charAt(0).toUpperCase() + meal.slice(1)}`}>
            {isLoading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}
            {!isLoading && (byMeal[meal] || []).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No orders recorded.</div>}
            {(byMeal[meal] || []).map((o, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-primary)' }}>{o.option_name}{o.texture && o.texture !== 'normal' ? <span style={{ color: 'var(--danger)' }}> ({o.texture})</span> : null}</span>
                <strong style={{ color: 'var(--primary)' }}>{o.total_orders}</strong>
              </div>
            ))}
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
