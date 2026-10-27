import test from 'node:test';
import assert from 'node:assert';
import { renderHook } from './mockReact';
import { useRedactorState } from '../components/RedactorWorkspace/hooks/useRedactorState';
import { RedactionItem } from '../types';

// Helper to create dummy redaction items
function createMockRedaction(id: string, approved: boolean = true, category: string = 'TCKN', val: string = '12345678901'): RedactionItem {
  return {
    id,
    category,
    value: val,
    page_number: 0,
    rect: [100, 100, 200, 150],
    confidence: 0.99,
    approved,
  };
}

test('Scenario 1: Initial state has canUndo=false and canRedo=false', () => {
  const { result } = renderHook(() => useRedactorState());

  assert.strictEqual(result.current.canUndo, false, 'Initial canUndo must be false');
  assert.strictEqual(result.current.canRedo, false, 'Initial canRedo must be false');
  assert.strictEqual(result.current.history.length, 0, 'Initial history length must be 0');
  assert.strictEqual(result.current.future.length, 0, 'Initial future length must be 0');
  assert.strictEqual(result.current.redactions.length, 0, 'Initial redactions length must be 0');
});

test('Scenario 2.1: pushState increments history depth and enables canUndo', () => {
  const { result } = renderHook(() => useRedactorState());

  const item1 = createMockRedaction('item_1', true);
  result.current.pushState([item1]);

  assert.strictEqual(result.current.canUndo, true, 'canUndo must be true after pushState');
  assert.strictEqual(result.current.canRedo, false, 'canRedo must be false after pushState');
  assert.strictEqual(result.current.history.length, 1, 'history length must be 1');
  assert.strictEqual(result.current.redactions.length, 1, 'redactions length must be 1');
  assert.strictEqual(result.current.redactions[0].id, 'item_1');

  // Push another state
  const item2 = createMockRedaction('item_2', false);
  result.current.pushState((prev) => [...prev, item2]);

  assert.strictEqual(result.current.history.length, 2, 'history length must be 2 after second pushState');
  assert.strictEqual(result.current.redactions.length, 2);
  assert.strictEqual(result.current.canUndo, true);
});

test('Scenario 2.2: toggleRedaction records history and toggles approved status', () => {
  const { result } = renderHook(() => useRedactorState());

  const initialItems = [
    createMockRedaction('item_1', true),
    createMockRedaction('item_2', false),
  ];
  result.current.pushState(initialItems);

  const historyLenBefore = result.current.history.length;

  // Toggle function simulating index.tsx: toggleRedaction
  const toggleRedaction = (id: string) => {
    result.current.pushState((prev) =>
      prev.map((r) => (r.id === id ? { ...r, approved: !r.approved } : r))
    );
  };

  toggleRedaction('item_1');

  assert.strictEqual(result.current.history.length, historyLenBefore + 1, 'history should increment');
  assert.strictEqual(result.current.redactions.find((r) => r.id === 'item_1')?.approved, false, 'item_1 should be unapproved');

  toggleRedaction('item_1');
  assert.strictEqual(result.current.redactions.find((r) => r.id === 'item_1')?.approved, true, 'item_1 should be approved again');
});

test('Scenario 2.3: removeRedaction records history and removes item', () => {
  const { result } = renderHook(() => useRedactorState());

  const initialItems = [
    createMockRedaction('item_1', true),
    createMockRedaction('item_2', true),
  ];
  result.current.pushState(initialItems);

  const removeRedaction = (id: string) => {
    result.current.pushState((prev) => prev.filter((r) => r.id !== id));
  };

  const lenBefore = result.current.history.length;
  removeRedaction('item_1');

  assert.strictEqual(result.current.history.length, lenBefore + 1);
  assert.strictEqual(result.current.redactions.length, 1);
  assert.strictEqual(result.current.redactions[0].id, 'item_2');
});

