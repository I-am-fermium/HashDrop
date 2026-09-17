/**
 * DOM tests for the ContentInput component.
 *
 * Critical regression: PUBLIC mode must remain TEXT ONLY (no media tabs, no
 * file picker). PROOF/PRIVATE modes expose Text / Photo / Video / Voice tabs.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ContentInput } from './ContentInput';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function renderInto(jsx: React.ReactElement): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(jsx));
  return container;
}

const baseProps = {
  content: '',
  onContentChange: () => {},
  contentKind: 'TEXT' as const,
  onContentKindChange: () => {},
  onFileChosen: () => {},
  media: null,
  onMediaRemove: () => {},
  bytes: 0,
  mediaError: null,
  onError: () => {},
};

describe('ContentInput', () => {
  it('PUBLIC mode renders ONLY the text editor', () => {
    const container = renderInto(<ContentInput mode="public" {...baseProps} />);
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(container.textContent).toContain('text/plain');
    // No media affordances may appear in Public mode.
    expect(container.textContent).not.toContain('Photo');
    expect(container.textContent).not.toContain('Video');
    expect(container.textContent).not.toContain('Voice');
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('PROOF mode exposes Text / Photo / Video / Voice content-type tabs', () => {
    const container = renderInto(<ContentInput mode="proof" {...baseProps} />);
    expect(container.textContent).toContain('Text');
    expect(container.textContent).toContain('Photo');
    expect(container.textContent).toContain('Video');
    expect(container.textContent).toContain('Voice');
  });

  it('PRIVATE mode exposes the same media content-type tabs', () => {
    const container = renderInto(<ContentInput mode="private" {...baseProps} />);
    expect(container.textContent).toContain('Photo');
    expect(container.textContent).toContain('Video');
    expect(container.textContent).toContain('Voice');
  });
});