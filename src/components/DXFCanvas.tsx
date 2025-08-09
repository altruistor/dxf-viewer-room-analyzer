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

interface Room {
  id: string;
  bounds: Bounds;
  area: number;
  entities: DXFEntity[];
  isEnclosed: boolean;
}

interface LineSegment {
  start: Point;
  end: Point;
  entity: DXFEntity;
}

// Новые типы для улучшенного алгоритма детекции комнат

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
  const [detectedRooms, setDetectedRooms] = useState<Room[]>([]);
  const [showRoomAnalysis, setShowRoomAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Function to fix encoding issues in layer names
  const fixEncoding = useCallback((str: string): string => {
    // If the string contains only replacement characters, try to simplify for display
    if (/^[�_\-\s\w]+$/.test(str)) {
      // Replace replacement characters with readable alternatives
      return str
        .replace(/�+/g, 'Layer') // Replace groups of � with "Layer"
        .replace(/_{2,}/g, '_') // Remove repeated underscores
        .trim();
    }

    return str; // Return as is if there are normal characters
  }, []);

  // Получаем все уникальные слои из данных
  const availableLayers = React.useMemo(() => {
    const layers = new Set<string>();
    data.entities.forEach(entity => {
      // Исправляем кодировку имени слоя
      const fixedLayerName = fixEncoding(entity.layer);
      layers.add(fixedLayerName);
    });
    const layersArray = Array.from(layers).sort();
    console.log('Available layers (fixed encoding):', layersArray);
    console.log('Original layer names:', data.entities.slice(0, 5).map(e => e.layer));
    return layersArray;
  }, [data.entities, fixEncoding]);

  // Инициализируем все слои как видимые при первой загрузке

  // Вспомогательная функция для вычисления границ набора точек
  const calculateEntityBounds = useCallback((points: Point[]): Bounds => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    
    return { minX, minY, maxX, maxY };
  }, []);

  // Вычисление площади полигона по формуле Shoelace
  const calculatePolygonArea = useCallback((points: Point[]): number => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
  }, []);

  // Кластеризация близких INSERT блоков
  const clusterNearbyInserts = useCallback((entities: DXFEntity[]): DXFEntity[][] => {
    const clusters: DXFEntity[][] = [];
    const used = new Set<number>();
    const tolerance = 100; // Максимальное расстояние между соседними блоками
    
    entities.forEach((entity, index) => {
      if (used.has(index)) return;
      
      const cluster = [entity];
      used.add(index);
      
      // Временно используем простое извлечение координат без getEntityPoints
      const entityAny = entity as Record<string, unknown>;
      let entityPoint: Point | null = null;
      
      if (entityAny.position && typeof entityAny.position === 'object') {
        const pos = entityAny.position as Record<string, unknown>;
        if (typeof pos.x === 'number' && typeof pos.y === 'number') {
          entityPoint = { x: pos.x, y: pos.y };
        }
      }
      
      if (!entityPoint) return;
      
      // Ищем ближайшие блоки
      entities.forEach((otherEntity, otherIndex) => {
        if (used.has(otherIndex)) return;
        
        const otherEntityAny = otherEntity as Record<string, unknown>;
        let otherPoint: Point | null = null;
        
        if (otherEntityAny.position && typeof otherEntityAny.position === 'object') {
          const pos = otherEntityAny.position as Record<string, unknown>;
          if (typeof pos.x === 'number' && typeof pos.y === 'number') {
            otherPoint = { x: pos.x, y: pos.y };
          }
        }
        
        if (!otherPoint) return;
        
        const distance = Math.sqrt(
          Math.pow(entityPoint.x - otherPoint.x, 2) + 
          Math.pow(entityPoint.y - otherPoint.y, 2)
        );
        
        if (distance <= tolerance) {
          cluster.push(otherEntity);
          used.add(otherIndex);
        }
      });
      
      clusters.push(cluster);
    });
    
    return clusters;
  }, []);


  useEffect(() => {
    const allLayers = new Set(availableLayers);
    console.log('Setting visible layers:', allLayers);
    setVisibleLayers(allLayers);
  }, [availableLayers]);

  const getEntityPoints = useCallback((entity: DXFEntity): Point[] => {
    const points: Point[] = [];
    
    // Добавляем диагностику для первых 5 сущностей
    const entityIndex = data.entities.indexOf(entity);
    if (entityIndex < 5) {
      console.log(`🔍 getEntityPoints для сущности ${entityIndex}:`, {
        type: entity.type,
        layer: entity.layer,
        keys: Object.keys(entity as Record<string, unknown>),
        entity: entity
      });
    }
    

    const extractPoint = (obj: unknown): Point | null => {
      if (!obj) return null;
      

      if (Array.isArray(obj) && obj.length >= 2) {
        return { x: obj[0] as number, y: obj[1] as number };
      }
      
      const pointAny = obj as Record<string, unknown>;
      

      if (typeof pointAny.x === 'number' && typeof pointAny.y === 'number') {
        return { x: pointAny.x, y: pointAny.y };
      }
      
      return null;
    };
    
    const entityAny = entity as Record<string, unknown>;

    // console.log(`Processing entity type: ${entity.type}`, entity);

    switch (entity.type?.toUpperCase()) {
      case 'LINE': {

        const startFields = ['start', 'startPoint', 'vertices'];
        const endFields = ['end', 'endPoint'];
        
        let start: Point | null = null;
        let end: Point | null = null;

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

        if (entity.handle === '61') { 
          console.log('Processing INSERT entity:', entityAny);
          console.log('Available fields:', Object.keys(entityAny));
        }
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

        if (entityAny.center) {
          const center = extractPoint(entityAny.center);
          if (center) {

            points.push(center);

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

    // console.log(`Entity ${entity.type} extracted points:`, points);
    return points;
  }, [data.entities]);

  const calculateBounds = useCallback((entities: DXFEntity[]): Bounds => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let totalPoints = 0;
    
    console.log(`Calculating bounds for ${entities.length} entities`);
    
    entities.forEach((entity, index) => {
      const points = getEntityPoints(entity);
      if (index < 3) { 
        console.log(`Entity ${index} (${entity.type}): ${points.length} points`, points);
      }
      
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

  // Новая улучшенная версия алгоритма комнат - безопасная, но функциональная
  const analyzeRoomsImproved = async () => {
    console.log('🚀🚀🚀 УЛУЧШЕННАЯ ВЕРСИЯ ЗАПУЩЕНА 🚀🚀🚀');
    console.log('🔥 Время:', new Date().toLocaleTimeString());
    
    try {
      // Включаем индикатор анализа
      setIsAnalyzing(true);
      console.log('🔥 Индикатор анализа включен');
      
      // Пауза для UI
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const rooms: Room[] = [];
      
      // Этап 1: Поиск готовых замкнутых полилиний (самый быстрый)
      console.log('📐 Этап 1: Поиск готовых полилиний...');
      let polylineRooms = 0;
      
      // Ограничиваем количество объектов для анализа
      const maxEntities = Math.min(data.entities.length, 1000); // Увеличили лимит
      const limitedEntities = data.entities.slice(0, maxEntities);
      
      console.log(`📊 Анализируем ${limitedEntities.length} из ${data.entities.length} объектов`);
      
      for (let i = 0; i < limitedEntities.length; i++) {
        const entity = limitedEntities[i];
        
        if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
          try {
            const points = getEntityPoints(entity);
            
            if (points.length >= 3) { // Вернули к 3 точкам
              const area = calculatePolygonArea(points);
              
              console.log(`    📐 Полилиния ${i}: точек=${points.length}, площадь=${area.toFixed(0)}`);
              
              // Более широкие критерии для площади
              if (area > 1000 && area < 10000000) { // от 1м² до 10000м²
                const bounds = calculateEntityBounds(points);
                const width = bounds.maxX - bounds.minX;
                const height = bounds.maxY - bounds.minY;
                
                // Проверяем, что это разумный прямоугольник (не слишком вытянутый)
                const aspectRatio = Math.max(width, height) / Math.min(width, height);
                if (aspectRatio < 20) { // Увеличили до 20:1
                  rooms.push({
                    id: `poly_room_${polylineRooms}`,
                    bounds,
                    area,
                    entities: [entity],
                    isEnclosed: true
                  });
                  
                  polylineRooms++;
                  console.log(`  ✅ Полилиния-комната ${polylineRooms}: ${width.toFixed(0)}×${height.toFixed(0)}, площадь ${area.toFixed(0)}, соотношение ${aspectRatio.toFixed(1)}`);
                  
                  // Ограничиваем количество найденных полилиний
                  if (polylineRooms >= 10) {
                    console.log('  🛑 Достигнут лимит полилиний (10)');
                    break;
                  }
                } else {
                  console.log(`    ❌ Слишком вытянутая форма: соотношение сторон ${aspectRatio.toFixed(1)}`);
                }
              } else {
                console.log(`    ❌ Площадь ${area.toFixed(0)} не подходит (нужно 1000-10000000)`);
              }
            }
          } catch (error) {
            console.warn(`  ⚠️ Ошибка при обработке полилинии ${i}:`, error);
          }
        }
        
        // Пауза каждые 50 объектов
        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      console.log(`📐 Этап 1 завершён: найдено ${polylineRooms} полилиний-комнат`);
      
      // Этап 2: Улучшенный анализ прямоугольных комнат из линий
      if (polylineRooms < 5) { // Повысили порог
        console.log('🔲 Этап 2: Поиск прямоугольных комнат из линий...');
        
        // Собираем линии
        const lines: Array<{start: Point, end: Point, entity: DXFEntity}> = [];
        const maxLines = 300; // Увеличили лимит линий
        
        for (const entity of limitedEntities) {
          if (lines.length >= maxLines) break;
          
          if (entity.type === 'LINE') {
            try {
              const points = getEntityPoints(entity);
              if (points.length >= 2) {
                const lineLength = Math.sqrt(
                  Math.pow(points[1].x - points[0].x, 2) + 
                  Math.pow(points[1].y - points[0].y, 2)
                );
                // Фильтруем очень короткие линии
                if (lineLength > 10) { // Понизили минимальную длину
                  lines.push({
                    start: points[0],
                    end: points[1],
                    entity
                  });
                }
              }
            } catch (error) {
              console.warn('  ⚠️ Ошибка при обработке линии:', error);
            }
          }
        }
        
        console.log(`  📏 Собрано ${lines.length} линий`);
        
        // Анализируем длины линий для понимания масштаба
        const lineLengths = lines.map(line => {
          const dx = line.end.x - line.start.x;
          const dy = line.end.y - line.start.y;
          return Math.sqrt(dx * dx + dy * dy);
        }).sort((a, b) => a - b);
        
        if (lineLengths.length > 0) {
          const avgLength = lineLengths[Math.floor(lineLengths.length / 2)];
          console.log(`  📏 Медианная длина линий: ${avgLength.toFixed(0)}`);
          console.log(`  📏 Диапазон длин: ${lineLengths[0].toFixed(0)} - ${lineLengths[lineLengths.length-1].toFixed(0)}`);
        }
        
        // Разделяем на горизонтальные и вертикальные с улучшенной логикой
        const horizontal: typeof lines = [];
        const vertical: typeof lines = [];
        const tolerance = 15; // Увеличили угловой допуск до 15 градусов
        
        lines.forEach(line => {
          const dx = line.end.x - line.start.x;
          const dy = line.end.y - line.start.y;
          const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
          
          if (angle < tolerance || angle > (90 - tolerance)) {
            if (Math.abs(dx) > Math.abs(dy)) {
              horizontal.push(line);
            } else {
              vertical.push(line);
            }
          }
        });
        
        console.log(`  📏 Горизонтальных: ${horizontal.length}, вертикальных: ${vertical.length}`);
        
        // Улучшенный поиск прямоугольников - с менее строгой фильтрацией
        const maxH = Math.min(horizontal.length, 30); // Увеличили лимит
        const maxV = Math.min(vertical.length, 30);
        let rectangleRooms = 0;
        const foundRectangles: Room[] = [];
        
        for (let i = 0; i < maxH && rectangleRooms < 8; i++) { // Увеличили лимит результатов
          for (let j = i + 1; j < maxH && rectangleRooms < 8; j++) {
            const h1 = horizontal[i];
            const h2 = horizontal[j];
            
            const heightDiff = Math.abs(h1.start.y - h2.start.y);
            // Менее строгие требования к размеру
            if (heightDiff < 500 || heightDiff > 50000) continue; // от 0.5м до 50м
            
            for (let k = 0; k < maxV && rectangleRooms < 8; k++) {
              for (let l = k + 1; l < maxV && rectangleRooms < 8; l++) {
                const v1 = vertical[k];
                const v2 = vertical[l];
                
                const widthDiff = Math.abs(v1.start.x - v2.start.x);
                if (widthDiff < 500 || widthDiff > 50000) continue;
                
                const area = heightDiff * widthDiff;
                // Менее строгие требования к площади
                if (area > 100000 && area < 1000000000) { // от 100м² до 1000000м²
                  
                  const bounds = {
                    minX: Math.min(h1.start.x, h1.end.x, h2.start.x, h2.end.x),
                    maxX: Math.max(h1.start.x, h1.end.x, h2.start.x, h2.end.x),
                    minY: Math.min(v1.start.y, v1.end.y, v2.start.y, v2.end.y),
                    maxY: Math.max(v1.start.y, v1.end.y, v2.start.y, v2.end.y)
                  };
                  
                  const newRoom = {
                    id: `rect_room_${rectangleRooms}`,
                    bounds,
                    area,
                    entities: [h1.entity, h2.entity, v1.entity, v2.entity],
                    isEnclosed: true
                  };
                  
                  foundRectangles.push(newRoom);
                  rectangleRooms++;
                  console.log(`  ✅ Прямоугольная комната ${rectangleRooms}: ${widthDiff.toFixed(0)}×${heightDiff.toFixed(0)}, площадь ${area.toFixed(0)}`);
                }
              }
            }
          }
        }
        
        // Сортируем найденные прямоугольники по площади и берем только лучшие
        foundRectangles.sort((a, b) => b.area - a.area);
        const bestRectangles = foundRectangles.slice(0, Math.min(5, foundRectangles.length)); // Максимум 5 лучших
        rooms.push(...bestRectangles);
        
        console.log(`🔲 Этап 2 завершён: найдено ${bestRectangles.length} прямоугольных комнат`);
      }
      
      // Этап 3: Поиск комнат через анализ кругов и эллипсов
      console.log('🔵 Этап 3: Поиск круглых комнат...');
      let circleRooms = 0;
      
      for (const entity of limitedEntities) {
        if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
          try {
            const points = getEntityPoints(entity);
            if (points.length >= 2) {
              const bounds = calculateEntityBounds(points);
              const area = Math.PI * Math.pow((bounds.maxX - bounds.minX) / 2, 2);
              
              // Круглые комнаты - менее строгие критерии
              if (area > 500 && area < 5000000) { // от 0.5м² до 5000м²
                rooms.push({
                  id: `circle_room_${circleRooms}`,
                  bounds,
                  area,
                  entities: [entity],
                  isEnclosed: true
                });
                
                circleRooms++;
                console.log(`  ✅ Круглая комната ${circleRooms}: диаметр ${(bounds.maxX - bounds.minX).toFixed(0)}, площадь ${area.toFixed(0)}`);
                
                if (circleRooms >= 8) break; // Увеличили лимит
              }
            }
          } catch (error) {
            console.warn(`  ⚠️ Ошибка при обработке круга:`, error);
          }
        }
      }
      
      console.log(`🔵 Этап 3 завершён: найдено ${circleRooms} круглых комнат`);
      
      // Пауза для UI
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log(`� Итого найдено: ${rooms.length} реальных комнат`);
      
      // Устанавливаем результат
      setDetectedRooms(rooms);
      console.log('🔥 Результат установлен');
      
      console.log('🚀🚀🚀 УЛУЧШЕННАЯ ВЕРСИЯ ЗАВЕРШЕНА 🚀🚀🚀');
      
      return rooms;
      
    } catch (error) {
      console.error('❌ Ошибка в улучшенном алгоритме:', error);
      setDetectedRooms([]);
      return [];
    } finally {
      // Всегда выключаем индикатор анализа
      setIsAnalyzing(false);
      console.log('🔥 Индикатор анализа выключен');
    }
  };

  // Функция для анализа замкнутых контуров (комнат) - оригинальная версия
  const analyzeRooms = () => {
    console.log('🔍 Анализ комнат начат (стандартный алгоритм)...');
    console.log(`📊 Всего объектов в данных: ${data.entities.length}`);
    console.log(`👁️ Видимых слоев: ${Array.from(visibleLayers)}`);
    
    const rooms: Room[] = [];
    let polylineCount = 0;
    let checkedCount = 0;
    
    // Фильтруем только видимые объекты (как на канвасе)
    const visibleEntities = data.entities.filter(entity => {
      const fixedLayerName = fixEncoding(entity.layer);
      return visibleLayers.has(fixedLayerName);
    });
    
    console.log(`📋 Видимых объектов после фильтрации: ${visibleEntities.length}`);
    
    // Ищем замкнутые полилинии (готовые комнаты) только среди видимых
    visibleEntities.forEach((entity, index) => {
      if ((entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE')) {
        polylineCount++;
        const points = getEntityPoints(entity);
        console.log(`📐 Полилиния ${index} (${polylineCount}): тип=${entity.type}, слой=${entity.layer}, точек=${points.length}`);
        
        if (points.length >= 3) {
          checkedCount++;
          const bounds = calculateEntityBounds(points);
          const area = calculatePolygonArea(points);
          
          console.log(`    📊 Площадь=${area.toFixed(0)}, размеры=${(bounds.maxX - bounds.minX).toFixed(0)}×${(bounds.maxY - bounds.minY).toFixed(0)}`);
          
          // Более широкие критерии для поиска комнат
          if (area > 1000 && area < 10000000) { // от 1м² до 10000м²
            rooms.push({
              id: `room_${rooms.length + 1}`,
              bounds,
              area,
              entities: [entity],
              isEnclosed: entity.closed || true
            });
            console.log(`✅ Найдена комната ${rooms.length}: площадь ${area.toFixed(0)}, размер ${(bounds.maxX - bounds.minX).toFixed(0)}×${(bounds.maxY - bounds.minY).toFixed(0)}`);
          } else {
            console.log(`    ❌ Площадь ${area.toFixed(0)} не подходит (нужно 1000-10000000)`);
          }
        } else {
          console.log(`    ⚠️ Недостаточно точек: ${points.length} (нужно минимум 3)`);
        }
      }
    });

    console.log(`📈 Статистика: полилиний=${polylineCount}, проверено=${checkedCount}, найдено комнат=${rooms.length}`);
    console.log(`🏠 Найдено ${rooms.length} реальных комнат (стандартный алгоритм)`);
    setDetectedRooms(rooms);
    
    return rooms;
  };

  // Новый алгоритм: анализ комнат по видимому канвасу
  const analyzeRoomsByCanvas = async () => {
    console.log('🎨🎨🎨 АНАЛИЗ ПО КАНВАСУ ЗАПУЩЕН 🎨🎨🎨');
    console.log('🔥 Время:', new Date().toLocaleTimeString());
    
    try {
      setIsAnalyzing(true);
      console.log('🔥 Индикатор анализа включен');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const rooms: Room[] = [];
      
      // Фильтруем только видимые объекты (то что пользователь видит на канвасе)
      const visibleEntities = data.entities.filter(entity => {
        const fixedLayerName = fixEncoding(entity.layer);
        return visibleLayers.has(fixedLayerName);
      });
      
      console.log(`🎨 Анализируем ${visibleEntities.length} видимых объектов из ${data.entities.length} общих`);
      console.log(`👁️ Активные слои: ${Array.from(visibleLayers).join(', ')}`);
      
      // Этап 1: Поиск готовых полилиний среди видимых объектов
      console.log('🔍 Этап 1: Поиск полилиний в видимых слоях...');
      let foundPolylines = 0;
      
      for (const entity of visibleEntities) {
        if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
          try {
            const points = getEntityPoints(entity);
            
            if (points.length >= 3) {
              const area = calculatePolygonArea(points);
              const bounds = calculateEntityBounds(points);
              const width = bounds.maxX - bounds.minX;
              const height = bounds.maxY - bounds.minY;
              
              console.log(`  📐 Полилиния на слое "${entity.layer}": точек=${points.length}, площадь=${area.toFixed(0)}, размер=${width.toFixed(0)}×${height.toFixed(0)}`);
              
              // Очень широкие критерии для видимых объектов
              if (area > 500 && area < 50000000 && width > 50 && height > 50) {
                const aspectRatio = Math.max(width, height) / Math.min(width, height);
                
                if (aspectRatio < 50) { // Очень либеральное соотношение сторон
                  rooms.push({
                    id: `canvas_poly_${foundPolylines}`,
                    bounds,
                    area,
                    entities: [entity],
                    isEnclosed: true
                  });
                  
                  foundPolylines++;
                  console.log(`  ✅ Найдена полилиния-комната ${foundPolylines}: ${width.toFixed(0)}×${height.toFixed(0)}, площадь ${area.toFixed(0)}, слой "${entity.layer}"`);
                } else {
                  console.log(`    ❌ Слишком вытянутая: соотношение ${aspectRatio.toFixed(1)}`);
                }
              } else {
                console.log(`    ❌ Не подходит: площадь=${area.toFixed(0)}, размер=${width.toFixed(0)}×${height.toFixed(0)}`);
              }
            }
          } catch (error) {
            console.warn(`  ⚠️ Ошибка при обработке полилинии:`, error);
          }
        }
      }
      
      console.log(`🔍 Этап 1 завершён: найдено ${foundPolylines} полилиний-комнат`);
      
      // Этап 2: Анализ прямоугольников из линий (только видимых)
      console.log('📏 Этап 2: Поиск прямоугольников из видимых линий...');
      
      const visibleLines: Array<{start: Point, end: Point, entity: DXFEntity}> = [];
      
      for (const entity of visibleEntities) {
        if (entity.type === 'LINE') {
          try {
            const points = getEntityPoints(entity);
            if (points.length >= 2) {
              const lineLength = Math.sqrt(
                Math.pow(points[1].x - points[0].x, 2) + 
                Math.pow(points[1].y - points[0].y, 2)
              );
              
              if (lineLength > 20) { // Минимальная длина линии
                visibleLines.push({
                  start: points[0],
                  end: points[1],
                  entity
                });
              }
            }
          } catch (error) {
            console.warn('  ⚠️ Ошибка при обработке линии:', error);
          }
        }
      }
      
      console.log(`  📏 Найдено ${visibleLines.length} видимых линий`);
      
      // Группируем линии по направлениям
      const horizontal: typeof visibleLines = [];
      const vertical: typeof visibleLines = [];
      const tolerance = 20; // Угловой допуск в градусах
      
      visibleLines.forEach(line => {
        const dx = line.end.x - line.start.x;
        const dy = line.end.y - line.start.y;
        const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
        
        if (angle < tolerance || angle > (90 - tolerance)) {
          if (Math.abs(dx) > Math.abs(dy)) {
            horizontal.push(line);
          } else {
            vertical.push(line);
          }
        }
      });
      
      console.log(`  📏 Горизонтальных: ${horizontal.length}, вертикальных: ${vertical.length}`);
      
      // Поиск прямоугольников
      let rectangleRooms = 0;
      const maxSearch = 15; // Ограничиваем поиск для производительности
      
      for (let i = 0; i < Math.min(horizontal.length, maxSearch) && rectangleRooms < 6; i++) {
        for (let j = i + 1; j < Math.min(horizontal.length, maxSearch) && rectangleRooms < 6; j++) {
          const h1 = horizontal[i];
          const h2 = horizontal[j];
          
          const heightDiff = Math.abs(h1.start.y - h2.start.y);
          if (heightDiff < 100 || heightDiff > 20000) continue;
          
          for (let k = 0; k < Math.min(vertical.length, maxSearch) && rectangleRooms < 6; k++) {
            for (let l = k + 1; l < Math.min(vertical.length, maxSearch) && rectangleRooms < 6; l++) {
              const v1 = vertical[k];
              const v2 = vertical[l];
              
              const widthDiff = Math.abs(v1.start.x - v2.start.x);
              if (widthDiff < 100 || widthDiff > 20000) continue;
              
              const area = heightDiff * widthDiff;
              if (area > 50000 && area < 500000000) {
                const bounds = {
                  minX: Math.min(h1.start.x, h1.end.x, h2.start.x, h2.end.x),
                  maxX: Math.max(h1.start.x, h1.end.x, h2.start.x, h2.end.x),
                  minY: Math.min(v1.start.y, v1.end.y, v2.start.y, v2.end.y),
                  maxY: Math.max(v1.start.y, v1.end.y, v2.start.y, v2.end.y)
                };
                
                rooms.push({
                  id: `canvas_rect_${rectangleRooms}`,
                  bounds,
                  area,
                  entities: [h1.entity, h2.entity, v1.entity, v2.entity],
                  isEnclosed: true
                });
                
                rectangleRooms++;
                console.log(`  ✅ Прямоугольная комната ${rectangleRooms}: ${widthDiff.toFixed(0)}×${heightDiff.toFixed(0)}, площадь ${area.toFixed(0)}`);
              }
            }
          }
        }
      }
      
      console.log(`📏 Этап 2 завершён: найдено ${rectangleRooms} прямоугольных комнат`);
      
      // Этап 3: Поиск кругов среди видимых объектов
      console.log('⭕ Этап 3: Поиск круглых комнат в видимых слоях...');
      let circleRooms = 0;
      
      for (const entity of visibleEntities) {
        if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
          try {
            const points = getEntityPoints(entity);
            if (points.length >= 2) {
              const bounds = calculateEntityBounds(points);
              const diameter = bounds.maxX - bounds.minX;
              const area = Math.PI * Math.pow(diameter / 2, 2);
              
              console.log(`  ⭕ Круг на слое "${entity.layer}": диаметр=${diameter.toFixed(0)}, площадь=${area.toFixed(0)}`);
              
              if (area > 1000 && area < 10000000 && diameter > 50) {
                rooms.push({
                  id: `canvas_circle_${circleRooms}`,
                  bounds,
                  area,
                  entities: [entity],
                  isEnclosed: true
                });
                
                circleRooms++;
                console.log(`  ✅ Круглая комната ${circleRooms}: диаметр ${diameter.toFixed(0)}, площадь ${area.toFixed(0)}, слой "${entity.layer}"`);
              }
            }
          } catch (error) {
            console.warn(`  ⚠️ Ошибка при обработке круга:`, error);
          }
        }
      }
      
      console.log(`⭕ Этап 3 завершён: найдено ${circleRooms} круглых комнат`);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log(`🎨 Итого найдено по канвасу: ${rooms.length} комнат`);
      console.log(`📊 Распределение: полилинии=${foundPolylines}, прямоугольники=${rectangleRooms}, круги=${circleRooms}`);
      
      setDetectedRooms(rooms);
      console.log('🔥 Результат установлен');
      
      console.log('🎨🎨🎨 АНАЛИЗ ПО КАНВАСУ ЗАВЕРШЁН 🎨🎨🎨');
      
      return rooms;
      
    } catch (error) {
      console.error('❌ Ошибка в анализе по канвасу:', error);
      setDetectedRooms([]);
      return [];
    } finally {
      setIsAnalyzing(false);
      console.log('🔥 Индикатор анализа выключен');
    }
  };
    console.log('�🚨🚨 НОВАЯ ПРОСТЕЙШАЯ ВЕРСИЯ ЗАПУЩЕНА 🚨🚨🚨');
    console.log('🔥 Время:', new Date().toLocaleTimeString());
    
    // Включаем индикатор анализа
    setIsAnalyzing(true);
    console.log('🔥 Индикатор анализа включен');
    
    // Создаём одну тестовую комнату БЕЗ async/await
    const testRooms: Room[] = [
      {
        id: 'simple_test_room',
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        area: 1000000,
        entities: [],
        isEnclosed: true
      }
    ];
    
    console.log('🔥 Тестовая комната создана:', testRooms);
    
    // Устанавливаем результат
    setDetectedRooms(testRooms);
    console.log('🔥 Результат установлен');
    
    // Выключаем индикатор анализа
    setIsAnalyzing(false);
    console.log('🔥 Индикатор анализа выключен');
    
    console.log('🚨🚨🚨 НОВАЯ ПРОСТЕЙШАЯ ВЕРСИЯ ЗАВЕРШЕНА 🚨🚨🚨');
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

  const drawInsert = useCallback((ctx: CanvasRenderingContext2D, entity: DXFEntity) => {
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
    
    // Получаем имя блока
    const blockName = entityAny.name || entityAny.blockName;
    
    // Если есть данные о блоках, пытаемся отобразить содержимое блока
    if (data.blocks && blockName && data.blocks[blockName as string]) {
      const block = data.blocks[blockName as string] as Record<string, unknown>;
      console.log(`Rendering block "${blockName}":`, block);
      
      // Если в блоке есть entities, рисуем их
      if (block.entities && Array.isArray(block.entities)) {
        ctx.save();
        ctx.translate(position.x, position.y);
        
        // Применяем масштаб блока если есть
        const scaleX = (entityAny.scaleX as number) || 1;
        const scaleY = (entityAny.scaleY as number) || 1;
        const rotation = (entityAny.rotation as number) || 0;
        
        if (scaleX !== 1 || scaleY !== 1) {
          ctx.scale(scaleX, scaleY);
        }
        if (rotation !== 0) {
          ctx.rotate(rotation);
        }
        
        // Рисуем все entity из блока
        block.entities.forEach((blockEntity: DXFEntity) => {
          // Рисуем содержимое блока напрямую
          ctx.strokeStyle = getEntityColor(blockEntity);
          ctx.lineWidth = 1;
          
          switch (blockEntity.type) {
            case 'LINE':
              drawLine(ctx, blockEntity);
              break;
            case 'CIRCLE':
              drawCircle(ctx, blockEntity);
              break;
            case 'ARC':
              drawArc(ctx, blockEntity);
              break;
            case 'POLYLINE':
            case 'LWPOLYLINE':
              drawPolyline(ctx, blockEntity);
              break;
            // Избегаем рекурсии для INSERT внутри блоков
            case 'INSERT':
              console.log('Nested INSERT found in block, skipping to avoid recursion');
              break;
          }
        });
        
        ctx.restore();
      } else {
        // Если нет entities в блоке, рисуем как обычно крестик, но меньшего размера
        const size = 5;
        ctx.strokeStyle = '#00ff00'; // Зелёный для блоков без содержимого
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.moveTo(position.x - size, position.y - size);
        ctx.lineTo(position.x + size, position.y + size);
        ctx.moveTo(position.x - size, position.y + size);
        ctx.lineTo(position.x + size, position.y - size);
        ctx.stroke();
      }
    } else {
      // Если блок не найден, рисуем простой маркер
      const size = 3;
      ctx.strokeStyle = '#0000ff'; // Синий для неопределённых блоков
      ctx.lineWidth = 1;
      
      // Рисуем квадрат
      ctx.beginPath();
      ctx.rect(position.x - size, position.y - size, size * 2, size * 2);
      ctx.stroke();
      
      // Рисуем точку в центре
      ctx.beginPath();
      ctx.arc(position.x, position.y, 1, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [data.blocks]);

  const drawEntity = useCallback((ctx: CanvasRenderingContext2D, entity: DXFEntity, skipLayerCheck: boolean = false) => {
    // Проверяем, видим ли слой (если не skipLayerCheck)
    if (!skipLayerCheck && !visibleLayers.has(entity.layer)) return;
    
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
  }, [visibleLayers, drawInsert]);

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

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Очистка canvas
    ctx.clearRect(0, 0, width, height);
    
    console.log(`Rendering ${data.entities.length} entities`);
    console.log('Current visible layers:', Array.from(visibleLayers));
    
    // Логируем информацию о блоках в DXF данных
    if (data.blocks) {
      console.log('DXF blocks available:', Object.keys(data.blocks));
      console.log('First block:', Object.values(data.blocks)[0]);
    } else {
      console.log('No blocks found in DXF data');
    }
    
    // Фильтруем видимые объекты с исправлением кодировки слоев
    // Временно показываем все объекты для отладки
    const visibleEntities = data.entities;
    /*
    const visibleEntities = data.entities.filter(entity => {
      const fixedLayerName = fixEncoding(entity.layer);
      const isVisible = visibleLayers.has(fixedLayerName);
      if (!isVisible) {
        console.log(`Entity layer "${entity.layer}" (fixed: "${fixedLayerName}") not in visible layers`);
      }
      return isVisible;
    });
    */
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
  }, [data, width, height, zoom, pan, calculateBounds, drawEntity, visibleLayers, getEntityPoints, fixEncoding]);

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
    return data.entities.filter(entity => fixEncoding(entity.layer) === layerName).length;
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
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.1), 10);
    
    // Зуммирование к позиции курсора
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left - width / 2;
      const mouseY = event.clientY - rect.top - height / 2;
      
      const zoomFactor = newZoom / zoom;
      setPan(prev => ({
        x: prev.x - (mouseX * (zoomFactor - 1)),
        y: prev.y - (mouseY * (zoomFactor - 1))
      }));
    }
    
    setZoom(newZoom);
  }, [zoom, width, height]);

  // Добавляем обработчик колеса мыши через useEffect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  return (
    <div className="dxf-canvas-container">
      <div className="canvas-controls">
        <div className="zoom-controls">
          <button onClick={handleZoomIn} title="Увеличить">+</button>
          <button onClick={handleZoomOut} title="Уменьшить">-</button>
          <button onClick={handleResetView} title="Сбросить вид">RESET</button>
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
          <button 
            onClick={() => {
              const rooms = analyzeRooms();
              setShowRoomAnalysis(!showRoomAnalysis);
              console.log('Найденные комнаты (стандартный алгоритм):', rooms);
            }} 
            title="Анализ комнат (стандартный)"
            className={showRoomAnalysis ? 'active' : ''}
          >
            🏠 Комнаты ({detectedRooms.length})
          </button>
          <button 
            onClick={async () => {
              console.log('🔵 Кнопка "Улучшенный" нажата');
              
              if (isAnalyzing) {
                console.log('🟡 Анализ уже выполняется, игнорируем нажатие');
                return; // Предотвращаем повторные нажатия
              }
              
              console.log('🟢 Начинаем выполнение улучшенного алгоритма...');
              
              try {
                console.log('🔄 Вызываем analyzeRoomsImproved()...');
                const rooms = await analyzeRoomsImproved();
                console.log('✅ analyzeRoomsImproved() завершён, результат:', rooms);
                
                setShowRoomAnalysis(true);
                console.log('✅ Панель анализа комнат включена');
                
                console.log('🏠 Найденные комнаты (улучшенный алгоритм):', rooms);
              } catch (error) {
                console.error('❌ Ошибка при выполнении улучшенного алгоритма:', error);
                alert('Произошла ошибка при анализе комнат. Попробуйте стандартный алгоритм.');
              }
              
              console.log('🔵 Обработка нажатия кнопки завершена');
            }} 
            title="Анализ комнат (улучшенный алгоритм)"
            className={showRoomAnalysis ? 'active' : ''}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '⏳ Анализ...' : `🏠+ Улучшенный (${detectedRooms.length})`}
          </button>
          <button 
            onClick={async () => {
              console.log('🎨 Кнопка "По канвасу" нажата');
              
              if (isAnalyzing) {
                console.log('🟡 Анализ уже выполняется, игнорируем нажатие');
                return;
              }
              
              console.log('🟢 Начинаем анализ по видимому канвасу...');
              
              try {
                const rooms = await analyzeRoomsByCanvas();
                console.log('✅ Анализ по канвасу завершён, результат:', rooms);
                
                setShowRoomAnalysis(true);
                console.log('✅ Панель анализа комнат включена');
                
                console.log('🎨 Найденные комнаты по канвасу:', rooms);
              } catch (error) {
                console.error('❌ Ошибка при анализе по канвасу:', error);
                alert('Произошла ошибка при анализе комнат по канвасу.');
              }
              
              console.log('🎨 Обработка нажатия кнопки завершена');
            }} 
            title="Анализ комнат по видимому канвасу"
            className={showRoomAnalysis ? 'active' : ''}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '⏳ Анализ...' : `🎨 По канвасу (${detectedRooms.length})`}
          </button>
        </div>
        <div className="info-panel">
          <span className="zoom-info">Zoom: {Math.round(zoom * 100)}%</span>
          <span className="pan-info">Pan: {Math.round(pan.x)}, {Math.round(pan.y)}</span>
          <span className="help-info">Drag with mouse or use arrow keys/WASD</span>
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

      {showRoomAnalysis && (
        <div className="rooms-panel">
          <div className="rooms-header">
            <h4>Анализ комнат</h4>
            <button onClick={() => setShowRoomAnalysis(false)} className="close-button">
              ✕
            </button>
          </div>
          <div className="rooms-list">
            {detectedRooms.length === 0 ? (
              <p>Комнаты не найдены. Попробуйте нажать кнопку "🏠 Комнаты" для анализа.</p>
            ) : (
              detectedRooms.map(room => (
                <div key={room.id} className="room-item">
                  <div className="room-info">
                    <span className="room-name">{room.id}</span>
                    <span className="room-type">{room.isEnclosed ? '🔒 Замкнутая' : '📐 По блокам'}</span>
                    <span className="room-area">Площадь: {Math.round(room.area)} кв.ед.</span>
                    <span className="room-dimensions">
                      {Math.round(room.bounds.maxX - room.bounds.minX)} × {Math.round(room.bounds.maxY - room.bounds.minY)}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      // Центрируем вид на комнате
                      const centerX = (room.bounds.minX + room.bounds.maxX) / 2;
                      const centerY = (room.bounds.minY + room.bounds.maxY) / 2;
                      setPan({ x: width/2 - centerX, y: height/2 - centerY });
                      setZoom(2); // Увеличиваем для лучшего обзора
                    }}
                    className="focus-room-button"
                    title="Центрировать на комнате"
                  >
                    🎯
                  </button>
                </div>
              ))
            )}
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
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
    </div>
  );
};
