import { useState, useRef, useCallback, useEffect } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import StringArtCanvas, { type CanvasHandle } from "./StringArtCanvas";
import ControlPanel from "./ControlPanel";
import type { CanvasConfig, CanvasSettings, Nail, Thread, Tool, ImageLayer, DesignSnapshot, LineStyle } from "./types";
import { distributeNails, unitToPx, pxToUnit } from "./geometry";

const defaultCanvas: CanvasConfig = {
  width: 800,
  height: 800,
  unit: "px",
  dpi: 96,
};

const defaultSettings: CanvasSettings = {
  showGrid: true,
  snapToGrid: false,
  gridSize: 40,
  nailRadius: 4,
  nailColor: "#94a3b8",
  showNails: true,
  backgroundColor: "#0a0a0a",
};

const defaultGlobalLineStyle: LineStyle = "solid";

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_HISTORY = 100;

const toolHotkeys: Record<string, Tool> = {
  v: "select",
  n: "nail",
  t: "thread",
  i: "image",
  f: "pan",
};

export default function App() {
  const [canvas, setCanvas] = useState<CanvasConfig>(defaultCanvas);
  const [settings, setSettings] = useState<CanvasSettings>(defaultSettings);
  const [nails, setNails] = useState<Nail[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [imageLayer, setImageLayer] = useState<ImageLayer | null>(null);
  const [tool, setTool] = useState<Tool>("nail");
  const [selectedNailId, setSelectedNailId] = useState<string | null>(null);
  const [buildingThreadNailIds, setBuildingThreadNailIds] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [globalThreadColor, setGlobalThreadColor] = useState("#e2e8f0");
  const [globalThreadThickness, setGlobalThreadThickness] = useState(1.5);
  const [globalThreadOpacity, setGlobalThreadOpacity] = useState(0.85);
  const [globalLineStyle] = useState<LineStyle>(defaultGlobalLineStyle);

  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      backgroundColor: theme === "light" ? "#f8fafc" : prev.backgroundColor === "#f8fafc" ? "#0a0a0a" : prev.backgroundColor,
    }));
  }, [theme]);

  const canvasCompRef = useRef<CanvasHandle>(null);

  // --- Undo/Redo history ---
  const historyRef = useRef<{ past: DesignSnapshot[]; future: DesignSnapshot[] }>({ past: [], future: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const skipHistoryRef = useRef(false);

  const snapshot = useCallback((): DesignSnapshot => ({
    canvas: { ...canvas },
    nails: nails.map((n) => ({ ...n })),
    threads: threads.map((t) => ({ ...t, nailIds: [...t.nailIds] })),
    settings: { ...settings },
    imageLayer: imageLayer ? { ...imageLayer } : null,
  }), [canvas, nails, threads, settings, imageLayer]);

  const restoreSnapshot = useCallback((snap: DesignSnapshot) => {
    skipHistoryRef.current = true;
    setCanvas({ ...snap.canvas });
    setNails(snap.nails.map((n) => ({ ...n })));
    setThreads(snap.threads.map((t) => ({ ...t, nailIds: [...t.nailIds] })));
    setSettings({ ...snap.settings });
    setImageLayer(snap.imageLayer ? { ...snap.imageLayer } : null);
    setBuildingThreadNailIds([]);
    setSelectedNailId(null);
    setActiveThreadId(null);
  }, []);

  const pushHistory = useCallback(() => {
    const snap = snapshot();
    historyRef.current.past.push(snap);
    if (historyRef.current.past.length > MAX_HISTORY) historyRef.current.past.shift();
    historyRef.current.future = [];
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(false);
  }, [snapshot]);

  const onUndo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const current = snapshot();
    future.push(current);
    past.pop();
    restoreSnapshot(prev);
    setCanUndo(past.length > 0);
    setCanRedo(future.length > 0);
  }, [snapshot, restoreSnapshot]);

  const onRedo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = snapshot();
    past.push(current);
    future.pop();
    restoreSnapshot(next);
    setCanUndo(past.length > 0);
    setCanRedo(future.length > 0);
  }, [snapshot, restoreSnapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        onRedo();
        return;
      }

      if (isEditableTarget || e.altKey) return;

      const nextTool = toolHotkeys[e.key.toLowerCase()];
      if (nextTool) {
        e.preventDefault();
        setTool((prev) => (prev === nextTool ? prev : nextTool));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndo, onRedo]);

  // --- Settings (no history for view toggles like grid) ---
  const onSettingsChange = useCallback((patch: Partial<CanvasSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // --- Nails ---
  const onAddNail = useCallback((x: number, y: number) => {
    pushHistory();
    const nail: Nail = { id: uid("nail"), x, y, radius: settings.nailRadius };
    setNails((prev) => [...prev, nail]);
  }, [settings.nailRadius, pushHistory]);

  const onSelectNail = useCallback((id: string | null) => {
    setSelectedNailId(id);
  }, []);

  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const onMoveNail = useCallback((id: string, x: number, y: number) => {
    if (!dragStartPosRef.current) {
      dragStartPosRef.current = { x, y };
      pushHistory();
    }
    setNails((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, [pushHistory]);

  const onMoveNailEnd = useCallback(() => {
    dragStartPosRef.current = null;
  }, []);

  const onDeleteNail = useCallback((id: string) => {
    pushHistory();
    setNails((prev) => prev.filter((n) => n.id !== id));
    setThreads((prev) => prev.map((t) => ({ ...t, nailIds: t.nailIds.filter((nid) => nid !== id) })));
    setBuildingThreadNailIds((prev) => prev.filter((nid) => nid !== id));
    setSelectedNailId(null);
  }, [pushHistory]);

  const onClearNails = useCallback(() => {
    pushHistory();
    setNails([]);
    setThreads([]);
    setBuildingThreadNailIds([]);
    setSelectedNailId(null);
  }, [pushHistory]);

  const onDistributeNails = useCallback((shape: "circle" | "square", count: number) => {
    pushHistory();
    const newNails = distributeNails(shape, count, canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.8, settings.nailRadius);
    setNails((prev) => [...prev, ...newNails]);
  }, [canvas.width, canvas.height, settings.nailRadius, pushHistory]);

  // --- Threads ---
  const onAddThread = useCallback(() => {
    pushHistory();
    const id = uid("thread");
    const thread: Thread = {
      id,
      name: `Thread ${threads.length + 1}`,
      color: globalThreadColor,
      thickness: globalThreadThickness,
      opacity: globalThreadOpacity,
      lineStyle: globalLineStyle,
      nailIds: [],
      visible: true,
    };
    setThreads((prev) => [...prev, thread]);
    setActiveThreadId(id);
    setBuildingThreadNailIds([]);
    setTool("thread");
  }, [threads.length, globalThreadColor, globalThreadThickness, globalThreadOpacity, globalLineStyle, pushHistory]);

  const onDeleteThread = useCallback((id: string) => {
    pushHistory();
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setBuildingThreadNailIds([]);
    }
  }, [activeThreadId, pushHistory]);

  const onUpdateThread = useCallback((id: string, patch: Partial<Thread>) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const onSetActiveThread = useCallback((id: string) => {
    setActiveThreadId(id);
    const t = threads.find((t) => t.id === id);
    setBuildingThreadNailIds(t ? [...t.nailIds] : []);
    setTool("thread");
  }, [threads]);

  const onThreadAddNail = useCallback((nailId: string) => {
    if (!activeThreadId) return;
    pushHistory();
    setBuildingThreadNailIds((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === nailId) return prev;
      const next = [...prev, nailId];
      setThreads((prevT) => prevT.map((t) => (t.id === activeThreadId ? { ...t, nailIds: next } : t)));
      return next;
    });
  }, [activeThreadId, pushHistory]);

  const onFinishThread = useCallback(() => {
    setBuildingThreadNailIds([]);
    setActiveThreadId(null);
    setTool("select");
  }, []);

  // --- Image ---
  const onImportImage = useCallback((file: File) => {
    pushHistory();
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        setImageLayer({
          src,
          x: (canvas.width - w) / 2,
          y: (canvas.height - h) / 2,
          scale,
          opacity: 0.5,
          visible: true,
          locked: true,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [canvas.width, canvas.height, pushHistory]);

  const onImageLayerChange = useCallback((patch: Partial<ImageLayer>) => {
    setImageLayer((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const onImageMove = useCallback((x: number, y: number) => {
    setImageLayer((prev) => (prev ? { ...prev, x, y } : prev));
  }, []);

  const onRemoveImage = useCallback(() => {
    pushHistory();
    setImageLayer(null);
  }, [pushHistory]);

  // --- Export ---
  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const onExportPNG = useCallback(() => {
    const dataUrl = canvasCompRef.current?.exportImage("png", true);
    if (dataUrl) downloadDataUrl(dataUrl, "string-art.png");
  }, []);

  const onExportJPEG = useCallback(() => {
    const dataUrl = canvasCompRef.current?.exportImage("jpeg", true);
    if (dataUrl) downloadDataUrl(dataUrl, "string-art.jpg");
  }, []);

  const onExportJSON = useCallback(() => {
    const data = {
      canvas: { width: canvas.width, height: canvas.height, unit: canvas.unit, dpi: canvas.dpi },
      nails: nails.map((n, i) => ({
        index: i, id: n.id, x: n.x, y: n.y,
        xUnit: pxToUnit(n.x, canvas.unit, canvas.dpi),
        yUnit: pxToUnit(n.y, canvas.unit, canvas.dpi),
      })),
      threads: threads.map((t) => ({
        id: t.id, name: t.name, color: t.color, thickness: t.thickness, opacity: t.opacity, lineStyle: t.lineStyle,
        sequence: t.nailIds.map((nid, idx) => {
          const nailIndex = nails.findIndex((n) => n.id === nid);
          return { step: idx + 1, nailIndex: nailIndex >= 0 ? nailIndex : -1, nailId: nid };
        }),
        sequenceText: t.nailIds.map((nid) => {
          const idx = nails.findIndex((n) => n.id === nid);
          return idx >= 0 ? `Nail ${idx}` : nid;
        }).join(" -> "),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, "string-art-data.json");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [canvas, nails, threads]);

  const displayWidth = pxToUnit(canvas.width, canvas.unit, canvas.dpi);
  const displayHeight = pxToUnit(canvas.height, canvas.unit, canvas.dpi);

  return (
    <div className="h-screen w-screen flex bg-app text-primary overflow-hidden">
      <div className={`transition-all duration-300 ${panelOpen ? "w-80" : "w-0"} flex-shrink-0 overflow-hidden`}>
        {panelOpen && (
          <ControlPanel
            canvas={{ ...canvas, width: displayWidth, height: displayHeight }}
            settings={settings}
            threads={threads}
            activeThreadId={activeThreadId}
            imageLayer={imageLayer}
            tool={tool}
            nailCount={nails.length}
            globalThreadColor={globalThreadColor}
            globalThreadThickness={globalThreadThickness}
            globalThreadOpacity={globalThreadOpacity}
            onCanvasChange={(patch) => {
              if (patch.width !== undefined) {
                pushHistory();
                setCanvas((prev) => ({ ...prev, width: unitToPx(patch.width!, canvas.unit, canvas.dpi) }));
              } else if (patch.height !== undefined) {
                pushHistory();
                setCanvas((prev) => ({ ...prev, height: unitToPx(patch.height!, canvas.unit, canvas.dpi) }));
              } else if (patch.unit) {
                setCanvas((prev) => ({ ...prev, unit: patch.unit! }));
              } else {
                pushHistory();
                setCanvas((prev) => ({ ...prev, ...patch }));
              }
            }}
            onSettingsChange={onSettingsChange}
            onToolChange={setTool}
            onAddThread={onAddThread}
            onDeleteThread={onDeleteThread}
            onUpdateThread={onUpdateThread}
            onSetActiveThread={onSetActiveThread}
            onFinishThread={onFinishThread}
            onDistributeNails={onDistributeNails}
            onClearNails={onClearNails}
            onImportImage={onImportImage}
            onImageLayerChange={onImageLayerChange}
            onRemoveImage={onRemoveImage}
            onExportPNG={onExportPNG}
            onExportJPEG={onExportJPEG}
            onExportJSON={onExportJSON}
            onGlobalThreadColor={setGlobalThreadColor}
            onGlobalThreadThickness={setGlobalThreadThickness}
            onGlobalThreadOpacity={setGlobalThreadOpacity}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        )}
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-auto bg-app custom-scroll">
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="absolute top-4 left-4 z-10 p-2 bg-panel backdrop-blur-md border border-subtle rounded-lg text-secondary hover:text-primary hover:bg-hover transition-all"
        >
          {panelOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 bg-panel backdrop-blur-md border border-subtle rounded-lg text-secondary hover:text-primary hover:bg-hover transition-all"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="px-3 py-1.5 bg-panel backdrop-blur-md border border-subtle rounded-lg text-xs text-secondary font-mono">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {tool === "thread" && activeThreadId && (
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 px-4 py-2 rounded-lg border border-blue-500/30 bg-blue-600/70 backdrop-blur-md text-sm text-white/90 shadow-lg">
            Click nails to build thread sequence — click "Done" when finished
          </div>
        )}
        {tool === "nail" && (
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 px-4 py-2 rounded-lg border border-subtle bg-panel/70 backdrop-blur-md text-sm text-secondary/80 shadow-lg">
            Click canvas to place nails — double-click a nail to delete
          </div>
        )}

        <div
          className="flex items-center justify-center min-w-full min-h-full"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, padding: "40px" }}
        >
          <StringArtCanvas
            ref={canvasCompRef}
            canvas={canvas}
            nails={nails}
            threads={threads}
            imageLayer={imageLayer}
            settings={settings}
            tool={tool}
            selectedNailId={selectedNailId}
            buildingThreadNailIds={buildingThreadNailIds}
            onAddNail={onAddNail}
            onSelectNail={onSelectNail}
            onMoveNail={onMoveNail}
            onMoveNailEnd={onMoveNailEnd}
            onDeleteNail={onDeleteNail}
            onThreadAddNail={onThreadAddNail}
            onImageMove={onImageMove}
            globalThreadColor={globalThreadColor}
            globalThreadThickness={globalThreadThickness}
            globalThreadOpacity={globalThreadOpacity}
            zoom={zoom}
            pan={pan}
            onPanChange={setPan}
            onZoomChange={setZoom}
          />
        </div>
      </div>
    </div>
  );
}
