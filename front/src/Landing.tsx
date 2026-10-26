import { useEffect, useRef, useState } from 'react'

const HERO_VIDEO = `${import.meta.env.BASE_URL}videos/kanastra-hero.mp4`
const HERO_POSTER = `${import.meta.env.BASE_URL}videos/kanastra-hero-poster.webp`

function HeroBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', onChange)
    return () => preference.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const background = backgroundRef.current
    const hero = background?.parentElement
    if (!background || !hero) return
    let frame = 0
    const update = () => {
      frame = 0
      const bounds = hero.getBoundingClientRect()
      const progress = Math.min(1, Math.max(0, -bounds.top / Math.max(1, bounds.height * 0.8)))
      const opacity = reducedMotion ? 1 : 1 - progress * progress * (3 - 2 * progress)
      background.style.opacity = String(opacity)
      hero.style.setProperty('--hero-fade', `${(1 - opacity) * 100}%`)
      const video = videoRef.current
      if (!video) return
      if (opacity === 0 || document.hidden) video.pause()
      else if (video.paused) void video.play().catch(() => { /* Keep the poster if autoplay is blocked. */ })
    }
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    document.addEventListener('visibilitychange', scheduleUpdate)
    update()
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      document.removeEventListener('visibilitychange', scheduleUpdate)
    }
  }, [reducedMotion, failed])

  return (
    <div ref={backgroundRef} className="hero-background" aria-hidden="true" style={{ backgroundImage: `url(${HERO_POSTER})` }}>
      {!reducedMotion && !failed && <video ref={videoRef} className="hero-background-video" src={HERO_VIDEO} autoPlay loop muted playsInline preload="metadata" poster={HERO_POSTER} onError={() => setFailed(true)} />}
    </div>
  )
}

export function LandingIntro() {
  return (
    <section className="intro landing-intro" id="inicio" aria-labelledby="landing-title">
      <HeroBackground />
      <div className="intro-copy">
        <p className="eyebrow">TECNOLOGIA PARA OPERAÇÕES DE CRÉDITO</p>
        <h1 id="landing-title">Sua carteira.<br />Uma visão <span>mais clara.</span></h1>
        <p className="subtitle">Da validação à precificação, transforme seus recebíveis em informações para decidir o próximo passo.</p>
        <a className="landing-cta" href="#analise">Analisar carteira <span aria-hidden="true">↗</span></a>
        <p className="landing-caption">Análise em lote · Regras por operação · Visão por fundo</p>
      </div>
      <div className="credit-flow" aria-label="Fluxo de análise: importar carteira, validar regras e consultar resultados">
        <div className="flow-heading"><span className="flow-spark" aria-hidden="true">✳</span><span>DO ARQUIVO À DECISÃO</span></div>
        <ol>
          <li><span className="flow-number">01</span><div><strong>Importe sua carteira</strong><small>Recebíveis organizados em um só lugar</small></div><span aria-hidden="true">↗</span></li>
          <li><span className="flow-number">02</span><div><strong>Valide cada recebível</strong><small>Critérios configurados para sua operação</small></div><span aria-hidden="true">↗</span></li>
          <li><span className="flow-number">03</span><div><strong>Enxergue o resultado</strong><small>Aprovações, motivos e valores sugeridos</small></div><span aria-hidden="true">✓</span></li>
        </ol>
        <div className="flow-footer"><span aria-hidden="true" />Clareza em cada etapa da análise</div>
      </div>
    </section>
  )
}

export function OperationSteps() {
  return (
    <section className="operation-steps" id="como-funciona" aria-labelledby="operation-title">
      <div className="operation-heading"><p className="eyebrow">COMO FUNCIONA</p><h2 id="operation-title">Controle para sua operação.<br />Do início ao resultado.</h2></div>
      <div className="operation-grid">
        <article><span>01 / IMPORTAÇÃO</span><h3>Comece pelos dados</h3><p>Envie o CSV com as notas da sua carteira. O arquivo é analisado conforme os critérios da operação.</p></article>
        <article><span>02 / VALIDAÇÃO</span><h3>Regras que fazem sentido</h3><p>Configure prazos, valores e limites de concentração. Consulte o motivo de cada nota barrada.</p></article>
        <article><span>03 / RESULTADOS</span><h3>Uma visão de cada fundo</h3><p>Compare aprovações no dashboard ou consulte notas, valores e a precificação sugerida na listagem.</p></article>
      </div>
    </section>
  )
}
