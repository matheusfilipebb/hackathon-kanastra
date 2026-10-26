import './AnalysisNavigation.css'

type View = 'notas' | 'dashboard'

function NavigationIcon({ name }: { name: View | 'new' }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'notas' ? <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></> : name === 'dashboard' ? <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="18" width="7" height="3" rx="1" /></> : <path d="M12 5v14M5 12h14" />}
  </svg>
}

export default function AnalysisNavigation({ activeView, total, onViewChange, onNewAnalysis }: { activeView: View; total: number; onViewChange: (view: View) => void; onNewAnalysis: () => void }) {
  return <div className="analysis-navigation-layer">
    <nav className="analysis-dock" aria-label="Visualização dos resultados">
      <button type="button" className="dock-button" aria-label="Notas" aria-pressed={activeView === 'notas'} aria-controls="invoices-view" onClick={() => onViewChange('notas')}>
        <span className="dock-icon"><NavigationIcon name="notas" /></span><span className="dock-label">Notas <small>{total.toLocaleString('pt-BR')}</small></span>
      </button>
      <button type="button" className="dock-button" aria-label="Dashboard" aria-pressed={activeView === 'dashboard'} aria-controls="dashboard-view" onClick={() => onViewChange('dashboard')}>
        <span className="dock-icon"><NavigationIcon name="dashboard" /></span><span className="dock-label">Dashboard</span>
      </button>
    </nav>
    <div className="analysis-dock-new"><button type="button" className="dock-button dock-button-new" aria-label="Nova análise" onClick={onNewAnalysis}>
      <span className="dock-icon"><NavigationIcon name="new" /></span><span className="dock-label">Nova análise</span>
    </button></div>
  </div>
}
