import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveCoachUiState, initialCoachModalState, publishButtonEnabled, transitionCoachModal } from './conversationFlow';

test('deriveCoachUiState handles create and discovery states', () => {
  assert.equal(deriveCoachUiState({ hasActiveDraft: false, hasMessages: false }), 'empty');
  assert.equal(deriveCoachUiState({ hasActiveDraft: false, hasMessages: true }), 'discovery');
});

test('deriveCoachUiState handles ready and published states', () => {
  assert.equal(deriveCoachUiState({ hasActiveDraft: true, hasMessages: true, draftStatus: 'ready' }), 'ready');
  assert.equal(deriveCoachUiState({ hasActiveDraft: true, hasMessages: true, draftStatus: 'published' }), 'published');
});

test('publish button rule enforces RBAC and status', () => {
  assert.equal(publishButtonEnabled({ canPublish: false, hasDraft: true, draftStatus: 'ready' }), false);
  assert.equal(publishButtonEnabled({ canPublish: true, hasDraft: false, draftStatus: 'ready' }), false);
  assert.equal(publishButtonEnabled({ canPublish: true, hasDraft: true, draftStatus: 'published' }), false);
  assert.equal(publishButtonEnabled({ canPublish: true, hasDraft: true, draftStatus: 'ready' }), true);
});

test('modal create flow opens as focused dialog and supports continue later', () => {
  const start = initialCoachModalState();
  const opened = transitionCoachModal(start, 'open-create');
  assert.equal(opened.isOpen, true);
  assert.equal(opened.mode, 'create');

  const continuedLater = transitionCoachModal(opened, 'continue-later');
  assert.equal(continuedLater.isOpen, false);
  assert.equal(continuedLater.mode, 'idle');
});
