import React, { useState, useEffect } from 'react';
import { DownloadCloud, Loader2, CheckCircle, XCircle } from 'lucide-react';
import useThemeStore from '../lib/zustand/themeStore';
import { startDownload, cancelDownload, pauseDownload, resumeDownload } from '../lib/downloader';
import { ifExists } from '../lib/file/ifExists';

const Downloader = ({ providerValue, link, type, title, fileName }) => {
  const { primary } = useThemeStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, downloading, paused, completed, error

  // Check if file already exists
  useEffect(() => {
    const check = async () => {
      const exists = await ifExists(fileName);
      if (exists) setStatus('completed');
    };
    check();
  }, [fileName]);

  const handleDownload = async () => {
    if (status === 'completed') return;
    if (status === 'downloading') {
      // Pause
      await pauseDownload(jobId);
      setStatus('paused');
      return;
    }
    if (status === 'paused') {
      // Resume
      await resumeDownload(jobId);
      setStatus('downloading');
      return;
    }
    // Start new download
    setIsDownloading(true);
    setStatus('downloading');
    setProgress(0);
    try {
      const id = await startDownload({
        url: link,
        fileName,
        title,
        fileType: type,
        headers: {}, // pass headers if needed
        setDownloadId: setJobId,
        setAlreadyDownloaded: () => {},
        setDownloadActive: setIsDownloading,
        onProgress: (prog) => {
          setProgress(prog.progress || 0);
          if (prog.status === 'completed') setStatus('completed');
        }
      });
      setJobId(id);
    } catch (error) {
      console.error("Download failed", error);
      setStatus('error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancel = async () => {
    if (jobId) {
      await cancelDownload(jobId);
      setStatus('idle');
      setProgress(0);
      setJobId(null);
    }
  };

  let icon;
  let color = primary;
  if (status === 'completed') {
    icon = <CheckCircle size={24} color="#10b981" />;
  } else if (status === 'downloading' || status === 'paused') {
    icon = <Loader2 size={24} color={primary} className="animate-spin" />;
  } else if (status === 'error') {
    icon = <XCircle size={24} color="#ef4444" />;
  } else {
    icon = <DownloadCloud size={24} color={primary} />;
  }

  const buttonText = status === 'downloading' ? `${Math.round(progress)}%` : (status === 'paused' ? 'Resume' : (status === 'completed' ? 'Downloaded' : 'Download'));

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleDownload}
        disabled={status === 'downloading' || status === 'completed'}
        className="p-3 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 transition flex items-center justify-center disabled:opacity-50 gap-2"
        title={buttonText}
      >
        {icon}
        <span className="text-sm text-gray-300">{buttonText}</span>
      </button>
      {(status === 'downloading' || status === 'paused') && (
        <button
          onClick={handleCancel}
          className="text-xs text-red-400 mt-1 hover:text-red-300"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default Downloader;