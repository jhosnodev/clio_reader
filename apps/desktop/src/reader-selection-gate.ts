export interface SelectionGate {
  /** El usuario apoya el puntero: se interrumpe cualquier captura pendiente. */
  pointerDown(): void;
  /** El usuario suelta el puntero: la captura puede empezar a estabilizarse. */
  pointerUp(): void;
  /** El gesto se canceló (táctil, Escape): no se captura nada. */
  pointerCancel(): void;
  /** La selección del documento cambió. */
  request(): void;
  /** Descarta una captura pendiente sin ejecutarla. */
  cancel(): void;
}

/**
 * Cronometra la captura de la selección para que el lector responda al gesto
 * terminado y no a cada pausa del arrastre. Durante el arrastre el panel de
 * notas espera: si reacciona a mitad, el `pointerdown` del scrim corta la
 * selección y es imposible seleccionar un párrafo.
 */
export function createSelectionGate(settleMs: number, onSettled: () => void): SelectionGate {
  let pointerIsDown = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = (): void => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const schedule = (): void => {
    stop();
    timer = setTimeout(() => {
      timer = null;
      onSettled();
    }, settleMs);
  };

  return {
    pointerDown() {
      pointerIsDown = true;
      stop();
    },
    pointerUp() {
      pointerIsDown = false;
      schedule();
    },
    pointerCancel() {
      pointerIsDown = false;
    },
    request() {
      if (pointerIsDown) return;
      schedule();
    },
    cancel: stop,
  };
}
