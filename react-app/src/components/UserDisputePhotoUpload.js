import React, { useState } from 'react';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * UserDisputePhotoUpload – for uploading dispute evidence photos.
 * Props:
 *   bookingId – Firestore booking ID
 *   onUploaded(urls: string[])
 */
export default function UserDisputePhotoUpload({ bookingId, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (!files.length) { setError('Please select at least one photo.'); return; }
    setUploading(true);
    setError('');
    try {
      const urls = [];
      for (const file of files) {
        const storageRef = ref(storage, `bookings/${bookingId}/userDisputePhotos/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        urls.push(url);
      }
      if (onUploaded) onUploaded(urls);
    } catch (e) {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ margin: '12px 0' }}>
      <label style={{ fontWeight: 700 }}>Upload Evidence Photo(s):</label>
      <input type="file" accept="image/*" multiple onChange={handleChange} disabled={uploading} />
      <button onClick={handleUpload} disabled={uploading || !files.length} style={{ marginLeft: 8 }}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      {error && <div style={{ color: 'var(--error)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
