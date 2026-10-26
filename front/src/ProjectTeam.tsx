import './ProjectTeam.css'

const repository = 'https://github.com/matheusfilipebb/hackathon-kanastra'
const team = [
  { name: 'Samuel Victor Alventino Silva', username: 'samuel-0v', initials: 'SV' },
  { name: 'Matheus Filipe', username: 'matheusfilipebb', initials: 'MF' },
  { name: 'David de Oliveira', username: 'ogDavid-SI', initials: 'DO' },
]

export default function ProjectTeam() {
  return <section className="project-team" id="equipe" aria-labelledby="project-team-title">
    <div className="project-team-heading"><div><p className="eyebrow">EQUIPE RESPONSÁVEL</p><h2 id="project-team-title">Quem constrói o Antecipe</h2><p>Conheça a equipe e acompanhe o desenvolvimento do projeto no GitHub.</p></div><a className="project-repository" href={repository} target="_blank" rel="noopener noreferrer" aria-label="Ver projeto no GitHub (abre em nova aba)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1 0-4h13M8 7h7M8 11h5" /></svg>Ver projeto no GitHub <span aria-hidden="true">↗</span></a></div>
    <ul className="project-team-grid">{team.map(member => <li key={member.username}><a href={`https://github.com/${member.username}`} target="_blank" rel="noopener noreferrer" aria-label={`GitHub de ${member.name} (abre em nova aba)`}><span className="project-team-avatar" aria-hidden="true">{member.initials}</span><span className="project-team-person"><strong>{member.name}</strong><span>@{member.username}</span></span><span className="project-team-arrow" aria-hidden="true">↗</span></a></li>)}</ul>
  </section>
}
