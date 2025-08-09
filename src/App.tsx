import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { DXFViewer } from './components/DXFViewer';
import { DXFService } from './services/dxfService';
import type { DXFData } from './types/dxf';
import './App.css';

function App() {
  const [dxfData, setDxfData] = useState<DXFData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dxfService = new DXFService();

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    setDxfData(null);

    try {
      const result = await dxfService.parseCADFile(file);
      
      if (result.success && result.data) {
        setDxfData(result.data);
        setFileName(file.name);
      } else {
        setError(result.error || 'Unexpected error during file parsing');
      }
    } catch (err) {
      setError('Error processing file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDxfData(null);
    setFileName('');
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>CAD File Viewer</h1>
        <p>Upload and view the contents of DXF and DWG files</p>
      </header>

      <main className="app-main">
        {!dxfData && !loading && (
          <FileUpload onFileSelect={handleFileSelect} loading={loading} />
        )}

        {loading && (
          <div className="loading-container">
            <FileUpload onFileSelect={handleFileSelect} loading={loading} />
          </div>
        )}

        {error && (
          <div className="error-container">
            <div className="error-message">
              <h3>Error</h3>
              <p>{error}</p>
              <button onClick={handleReset} className="retry-button">
                Try Again
              </button>
            </div>
          </div>
        )}

        {dxfData && !loading && (
          <div className="viewer-container">
            <div className="viewer-actions">
              <button onClick={handleReset} className="back-button">
                ← Upload Another File
              </button>
            </div>
            <DXFViewer data={dxfData} fileName={fileName} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Created with React, Vite and dxf-parser. Supports DXF and DWG files</p>
      </footer>
    </div>
  );
}

export default App;
