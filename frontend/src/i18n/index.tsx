// src/i18n/index.tsx — lightweight, dependency-free internationalisation.
// t(s) returns the translation for the current language, or the English
// string itself if no translation exists (so nothing ever breaks).
import React, { createContext, useContext, useState, useCallback } from 'react';

export type Lang = 'en' | 'pl' | 'ro' | 'pt' | 'es' | 'hi';
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polski' },
  { code: 'ro', label: 'Română' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
];

type Dict = Record<string, string>;
const T: Record<Exclude<Lang, 'en'>, Dict> = {
  pl: {
    'Overview':'Przegląd','Care':'Opieka','Team':'Zespół','Governance':'Zarządzanie','Quality of Life':'Jakość życia','Communications':'Komunikacja','Finance':'Finanse','Tools':'Narzędzia',
    'Dashboard':'Pulpit','Home':'Start','Residents':'Mieszkańcy','Care Notes':'Notatki opieki','Medications':'Leki','Meds':'Leki','Incidents':'Zdarzenia','Activities':'Zajęcia','Task Board':'Zadania','Housekeeping':'Sprzątanie','Wellbeing Hub':'Dobrostan','Family Portal':'Portal rodziny','Staff':'Personel','Training':'Szkolenia','Rota':'Grafik','Billing':'Rozliczenia','Visitors':'Goście','Menu Choices':'Menu','Room Turnover':'Przygotowanie pokoi','Policies':'Zasady','Audit Log':'Dziennik audytu','Notes':'Notatki',
    'Save':'Zapisz','Cancel':'Anuluj','Add':'Dodaj','Edit':'Edytuj','Delete':'Usuń','Search':'Szukaj','Logout':'Wyloguj','Settings':'Ustawienia','Language':'Język','Loading':'Ładowanie','Yes':'Tak','No':'Nie','Close':'Zamknij','Submit':'Wyślij','Confirm':'Potwierdź',
    'Sign in':'Zaloguj się','Email address':'Adres e-mail','Password':'Hasło','Care Home Management':'Zarządzanie domem opieki','Quick Demo Login':'Szybkie logowanie demo','Good morning':'Dzień dobry','Good afternoon':'Dzień dobry','Good evening':'Dobry wieczór',
  },
  ro: {
    'Overview':'Prezentare','Care':'Îngrijire','Team':'Echipă','Governance':'Guvernanță','Quality of Life':'Calitatea vieții','Communications':'Comunicări','Finance':'Finanțe','Tools':'Instrumente',
    'Dashboard':'Panou','Home':'Acasă','Residents':'Rezidenți','Care Notes':'Note de îngrijire','Medications':'Medicamente','Meds':'Medicamente','Incidents':'Incidente','Activities':'Activități','Task Board':'Sarcini','Housekeeping':'Curățenie','Wellbeing Hub':'Bunăstare','Family Portal':'Portal familie','Staff':'Personal','Training':'Instruire','Rota':'Program','Billing':'Facturare','Visitors':'Vizitatori','Menu Choices':'Meniu','Room Turnover':'Pregătirea camerelor','Policies':'Politici','Audit Log':'Jurnal de audit','Notes':'Note',
    'Save':'Salvează','Cancel':'Anulează','Add':'Adaugă','Edit':'Editează','Delete':'Șterge','Search':'Caută','Logout':'Deconectare','Settings':'Setări','Language':'Limbă','Loading':'Se încarcă','Yes':'Da','No':'Nu','Close':'Închide','Submit':'Trimite','Confirm':'Confirmă',
    'Sign in':'Autentificare','Email address':'Adresă de e-mail','Password':'Parolă','Care Home Management':'Administrarea căminului','Quick Demo Login':'Autentificare demo rapidă','Good morning':'Bună dimineața','Good afternoon':'Bună ziua','Good evening':'Bună seara',
  },
  pt: {
    'Overview':'Visão geral','Care':'Cuidados','Team':'Equipa','Governance':'Governação','Quality of Life':'Qualidade de vida','Communications':'Comunicações','Finance':'Finanças','Tools':'Ferramentas',
    'Dashboard':'Painel','Home':'Início','Residents':'Residentes','Care Notes':'Notas de cuidado','Medications':'Medicação','Meds':'Medicação','Incidents':'Incidentes','Activities':'Atividades','Task Board':'Tarefas','Housekeeping':'Limpeza','Wellbeing Hub':'Bem-estar','Family Portal':'Portal da família','Staff':'Pessoal','Training':'Formação','Rota':'Escala','Billing':'Faturação','Visitors':'Visitantes','Menu Choices':'Menu','Room Turnover':'Preparação de quartos','Policies':'Políticas','Audit Log':'Registo de auditoria','Notes':'Notas',
    'Save':'Guardar','Cancel':'Cancelar','Add':'Adicionar','Edit':'Editar','Delete':'Eliminar','Search':'Pesquisar','Logout':'Terminar sessão','Settings':'Definições','Language':'Idioma','Loading':'A carregar','Yes':'Sim','No':'Não','Close':'Fechar','Submit':'Enviar','Confirm':'Confirmar',
    'Sign in':'Entrar','Email address':'Endereço de e-mail','Password':'Palavra-passe','Care Home Management':'Gestão de lares','Quick Demo Login':'Acesso de demonstração','Good morning':'Bom dia','Good afternoon':'Boa tarde','Good evening':'Boa noite',
  },
  es: {
    'Overview':'Resumen','Care':'Cuidados','Team':'Equipo','Governance':'Gobernanza','Quality of Life':'Calidad de vida','Communications':'Comunicaciones','Finance':'Finanzas','Tools':'Herramientas',
    'Dashboard':'Panel','Home':'Inicio','Residents':'Residentes','Care Notes':'Notas de cuidado','Medications':'Medicación','Meds':'Medicación','Incidents':'Incidentes','Activities':'Actividades','Task Board':'Tareas','Housekeeping':'Limpieza','Wellbeing Hub':'Bienestar','Family Portal':'Portal de familias','Staff':'Personal','Training':'Formación','Rota':'Turnos','Billing':'Facturación','Visitors':'Visitantes','Menu Choices':'Menú','Room Turnover':'Preparación de habitaciones','Policies':'Políticas','Audit Log':'Registro de auditoría','Notes':'Notas',
    'Save':'Guardar','Cancel':'Cancelar','Add':'Añadir','Edit':'Editar','Delete':'Eliminar','Search':'Buscar','Logout':'Cerrar sesión','Settings':'Ajustes','Language':'Idioma','Loading':'Cargando','Yes':'Sí','No':'No','Close':'Cerrar','Submit':'Enviar','Confirm':'Confirmar',
    'Sign in':'Iniciar sesión','Email address':'Correo electrónico','Password':'Contraseña','Care Home Management':'Gestión de residencias','Quick Demo Login':'Acceso de demostración','Good morning':'Buenos días','Good afternoon':'Buenas tardes','Good evening':'Buenas noches',
  },
  hi: {
    'Overview':'अवलोकन','Care':'देखभाल','Team':'टीम','Governance':'प्रशासन','Quality of Life':'जीवन की गुणवत्ता','Communications':'संचार','Finance':'वित्त','Tools':'उपकरण',
    'Dashboard':'डैशबोर्ड','Home':'होम','Residents':'निवासी','Care Notes':'देखभाल नोट्स','Medications':'दवाइयाँ','Meds':'दवाइयाँ','Incidents':'घटनाएँ','Activities':'गतिविधियाँ','Task Board':'कार्य','Housekeeping':'साफ-सफाई','Wellbeing Hub':'कल्याण','Family Portal':'परिवार पोर्टल','Staff':'स्टाफ','Training':'प्रशिक्षण','Rota':'ड्यूटी सूची','Billing':'बिलिंग','Visitors':'आगंतुक','Menu Choices':'मेन्यू','Room Turnover':'कमरे की तैयारी','Policies':'नीतियाँ','Audit Log':'ऑडिट लॉग','Notes':'नोट्स',
    'Save':'सहेजें','Cancel':'रद्द करें','Add':'जोड़ें','Edit':'संपादित करें','Delete':'हटाएँ','Search':'खोजें','Logout':'लॉग आउट','Settings':'सेटिंग्स','Language':'भाषा','Loading':'लोड हो रहा है','Yes':'हाँ','No':'नहीं','Close':'बंद करें','Submit':'जमा करें','Confirm':'पुष्टि करें',
    'Sign in':'साइन इन','Email address':'ईमेल पता','Password':'पासवर्ड','Care Home Management':'केयर होम प्रबंधन','Quick Demo Login':'त्वरित डेमो लॉगिन','Good morning':'सुप्रभात','Good afternoon':'नमस्कार','Good evening':'शुभ संध्या',
  },
};

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string; }
const LanguageContext = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('cv_lang') as Lang) || 'en');
  const setLang = useCallback((l: Lang) => { localStorage.setItem('cv_lang', l); setLangState(l); }, []);
  const t = useCallback((s: string) => (lang === 'en' ? s : (T[lang] && T[lang][s]) || s), [lang]);
  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}
export function useLang() { return useContext(LanguageContext); }

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useLang();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {!compact && <span style={{ fontSize: 16 }} title={t('Language')}>🌐</span>}
      <select
        aria-label={t('Language')}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        style={{ fontSize: 13, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
      >
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </div>
  );
}
