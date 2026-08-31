import React from 'react';
import { useLang } from '../i18n';
import { PrintHeader, PrintButton } from '../components/PrintHeader';

// The regulatory statement, visible inside the product.
//
// Classification under UK MDR 2002 turns on the stated intended purpose. Keeping
// that statement where staff, a manager, an inspector and an assessor can all
// read it is part of holding the position — a claim made only in a filing
// drawer is worth less than one the product itself displays.

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="card" style={{ marginBottom: 14 }}>
    <div className="card-header"><span className="card-title">{title}</span></div>
    <div className="card-body" style={{ lineHeight: 1.6 }}>{children}</div>
  </div>
);

const Item = ({ children }: { children: React.ReactNode }) => (
  <li style={{ marginBottom: 6 }}>{children}</li>
);

export default function AboutThisSoftware() {
  const { t: tr } = useLang();
  return (
    <div>
      <PrintHeader title="About this software — statement of intended purpose" />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{tr('About This Software')}</h1>
          <p className="page-subtitle">
            What CareVista is for, what it does not do, and why. Version 1.0 · August 2026.
          </p>
        </div>
        <PrintButton label="Print statement" />
      </div>

      <Section title="What this software is for">
        <p style={{ marginTop: 0 }}>
          CareVista is a record-keeping and workflow system for adult residential care services.
          It records the care that has been delivered, displays information that has already been
          recorded, and helps a service organise and evidence its own work.
        </p>
        <p style={{ marginBottom: 0 }}>
          It is for use by care staff, nurses and managers employed by a registered care provider.
        </p>
      </Section>

      <Section title="What it does not do">
        <p style={{ marginTop: 0 }}>CareVista is not intended to:</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <Item>diagnose, prevent, monitor, treat or alleviate disease;</Item>
          <Item>predict a future clinical event;</Item>
          <Item>recommend, calculate or alter a medicine, dose or treatment;</Item>
          <Item>replace, override or automate clinical judgement;</Item>
          <Item>trigger any clinical action without a qualified person deciding to take it.</Item>
        </ul>
        <p style={{ marginBottom: 0, marginTop: 12, fontWeight: 500 }}>
          No output of this system is a clinical decision. Everything it shows is information
          about what has already been recorded, for a qualified person to interpret.
        </p>
      </Section>

      <Section title="How that is kept true">
        <p style={{ marginTop: 0 }}>
          <strong>Calculations show their working.</strong> NEWS2, MUST and Waterlow return every
          parameter, its value and its sub-score, with the source of the tool named, so a nurse can
          check the result line by line against the published chart.
        </p>
        <p>
          <strong>Reference information cites its source.</strong> Every medication interaction
          shown carries its source and a reminder to check the current BNF. The system reports a
          known interaction; it does not decide anything.
        </p>
        <p>
          <strong>Risk indicators report the past, not the future.</strong> They weigh facts already
          in the record and show the factors and weights behind any figure.
        </p>
        <p>
          <strong>Generated text is a draft, never a record.</strong> Nothing written with AI
          assistance enters a clinical record until a qualified person has read it, edited it where
          necessary and signed it. The system records who signed.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Sensor output is observation, not alarm.</strong> Ambient sensing reports what was
          observed, with the evidence and a confidence. It does not diagnose a fall; it reports an
          impact and asks someone to check.
        </p>
      </Section>

      <Section title="Regulatory position">
        <p style={{ marginTop: 0 }}>
          On the basis of the intended purpose above, CareVista is considered not to be a medical
          device under the UK Medical Devices Regulations 2002: an electronic record replacing a
          paper care file does not have a medical purpose, and software providing reference
          information for a professional to apply their own knowledge does not either.
        </p>
        <p style={{ margin: 0, padding: 12, background: 'var(--surface-2)', borderRadius: 8, fontSize: 14 }}>
          This position is held by the manufacturer and has not been confirmed by the MHRA.
          A borderline determination will be sought before the product is used with real resident
          data at scale.
        </p>
      </Section>

      <Section title="Reporting a problem">
        <p style={{ marginTop: 0, marginBottom: 0 }}>
          If this software shows something that is wrong, or that could affect a resident's safety,
          report it to your manager and to CareVista at rsmsurrey@gmail.com. Safety reports are
          investigated and answered, and the outcome is recorded.
        </p>
      </Section>
    </div>
  );
}