test('Scenario 2.4: approveAllAcrossDocument & unapproveAllAcrossDocument record history', () => {
  const { result } = renderHook(() => useRedactorState());

  const initialItems = [
    createMockRedaction('item_1', false),
    createMockRedaction('item_2', false),
  ];
  result.current.pushState(initialItems);

  const approveAllAcrossDocument = () => {
    result.current.pushState((prev) => prev.map((r) => ({ ...r, approved: true })));
  };

  const unapproveAllAcrossDocument = () => {
    result.current.pushState((prev) => prev.map((r) => ({ ...r, approved: false })));
  };

  approveAllAcrossDocument();
  assert.strictEqual(result.current.redactions.every((r) => r.approved), true);
  assert.strictEqual(result.current.history.length, 2);

  unapproveAllAcrossDocument();
  assert.strictEqual(result.current.redactions.every((r) => !r.approved), true);
  assert.strictEqual(result.current.history.length, 3);
});

test('Scenario 2.5: Manuel bant ekleme (manual draw) records history and adds newItem', () => {
  const { result } = renderHook(() => useRedactorState());

  result.current.pushState([]);

  // Simulating index.tsx handlePointerUp manual creation
  const targetPage = 0;
  const pdfX0 = 50, pdfY0 = 60, pdfX1 = 150, pdfY1 = 80;
  const newItem: RedactionItem = {
    id: `manual_${targetPage}_${Math.round(pdfX0)}_${Math.round(pdfY0)}_${Date.now()}`,
    category: 'MANUEL',
    value: 'Manuel Seçim (Bant)',
    page_number: targetPage,
    rect: [pdfX0, pdfY0, pdfX1, pdfY1],
    confidence: 1.0,
    approved: true,
  };

  result.current.pushState((prev) => [...prev, newItem]);

  assert.strictEqual(result.current.redactions.length, 1);
  assert.strictEqual(result.current.redactions[0].category, 'MANUEL');
  assert.strictEqual(result.current.canUndo, true);
  assert.strictEqual(result.current.history.length, 2);
});

test('Scenario 2.6: handleSearchText additions record history and add search results', () => {
  const { result } = renderHook(() => useRedactorState());

  result.current.pushState([createMockRedaction('existing_1')]);

  // Simulating index.tsx handleSearchText:
  const searchResults = [
    createMockRedaction('search_found_1', true, 'OZEL_KELIME', 'Ahmet Yılmaz'),
    createMockRedaction('existing_1', true), // duplicate, should be filtered out
  ];

  const existingIds = new Set(result.current.redactions.map((r) => r.id));
  const newItems = searchResults.filter((item) => !existingIds.has(item.id));
  if (newItems.length > 0) {
    result.current.pushState((prev) => [...prev, ...newItems]);
  }

  assert.strictEqual(result.current.history.length, 2);
  assert.strictEqual(result.current.redactions.length, 2);
  assert.strictEqual(result.current.redactions.some((r) => r.id === 'search_found_1'), true);
});

test('Scenario 2.7: addToWhitelist removes matching redactions and records history', () => {
  const { result } = renderHook(() => useRedactorState());

  const items = [
    createMockRedaction('item_1', true, 'TARAF_ISMI', 'Ahmet Yılmaz'),
    createMockRedaction('item_2', true, 'TCKN', '11111111111'),
  ];
  result.current.pushState(items);

  const clean = 'Ahmet Yılmaz';
  result.current.pushState((prev) =>
    prev.filter((r) => !r.value.toLowerCase().includes(clean.toLowerCase()))
  );

  assert.strictEqual(result.current.history.length, 2);
  assert.strictEqual(result.current.redactions.length, 1);
  assert.strictEqual(result.current.redactions[0].id, 'item_2');
});

