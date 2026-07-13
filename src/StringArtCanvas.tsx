import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import type { CanvasConfig, Nail, Thread, ImageLayer, CanvasSettings, Tool, Vec2 } from "./types";
import { buildThreadPath, snapToGrid, hitTestNail, dashPattern } from "./geometry";

export interface CanvasHandle {
  exportImage: (format: "png" | "jpeg", includeNails: boolean) => string;
  getCanvas: () => HTMLCanvasElement | null;
}

interface Props {
  canvas: CanvasConfig;
  nails: Nail[];
  threads: Thread[];
  imageLayer: ImageLayer | null;
  settings: CanvasSettings;
  tool: Tool;
  selectedNailId: string | null;
  buildingThreadNailIds: string[];
  onAddNail: (x: number, y: number) => void;
  onSelectNail: (id: string | null) => void;
  onMoveNail: (id: string, x: number, y: number) => void;
  onMoveNailEnd: () => void;
  onDeleteNail: (id: string) => void;
  onThreadAddNail: (nailId: string) => void;
  onImageMove: (x: number, y: number) => void;
  globalThreadColor: string;
  globalThreadThickness: number;
  globalThreadOpacity: number;
  zoom: number;
  pan: Vec2;
  onPanChange: (pan: Vec2) => void;
  onZoomChange: (zoom: number) => void;
}

