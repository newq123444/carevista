import React, { useState } from 'react';
import { useLang } from '../i18n';
import { RecordView } from '../components/ui';
import { useMenuOptions, useCreateMenuOption, useMenuDietaryProfile, useUpdateMenuDietaryProfile, useSubmitMenuChoice, useMenuKitchenDashboard, useResidentMenuChoices, useResidents } from '../hooks';

export default function MenuChoiceSystem() {
  const { t: tr } = useLang();
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'menu' | 'dietary' | 'kitchen' | 'history'>('menu');
  const [showOptionForm, setShowOptionForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: options = [] } = useMenuOptions();
  const { data: dietaryProfile } = useMenuDietaryProfile(selectedResident);
  const { data: kitchenData } = useMenuKitchenDashboard();
  const { data: residentChoices = [] } = useResidentMenuChoices(selectedResident);

  const createOptionMutation = useCreateMenuOption();
  const updateDietaryMutation = useUpdateMenuDietaryProfile();
  const submitChoiceMutation = useSubmitMenuChoice();

  const [optionForm, setOptionForm] = useState({ meal_type: 'lunch', name: '', description: '', available_date: new Date().toISOString().split('T')[0] });
  const [dietaryForm, setDietaryForm] = useState({ texture_requirement: 'normal', cultural_needs: '', allergies: '', notes: '' });

  const residentList = Array.isArray(residents) ? residents : [];
  const optionList = Array.isArray(options) ? options : [];
  const choiceList = Array.isArray(residentChoices) ? residentChoices : [];

  const handleCreateOption = (e: React.FormEvent) => {
    e.preventDefault();
    createOptionMutation.mutate(optionForm, {
      onSuccess: () => { setShowOptionForm(false); setOptionForm({ meal_type: 'lunch', name: '', description: '', available_date: new Date().toISOString().split('T')[0] }); }
    });
  };

  const handleSubmitChoice = (optionId: string, mealType: string) => {
    if (!selectedResident) return;
    submitChoiceMutation.mutate({ resident_id: selectedResident, menu_option_id: optionId, meal_type: mealType, meal_date: new Date().toISOString().split('T')[0] });
  };

  const handleUpdateDietary = (e: React.FormEvent) => {
    e.preventDefault();
    updateDietaryMutation.mutate({ residentId: selectedResident, data: { texture_requirement: dietaryForm.texture_requirement, cultural_needs: dietaryForm.cultural_needs ? dietaryForm.cultural_needs.split(',').map(s => s.trim()) : [], allergies: dietaryForm.allergies ? dietaryForm.allergies.split(',').map(s => s.trim()) : [], notes: dietaryForm.notes } });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Menu Choice System</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Tablet-friendly meal selection with dietary profiles and kitchen dashboard.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Choose a resident...</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['menu', 'dietary', 'kitchen', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab === 'dietary' ? 'Dietary Profile' : tab === 'kitchen' ? 'Kitchen Dashboard' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'menu' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Available Meals</h2>
            <button onClick={() => setShowOptionForm(!showOptionForm)} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>+ Add Option</button>
          </div>
          {showOptionForm && (
            <form onSubmit={handleCreateOption} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Meal Type</label>
                  <select value={optionForm.meal_type} onChange={e => setOptionForm(f => ({ ...f, meal_type: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="breakfast">{tr('Breakfast')}</option>
                    <option value="lunch">{tr('Lunch')}</option>
                    <option value="dinner">{tr('Dinner')}</option>
                    <option value="snack">{tr('Snack')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Name</label>
                  <input type="text" value={optionForm.name} onChange={e => setOptionForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Date')}</label>
                  <input type="date" value={optionForm.available_date} onChange={e => setOptionForm(f => ({ ...f, available_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Description')}</label>
                <input type="text" value={optionForm.description} onChange={e => setOptionForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Create Option</button>
            </form>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {optionList.map((opt: any) => (
              <div key={opt.id} style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => handleSubmitChoice(opt.id, opt.meal_type)}>
                <div style={{ width: '100%', height: 80, background: '#f3f4f6', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  {opt.meal_type === 'breakfast' ? '🍳' : opt.meal_type === 'lunch' ? '🥗' : opt.meal_type === 'dinner' ? '🍽️' : '🍎'}
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>{opt.name}</div>
                {opt.description && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 8 }}>{opt.description}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#e0e7ff', borderRadius: 12, color: '#4338ca' }}>{opt.meal_type}</span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{opt.available_date}</span>
                </div>
              </div>
            ))}
          </div>
          {optionList.length === 0 && <p style={{ color: '#6b7280' }}>No menu options available. Add some above.</p>}
        </div>
      )}

      {activeTab === 'dietary' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Dietary Profile</h2>
          {selectedResident ? (
            <form onSubmit={handleUpdateDietary} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Texture Requirement</label>
                  <select value={dietaryForm.texture_requirement} onChange={e => setDietaryForm(f => ({ ...f, texture_requirement: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="normal">Normal</option>
                    <option value="soft">Soft</option>
                    <option value="pureed">Pureed</option>
                    <option value="liquid">Liquid</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Cultural Needs (comma-separated)</label>
                  <input type="text" value={dietaryForm.cultural_needs} onChange={e => setDietaryForm(f => ({ ...f, cultural_needs: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. halal, kosher" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Allergies (comma-separated)</label>
                  <input type="text" value={dietaryForm.allergies} onChange={e => setDietaryForm(f => ({ ...f, allergies: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. nuts, dairy" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Notes')}</label>
                  <input type="text" value={dietaryForm.notes} onChange={e => setDietaryForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Update Profile</button>
              {dietaryProfile && (
                <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 8 }}>Current Profile:</div>
                  <RecordView data={dietaryProfile} empty="No dietary profile recorded for this resident yet." />
                </div>
              )}
            </form>
          ) : <p style={{ color: '#6b7280' }}>Select a resident to view/edit dietary profile.</p>}
        </div>
      )}

      {activeTab === 'kitchen' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Kitchen Dashboard</h2>
          {kitchenData ? (
            <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 12 }}>Aggregated meal choices for tomorrow:</p>
              <RecordView data={kitchenData} empty="No kitchen summary for today yet." />
            </div>
          ) : <p style={{ color: '#6b7280' }}>No kitchen dashboard data available yet.</p>}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Choice History</h2>
          {choiceList.map((c: any) => (
            <div key={c.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 500 }}>{c.option_name || 'Menu item'}</span>
                <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#6b7280' }}>{c.meal_type} - {c.meal_date}</span>
              </div>
            </div>
          ))}
          {choiceList.length === 0 && <p style={{ color: '#6b7280' }}>No choices recorded yet.</p>}
        </div>
      )}
    </div>
  );
}
