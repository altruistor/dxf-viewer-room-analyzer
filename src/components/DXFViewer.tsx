import React, { useState } from 'react';
import type { DXFData } from '../types/dxf';
import { DXFCanvas } from './DXFCanvas';
import { ToolboxPanel } from './ToolboxPanel';
import './DXFViewer.css';

interface DXFViewerProps {
  data: DXFData;
  fileName: string;
}

export const DXFViewer: React.FC<DXFViewerProps> = ({ data, fileName }) => {
  const { header, entities, blocks, tables } = data;
  const [activeTab, setActiveTab] = useState<'canvas' | 'details'>('canvas');
  const [isToolboxOpen, setIsToolboxOpen] = useState(false);

  const renderEntityInfo = (entity: typeof entities[0], index: number) => (
    <div key={index} className="entity-item">
      <div className="entity-header">
        <span className="entity-type">{entity.type}</span>
        <span className="entity-layer">Layer: {entity.layer}</span>
      </div>
      <div className="entity-details">
        {entity.color && <span>Color: {entity.color}</span>}
        {entity.lineType && <span>Line Type: {entity.lineType}</span>}
      </div>
    </div>
  );

  return (
    <div className="dxf-viewer">
      <ToolboxPanel 
        isOpen={isToolboxOpen} 
        onToggle={() => setIsToolboxOpen(!isToolboxOpen)} 
      />
      
      <div className="viewer-header">
        <h2>{fileName}</h2>
        <div className="file-stats">
          <span>Objects: {entities.length}</span>
          <span>Blocks: {Object.keys(blocks).length}</span>
          <span>Tables: {Object.keys(tables).length}</span>
        </div>
      </div>

      <div className="viewer-tabs">
        <button 
          className={`tab-button ${activeTab === 'canvas' ? 'active' : ''}`}
          onClick={() => setActiveTab('canvas')}
        >
          Look up Drawing
        </button>
        <button 
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          File details
        </button>
      </div>

      <div className="viewer-content">
        {activeTab === 'canvas' && (
          <div className="canvas-tab">
            <DXFCanvas data={data} width={800} height={600} />
          </div>
        )}

        {activeTab === 'details' && (
          <div className="details-tab">
            <div className="section">
              <h3>Title</h3>
              <div className="header-info">
                {Object.entries(header).slice(0, 10).map(([key, value]) => (
                  <div key={key} className="header-item">
                    <span className="header-key">{key}:</span>
                    <span className="header-value">{String(value)}</span>
                  </div>
                ))}
                {Object.keys(header).length > 10 && (
                  <div className="more-items">
                    ... and {Object.keys(header).length - 10} more items
                  </div>
                )}
              </div>
            </div>

            <div className="section">
              <h3>Objects ({entities.length})</h3>
              <div className="entities-container">
                {entities.slice(0, 20).map(renderEntityInfo)}
                {entities.length > 20 && (
                  <div className="more-items">
                    ... and {entities.length - 20} more items
                  </div>
                )}
              </div>
            </div>

            {Object.keys(blocks).length > 0 && (
              <div className="section">
                <h3>Blocks ({Object.keys(blocks).length})</h3>
                <div className="blocks-container">
                  {Object.keys(blocks).slice(0, 10).map((blockName, index) => (
                    <div key={index} className="block-item">
                      {blockName}
                    </div>
                  ))}
                  {Object.keys(blocks).length > 10 && (
                    <div className="more-items">
                      ... and {Object.keys(blocks).length - 10} more items
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