const StringArtCanvas = forwardRef<CanvasHandle, Props>(function StringArtCanvas(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const stateRef = useRef(props);
  stateRef.current = props;

  const interactionRef = useRef<{
    mode: "none" | "drag-nail" | "pan" | "drag-image";
    dragNailId: string | null;
    dragOffset: Vec2;
    lastMouse: Vec2;
  }>({ mode: "none", dragNailId: null, dragOffset: { x: 0, y: 0 }, lastMouse: { x: 0, y: 0 } });

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { canvas: cfg, nails, threads, imageLayer, settings, zoom, selectedNailId, buildingThreadNailIds } = stateRef.current;

    const dpr = window.devicePixelRatio || 1;
    const displayW = cfg.width * zoom;
    const displayH = cfg.height * zoom;
    canvas.width = cfg.width * dpr;
    canvas.height = cfg.height * dpr;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, cfg.width, cfg.height);

    if (imageLayer && imageRef.current) {
      const img = imageRef.current;
      ctx.globalAlpha = imageLayer.opacity;
      const w = img.naturalWidth * imageLayer.scale;
      const h = img.naturalHeight * imageLayer.scale;
      ctx.drawImage(img, imageLayer.x, imageLayer.y, w, h);
      ctx.globalAlpha = 1;
    }

    if (settings.showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      const gs = settings.gridSize;
      ctx.beginPath();
      for (let x = 0; x <= cfg.width; x += gs) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cfg.height);
      }
      for (let y = 0; y <= cfg.height; y += gs) {
        ctx.moveTo(0, y);
        ctx.lineTo(cfg.width, y);
      }
      ctx.stroke();
    }

    for (const thread of threads) {
      if (!thread.visible || thread.nailIds.length < 2) continue;
      const segments = buildThreadPath(nails, thread.nailIds);
      ctx.strokeStyle = thread.color;
      ctx.lineWidth = thread.thickness;
      ctx.globalAlpha = thread.opacity;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const dash = dashPattern(thread.lineStyle, thread.thickness);
      if (dash.length > 0) ctx.setLineDash(dash); else ctx.setLineDash([]);
      for (const seg of segments) {
        if (seg.type === "line") {
          ctx.moveTo(seg.from.x, seg.from.y);
          ctx.lineTo(seg.to.x, seg.to.y);
        } else {
          ctx.arc(seg.center.x, seg.center.y, seg.radius, seg.startAngle, seg.endAngle, seg.ccw);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    if (buildingThreadNailIds.length >= 2) {
      const segments = buildThreadPath(nails, buildingThreadNailIds);
      ctx.strokeStyle = stateRef.current.globalThreadColor;
      ctx.lineWidth = stateRef.current.globalThreadThickness;
      ctx.globalAlpha = stateRef.current.globalThreadOpacity * 0.7;
      ctx.setLineDash([6, 4]);
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const seg of segments) {
        if (seg.type === "line") {
          ctx.moveTo(seg.from.x, seg.from.y);
          ctx.lineTo(seg.to.x, seg.to.y);
        } else {
          ctx.arc(seg.center.x, seg.center.y, seg.radius, seg.startAngle, seg.endAngle, seg.ccw);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    if (settings.showNails) {
      for (const nail of nails) {
        const isSelected = nail.id === selectedNailId;
        const isInBuilding = buildingThreadNailIds.includes(nail.id);

        ctx.beginPath();
        ctx.arc(nail.x, nail.y, nail.radius, 0, Math.PI * 2);
        ctx.fillStyle = settings.nailColor;
        ctx.fill();

        if (isSelected || isInBuilding) {
          ctx.beginPath();
          ctx.arc(nail.x, nail.y, nail.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? "#3b82f6" : "#10b981";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }, []);

  useEffect(() => {
    if (props.imageLayer) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        render();
      };
      img.src = props.imageLayer.src;
    } else {
      imageRef.current = null;
      render();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.imageLayer?.src]);

  useEffect(() => {
    render();
  });

  const getCanvasPos = useCallback((e: React.MouseEvent): Vec2 => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { zoom } = stateRef.current;
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const { tool, nails, settings, imageLayer, onAddNail, onSelectNail, onThreadAddNail } = stateRef.current;
    const interaction = interactionRef.current;

    if (e.button === 1 || (e.button === 0 && tool === "pan")) {
      interaction.mode = "pan";
      interaction.lastMouse = { x: e.clientX, y: e.clientY };
      return;
    }

    const hit = hitTestNail(nails, pos, 5);

    if (tool === "select") {
      if (hit) {
        interaction.mode = "drag-nail";
        interaction.dragNailId = hit.id;
        interaction.dragOffset = { x: pos.x - hit.x, y: pos.y - hit.y };
        onSelectNail(hit.id);
      } else {
        onSelectNail(null);
      }
    } else if (tool === "nail") {
      if (!hit) {
        let p = pos;
        if (settings.snapToGrid) {
          p = snapToGrid(p.x, p.y, settings.gridSize);
        }
        onAddNail(p.x, p.y);
      } else {
        interaction.mode = "drag-nail";
        interaction.dragNailId = hit.id;
        interaction.dragOffset = { x: pos.x - hit.x, y: pos.y - hit.y };
        onSelectNail(hit.id);
      }
    } else if (tool === "thread") {
      if (hit) {
        onThreadAddNail(hit.id);
      }
    } else if (tool === "image") {
      if (imageLayer && !imageLayer.locked && imageRef.current) {
        interaction.mode = "drag-image";
        interaction.lastMouse = { x: e.clientX, y: e.clientY };
      }
    }
  }, [getCanvasPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const interaction = interactionRef.current;
    const { onMoveNail, onPanChange, pan, zoom, onImageMove, imageLayer, settings } = stateRef.current;

    if (interaction.mode === "drag-nail" && interaction.dragNailId) {
      const pos = getCanvasPos(e);
      let x = pos.x - interaction.dragOffset.x;
      let y = pos.y - interaction.dragOffset.y;
      if (settings.snapToGrid) {
        const snapped = snapToGrid(x, y, settings.gridSize);
        x = snapped.x;
        y = snapped.y;
      }
      onMoveNail(interaction.dragNailId, x, y);
    } else if (interaction.mode === "pan") {
      const dx = e.clientX - interaction.lastMouse.x;
      const dy = e.clientY - interaction.lastMouse.y;
      onPanChange({ x: pan.x + dx, y: pan.y + dy });
      interaction.lastMouse = { x: e.clientX, y: e.clientY };
    } else if (interaction.mode === "drag-image" && imageLayer) {
      const dx = (e.clientX - interaction.lastMouse.x) / zoom;
      const dy = (e.clientY - interaction.lastMouse.y) / zoom;
      onImageMove(imageLayer.x + dx, imageLayer.y + dy);
      interaction.lastMouse = { x: e.clientX, y: e.clientY };
    }
  }, [getCanvasPos]);

  const handleMouseUp = useCallback(() => {
    if (interactionRef.current.mode === "drag-nail") {
      stateRef.current.onMoveNailEnd();
    }
    interactionRef.current.mode = "none";
    interactionRef.current.dragNailId = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const { zoom, onZoomChange } = stateRef.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(5, Math.max(0.1, zoom * delta));
    onZoomChange(newZoom);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const { nails, onDeleteNail } = stateRef.current;
    const hit = hitTestNail(nails, pos, 5);
    if (hit) {
      onDeleteNail(hit.id);
    }
  }, [getCanvasPos]);

  useImperativeHandle(ref, () => ({
    exportImage: (format: "png" | "jpeg", includeNails: boolean) => {
      const exportCanvas = document.createElement("canvas");
      const { canvas: cfg, nails, threads, settings, imageLayer } = stateRef.current;
      exportCanvas.width = cfg.width;
      exportCanvas.height = cfg.height;
      const ctx = exportCanvas.getContext("2d")!;
      ctx.fillStyle = settings.backgroundColor;
      ctx.fillRect(0, 0, cfg.width, cfg.height);

      if (imageLayer && imageRef.current) {
        const img = imageRef.current;
        ctx.globalAlpha = imageLayer.opacity;
        const w = img.naturalWidth * imageLayer.scale;
        const h = img.naturalHeight * imageLayer.scale;
        ctx.drawImage(img, imageLayer.x, imageLayer.y, w, h);
        ctx.globalAlpha = 1;
      }

      for (const thread of threads) {
        if (!thread.visible || thread.nailIds.length < 2) continue;
        const segments = buildThreadPath(nails, thread.nailIds);
        ctx.strokeStyle = thread.color;
        ctx.lineWidth = thread.thickness;
        ctx.globalAlpha = thread.opacity;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        const dash = dashPattern(thread.lineStyle, thread.thickness);
        if (dash.length > 0) ctx.setLineDash(dash); else ctx.setLineDash([]);
        for (const seg of segments) {
          if (seg.type === "line") {
            ctx.moveTo(seg.from.x, seg.from.y);
            ctx.lineTo(seg.to.x, seg.to.y);
          } else {
            ctx.arc(seg.center.x, seg.center.y, seg.radius, seg.startAngle, seg.endAngle, seg.ccw);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      if (includeNails) {
        for (const nail of nails) {
          ctx.beginPath();
          ctx.arc(nail.x, nail.y, nail.radius, 0, Math.PI * 2);
          ctx.fillStyle = settings.nailColor;
          ctx.fill();
        }
      }

      return exportCanvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", 0.95);
    },
    getCanvas: () => canvasRef.current,
  }));

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      className="rounded-lg"
      style={{ cursor: props.tool === "pan" ? "grab" : props.tool === "nail" ? "crosshair" : "default", boxShadow: "var(--canvas-shadow)", border: "2px solid var(--border-canvas)" }}
    />
  );
});

export default StringArtCanvas;
