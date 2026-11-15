import { act, renderHook } from '@testing-library/react';
import useCountUp from './useCountUp';

const mockMatchMedia = (matches) => {
  window.matchMedia = jest.fn().mockImplementation(() => ({ matches }));
};

describe('useCountUp', () => {
  let now;
  let callbacks;
  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    callbacks = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete window.matchMedia;
  });

  const runFrames = (ms) => {
    act(() => { jest.advanceTimersByTime(130); });
    for (let i = 0; i < 200 && callbacks.length; i += 1) {
      const cb = callbacks.shift();
      now += ms / 100;
      act(() => { cb(now); });
    }
  };

  it('returns String(value) under reduced motion', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useCountUp(42.49));
    expect(result.current).toBe('42.49');
  });

  it('returns String(value) for a non-finite value', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useCountUp('n/a'));
    expect(result.current).toBe('n/a');
  });

  it('ends on 42.49', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useCountUp(42.49));
    expect(result.current).toBe('0.00');
    runFrames(1300);
    expect(result.current).toBe('42.49');
  });

  it('ends on 80', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useCountUp(80));
    expect(result.current).toBe('0');
    runFrames(1300);
    expect(result.current).toBe('80');
  });
});