test('Scenario 3: undo() returns to previous state and puts current state into future stack', () => {
  const { result } = renderHook(() => useRedactorState());

  const itemA = createMockRedaction('A');
  const itemB = createMockRedaction('B');

  // Initial state (empty)
  result.current.pushState([itemA]); // History: [[]], Current: [A]
  result.current.pushState([itemA, itemB]); // History: [[], [A]], Current: [A, B]

  assert.strictEqual(result.current.history.length, 2);
  assert.strictEqual(result.current.future.length, 0);
  assert.strictEqual(result.current.canUndo, true);
  assert.strictEqual(result.current.canRedo, false);

  // First Undo
  result.current.undo();

  assert.strictEqual(result.current.redactions.length, 1, 'Current redactions should revert to [A]');
  assert.strictEqual(result.current.redactions[0].id, 'A');
  assert.strictEqual(result.current.history.length, 1, 'History length should decrease to 1');
  assert.strictEqual(result.current.future.length, 1, 'Future length should increase to 1');
  assert.strictEqual(result.current.future[0].length, 2, 'Future[0] should contain [A, B]');
  assert.strictEqual(result.current.canUndo, true);
  assert.strictEqual(result.current.canRedo, true);

  // Second Undo
  result.current.undo();

  assert.strictEqual(result.current.redactions.length, 0, 'Current redactions should revert to empty');
  assert.strictEqual(result.current.history.length, 0, 'History should now be empty');
  assert.strictEqual(result.current.future.length, 2, 'Future should have 2 entries');
  assert.strictEqual(result.current.canUndo, false, 'canUndo must be false when history is empty');
  assert.strictEqual(result.current.canRedo, true, 'canRedo must still be true');

  // Third Undo on empty history (safe no-op)
  result.current.undo();
  assert.strictEqual(result.current.redactions.length, 0, 'Undo on empty history must not throw or change state');
  assert.strictEqual(result.current.history.length, 0);
  assert.strictEqual(result.current.future.length, 2);
});

test('Scenario 4: redo() restores undone state from future stack', () => {
  const { result } = renderHook(() => useRedactorState());

  const itemA = createMockRedaction('A');
  const itemB = createMockRedaction('B');

  result.current.pushState([itemA]);
  result.current.pushState([itemA, itemB]);

  // Undo twice
  result.current.undo();
  result.current.undo();

  assert.strictEqual(result.current.redactions.length, 0);

  // First Redo -> Re-applies [A]
  result.current.redo();
  assert.strictEqual(result.current.redactions.length, 1);
  assert.strictEqual(result.current.redactions[0].id, 'A');
  assert.strictEqual(result.current.history.length, 1);
  assert.strictEqual(result.current.future.length, 1);
  assert.strictEqual(result.current.canUndo, true);
  assert.strictEqual(result.current.canRedo, true);

  // Second Redo -> Re-applies [A, B]
  result.current.redo();
  assert.strictEqual(result.current.redactions.length, 2);
  assert.strictEqual(result.current.history.length, 2);
  assert.strictEqual(result.current.future.length, 0);
  assert.strictEqual(result.current.canUndo, true);
  assert.strictEqual(result.current.canRedo, false);

  // Third Redo on empty future (safe no-op)
  result.current.redo();
  assert.strictEqual(result.current.redactions.length, 2);
  assert.strictEqual(result.current.future.length, 0);
  assert.strictEqual(result.current.canRedo, false);
});

test('Scenario 4.1: New pushState after undo clears future stack (Redo branch invalidation)', () => {
  const { result } = renderHook(() => useRedactorState());

  const itemA = createMockRedaction('A');
  const itemB = createMockRedaction('B');
  const itemC = createMockRedaction('C');

  result.current.pushState([itemA]);
  result.current.pushState([itemA, itemB]);

  // Undo back to [A]
  result.current.undo();
  assert.strictEqual(result.current.future.length, 1);
  assert.strictEqual(result.current.canRedo, true);

  // Now push a new action [A, C]
  result.current.pushState([itemA, itemC]);

  assert.strictEqual(result.current.redactions.length, 2);
  assert.strictEqual(result.current.redactions[1].id, 'C');
  assert.strictEqual(result.current.future.length, 0, 'future stack must be reset to 0 after new pushState');
  assert.strictEqual(result.current.canRedo, false, 'canRedo must be false after new pushState');
  assert.strictEqual(result.current.canUndo, true);
});

