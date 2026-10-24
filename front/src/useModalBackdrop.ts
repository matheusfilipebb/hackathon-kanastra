import { useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

function outside(event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
}

export function useModalBackdrop(onClose: () => void, disabled = false) {
  const startedOutside = useRef(false)
  return {
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => { startedOutside.current = event.button === 0 && outside(event) },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      const close = startedOutside.current && outside(event)
      startedOutside.current = false
      if (close && !disabled) onClose()
    },
  }
}
