import type { ReactNode } from "react";

export function EnterpriseStyles() {
  return <style>{`
    .orb-erp{display:grid;gap:24px;min-inline-size:0;color:var(--orb-color-on-surface)}
    .orb-erp>.orb-page-header{margin:0;padding-block-end:4px;border-block-end:1px solid var(--orb-color-outline-variant)}
    .orb-erp .orb-eyebrow{display:flex;align-items:center;gap:8px;color:var(--orb-color-primary);font:var(--orb-type-label);letter-spacing:.04em;text-transform:uppercase;margin-block-end:8px}
    .orb-erp .orb-page-header h1{font:var(--orb-type-display);font-size:clamp(1.8rem,3vw,2.55rem);margin:0 0 8px}
    .orb-erp .orb-page-header p{max-inline-size:72ch}
    .orb-erp .orb-header-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .orb-erp .orb-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .orb-erp .orb-kpi{background:var(--orb-color-surface-bright);border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;box-shadow:var(--orb-elevation-1);min-inline-size:0}
    .orb-erp .orb-kpi span{display:block;color:var(--orb-color-on-surface-variant);font-size:.76rem;font-weight:700;margin-block-end:8px}
    .orb-erp .orb-kpi strong{display:block;font-size:1.25rem;line-height:1.25;overflow-wrap:anywhere}
    .orb-erp .orb-kpi small{display:block;color:var(--orb-color-on-surface-variant);margin-block-start:6px}
    .orb-erp>section[role=region],.orb-erp>div>section[role=region],.orb-erp section[role=region]{background:var(--orb-color-surface-bright)!important;border:1px solid var(--orb-color-outline-variant)!important;border-radius:18px!important;box-shadow:var(--orb-elevation-1);padding:22px!important;min-inline-size:0}
    .orb-erp section[role=region]>h2:first-child,.orb-erp section[role=region]>header h2{margin-block-end:6px}
    .orb-erp section[role=region]>h2:first-child+p,.orb-erp section[role=region]>header p{color:var(--orb-color-on-surface-variant)}
    .orb-erp form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px!important;margin-block-start:18px}
    .orb-erp form>button,.orb-erp form>div,.orb-erp form>p{align-self:end}
    .orb-erp button{background:var(--orb-color-primary-container);border:0;border-radius:999px;color:var(--orb-color-on-primary-container);font-weight:700;padding-inline:18px;transition:background .12s,box-shadow .12s}
    .orb-erp button:hover:not(:disabled){background:#c2d9fc;box-shadow:var(--orb-elevation-1)}
    .orb-erp button:disabled{cursor:not-allowed;filter:grayscale(.45);opacity:.55}
    .orb-erp button[data-operation-id*="submit"],.orb-erp button[data-operation-id*="record"],.orb-erp button[data-operation-id*="create"],.orb-erp button[data-operation-id*="allocate"],.orb-erp button[data-operation-id="decideFixedApproval"]:first-child{background:var(--orb-color-primary);color:var(--orb-color-on-primary)}
    .orb-erp button[data-operation-id*="reverse"],.orb-erp button[data-operation-id*="cancel"],.orb-erp button[data-operation-id*="revoke"],.orb-erp button[data-operation-id="decideFixedApproval"]:last-child{background:var(--orb-color-error-container);color:var(--orb-color-error)}
    .orb-erp [role=status],.orb-erp [role=alert],.orb-erp [role=note]{border:0!important;border-inline-start:4px solid var(--orb-color-primary)!important;border-radius:12px!important;background:var(--orb-color-primary-container)!important;color:var(--orb-color-on-primary-container);padding:14px 16px!important}
    .orb-erp [role=alert]{border-inline-start-color:var(--orb-color-error)!important;background:var(--orb-color-error-container)!important;color:var(--orb-color-error)}
    .orb-erp dl{margin:14px 0}.orb-erp dt{color:var(--orb-color-on-surface-variant);font-size:.75rem;font-weight:700}.orb-erp dd{font-weight:700;margin-inline:0;margin-block-start:4px}
    .orb-erp table{background:var(--orb-color-surface-bright)}
    .orb-erp table button{white-space:nowrap}.orb-erp th,.orb-erp td{vertical-align:middle}
    .orb-erp .orb-tablist{display:flex;gap:6px;overflow-x:auto;padding:4px;background:var(--orb-color-surface-container);border-radius:999px;inline-size:max-content;max-inline-size:100%}
    .orb-erp .orb-tablist button{background:transparent;color:var(--orb-color-on-surface-variant);white-space:nowrap}
    .orb-erp .orb-tablist button[aria-selected=true]{background:var(--orb-color-surface-bright);color:var(--orb-color-primary);box-shadow:var(--orb-elevation-1)}
    .orb-erp .orb-split{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.75fr);gap:20px;align-items:start}
    .orb-erp .orb-callout{display:flex;gap:12px;align-items:flex-start;background:var(--orb-color-warning-container);color:var(--orb-color-warning);border-radius:14px;padding:16px}
    .orb-erp .orb-callout strong{display:block}.orb-erp .orb-callout p{margin:3px 0 0}
    .orb-erp .orb-actions{display:flex;gap:8px;flex-wrap:wrap}
    .orb-erp code,.orb-erp bdi{unicode-bidi:isolate}
    .orb-signin{background:radial-gradient(circle at 15% 15%,#d9e9ff 0,transparent 38%),linear-gradient(145deg,#f8fafd,#eef3f8);min-block-size:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,480px);align-items:stretch}
    .orb-signin-brand{display:flex;flex-direction:column;justify-content:center;padding:clamp(32px,8vw,112px);background:linear-gradient(140deg,#082e6f,#0b57d0);color:white}
    .orb-signin-brand-mark{display:grid;place-items:center;background:white;color:#0b57d0;border-radius:20px;font-size:2rem;font-weight:900;inline-size:72px;block-size:72px;margin-block-end:30px;box-shadow:0 16px 50px #001b4480}
    .orb-signin-brand h1{font:var(--orb-type-display);font-size:clamp(2rem,4vw,3.5rem);max-inline-size:12ch}.orb-signin-brand p{font-size:1.05rem;max-inline-size:48ch;opacity:.84}
    .orb-signin-panel{display:grid;align-content:center;padding:clamp(24px,6vw,72px)}
    .orb-signin-card{background:white;border:1px solid var(--orb-color-outline-variant);border-radius:24px;box-shadow:var(--orb-elevation-2);padding:clamp(24px,4vw,40px)}
    .orb-signin-card form{display:grid;gap:18px!important}.orb-signin-card button{inline-size:100%;margin-block-start:6px}
    @media(max-width:900px){.orb-erp .orb-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.orb-erp .orb-split{grid-template-columns:1fr}.orb-signin{grid-template-columns:1fr}.orb-signin-brand{display:none}}
    @media(max-width:600px){.orb-erp{gap:18px}.orb-erp .orb-summary-grid{grid-template-columns:1fr 1fr;gap:8px}.orb-erp .orb-kpi{padding:13px}.orb-erp .orb-kpi strong{font-size:1rem}.orb-erp form{grid-template-columns:1fr}.orb-erp section[role=region]{padding:16px!important}.orb-erp .orb-page-header{gap:14px}.orb-erp .orb-page-header h1{font-size:1.7rem}.orb-signin-panel{padding:16px}.orb-signin-card{padding:24px 18px}}
    @media(max-width:340px){.orb-erp .orb-summary-grid{grid-template-columns:1fr}.orb-erp .orb-actions button{inline-size:100%}}
  `}</style>;
}

export function ErpPageHeader({ eyebrow, title, description, meta, titleId }: Readonly<{ eyebrow: ReactNode; title: ReactNode; description?: ReactNode; meta?: ReactNode; titleId?: string }>) {
  return <header className="orb-page-header"><div><div className="orb-eyebrow">{eyebrow}</div><h1 id={titleId}>{title}</h1>{description && <p>{description}</p>}</div>{meta && <div className="orb-header-actions">{meta}</div>}</header>;
}

export function Kpi({ label, value, detail }: Readonly<{ label: ReactNode; value: ReactNode; detail?: ReactNode }>) {
  return <div className="orb-kpi"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}