test('Scenario 4.2: Complex interwoven Undo/Redo/Push transitions', () => {
  const { result } = renderHook(() => useRedactorState());

  const i1 = createMockRedaction('1');
  const i2 = createMockRedaction('2');
  const i3 = createMockRedaction('3');
  const i4 = createMockRedaction('4');

  result.current.pushState([i1]);             // Hist: [[]], Curr: [1]
  result.current.pushState([i1, i2]);         // Hist: [[], [1]], Curr: [1, 2]
  result.current.pushState([i1, i2, i3]);     // Hist: [[], [1], [1, 2]], Curr: [1, 2, 3]

  assert.strictEqual(result.current.history.length, 3);
  assert.strictEqual(result.current.future.length, 0);

  result.current.undo(); // back to [1, 2]
  assert.strictEqual(result.current.redactions.length, 2);
  assert.strictEqual(result.current.future.length, 1);

  result.current.undo(); // back to [1]
  assert.strictEqual(result.current.redactions.length, 1);
  assert.strictEqual(result.current.future.length, 2);

  result.current.redo(); // forward to [1, 2]
  assert.strictEqual(result.current.redactions.length, 2);
  assert.strictEqual(result.current.future.length, 1);

  // New action replaces branch
  result.current.pushState([i1, i2, i4]); // Curr: [1, 2, 4], future cleared
  assert.strictEqual(result.current.redactions.length, 3);
  assert.strictEqual(result.current.redactions[2].id, '4');
  assert.strictEqual(result.current.future.length, 0);
  assert.strictEqual(result.current.canRedo, false);

  result.current.undo(); // back to [1, 2]
  assert.strictEqual(result.current.redactions.length, 2);
  assert.strictEqual(result.current.future[0][2].id, '4', 'Redo stack now points to [1, 2, 4], NOT [1, 2, 3]');
});

test('Scenario 5: clearHistory resets history, future, canUndo, and canRedo', () => {
  const { result } = renderHook(() => useRedactorState());

  result.current.pushState([createMockRedaction('1')]);
  result.current.pushState([createMockRedaction('1'), createMockRedaction('2')]);
  result.current.undo();

  assert.strictEqual(result.current.history.length, 1);
  assert.strictEqual(result.current.future.length, 1);
  assert.strictEqual(result.current.canUndo, true);
  assert.strictEqual(result.current.canRedo, true);

  // Simulate loadDocument calling clearHistory()
  result.current.clearHistory();

  assert.strictEqual(result.current.history.length, 0, 'history must be []');
  assert.strictEqual(result.current.future.length, 0, 'future must be []');
  assert.strictEqual(result.current.canUndo, false, 'canUndo must be false after clearHistory');
  assert.strictEqual(result.current.canRedo, false, 'canRedo must be false after clearHistory');
});

