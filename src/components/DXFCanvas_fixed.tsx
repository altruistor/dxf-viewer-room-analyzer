import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { DXFData, DXFEntity, Point } from '../types/dxf';
import './DXFCanvas.css';

interface DXFCanvasProps {
  data: DXFData;
  width?: number;
  height?: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const DXFCanvas: React.FC<DXFCanvasProps> = ({ 
  data, 
  width = 800, 
  height = 600 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // Получаем все уникальные слои из данных
  const availableLayers = React.useMemo(() => {
    const layers = new Set<string>();
    data.entities.forEach(entity => {
      layers.add(entity.layer);
    });
    return Array.from(layers).sort();
  }, [data.entities]);

  // Инициализируем все слои как видимые при первой загрузке
  useEffect(() => {
    setVisibleLayers(new Set(availableLayers));
  }, [availableLayers]);

  const getEntityPoints = useCallback((entity: DXFEntity): Point[] => {
    const points: Point[] = [];
    
    // Вспомогательная функция для извлечения координат из любого объекта
    const extractPoint = (obj: unknown): Point | null => {
      if (!obj) return null;
      
      // Обрабатываем массивы координат [x, y] или [x, y, z]
      if (Array.isArray(obj) && obj.length >= 2) {
        return { x: obj[0] as number, y: obj[1] as number };
      }
      
      const pointAny = obj as Record<string, unknown>;
      
      // Пробуем различные поля координат, включая z-координату
      if (typeof pointAny.x === 'number' && typeof pointAny.y === 'number') {
        return { x: pointAny.x, y: pointAny.y };
      }
      
      return null;
    };
    
    const entityAny = entity as Record<string, unknown>;
    console.log(`Processing entity type: ${entity.type}`, entity);

    switch (entity.type?.toUpperCase()) {
      case 'LINE': {
        // Пробуем различные поля для начальной и конечной точки
        const startFields = ['start', 'startPoint', 'vertices'];
        const endFields = ['end', 'endPoint'];
        
        let start: Point | null = null;
        let end: Point | null = null;
        
        // Ищем начальную точку
        for (const field of startFields) {
          if (entityAny[field]) {
            if (field === 'vertices' && Array.isArray(entityAny[field])) {
              const vertices = entityAny[field] as unknown[];
              if (vertices.length >= 2) {
                start = extractPoint(vertices[0]);
                end = extractPoint(vertices[1]);
                break;
              }
            } else {
              start = extractPoint(entityAny[field]);
              break;
            }
          }
        }
        
        // Ищем конечную точку, если не нашли в vertices
        if (start && !end) {
          for (const field of endFields) {
            if (entityAny[field]) {
              end = extractPoint(entityAny[field]);
              break;
            }
          }
        }
        
        if (start && end) {
          points.push(start, end);
        }
        break;
      }
        
      case 'CIRCLE':
      case 'ARC': {
        // Пробуем различные поля для центра
        const centerFields = ['center', 'centerPoint'];
        const radiusFields = ['radius', 'r'];
        
        let center: Point | null = null;
        let radius: number | null = null;
        
        for (const field of centerFields) {
          if (entityAny[field]) {
            center = extractPoint(entityAny[field]);
            break;
          }
        }
        
        for (const field of radiusFields) {
          if (typeof entityAny[field] === 'number') {
            radius = entityAny[field] as number;
            break;
          }
        }
        
        if (center && radius) {
          points.push(
            { x: center.x - radius, y: center.y - radius },
            { x: center.x + radius, y: center.y + radius }
          );
        }
        break;
      }
        
      case 'POLYLINE':
      case 'LWPOLYLINE': {
        // Пробуем различные поля для вершин
        const vertexFields = ['vertices', 'points'];
        
        for (const field of vertexFields) {
          if (Array.isArray(entityAny[field])) {
            const vertices = entityAny[field] as unknown[];
            vertices.forEach(vertex => {
              const point = extractPoint(vertex);
              if (point) points.push(point);
            });
            break;
          }
        }
        break;
      }
        
      case 'POINT': {
        // Пробуем различные поля для позиции
        const positionFields = ['position', 'point', 'location'];
        
        for (const field of positionFields) {
          if (entityAny[field]) {
            const point = extractPoint(entityAny[field]);
            if (point) {
              points.push(point);
              break;
            }
          }
        }
        break;
      }
        
      case 'TEXT':
      case 'MTEXT': {
        // Пробуем различные поля для текстовых объектов
        const textFields = ['startPoint', 'position', 'insertionPoint'];
        
        for (const field of textFields) {
          if (entityAny[field]) {
            const point = extractPoint(entityAny[field]);
            if (point) {
              points.push(point);
              break;
            }
          }
        }
        break;
      }
        
      case 'INSERT': {
        // Блоки DXF - используем позицию вставки
        const insertFields = ['position', 'insertionPoint', 'basePoint'];
        
        for (const field of insertFields) {
          if (entityAny[field]) {
            const point = extractPoint(entityAny[field]);
            if (point) {
              points.push(point);
              break;
            }
          }
        }
        break;
      }
        
      case 'ELLIPSE': {
        // Эллипсы - используем центр и радиусы
        if (entityAny.center) {
          const center = extractPoint(entityAny.center);
          if (center) {
            // Добавляем центр как основную точку
            points.push(center);
            
            // Если есть информация о радиусах, добавляем границы
            const majorAxis = entityAny.majorAxisEndpoint as Record<string, unknown> | undefined;
            if (majorAxis && typeof majorAxis.x === 'number' && typeof majorAxis.y === 'number') {
              const majorRadius = Math.sqrt(majorAxis.x * majorAxis.x + majorAxis.y * majorAxis.y);
              const minorAxisRatio = (entityAny.axisRatio as number) || 1;
              const minorRadius = majorRadius * minorAxisRatio;
              
              points.push(
                { x: center.x - majorRadius, y: center.y - minorRadius },
                { x: center.x + majorRadius, y: center.y + minorRadius }
              );
            }
          }
        }
        break;
      }
        
      case 'SPLINE': {
        // Сплайны - используем контрольные точки
        const splineFields = ['controlPoints', 'fitPoints', 'vertices'];
        
        for (const field of splineFields) {
          if (Array.isArray(entityAny[field])) {
            const splinePoints = entityAny[field] as unknown[];
            splinePoints.forEach(splinePoint => {
              const point = extractPoint(splinePoint);
              if (point) points.push(point);
            });
            break;
          }
        }
        break;
      }
        
      default: {
        // Для неизвестных типов пробуем найти любые координаты
        console.log(`Unknown entity type: ${entity.type}`, entity);
        
        const commonFields = ['start', 'end', 'center', 'position', 'point', 'vertices'];
        for (const field of commonFields) {
          if (entityAny[field]) {
            if (Array.isArray(entityAny[field])) {
              const vertices = entityAny[field] as unknown[];
              vertices.forEach(vertex => {
                const point = extractPoint(vertex);
                if (point) points.push(point);
              });
            } else {
              const point = extractPoint(entityAny[field]);
              if (point) points.push(point);
            }
          }
        }
        break;
      }
    }

    console.log(`Entity ${entity.type} extracted points:`, points);
    return points;
  }, []);

  const calculateBounds = useCallback((entities: DXFEntity[]): Bounds => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let totalPoints = 0;
    
    console.log(`Calculating bounds for ${entities.length} entities`);
    
    entities.forEach((entity, index) => {
      const points = getEntityPoints(entity);
      console.log(`Entity ${index} (${entity.type}): ${points.length} points`, points);
      
      if (points.length > 0) {
        totalPoints += points.length;
        points.forEach(point => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
      }
    });
    
    console.log(`Total points found: ${totalPoints}`);
    console.log(`Raw bounds: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);
    
    // Если нет точек, возвращаем дефолтные границы
    if (totalPoints === 0) {
      console.warn('No points found, using default bounds');
      return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    }
    
    // Добавляем небольшой отступ
    const margin = Math.max((maxX - minX), (maxY - minY)) * 0.1;
    return {
      minX: minX - margin,
      minY: minY - margin,
      maxX: maxX + margin,
      maxY: maxY + margin
    };
  }, [getEntityPoints]);

  const calculateScale = (bounds: Bounds, canvasWidth: number, canvasHeight: number) => {
    const drawingWidth = bounds.maxX - bounds.minX;
    const drawingHeight = bounds.maxY - bounds.minY;
    
    if (drawingWidth === 0 || drawingHeight === 0) return 1;
    
    const scaleX = (canvasWidth * 0.8) / drawingWidth;
    const scaleY = (canvasHeight * 0.8) / drawingHeight;
    
    return Math.min(scaleX, scaleY);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, bounds: Bounds, scale: number) => {
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5 / scale;
    
    const gridSize = Math.pow(10, Math.floor(Math.log10((bounds.maxX - bounds.minX) / 20)));
    
    for (let x = Math.floor(bounds.minX / gridSize) * gridSize; x <= bounds.maxX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.minY);
      ctx.lineTo(x, bounds.maxY);
      ctx.stroke();
    }
    
    for (let y = Math.floor(bounds.minY / gridSize) * gridSize; y <= bounds.maxY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(bounds.minX, y);
      ctx.lineTo(bounds.maxX, y);
      ctx.stroke();
    }
  };

  const drawEntity = useCallback((ctx: CanvasRenderingContext2D, entity: DXFEntity) => {
    // Проверяем, видим ли слой
    if (!visibleLayers.has(entity.layer)) return;
    
    // Цвет по умолчанию или по слою
    ctx.strokeStyle = getEntityColor(entity);
    ctx.lineWidth = 1;
    
    switch (entity.type) {
      case 'LINE':
        drawLine(ctx, entity);
        break;
      case 'CIRCLE':
        drawCircle(ctx, entity);
        break;
      case 'ARC':
        drawArc(ctx, entity);
        break;
      case 'POLYLINE':
      case 'LWPOLYLINE':
        drawPolyline(ctx, entity);
        break;
      case 'INSERT':
        // Для блоков просто рисуем точку в позиции вставки
        drawInsert(ctx, entity);
        break;
    }
  }, [visibleLayers]);

  const getEntityColor = (entity: DXFEntity): string => {
    // Простая цветовая схема для слоев
    const layerColors: Record<string, string> = {
      '0': '#333333',
      'construction': '#ff9800',
      'dimensions': '#4caf50',
      'text': '#2196f3',
      'centerlines': '#9c27b0'
    };
    
    return layerColors[entity.layer] || '#333333';
  };

  const drawLine = (ctx: CanvasRenderingContext2D, entity: DXFEntity) => {
    let start: Point | undefined, end: Point | undefined;
    
    if (entity.start && entity.end) {
      start = entity.start;
      end = entity.end;
    } else if (entity.startPoint && entity.endPoint) {
      start = entity.startPoint;
      end = entity.endPoint;
    } else if (entity.vertices && entity.vertices.length >= 2) {
      start = entity.vertices[0];
      end = entity.vertices[1];
    }
    
    if (!start || !end) return;
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  };

  const drawCircle = (ctx: CanvasRenderingContext2D, entity: DXFEntity) => {
    let center: Point | undefined, radius: number | undefined;
    
    if (entity.center && entity.radius) {
      center = entity.center;
      radius = entity.radius;
    } else if (entity.centerPoint && entity.radius) {
      center = entity.centerPoint;
      radius = entity.radius;
    }
    
    if (!center || !radius) return;
    
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const drawArc = (ctx: CanvasRenderingContext2D, entity: DXFEntity) => {
    let center: Point | undefined, radius: number | undefined;
    
    if (entity.center && entity.radius) {
      center = entity.center;
      radius = entity.radius;
    } else if (entity.centerPoint && entity.radius) {
      center = entity.centerPoint;
      radius = entity.radius;
    }
    
    if (!center || !radius) return;
    
    const startAngle = entity.startAngle || 0;
    const endAngle = entity.endAngle || Math.PI * 2;
    
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, startAngle, endAngle);
    ctx.stroke();
  };

  const drawPolyline = (ctx: CanvasRenderingContext2D, entity: DXFEntity) => {
    if (!entity.vertices || entity.vertices.length < 2) return;
    
    const vertices = entity.vertices;
    
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    
    if (entity.closed) {
      ctx.closePath();
    }
    
    ctx.stroke();
  };

  const drawInsert = (ctx: CanvasRenderingContext2D, entity: DXFEntity) => {
    // Пробуем найти позицию вставки блока
    const entityAny = entity as Record<string, unknown>;
    let position: Point | undefined;
    
    if (entity.position) {
      position = entity.position;
    } else if (entityAny.position) {
      const pos = entityAny.position as Record<string, unknown>;
      if (typeof pos.x === 'number' && typeof pos.y === 'number') {
        position = { x: pos.x, y: pos.y };
      }
    }
    
    if (!position) return;
    
    // Рисуем крестик для обозначения блока
    const size = 5;
    ctx.beginPath();
    ctx.moveTo(position.x - size, position.y - size);
    ctx.lineTo(position.x + size, position.y + size);
    ctx.moveTo(position.x - size, position.y + size);
    ctx.lineTo(position.x + size, position.y - size);
    ctx.stroke();
    
    // Рисуем маленький кружок в центре
    ctx.beginPath();
    ctx.arc(position.x, position.y, 2, 0, 2 * Math.PI);
    ctx.stroke();
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Очистка canvas
    ctx.clearRect(0, 0, width, height);
    
    console.log(`Rendering ${data.entities.length} entities`);
    
    // Фильтруем видимые объекты
    const visibleEntities = data.entities.filter(entity => visibleLayers.has(entity.layer));
    console.log(`Visible entities: ${visibleEntities.length}`);
    
    // Вычисление границ чертежа только для видимых объектов
    const calculatedBounds = calculateBounds(visibleEntities);
    console.log('Calculated bounds:', calculatedBounds);
    
    // Проверяем, есть ли валидные границы
    if (calculatedBounds.minX === Infinity || calculatedBounds.maxX === -Infinity) {
      console.warn('No valid bounds found - no entities to display');
      return;
    }
    
    // Настройка трансформации для масштабирования и центрирования
    const scale = calculateScale(calculatedBounds, width, height);
    const centerX = (calculatedBounds.minX + calculatedBounds.maxX) / 2;
    const centerY = (calculatedBounds.minY + calculatedBounds.maxY) / 2;
    
    console.log(`Scale: ${scale}, Center: (${centerX}, ${centerY})`);
    
    ctx.save();
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(scale * zoom, -scale * zoom); // Инвертируем Y для CAD координат
    ctx.translate(-centerX, -centerY);
    
    // Рендеринг сетки
    drawGrid(ctx, calculatedBounds, scale);
    
    // Рендеринг объектов
    let renderedCount = 0;
    visibleEntities.forEach(entity => {
      const pointsBefore = getEntityPoints(entity);
      if (pointsBefore.length > 0) {
        drawEntity(ctx, entity);
        renderedCount++;
      }
    });
    
    console.log(`Rendered ${renderedCount} out of ${visibleEntities.length} entities`);
    
    ctx.restore();
  }, [data, width, height, zoom, pan, calculateBounds, drawEntity, visibleLayers, getEntityPoints]);

  // Обработка клавиш для панорамирования
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const step = 20;
      
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          event.preventDefault();
          setPan(prev => ({ ...prev, y: prev.y + step }));
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          event.preventDefault();
          setPan(prev => ({ ...prev, y: prev.y - step }));
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          event.preventDefault();
          setPan(prev => ({ ...prev, x: prev.x + step }));
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          event.preventDefault();
          setPan(prev => ({ ...prev, x: prev.x - step }));
          break;
        case '=':
        case '+':
          event.preventDefault();
          handleZoomIn();
          break;
        case '-':
          event.preventDefault();
          handleZoomOut();
          break;
        case '0':
        case 'Home':
          event.preventDefault();
          handleResetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 10));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Функции управления слоями
  const toggleLayer = (layerName: string) => {
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerName)) {
        newSet.delete(layerName);
      } else {
        newSet.add(layerName);
      }
      return newSet;
    });
  };

  const toggleAllLayers = () => {
    if (visibleLayers.size === availableLayers.length) {
      // Скрыть все слои
      setVisibleLayers(new Set());
    } else {
      // Показать все слои
      setVisibleLayers(new Set(availableLayers));
    }
  };

  const getLayerEntityCount = (layerName: string) => {
    return data.entities.filter(entity => entity.layer === layerName).length;
  };

  // Обработчики для панорамирования
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setLastMousePos({ x: event.clientX, y: event.clientY });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const deltaX = event.clientX - lastMousePos.x;
    const deltaY = event.clientY - lastMousePos.y;

    setPan(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));

    setLastMousePos({ x: event.clientX, y: event.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Обработчик колеса мыши для зуммирования
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.1), 10);
    
    // Зуммирование к позиции курсора
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = event.clientX - rect.left - width / 2;
      const mouseY = event.clientY - rect.top - height / 2;
      
      const zoomFactor = newZoom / zoom;
      setPan(prev => ({
        x: prev.x - (mouseX * (zoomFactor - 1)),
        y: prev.y - (mouseY * (zoomFactor - 1))
      }));
    }
    
    setZoom(newZoom);
  };

  return (
    <div className="dxf-canvas-container">
      <div className="canvas-controls">
        <div className="zoom-controls">
          <button onClick={handleZoomIn} title="Увеличить">🔍+</button>
          <button onClick={handleZoomOut} title="Уменьшить">🔍-</button>
          <button onClick={handleResetView} title="Сбросить вид">⌂</button>
        </div>
        <div className="pan-controls">
          <button onClick={() => setPan(prev => ({ ...prev, y: prev.y + 50 }))} title="Вверх">⬆️</button>
          <div className="pan-horizontal">
            <button onClick={() => setPan(prev => ({ ...prev, x: prev.x + 50 }))} title="Влево">⬅️</button>
            <button onClick={() => setPan(prev => ({ ...prev, x: prev.x - 50 }))} title="Вправо">➡️</button>
          </div>
          <button onClick={() => setPan(prev => ({ ...prev, y: prev.y - 50 }))} title="Вниз">⬇️</button>
        </div>
        <div className="layer-controls">
          <button 
            onClick={() => setShowLayerPanel(!showLayerPanel)} 
            title="Управление слоями"
            className={showLayerPanel ? 'active' : ''}
          >
            📋 Слои ({visibleLayers.size}/{availableLayers.length})
          </button>
        </div>
        <div className="info-panel">
          <span className="zoom-info">Масштаб: {Math.round(zoom * 100)}%</span>
          <span className="pan-info">Смещение: {Math.round(pan.x)}, {Math.round(pan.y)}</span>
          <span className="help-info">💡 Перетаскивайте мышью или используйте стрелки/WASD</span>
        </div>
      </div>

      {showLayerPanel && (
        <div className="layers-panel">
          <div className="layers-header">
            <h4>Управление слоями</h4>
            <button onClick={toggleAllLayers} className="toggle-all-button">
              {visibleLayers.size === availableLayers.length ? '👁️‍🗨️ Скрыть все' : '👁️ Показать все'}
            </button>
          </div>
          <div className="layers-list">
            {availableLayers.map(layerName => (
              <div key={layerName} className="layer-item">
                <label className="layer-checkbox">
                  <input
                    type="checkbox"
                    checked={visibleLayers.has(layerName)}
                    onChange={() => toggleLayer(layerName)}
                  />
                  <span className="checkmark"></span>
                </label>
                <div className="layer-info">
                  <span className="layer-name">{layerName}</span>
                  <span className="layer-count">({getLayerEntityCount(layerName)} объектов)</span>
                </div>
                <div 
                  className="layer-color" 
                  style={{ backgroundColor: getEntityColor({ layer: layerName } as DXFEntity) }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="dxf-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
    </div>
  );
};
