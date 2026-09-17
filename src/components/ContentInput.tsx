'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ContentKind, ArtifactMeta, formatFileSize } from '../lib/media';

/**
 * A selected media object ready to publish: exact original bytes (already
 * hashed by `processMediaBytes` into the unified artifact model), the
 * validated metadata, and a preview URL.
 */
export interface MediaSelection {
  file: File; // the source File (may be synthesized from a voice recording)
  bytes: Uint8Array; // exact original bytes (authoritative for SHA-256)
  meta: ArtifactMeta; // validated artifact metadata (hash over the exact bytes)
  objectUrl: string; // preview URL ([blob:] IMAGE/VIDEO/AUDIO)
}

interface ContentInputProps {
  mode: 'public' | 'proof' | 'private';
  content: string;
  onContentChange: (content: string) => void;
  contentKind: ContentKind; // currently selected input type
  onContentKindChange: (kind: ContentKind) => void;
  /** A file was chosen (by picker or recorded); the parent reads + processes it. */
  onFileChosen: (file: File, declaredKind: 'IMAGE' | 'VIDEO' | 'AUDIO') => void;
  media: MediaSelection | null; // current media selection (for display)
  onMediaRemove: () => void;
  bytes: number;
  mediaError: string | null;
  onError: (message: string | null) => void;
}

/** Pick the best supported audio MIME type for the browser's MediaRecorder. */
function pickRecordingMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
  }
  return 'audio/webm';
}

function extensionFromMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  return 'webm';
}

