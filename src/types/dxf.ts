export interface Point {
  x: number;
  y: number;
}

export interface DXFEntity {
  type: string;
  layer: string;
  color?: number;
  lineType?: string;
  start?: Point;
  end?: Point;
  center?: Point;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  vertices?: Point[];
  closed?: boolean;
  // Дополнительные поля для совместимости с dxf-parser
  startPoint?: Point;
  endPoint?: Point;
  centerPoint?: Point;
  position?: Point;
  [key: string]: unknown;
}

export interface DXFData {
  header: Record<string, unknown>;
  entities: DXFEntity[];
  blocks: Record<string, unknown>;
  tables: Record<string, unknown>;
}

export interface ParsedDXF {
  success: boolean;
  data?: DXFData;
  error?: string;
}

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  loading?: boolean;
}
