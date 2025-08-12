import React from 'react';
import './ToolboxPanel.css';

interface ToolboxItem {
  id: string;
  name: string;
  icon: string;
  type: 'furniture' | 'fixture' | 'door' | 'window';
  color: string;
}

const toolboxItems: ToolboxItem[] = [
  { id: 'door', name: 'Door', icon: '🚪', type: 'door', color: '#8B4513' },
  { id: 'window', name: 'Window', icon: '🪟', type: 'window', color: '#87CEEB' },
  { id: 'bed', name: 'Bed', icon: '🛏️', type: 'furniture', color: '#DEB887' },
  { id: 'chair', name: 'Chair', icon: '🪑', type: 'furniture', color: '#A0522D' },
  { id: 'toilet', name: 'Toilet', icon: '🚽', type: 'fixture', color: '#F0F8FF' },
  { id: 'shower', name: 'Shower', icon: '🚿', type: 'fixture', color: '#B0E0E6' },
  { id: 'sink', name: 'Sink', icon: '🚰', type: 'fixture', color: '#E0E0E0' },
  { id: 'table', name: 'Table', icon: '🪨', type: 'furniture', color: '#CD853F' },
  { id: 'sofa', name: 'Sofa', icon: '🛋️', type: 'furniture', color: '#8FBC8F' },
  { id: 'light', name: 'Light', icon: '💡', type: 'fixture', color: '#FFD700' },
];

interface ToolboxPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const ToolboxPanel: React.FC<ToolboxPanelProps> = ({ isOpen, onToggle }) => {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, item: ToolboxItem) => {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'copy';
    
    // Create simple drag image with just the icon
    const dragImage = document.createElement('div');
    dragImage.style.fontSize = '32px';
    dragImage.style.padding = '8px';
    dragImage.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    dragImage.style.border = '2px solid ' + item.color;
    dragImage.style.borderRadius = '8px';
    dragImage.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.left = '-1000px';
    dragImage.style.zIndex = '9999';
    dragImage.textContent = item.icon;
    
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 25, 25);
    
    // Remove drag image after drag starts
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  const groupedItems = toolboxItems.reduce((groups, item) => {
    const type = item.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(item);
    return groups;
  }, {} as Record<string, ToolboxItem[]>);

  const getGroupIcon = (type: string) => {
    switch (type) {
      case 'door': return '🚪';
      case 'window': return '🪟';
      case 'furniture': return '🪑';
      case 'fixture': return '🚿';
      default: return '📦';
    }
  };

  const getGroupName = (type: string) => {
    switch (type) {
      case 'door': return 'Doors';
      case 'window': return 'Windows';
      case 'furniture': return 'Furniture';
      case 'fixture': return 'Fixtures';
      default: return 'Other';
    }
  };

  return (
    <>
      <button 
        className={`toolbox-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title="Toggle Toolbox"
      >
        {isOpen ? 'X' : '🧰'}
      </button>
      
      <div className={`toolbox-panel ${isOpen ? 'open' : ''}`}>
        <div className="toolbox-header">
          <h3>🧰 Toolbox</h3>
          <p>Drag items to canvas</p>
        </div>
        
        <div className="toolbox-content">
          {Object.entries(groupedItems).map(([type, items]) => (
            <div key={type} className="toolbox-group">
              <div className="group-header">
                <span className="group-icon">{getGroupIcon(type)}</span>
                <span className="group-name">{getGroupName(type)}</span>
              </div>
              
              <div className="group-items">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="toolbox-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    style={{ borderColor: item.color }}
                  >
                    <div className="item-icon">{item.icon}</div>
                    <div className="item-name">{item.name}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="toolbox-footer">
          <div className="tip">
            💡 <strong>Tip:</strong> Drag any item onto the canvas to place it
          </div>
        </div>
      </div>
    </>
  );
};
