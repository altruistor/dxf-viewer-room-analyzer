import React, { useRef } from 'react';
import type { FileUploadProps } from '../types/dxf';
import { DXFService } from '../services/dxfService';
import './FileUpload.css';

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, loading = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (DXFService.validateCADFile(file)) {
        onFileSelect(file);
      } else {
        alert('Пожалуйста, выберите файл с расширением .dxf или .dwg');
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && DXFService.validateCADFile(file)) {
      onFileSelect(file);
    } else {
      alert('Пожалуйста, перетащите файл с расширением .dxf или .dwg');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-zone ${loading ? 'loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".dxf,.DXF,.dwg,.DWG"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={loading}
        />
        
        {loading ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading and parsing file...</p>
          </div>
        ) : (
          <div className="upload-content">
            <h3>Upload CAD File</h3>
            <p>Drag and drop a file here or click to select</p>
            <p className="file-info">Supported formats: .dxf, .dwg</p>
          </div>
        )}
      </div>
    </div>
  );
};
