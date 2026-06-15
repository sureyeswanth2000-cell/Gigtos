import React, { useState } from 'react';
import ImageUpload from '../ImageUpload';
import { auth, storage, functionsInstance } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

/**
 * CompleteJobModal – Modal for workers to mark a job as complete with after photo upload.
 * Props:
 *   job – booking/job object
 *   onClose – close modal
 *   onCompleted – callback after completion
 */
export default function CompleteJobModal({ job, onClose, onCompleted }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = (fileList) => {
    setFiles(Array.from(fileList));
  };

  const handleComplete = async () => {
    if (!files.length) { setError('Please upload at least one photo.'); return; }
    setUploading(true);
    setError('');
    try {
      const urls = [];
      for (const file of files) {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Login required for completion photo upload.');
        const storageRef = ref(storage, `bookings/${job.id}/afterPhotos/${uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file, { contentType: file.type });
        const url = await getDownloadURL(storageRef);
        urls.push(url);
      }
      await httpsCallable(functionsInstance, 'updateBookingStatus')({
        bookingId: job.id,
        action: 'worker_mark_finished',
        extraArgs: { afterPhotos: urls },
      });
      if (onCompleted) onCompleted();
    } catch (e) {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-bg">
      <div className="modal">
        <h3>Mark Job as Complete</h3>
        <p>Upload at least one "after" photo as proof of work completion.</p>
        <ImageUpload label="Upload After Photo(s)" onUpload={handleUpload} multiple />
        {error && <div className="error-msg">{error}</div>}
        <div className="modal-actions">
          <button onClick={onClose} disabled={uploading}>Cancel</button>
          <button onClick={handleComplete} disabled={uploading}>{uploading ? 'Uploading...' : 'Complete Job'}</button>
        </div>
      </div>
    </div>
  );
}