test('Scenario 6: Keyboard shortcut handler respects input/textarea focus and executes shortcuts', () => {
  let undoCalled = false;
  let redoCalled = false;

  const mockUndo = () => { undoCalled = true; };
  const mockRedo = () => { redoCalled = true; };

  // Replicating index.tsx handleUndoRedoKeyDown
  const handleUndoRedoKeyDown = (e: any) => {
    const target = e.target;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;

    const key = e.key.toLowerCase();

    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        mockRedo();
      } else {
        mockUndo();
      }
    } else if (key === 'y') {
      e.preventDefault();
      mockRedo();
    }
  };

  const createEvent = (opts: any) => {
    let prevented = false;
    return {
      ctrlKey: !!opts.ctrlKey,
      metaKey: !!opts.metaKey,
      shiftKey: !!opts.shiftKey,
      key: opts.key || '',
      target: opts.target || { tagName: 'DIV' },
      preventDefault: () => { prevented = true; },
      get defaultPrevented() { return prevented; }
    };
  };

  // 6.1: When focused on INPUT -> Ctrl+Z must NOT trigger undo
  undoCalled = false;
  const inputEvent = createEvent({ ctrlKey: true, key: 'z', target: { tagName: 'INPUT' } });
  handleUndoRedoKeyDown(inputEvent);
  assert.strictEqual(undoCalled, false, 'Ctrl+Z inside INPUT must be ignored');
  assert.strictEqual(inputEvent.defaultPrevented, false, 'Default must not be prevented inside INPUT');

  // 6.2: When focused on TEXTAREA -> Ctrl+Z must NOT trigger undo
  undoCalled = false;
  const textareaEvent = createEvent({ ctrlKey: true, key: 'z', target: { tagName: 'TEXTAREA' } });
  handleUndoRedoKeyDown(textareaEvent);
  assert.strictEqual(undoCalled, false, 'Ctrl+Z inside TEXTAREA must be ignored');
  assert.strictEqual(textareaEvent.defaultPrevented, false);

  // 6.3: When focused on isContentEditable -> Ctrl+Z must NOT trigger undo
  undoCalled = false;
  const editableEvent = createEvent({ ctrlKey: true, key: 'z', target: { tagName: 'DIV', isContentEditable: true } });
  handleUndoRedoKeyDown(editableEvent);
  assert.strictEqual(undoCalled, false, 'Ctrl+Z inside isContentEditable must be ignored');

  // 6.4: Regular workspace element -> Ctrl+Z triggers undo
  undoCalled = false;
  const normalEvent = createEvent({ ctrlKey: true, key: 'z', target: { tagName: 'DIV' } });
  handleUndoRedoKeyDown(normalEvent);
  assert.strictEqual(undoCalled, true, 'Ctrl+Z must trigger undo');
  assert.strictEqual(normalEvent.defaultPrevented, true, 'Ctrl+Z must call preventDefault()');

  // 6.5: Ctrl+Shift+Z triggers redo
  redoCalled = false;
  const redoShiftEvent = createEvent({ ctrlKey: true, shiftKey: true, key: 'z', target: { tagName: 'DIV' } });
  handleUndoRedoKeyDown(redoShiftEvent);
  assert.strictEqual(redoCalled, true, 'Ctrl+Shift+Z must trigger redo');
  assert.strictEqual(redoShiftEvent.defaultPrevented, true);

  // 6.6: Ctrl+Y triggers redo
  redoCalled = false;
  const redoYEvent = createEvent({ ctrlKey: true, key: 'y', target: { tagName: 'DIV' } });
  handleUndoRedoKeyDown(redoYEvent);
  assert.strictEqual(redoCalled, true, 'Ctrl+Y must trigger redo');
  assert.strictEqual(redoYEvent.defaultPrevented, true);

  // 6.7: Mac Cmd+Z (metaKey) triggers undo
  undoCalled = false;
  const cmdZEvent = createEvent({ metaKey: true, key: 'z', target: { tagName: 'DIV' } });
  handleUndoRedoKeyDown(cmdZEvent);
  assert.strictEqual(undoCalled, true, 'Cmd+Z must trigger undo');

  // 6.8: Mac Cmd+Shift+Z triggers redo
  redoCalled = false;
  const cmdShiftZEvent = createEvent({ metaKey: true, shiftKey: true, key: 'z', target: { tagName: 'DIV' } });
  handleUndoRedoKeyDown(cmdShiftZEvent);
  assert.strictEqual(redoCalled, true, 'Cmd+Shift+Z must trigger redo');

  // 6.9: Plain key 'z' without Ctrl/Cmd does NOT trigger undo
  undoCalled = false;
  const plainZEvent = createEvent({ key: 'z', target: { tagName: 'DIV' } });
  handleUndoRedoKeyDown(plainZEvent);
  assert.strictEqual(undoCalled, false, 'Plain z key must not trigger undo');
  assert.strictEqual(plainZEvent.defaultPrevented, false);
});

test('Scenario 7.1: MAX_HISTORY = 30 limits history stack to 30 items', () => {
  const { result } = renderHook(() => useRedactorState());

  // Push 40 states
  for (let i = 1; i <= 40; i++) {
    result.current.pushState([createMockRedaction(`item_${i}`)]);
  }

  assert.strictEqual(result.current.history.length, 30, 'history length must be capped at MAX_HISTORY (30)');
  // The oldest state remaining in history should be item_10 (states 0 through 9 sliced off)
  const oldestInHistory = result.current.history[0];
  assert.strictEqual(oldestInHistory[0].id, 'item_10', 'Oldest state should be item_10 after 40 pushes');
});

test('Scenario 7.2: Deep cloning integrity - mutations to current state do not corrupt history', () => {
  const { result } = renderHook(() => useRedactorState());

  const initialItem = createMockRedaction('item_1', true);
  result.current.pushState([initialItem]);

  const secondItem = createMockRedaction('item_2', true);
  result.current.pushState([initialItem, secondItem]);

  // Attempt to mutate rect in the current state directly
  result.current.redactions[0].rect[0] = 999;
  result.current.redactions[0].approved = false;

  // Now undo to previous state
  result.current.undo();

  // The restored state should have the original pristine values, not 999 or false
  assert.strictEqual(result.current.redactions[0].rect[0], 100, 'rect[0] in history should not have been corrupted');
  assert.strictEqual(result.current.redactions[0].approved, true, 'approved in history should not have been corrupted');
});
