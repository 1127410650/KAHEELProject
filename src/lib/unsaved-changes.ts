/**
 * Tiny registry so navigation can ask "is anything unsaved right now?" without
 * knowing which page is open. A form registers itself while it holds dirty
 * state and unregisters on save or unmount.
 */
const dirty = new Set<string>();

export function markUnsaved(id: string) {
  dirty.add(id);
}

export function clearUnsaved(id: string) {
  dirty.delete(id);
}

export function hasUnsavedChanges(): boolean {
  return dirty.size > 0;
}
