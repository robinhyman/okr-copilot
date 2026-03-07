export type CoachUiState = 'empty' | 'discovery' | 'refining' | 'ready' | 'published';

export function deriveCoachUiState(input: {
  hasActiveDraft: boolean;
  draftStatus?: string;
  hasMessages: boolean;
}): CoachUiState {
  if (!input.hasActiveDraft && !input.hasMessages) return 'empty';
  if (input.draftStatus === 'published') return 'published';
  if (input.draftStatus === 'ready') return 'ready';
  if (input.hasMessages && !input.hasActiveDraft) return 'discovery';
  return 'refining';
}

export function publishButtonEnabled(input: { canPublish: boolean; hasDraft: boolean; draftStatus?: string }): boolean {
  if (!input.canPublish) return false;
  if (!input.hasDraft) return false;
  if (input.draftStatus === 'published') return false;
  return true;
}

export type CoachModalState = { isOpen: boolean; mode: 'idle' | 'create' | 'resume' };

export function initialCoachModalState(): CoachModalState {
  return { isOpen: false, mode: 'idle' };
}

export function transitionCoachModal(state: CoachModalState, action: 'open-create' | 'open-resume' | 'continue-later' | 'published'): CoachModalState {
  if (action === 'open-create') return { isOpen: true, mode: 'create' };
  if (action === 'open-resume') return { isOpen: true, mode: 'resume' };
  return { isOpen: false, mode: 'idle' };
}
