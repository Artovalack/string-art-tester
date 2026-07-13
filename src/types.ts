export type Vec2 = { x: number; y: number };

export type Unit = "px" | "cm" | "in";

export type LineStyle = "solid" | "dashed" | "dotted" | "dashdot" | "longdash";

export interface CanvasConfig {
  width: number; // in pixels (internal)
  height: number; // in pixels (internal)
  unit: Unit;
  dpi: number;
}

export interface Nail {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface Thread {
  id: string;
  name: string;
  color: string;
  thickness: number;
  opacity: number;
  lineStyle: LineStyle;
  nailIds: string[];
  visible: boolean;
}

export interface ImageLayer {
  src: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  naturalWidth: number;
  naturalHeight: number;
}

export interface CanvasSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  nailRadius: number;
  nailColor: string;
  showNails: boolean;
  backgroundColor: string;
}

export type Tool = "select" | "nail" | "thread" | "image" | "pan";

/** Snapshot of design data that participates in undo/redo. */
export interface DesignSnapshot {
  canvas: CanvasConfig;
  nails: Nail[];
  threads: Thread[];
  settings: CanvasSettings;
  imageLayer: ImageLayer | null;
}
