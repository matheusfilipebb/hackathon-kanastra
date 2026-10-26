import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent, TouchEvent } from 'react'

export type DashboardPanel = 0 | 1

function scrollRegion(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-dashboard-scroll]') : null
}

export function useDashboardPanels(activePanel: DashboardPanel, onPanelChange: (panel: DashboardPanel) => void) {
  const containerRef = useRef<HTMLElement>(null)
  const lockedUntil = useRef(0)
  const wheel = useRef({ value: 0, at: 0 })
  const touch = useRef<{ x: number; y: number; blocked: boolean } | null>(null)

  const setPanel = useCallback((panel: DashboardPanel) => {
    if (panel === activePanel) return
    lockedUntil.current = performance.now() + 650
    wheel.current.value = 0
    onPanelChange(panel)
  }, [activePanel, onPanelChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      if (event.target instanceof Element && event.target.closest('select,input,textarea')) return
      const region = scrollRegion(event.target)
      if (region && (event.deltaY > 0 ? region.scrollTop + region.clientHeight < region.scrollHeight - 2 : region.scrollTop > 2)) return
      event.preventDefault()
      const now = performance.now()
      if (now < lockedUntil.current) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1)
      if (now - wheel.current.at > 180 || Math.sign(delta) !== Math.sign(wheel.current.value)) wheel.current.value = 0
      wheel.current.value += delta
      wheel.current.at = now
      if (Math.abs(wheel.current.value) >= 80) {
        setPanel(wheel.current.value > 0 ? 1 : 0)
        wheel.current.value = 0
      }
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [setPanel])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.target instanceof Element && event.target.closest('button,input,select,textarea,a,[data-dashboard-scroll]')) return
    if (event.key === ' ' && event.shiftKey) {
      event.preventDefault()
      setPanel(0)
      return
    }
    if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) {
      event.preventDefault()
      setPanel(1)
    } else if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) {
      event.preventDefault()
      setPanel(0)
    }
  }

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const point = event.touches[0]
    if (!point || event.touches.length !== 1) { touch.current = null; return }
    const region = scrollRegion(event.target)
    const control = event.target instanceof Element && event.target.closest('button,input,select,textarea')
    touch.current = { x: point.clientX, y: point.clientY, blocked: Boolean(control || (region && (region.scrollHeight > region.clientHeight + 2 || region.scrollWidth > region.clientWidth + 2))) }
  }
  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touch.current
    touch.current = null
    const end = event.changedTouches[0]
    if (!start || !end || start.blocked || performance.now() < lockedUntil.current) return
    const dy = start.y - end.clientY
    if (Math.abs(dy) >= 60 && Math.abs(dy) > Math.abs(start.x - end.clientX) * 1.2) setPanel(dy > 0 ? 1 : 0)
  }

  return { containerRef, activePanel, setPanel, onKeyDown, onTouchStart, onTouchEnd }
}
