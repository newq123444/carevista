// Which icon each screen uses in the menu and the bottom bar. Kept in one
// place so the same screen never has two pictures.
import type { IconName } from '../components/Icon';

const BY_PATH: Record<string, IconName> = {
  '/': 'layout-dashboard', '/residents': 'users', '/record': 'hand-heart', '/round': 'hand-heart', '/tasks': 'list-checks',
  '/care-plans': 'clipboard-list', '/care-notes': 'notebook-pen', '/intake': 'droplets', '/charts': 'chart-column',
  '/soft-signs': 'siren', '/something-different': 'siren', '/appointments': 'calendar-days', '/emar': 'pill',
  '/incidents': 'triangle-alert', '/activities': 'smile', '/wellbeing': 'heart-pulse', '/news2': 'activity',
  '/wounds': 'bandage', '/continence': 'droplets', '/room-turnover': 'bed', '/housekeeping': 'bed',
  '/diabetes': 'thermometer', '/palliative-care': 'hand-heart', '/risk-assessments': 'clipboard-check', '/home-safety': 'shield-check', '/care-plan-setup': 'settings', '/assessment-builder': 'list-checks',
  '/dols': 'lock', '/carer-view': 'user-round', '/mca': 'brain', '/med-interactions': 'pill',
  '/schedule': 'calendar-days', '/staff': 'users', '/training': 'graduation-cap', '/competency-matrix': 'clipboard-check',
  '/supervisions': 'message-square', '/sickness-absence': 'clock', '/compliance': 'shield-check',
  '/feedback': 'message-square', '/policies': 'book-open', '/infections': 'thermometer', '/fire-log': 'siren',
  '/visitor-sign-in': 'user-round', '/menu-choices': 'utensils', '/family': 'message-square', '/billing': 'wallet',
  '/resident-finance': 'wallet', '/cd-register': 'pill', '/outcomes': 'chart-column', '/sbar-handover': 'file-text',
  '/regulatory': 'file-text', '/consent-manager': 'clipboard-check', '/audit-log': 'history',
  '/record-integrity': 'shield-check', '/report-builder': 'file-text', '/pilot-evidence': 'chart-column',
  '/care-tasks': 'list-checks', '/menu-admin': 'utensils', '/housekeeping-admin': 'bed', '/settings': 'settings',
  '/family-access': 'users', '/about-software': 'info', '/profile': 'user-round', '/shift': 'history',
};

export function navIcon(path: string): IconName {
  return BY_PATH[path] || 'flask-conical';
}
