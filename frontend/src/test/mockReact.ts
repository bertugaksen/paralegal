// Lightweight React mock for executing and testing React hooks deterministically in Node.js
import * as ActualReact from 'react';

export let currentHookContext: HookContext | null = null;

export class HookContext {
  hooks: any[] = [];
  hookIndex = 0;
  effects: (() => void | (() => void))[] = [];
  cleanups: (((() => void) | void))[] = [];
  hookFn: () => any;
  result: any;

  constructor(hookFn: () => any) {
    this.hookFn = hookFn;
    this.render();
  }

  render() {
    this.hookIndex = 0;
    this.effects = [];
    currentHookContext = this;
    const internals = (ActualReact as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const oldH = internals ? internals.H : null;
    if (internals) {
      internals.H = {
        useState,
        useRef,
        useCallback,
        useEffect,
      };
    }
    try {
      this.result = this.hookFn();
    } finally {
      if (internals) {
        internals.H = oldH;
      }
      currentHookContext = null;
    }
    // Run pending effects after render phase (just like real React)
    for (const effect of this.effects) {
      const cleanup = effect();
      if (typeof cleanup === 'function') {
        this.cleanups.push(cleanup);
      }
    }
  }

  rerender() {
    this.render();
  }
}

export function renderHook<T>(hookFn: () => T): { result: { current: T }; rerender: () => void } {
  const ctx = new HookContext(hookFn);
  const wrapper = {
    get current() {
      return ctx.result as T;
    }
  };
  return {
    result: wrapper,
    rerender: () => ctx.rerender()
  };
}

export function useState<T>(initial: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void] {
  if (!currentHookContext) {
    return ActualReact.useState(initial);
  }
  const ctx = currentHookContext;
  const idx = ctx.hookIndex++;
  if (ctx.hooks.length <= idx) {
    const initVal = typeof initial === 'function' ? (initial as Function)() : initial;
    ctx.hooks[idx] = initVal;
  }
  const setState = (newValOrFn: any) => {
    const prev = ctx.hooks[idx];
    const next = typeof newValOrFn === 'function' ? newValOrFn(prev) : newValOrFn;
    ctx.hooks[idx] = next;
    ctx.rerender();
  };
  return [ctx.hooks[idx], setState];
}

export function useRef<T>(initial: T): { current: T } {
  if (!currentHookContext) {
    return ActualReact.useRef(initial);
  }
  const ctx = currentHookContext;
  const idx = ctx.hookIndex++;
  if (ctx.hooks.length <= idx) {
    ctx.hooks[idx] = { current: initial };
  }
  return ctx.hooks[idx];
}

export function useCallback<T extends Function>(fn: T, deps: any[]): T {
  if (!currentHookContext) {
    return ActualReact.useCallback(fn as any, deps) as any;
  }
  const ctx = currentHookContext;
  const idx = ctx.hookIndex++;
  if (ctx.hooks.length <= idx) {
    ctx.hooks[idx] = { fn, deps };
    return fn;
  }
  const prev = ctx.hooks[idx];
  const hasChanged = !deps || !prev.deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
  if (hasChanged) {
    ctx.hooks[idx] = { fn, deps };
    return fn;
  }
  return prev.fn;
}

export function useEffect(effect: () => void | (() => void), deps?: any[]): void {
  if (!currentHookContext) {
    return ActualReact.useEffect(effect, deps);
  }
  const ctx = currentHookContext;
  const idx = ctx.hookIndex++;
  if (ctx.hooks.length <= idx) {
    ctx.hooks[idx] = { deps };
    ctx.effects.push(effect);
    return;
  }
  const prev = ctx.hooks[idx];
  const hasChanged = !deps || !prev.deps || deps.some((d: any, i: number) => !Object.is(d, prev.deps[i]));
  if (hasChanged) {
    ctx.hooks[idx] = { deps };
    ctx.effects.push(effect);
  }
}

// Re-export everything else from actual React
export default ActualReact;
export * from 'react';
