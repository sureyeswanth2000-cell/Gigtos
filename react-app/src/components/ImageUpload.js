import React, { useState } from 'react';

/**
 * ImageUpload component for uploading one or more images.
 * Props:
 * - label: string (button/field label)
 * - onUpload: function(files: FileList)
 * - multiple: boolean (allow multiple files)
 */
export default function ImageUpload({ label = 'Upload Photo', onUpload, multiple = false }) {
  const [preview, setPreview] = useState([]);

  const handleChange = (e) => {
    const files = Array.from(e.target.files);
    setPreview(files.map(file => URL.createObjectURL(file)));
    if (onUpload) onUpload(e.target.files);
  };

  return (
    <div className="image-upload">
      <label>
        {label}
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </label>
      <div className="image-preview-list">
        {preview.map((src, i) => (
          <img key={i} src={src} alt="preview" style={{ maxWidth: 100, margin: 4 }} />
        ))}
      </div>
    </div>
  );
}
