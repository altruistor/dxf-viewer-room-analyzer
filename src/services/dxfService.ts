import DxfParser from 'dxf-parser';
import type { DXFData, ParsedDXF } from '../types/dxf';

// Импортируем DWG парсер
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let LibreDWG: any = null;

// Асинхронная загрузка DWG библиотеки
const loadDWGLibrary = async () => {
  if (!LibreDWG) {
    try {
      const { LibreDwg, Dwg_File_Type } = await import('@mlightcad/libredwg-web');
      LibreDWG = await LibreDwg.create();
      console.log('DWG library loaded successfully');
      return { LibreDWG, Dwg_File_Type };
    } catch (error) {
      console.error('Failed to load DWG library:', error);
      throw error;
    }
  }
  return { LibreDWG, Dwg_File_Type: null };
};

export class DXFService {
  private parser: DxfParser;

  constructor() {
    this.parser = new DxfParser();
  }

  async parseCADFile(file: File): Promise<ParsedDXF> {
    try {
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (fileExtension === '.dwg') {
        return await this.parseDWGFile(file);
      } else {
        return await this.parseDXFFile(file);
      }
    } catch (error) {
      console.error('CAD file parsing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error'
      };
    }
  }

  async parseDXFFile(file: File): Promise<ParsedDXF> {
    try {
      const fileContent = await this.readFileAsText(file);
      const dxfData = this.parser.parseSync(fileContent);
      
      // Добавляем отладочную информацию
      console.log('Parsed DXF data structure:', dxfData);
      console.log('Entities found:', dxfData?.entities?.length || 0);
      console.log('First few entities:', dxfData?.entities?.slice(0, 5));
      
      return {
        success: true,
        data: dxfData as unknown as ParsedDXF['data']
      };
    } catch (error) {
      console.error('DXF parsing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error'
      };
    }
  }

  async parseDWGFile(file: File): Promise<ParsedDXF> {
    try {
      console.log('Attempting to parse DWG file:', file.name);
      
      // Загружаем DWG библиотеку
      const { LibreDWG: dwgLib, Dwg_File_Type } = await loadDWGLibrary();
      
      if (!dwgLib || !Dwg_File_Type) {
        throw new Error('Failed to load DWG library');
      }
      
      // Читаем файл как ArrayBuffer
      const fileBuffer = await this.readFileAsArrayBuffer(file);
      
      console.log(`DWG file size: ${fileBuffer.byteLength} bytes`);
      
      // Парсим DWG файл используя правильный API
      const dwgData = dwgLib.dwg_read_data(fileBuffer, Dwg_File_Type.DWG);
      
      if (!dwgData) {
        throw new Error('Failed to parse DWG file - no data returned');
      }
      
      console.log('DWG parsed successfully:', dwgData);
      
      // Конвертируем DWG данные в базу данных
      const database = dwgLib.convert(dwgData);
      
      console.log('DWG converted to database:', database);
      
      // Освобождаем память
      dwgLib.dwg_free(dwgData);
      
      // Конвертируем в формат, совместимый с DXF
      const convertedData = this.convertDWGToDXFFormat(database);
      
      return {
        success: true,
        data: convertedData
      };
      
    } catch (error) {
      console.error('DWG parsing error:', error);
      
      // Fallback к старому поведению
      return {
        success: false,
        error: `DWG parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. This might be an unsupported DWG version or corrupted file. Please convert your DWG file to DXF format first. You can use AutoCAD, FreeCAD, or online converters like: https://convertio.co/dwg-dxf/`
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertDWGToDXFFormat(database: any): DXFData {
    // Конвертация DWG базы данных в формат DXF
    console.log('Converting DWG database to DXF format:', database);
    
    // Извлекаем entities из базы данных
    const entities = database.entities || database.modelSpace?.entities || [];
    const blocks = database.blocks || {};
    
    console.log(`Converting DWG: found ${entities.length} entities and ${Object.keys(blocks).length} blocks`);
    
    // Логируем структуру первых нескольких entities для отладки
    if (entities.length > 0) {
      console.log('Sample entities:', entities.slice(0, 3));
    }
    
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entities: entities.map((entity: any, index: number) => {
        // Пытаемся извлечь основную информацию из entity
        const convertedEntity = {
          type: entity.type || entity.objectType || 'UNKNOWN',
          layer: entity.layer || entity.layerName || '0',
          handle: entity.handle || entity.objectHandle || `dwg_${index}`,
          // Копируем все остальные свойства
          ...entity
        };
        
        // Дополнительная обработка для основных типов
        if (entity.type === 'LINE' && entity.startPoint && entity.endPoint) {
          convertedEntity.start = entity.startPoint;
          convertedEntity.end = entity.endPoint;
        }
        
        if ((entity.type === 'CIRCLE' || entity.type === 'ARC') && entity.center) {
          convertedEntity.center = entity.center;
          convertedEntity.radius = entity.radius;
        }
        
        if ((entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') && entity.vertices) {
          convertedEntity.vertices = entity.vertices;
        }
        
        if (entity.type === 'INSERT' && entity.insertionPoint) {
          convertedEntity.position = entity.insertionPoint;
        }
        
        return convertedEntity;
      }),
      blocks: blocks,
      header: database.header || {},
      tables: database.tables || {}
    };
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsText(file);
    });
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as ArrayBuffer);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  static validateCADFile(file: File): boolean {
    const validExtensions = ['.dxf', '.DXF', '.dwg', '.DWG'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    return validExtensions.includes(fileExtension);
  }

  static validateDXFFile(file: File): boolean {
    const validExtensions = ['.dxf', '.DXF'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    return validExtensions.includes(fileExtension);
  }
}
