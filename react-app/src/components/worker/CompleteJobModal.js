import React, { useState } from 'react';
import ImageUpload from '../ImageUpload';
import { db, storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

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
        const storageRef = ref(storage, `bookings/${job.id}/afterPhotos/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        urls.push(url);
      }
      await updateDoc(doc(db, 'bookings', job.id), {
        afterPhotos: arrayUnion(...urls),
        status: 'awaiting_confirmation',
        statusUpdatedAt: new Date(),
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
