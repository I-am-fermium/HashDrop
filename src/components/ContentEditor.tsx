'use client';

interface ContentEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  bytes: number;
  contentType?: string;
}

export function ContentEditor({ content, onContentChange, bytes, contentType = 'text/plain' }: ContentEditorProps) {
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
        <span>Type: {contentType}</span>
      </div>
    </div>
  );
}