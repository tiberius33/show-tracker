// components/photos/UploadMediaModal.jsx
//
// Upload modal shared by all three galleries (photos/videos, posters,
// setlist photos) — which tabs/file types it offers depends on
// `category`: posters and setlist photos are images only (no video, no
// YouTube tab), since a poster or a setlist isn't a video by definition.
// One caption applies to the whole batch of files selected at once;
// per-photo captions in a multi-file batch is a scope cut, noted in the
// release notes rather than half-built here.

'use client';

import React, { useState } from 'react';
import { Upload, Youtube, X as XIcon } from 'lucide-react';
import { Modal, Button, Input, Textarea, Tabs } from '@/components/ui';
import { checkUploadAllowed, uploadShowMedia, addYoutubeLink, allowedTypesFor } from '@/lib/photos';

export default function UploadMediaModal({
  open, onClose, concertKey, uid, uploaderName, show, existingPhotos,
  category = 'photo', title = 'Add Photos & Videos', onUploaded, onError,
}) {
  const allowYoutube = category === 'photo';
  const acceptTypes = allowedTypesFor(category).join(',');

  const [mode, setMode] = useState('file');
  const [files, setFiles] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ index: 0, total: 0, pct: 0 });
  const [validationError, setValidationError] = useState('');

  const reset = () => {
    setFiles([]);
    setYoutubeUrl('');
    setCaption('');
    setValidationError('');
    setProgress({ index: 0, total: 0, pct: 0 });
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setValidationError('');
    // Validate up front so a bad file in a batch doesn't fail halfway
    // through uploading the good ones ahead of it.
    let runningPhotos = existingPhotos;
    for (const file of selected) {
      const err = checkUploadAllowed(file, runningPhotos, category);
      if (err) {
        setValidationError(err);
        setFiles([]);
        return;
      }
      runningPhotos = [...runningPhotos, { fileSize: file.size }];
    }
    setFiles(selected);
  };

  const handleUploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress({ index: 0, total: files.length, pct: 0 });
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ index: i + 1, total: files.length, pct: 0 });
        await uploadShowMedia({
          file: files[i], concertKey, uid, uploaderName, caption, category, show,
          onProgress: (pct) => setProgress({ index: i + 1, total: files.length, pct }),
        });
      }
      onUploaded?.();
      reset();
      onClose();
    } catch (err) {
      console.error('[photos] Upload failed:', err.code || err.message, err);
      onError?.("Couldn't upload — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddYoutube = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setUploading(true);
    try {
      await addYoutubeLink({ url: youtubeUrl, concertKey, uid, uploaderName, caption, show });
      onUploaded?.();
      reset();
      onClose();
    } catch (err) {
      onError?.(err.message || "Couldn't add that link.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} size="md">
      {allowYoutube && (
        <Tabs
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'file', label: 'Upload File', icon: Upload },
            { id: 'youtube', label: 'YouTube Link', icon: Youtube },
          ]}
          className="mb-5"
        />
      )}

      {mode === 'file' || !allowYoutube ? (
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-subtle rounded-xl py-8 cursor-pointer hover:border-brand/40 transition-colors">
            <Upload size={22} className="text-muted" />
            <span className="text-sm text-secondary">
              {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''} selected` : `Choose ${category === 'photo' ? 'images or MP4 videos' : 'images'}`}
            </span>
            <span className="text-xs text-muted">10MB per file, 50MB per show</span>
            <input
              type="file"
              accept={acceptTypes}
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-sm text-secondary bg-hover rounded-lg px-3 py-2">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    disabled={uploading}
                    className="text-muted hover:text-danger flex-shrink-0 ml-2"
                  >
                    <XIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {validationError && <p className="text-sm text-danger">{validationError}</p>}

          <Textarea
            placeholder="Add a caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            disabled={uploading}
          />

          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Uploading {progress.index} of {progress.total}…</span>
                <span>{Math.round(progress.pct * 100)}%</span>
              </div>
              <div className="h-1.5 bg-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${Math.round(progress.pct * 100)}%` }}
                />
              </div>
            </div>
          )}

          <Button full loading={uploading} disabled={files.length === 0} onClick={handleUploadFiles}>
            {uploading ? 'Uploading…' : `Upload ${files.length || ''}`.trim()}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleAddYoutube} className="space-y-4">
          <Input
            label="YouTube URL"
            placeholder="https://youtube.com/watch?v=…"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            disabled={uploading}
          />
          <Textarea
            placeholder="Add a caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            disabled={uploading}
          />
          <Button type="submit" full loading={uploading} disabled={!youtubeUrl.trim()}>
            Add Video
          </Button>
        </form>
      )}
    </Modal>
  );
}
