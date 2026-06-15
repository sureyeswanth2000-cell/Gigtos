import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, functionsInstance, storage } from '../../firebase';
import { useWorkerLocation } from '../../context/WorkerLocationContext';

function safeFileName(file) {
  return (file?.name || 'proof.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

async function uploadProofFile({ bookingId, uid, folder, file }) {
  const fileRef = ref(storage, `bookings/${bookingId}/${folder}/${uid}/${Date.now()}_${safeFileName(file)}`);
  await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' });
  return getDownloadURL(fileRef);
}

function getJobWorkLocation(job = {}) {
  const lat = Number(job.lat ?? job.locationLat ?? job.consumerLat ?? job.userLocationLat);
  const lng = Number(job.lng ?? job.locationLng ?? job.consumerLng ?? job.userLocationLng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export default function StartWorkProofModal({ job, onClose, onStarted }) {
  const workerLocation = useWorkerLocation();
  const [arrivalSelfie, setArrivalSelfie] = useState(null);
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const startWork = async () => {
    if (!arrivalSelfie) {
      setError('Take one arrival selfie before starting work.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Login required.');
      const arrivalSelfiePhoto = await uploadProofFile({
        bookingId: job.id,
        uid,
        folder: 'arrivalSelfies',
        file: arrivalSelfie,
      });
      const beforePhotos = [];
      for (const file of beforeFiles.slice(0, 6)) {
        beforePhotos.push(await uploadProofFile({
          bookingId: job.id,
          uid,
          folder: 'beforePhotos',
          file,
        }));
      }
      await httpsCallable(functionsInstance, 'updateBookingStatus')({
        bookingId: job.id,
        action: 'worker_start_work',
        extraArgs: {
          arrivalSelfiePhoto,
          beforePhotos,
          proofCaptureMode: 'camera_hint',
        },
      });
      if (workerLocation && !workerLocation.tracking) {
        workerLocation.startTracking(getJobWorkLocation(job), job.id);
      }
      if (onStarted) onStarted();
    } catch (err) {
      setError(err.message || 'Could not start work. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-bg">
      <div className="modal">
        <h3>Start Work Proof</h3>
        <p>Take a fresh arrival selfie so the consumer can confirm the correct worker arrived.</p>

        <label className="proof-upload-field">
          Arrival selfie
          <input
            type="file"
            accept="image/*"
            capture="user"
            disabled={uploading}
            onChange={(event) => setArrivalSelfie(event.target.files?.[0] || null)}
          />
        </label>
        {arrivalSelfie && <small>Selfie ready: {arrivalSelfie.name}</small>}

        <label className="proof-upload-field">
          Before-work photos optional
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={uploading}
            onChange={(event) => setBeforeFiles(Array.from(event.target.files || []))}
          />
        </label>
        {beforeFiles.length > 0 && <small>{beforeFiles.length} before-work photo{beforeFiles.length === 1 ? '' : 's'} ready.</small>}

        {error && <div className="error-msg">{error}</div>}
        <div className="modal-actions">
          <button onClick={onClose} disabled={uploading}>Cancel</button>
          <button onClick={startWork} disabled={uploading}>{uploading ? 'Uploading...' : 'Start Work'}</button>
        </div>
      </div>
    </div>
  );
}
