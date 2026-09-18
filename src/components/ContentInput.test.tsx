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

  it('Voice renders an audio file selector and NO recording UI', () => {
    const onError = jest.fn();
    const container = renderInto(
      <ContentInput mode="proof" {...baseProps} contentKind="AUDIO" onError={onError} />
    );

    // Exactly one file input, accepting audio.
    const fileInputs = container.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(1);
    const accept = (fileInputs[0] as HTMLInputElement).accept;
    expect(accept).toContain('audio/');
    expect(accept).toContain('audio/wav');
    expect(accept).toContain('audio/mpeg');

    // Upload-style wording, consistent with the Video card.
    expect(container.textContent).toContain('Select an audio');
    expect(container.textContent).toContain('never converted');

    // NO separate chooser button/span may exist — the dashed card itself is
    // the selector (regression guard against "Choose audio file" returning).
    expect(container.textContent).not.toContain('Choose audio file');
    const card = container.querySelector('label') as HTMLLabelElement;
    expect(card.querySelectorAll('span').length).toBe(0);
    expect(card.querySelectorAll('button').length).toBe(0);

    // NO recording affordances of any kind remain.
    expect(container.textContent).not.toContain('Start Recording');
    expect(container.textContent).not.toContain('Stop Recording');
    expect(container.textContent).not.toContain('Record');
    expect(container.textContent).not.toContain('Microphone');
    expect(container.textContent).not.toContain('recording');

    // Rendering Voice must not trigger any microphone/permission side effect.
    expect(onError).not.toHaveBeenCalled();
  });

  it('choosing an audio file forwards the ORIGINAL File object for processing as AUDIO', () => {
    const onFileChosen = jest.fn();
    const container = renderInto(
      <ContentInput mode="proof" {...baseProps} contentKind="AUDIO" onFileChosen={onFileChosen} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    // A minimal real WAV byte sequence ('RIFF' header) — the downstream
    // pipeline (processMediaBytes) hashes exactly these bytes.
    const originalBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04]);
    const file = new File([originalBytes], 'voice.wav', { type: 'audio/wav' });

    act(() => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onFileChosen).toHaveBeenCalledTimes(1);
    // The EXACT File object is forwarded (same identity → same original bytes),
    // declared as AUDIO so the parent processes it through the media pipeline.
    expect(onFileChosen).toHaveBeenCalledWith(file, 'AUDIO');
    const forwarded = onFileChosen.mock.calls[0][0] as File;
    expect(forwarded.type).toBe('audio/wav');
    expect(forwarded.name).toBe('voice.wav');
    expect(forwarded.size).toBe(originalBytes.length);
  });

  it('Video keeps its unchanged file-selection workflow (no recording regressions)', () => {
    const container = renderInto(<ContentInput mode="proof" {...baseProps} contentKind="VIDEO" />);
    expect(container.textContent).toContain('Select a video');
    expect(container.textContent).toContain('never transcoded');
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Recording');
  });

  it('Voice file-selector styling matches the Video selector exactly (only label/handler/accept differ)', () => {
    const video = renderInto(<ContentInput mode="proof" {...baseProps} contentKind="VIDEO" />);
    const voice = renderInto(<ContentInput mode="proof" {...baseProps} contentKind="AUDIO" />);

    // The clickable dashed card is the file selector in both cases: the
    // container classes must be byte-identical (same border/background/hover/
    // padding treatment).
    const videoCard = video.querySelector('label') as HTMLLabelElement;
    const voiceCard = voice.querySelector('label') as HTMLLabelElement;
    expect(voiceCard.className).toBe(videoCard.className);
    expect(voiceCard.className).toContain('border-dashed');
    expect(voiceCard.className).toContain('bg-black');
    expect(voiceCard.className).not.toContain('bg-accent');

    // Identical structure: both cards contain the heading div, the format
    // note div, and a single hidden file input — no inner chooser element.
    expect(videoCard.querySelectorAll('span, button').length).toBe(0);
    expect(voiceCard.querySelectorAll('span, button').length).toBe(0);
    expect(voiceCard.querySelectorAll('div').length).toBe(videoCard.querySelectorAll('div').length);
    expect(voiceCard.querySelectorAll('input').length).toBe(1);
    expect(videoCard.querySelectorAll('input').length).toBe(1);
  });
});