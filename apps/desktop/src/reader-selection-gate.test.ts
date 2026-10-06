import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSelectionGate } from './reader-selection-gate';

const SETTLE_MS = 250;

describe('createSelectionGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('captura la selección tras estabilizarse', () => {
    const onSettled = vi.fn();
    const gate = createSelectionGate(SETTLE_MS, onSettled);

    gate.request();
    expect(onSettled).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SETTLE_MS - 1);
    expect(onSettled).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('no captura nada mientras el puntero sigue abajo', () => {
    const onSettled = vi.fn();
    const gate = createSelectionGate(SETTLE_MS, onSettled);

    gate.pointerDown();
    gate.request();
    vi.advanceTimersByTime(SETTLE_MS * 4);

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('permite seleccionar un párrafo largo con pausas durante el arrastre', () => {
    const onSettled = vi.fn();
    const gate = createSelectionGate(SETTLE_MS, onSettled);

    // Arrastre con dos pausas prolongadas a mitad de camino.
    gate.pointerDown();
    vi.advanceTimersByTime(2000);
    gate.request();
    vi.advanceTimersByTime(2000);
    gate.request();
    expect(onSettled).not.toHaveBeenCalled();

    gate.pointerUp();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('descarta la captura pendiente al empezar un gesto nuevo', () => {
    const onSettled = vi.fn();
    const gate = createSelectionGate(SETTLE_MS, onSettled);

    gate.request();
    gate.pointerDown();
    vi.advanceTimersByTime(SETTLE_MS * 2);

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('no captura si el gesto se cancela', () => {
    const onSettled = vi.fn();
    const gate = createSelectionGate(SETTLE_MS, onSettled);

    gate.pointerDown();
    gate.request();
    gate.pointerCancel();
    vi.advanceTimersByTime(SETTLE_MS * 2);

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('captura la selección hecha con teclado tras soltar la tecla', () => {
    const onSettled = vi.fn();
    const gate = createSelectionGate(SETTLE_MS, onSettled);

    gate.request();
    gate.request();
    vi.advanceTimersByTime(SETTLE_MS);

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('cancel() descarta lo pendiente', () => {
    const onSettled = vi.fn();
    const gate = createSelectionGate(SETTLE_MS, onSettled);

    gate.request();
    gate.cancel();
    vi.advanceTimersByTime(SETTLE_MS * 2);

    expect(onSettled).not.toHaveBeenCalled();
  });
});
