// components/photos/UploadMediaModal.jsx
//
// Upload modal shared by all three galleries (photos/videos, posters,
// setlist photos) — which tabs/file types it offers depends on
// `category`: posters and setlist photos are images only (no video, no
// YouTube tab), since a poster or a setlist isn't a video by definition.
// Each selected file gets its own caption field — a batch of 5 photos
// from one night usually isn't 5 copies of the same caption.
//
// Captions are free text and so go through the content filter before
// anything is uploaded (Guideline 1.2). Checked here per caption, so the
// error points at the offending one rather than failing the whole batch
// anonymously — and checked again in the Netlify function that writes the
// metadata document, which is the actual enforcement.

'use client';

import React, { useState } from 'react';
import { Upload, Youtube, X as XIcon } from 'lucide-react';
import { Modal, Button, Input, Textarea, Tabs } from '@/components/ui';
import { checkUploadAllowed, uploadShowMedia, addYoutubeLink, allowedTypesFor } from '@/lib/photos';
import { contentProblem } from '@/lib/contentFilter';

export default function UploadMediaModal({
  open, onClose, concertKey, uid, uploaderName, show, existingPhotos,
  category = 'photo', title = 'Add Photos & Videos', onUploaded, onError,
}) {
  const allowYoutube = category === 'photo';
  const acceptTypes = allowedTypesFor(category).join(',');

  const [mode, setMode] = useState('file');
  const [entries, setEntries] = useState([]); // [{ file, caption }]
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeCaption, setYoutubeCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ index: 0, total: 0, pct: 0 });
  const [validationError, setValidationError] = useState('');

  const reset = () => {
    setEntries([]);
    setYoutubeUrl('');
    setYoutubeCaption('');
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
        setEntries([]);
        return;
      }
      runningPhotos = [...runningPhotos, { fileSize: file.size }];
    }
    setEntries(selected.map((file) => ({ file, caption: '' })));
  };

  const updateCaption = (index, caption) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, caption } : e)));
    if (validationError) setValidationError('');
  };

  const removeEntry = (index) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async () => {
    if (entries.length === 0) return;

    // Before the first byte goes to Storage: a caption rejected after
    // three of five photos have uploaded leaves a half-done batch and an
    // error that doesn't say which one.
    for (let i = 0; i < entries.length; i++) {
      const problem = contentProblem(entries[i].caption);
      if (problem) {
        setValidationError(`Caption for “${entries[i].file.name}”: ${problem}`);
        return;
      }
    }
    setValidationError('');

    setUploading(true);
    setProgress({ index: 0, total: entries.length, pct: 0 });
    try {
      for (let i = 0; i < entries.length; i++) {
        setProgress({ index: i + 1, total: entries.length, pct: 0 });
        await uploadShowMedia({
          file: entries[i].file, concertKey, uid, uploaderName, caption: entries[i].caption, category, show,
          onProgress: (pct) => setProgress({ index: i + 1, total: entries.length, pct }),
        });
      }
      onUploaded?.();
      reset();
      onClose();
    } catch (err) {
      console.error('[photos] Upload failed:', err.code || err.message, err);
      // The server runs the caption filter too, and its rejection names
      // what is wrong — show that inline rather than replacing it with a
      // generic "try again" the user cannot act on.
      setValidationError(err.message || "Couldn't upload — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddYoutube = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    const problem = contentProblem(youtubeCaption);
    if (problem) {
      setValidationError(problem);
      return;
    }
    setValidationError('');

    setUploading(true);
    try {
      await addYoutubeLink({ url: youtubeUrl, concertKey, uid, uploaderName, caption: youtubeCaption, show });
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
              {entries.length > 0 ? `${entries.length} file${entries.length !== 1 ? 's' : ''} selected` : `Choose ${category === 'photo' ? 'images or MP4 videos' : 'images'}`}
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

          {entries.length > 0 && (
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {entries.map((entry, i) => (
                <li key={i} className="flex items-start gap-2 bg-hover rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-secondary truncate mb-1">{entry.file.name}</div>
                    <Textarea
                      placeholder="Caption for this one (optional)"
                      value={entry.caption}
                      onChange={(e) => updateCaption(i, e.target.value)}
                      rows={1}
                      disabled={uploading}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEntry(i)}
                    disabled={uploading}
                    className="text-muted hover:text-danger flex-shrink-0 mt-1"
                  >
                    <XIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {validationError && <p className="text-sm text-danger">{validationError}</p>}

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

          <Button full loading={uploading} disabled={entries.length === 0} onClick={handleUploadFiles}>
            {uploading ? 'Uploading…' : `Upload ${entries.length || ''}`.trim()}
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
            value={youtubeCaption}
            onChange={(e) => { setYoutubeCaption(e.target.value); setValidationError(''); }}
            rows={2}
            disabled={uploading}
            error={validationError}
          />
          <Button type="submit" full loading={uploading} disabled={!youtubeUrl.trim()}>
            Add Video
          </Button>
        </form>
      )}
    </Modal>
  );
}