const VOICE_INPUT_ACCEPT = 'audio/webm,audio/ogg,audio/wav,audio/mpeg,audio/mp4,audio/*';
export function ContentInput({
  mode,
  content,
  onContentChange,
  contentKind,
  onContentKindChange,
  onFileChosen,
  media,
  onMediaRemove,
  bytes,
  mediaError,
  onError,
}: ContentInputProps) {
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onFileChosen(file, contentKind === 'IMAGE' ? 'IMAGE' : 'VIDEO');
  };

  const handleAudioFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onFileChosen(file, 'AUDIO');
  };

  // Cleanup recorder + timers on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        onError('Voice recording is not supported by this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File(
          [blob],
          `voice-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${extensionFromMime(mimeType)}`,
          { type: mimeType }
        );
        onFileChosen(file, 'AUDIO');
      };

      recorder.onerror = () => {
        onError('Voice recording failed. Please release the microphone and try again.');
        setRecording(false);
      };

      recorder.start();
      setRecording(true);
      setRecordingElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setRecordingElapsed((s) => s + 1), 1000);
    } catch {
      onError(
        'Microphone access was denied or unavailable. Allow microphone access to record a voice note, or import an audio file instead.'
      );
    }
  }, [onFileChosen, onError]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
  }, []);

  // PUBLIC mode is TEXT ONLY — hooks above are called unconditionally; only
  // the render differs. No media tabs, file pickers, or voice UI appear.
  if (mode === 'public') {
    return (
      <div className="space-y-3">
        <textarea
          className="w-full h-32 bg-black text-primary font-mono p-2 rounded resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Paste your content here..."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
        />
        <div className="text-sm text-secondary flex justify-between">
          <span>Size: {bytes} bytes</span>
          <span>Type: text/plain</span>
        </div>
      </div>
    );
  }

  const tabs: { kind: ContentKind; label: string; hint: string }[] = [
    { kind: 'TEXT', label: 'Text', hint: 'Paste text content' },
    { kind: 'IMAGE', label: 'Photo', hint: 'Upload an image (JPEG/PNG/WebP/GIF)' },
    { kind: 'VIDEO', label: 'Video', hint: 'Upload a video (MP4/WebM/QuickTime)' },
    { kind: 'AUDIO', label: 'Voice', hint: 'Record or import a voice note' },
  ];

  const showMediaPanel =
    media !== null || contentKind === 'IMAGE' || contentKind === 'VIDEO' || contentKind === 'AUDIO';

  return (
    <div className="space-y-3">
      {/* Content type selector — clear, obvious input type */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            onClick={() => {
              onContentKindChange(tab.kind);
              onError(null);
            }}
            className={`p-2 rounded border text-left transition ${
              contentKind === tab.kind
                ? 'border-accent bg-accent/10'
                : 'border-gray-700 bg-black hover:border-gray-500'
            }`}
          >
            <div className="text-sm font-medium text-primary">{tab.label}</div>
            <div className="text-xs text-secondary mt-1 break-words">{tab.hint}</div>
          </button>
        ))}
      </div>

      {/* TEXT input */}
      {contentKind === 'TEXT' && (
        <div className="space-y-3">
          <textarea
            className="w-full h-32 bg-black text-primary font-mono p-2 rounded resize-none focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Paste your content here..."
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
          />
          <div className="text-sm text-secondary flex justify-between">
            <span>Size: {bytes} bytes</span>
            <span>Type: text/plain</span>
          </div>
        </div>
      )}
{/* IMAGE / VIDEO file input */}
      {(contentKind === 'IMAGE' || contentKind === 'VIDEO') && !media && (
        <div className="space-y-3">
          <label className="cursor-pointer block bg-black border border-dashed border-gray-600 rounded p-6 text-center hover:border-accent transition">
            <div className="text-accent font-medium">
              {contentKind === 'IMAGE' ? 'Select a photo' : 'Select a video'}
            </div>
            <div className="text-xs text-secondary mt-1">
              {contentKind === 'IMAGE'
                ? 'JPEG, PNG, WebP, GIF — the original file is hashed and preserved, never recompressed.'
                : 'MP4, WebM, QuickTime — the original file is hashed and preserved, never transcoded.'}
            </div>
            <input
              type="file"
              className="hidden"
              accept={
                contentKind === 'IMAGE'
                  ? 'image/jpeg,image/png,image/webp,image/gif'
                  : 'video/mp4,video/webm,video/quicktime'
              }
              onChange={handleFilePicked}
            />
          </label>
          <p className="text-xs text-secondary">
            File info (filename, MIME type, size, SHA-256) is shown after processing.
          </p>
        </div>
      )}

      {/* AUDIO / Voice */}
      {contentKind === 'AUDIO' && !media && (
        <div className="space-y-3">
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded transition"
            >
              ● Start Recording
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded transition"
            >
              ■ Stop Recording ({recordingElapsed}s)
            </button>
          )}

          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary">or import an existing audio file</span>
            <label className="cursor-pointer bg-gray-700 hover:opacity-90 text-primary px-3 py-1.5 rounded text-sm transition">
              Choose audio file
              <input type="file" className="hidden" accept={VOICE_INPUT_ACCEPT} onChange={handleAudioFilePicked} />
            </label>
          </div>

          <p className="text-xs text-secondary">
            The recording is saved exactly as captured and hashed from its original bytes — it is never
            transcribed or converted.
          </p>
        </div>
      )}

      {/* Selected media display: filename, MIME, size, content type */}
      {showMediaPanel && media && (
        <div className="space-y-3">
          <div className="bg-black border border-gray-700 rounded p-3">
            {media.meta.contentKind === 'IMAGE' && (
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src={media.objectUrl}
                  alt="Selected"
                  fill
                  unoptimized
                  className="object-contain rounded"
                />
              </div>
            )}
            {media.meta.contentKind === 'VIDEO' && (
              <video src={media.objectUrl} controls className="max-h-64 w-full rounded" />
            )}
            {media.meta.contentKind === 'AUDIO' && (
              <audio src={media.objectUrl} controls className="w-full" />
            )}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-secondary">Filename</dt>
              <dd className="text-accent break-all">{media.meta.filename}</dd>
              <dt className="text-secondary">MIME Type</dt>
              <dd className="text-accent break-all">{media.meta.mimeType}</dd>
              <dt className="text-secondary">Size</dt>
              <dd className="text-accent">{formatFileSize(media.meta.size)}</dd>
              <dt className="text-secondary">Content Type</dt>
              <dd className="text-accent">{media.meta.contentKind}</dd>
              <dt className="text-secondary">SHA-256</dt>
              <dd className="text-accent break-all font-mono">{media.meta.hash}</dd>
            </dl>
            <button
              type="button"
              onClick={onMediaRemove}
              className="mt-3 px-3 py-1.5 bg-gray-700 hover:bg-red-700 text-white rounded text-sm transition"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Validation / processing error */}
      {mediaError && (
        <div className="bg-red-900/30 border border-red-600 rounded p-3">
          <p className="text-sm text-red-300">{mediaError}</p>
        </div>
      )}
    </div>
  );
}

export default ContentInput;