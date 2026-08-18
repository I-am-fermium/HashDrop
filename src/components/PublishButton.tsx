'use client';

import { useState } from 'react';

interface PublishButtonProps {
  isConnected: boolean;
  progress: number;
  onPublish: () => Promise<void>;
  onReset: () => void;
}

export function PublishButton({ isConnected, progress, onPublish, onReset }: PublishButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async () => {
    if (!isConnected) return;

    if (progress > 0 && progress < 100) {
      // Already publishing, ignore
      return;
    }

    if (progress === 100) {
      onReset();
      return;
    }

    setIsSubmitting(true);
    try {
      await onPublish();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusText = () => {
    if (progress > 0 && progress < 100) {
      return `Publishing... ${progress}%`;
    }
    return 'Publish';
  };

  const isBusy = progress > 0 && progress < 100;
  const isSuccess = progress === 100;

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleClick}
        disabled={!isConnected || isBusy}
        className={`w-full font-bold py-3 px-6 rounded text-xl transition ${
          isSuccess
            ? 'bg-green-600 hover:opacity-90'
            : isBusy
            ? 'bg-gray-600 cursor-not-allowed'
            : isConnected
            ? 'bg-accent text-white hover:opacity-90'
            : 'bg-gray-600 cursor-not-allowed'
        }`}
      >
        {getStatusText()}
      </button>

      {!isConnected && (
        <p className="text-xs text-secondary text-center">
          Connect your wallet to publish content
        </p>
      )}
    </div>
  );
}