import { useState, type ReactNode } from "react";
import { pxToUnit, unitToPx } from "./geometry";
import {
  ChevronDown,
  Settings,
  Circle,
  Spline,
  Image as ImageIcon,
  Download,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Grid3x3,
  Magnet,
  Lock,
  Unlock,
  Square,
  FileJson,
  Undo2,
  Redo2,
} from "lucide-react";
import type { CanvasConfig, Thread, CanvasSettings, Unit, Tool, ImageLayer, LineStyle } from "./types";

interface Props {
  canvas: CanvasConfig;
  settings: CanvasSettings;
  threads: Thread[];
  activeThreadId: string | null;
  imageLayer: ImageLayer | null;
  tool: Tool;
  nailCount: number;
  globalThreadColor: string;
  globalThreadThickness: number;
  globalThreadOpacity: number;
  onCanvasChange: (c: Partial<CanvasConfig>) => void;
  onSettingsChange: (s: Partial<CanvasSettings>) => void;
  onToolChange: (t: Tool) => void;
  onAddThread: () => void;
  onDeleteThread: (id: string) => void;
  onUpdateThread: (id: string, patch: Partial<Thread>) => void;
  onSetActiveThread: (id: string) => void;
  onFinishThread: () => void;
  onDistributeNails: (shape: "circle" | "square", count: number) => void;
  onClearNails: () => void;
  onImportImage: (file: File) => void;
  onImageLayerChange: (patch: Partial<ImageLayer>) => void;
  onRemoveImage: () => void;
  onExportPNG: () => void;
  onExportJPEG: () => void;
  onExportJSON: () => void;
  onGlobalThreadColor: (c: string) => void;
  onGlobalThreadThickness: (n: number) => void;
  onGlobalThreadOpacity: (n: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-secondary">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-medium text-secondary mb-1.5">{children}</label>;
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-input accent-blue-500"
    />
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={Math.round(value * 100) / 100}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-full px-2.5 py-1.5 text-sm bg-input border border-border-input rounded-md text-primary focus:outline-none focus:border-blue-500 transition-colors"
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-8 rounded cursor-pointer bg-transparent border border-border-input"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2.5 py-1.5 text-sm bg-input border border-border-input rounded-md text-primary font-mono focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

const toolButtons: { tool: Tool; label: string; hotkey: string; icon: ReactNode }[] = [
  { tool: "select", label: "Select", hotkey: "V", icon: <Square size={16} /> },
  { tool: "nail", label: "Nail", hotkey: "N", icon: <Circle size={16} /> },
  { tool: "thread", label: "Thread", hotkey: "T", icon: <Spline size={16} /> },
  { tool: "image", label: "Image", hotkey: "I", icon: <ImageIcon size={16} /> },
  { tool: "pan", label: "Pan", hotkey: "P", icon: <Plus size={16} className="rotate-45" /> },
];

export default function ControlPanel(props: Props) {
  const {
    canvas,
    settings,
    threads,
    activeThreadId,
    imageLayer,
    tool,
    nailCount,
    globalThreadColor,
    globalThreadThickness,
    globalThreadOpacity,
  } = props;

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const [distShape, setDistShape] = useState<"circle" | "square">("circle");
  const [distCount, setDistCount] = useState(24);

  return (
    <div className="w-80 h-full bg-panel backdrop-blur-xl border-r border-border-subtle flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-primary tracking-tight">String Art Studio</h1>
            <p className="text-xs text-muted mt-0.5">Design & test string art</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={props.onUndo}
              disabled={!props.canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={props.onRedo}
              disabled={!props.canRedo}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <Label>Tools</Label>
        <div className="grid grid-cols-5 gap-1.5">
          {toolButtons.map((tb) => (
            <button
              key={tb.tool}
              onClick={() => props.onToolChange(tb.tool)}
              title={`${tb.label} (${tb.hotkey})`}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                tool === tb.tool
                  ? "bg-blue-600 text-white"
                  : "bg-input text-secondary hover:bg-input-hover hover:text-primary"
              }`}
            >
              {tb.icon}
              <span className="text-[10px] font-medium">{tb.label}</span>
              <span className="text-[9px] uppercase tracking-wide opacity-70">{tb.hotkey}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {/* Canvas Settings */}
        <Section title="Canvas" icon={<Settings size={15} />}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Width</Label>
              <NumberInput value={canvas.width} onChange={(v) => props.onCanvasChange({ width: v })} min={100} />
            </div>
            <div>
              <Label>Height</Label>
              <NumberInput value={canvas.height} onChange={(v) => props.onCanvasChange({ height: v })} min={100} />
            </div>
          </div>
          <div>
            <Label>Unit</Label>
            <select
              value={canvas.unit}
              onChange={(e) => props.onCanvasChange({ unit: e.target.value as Unit })}
              className="w-full px-2.5 py-1.5 text-sm bg-input border border-border-input rounded-md text-primary focus:outline-none focus:border-blue-500"
            >
              <option value="px">Pixels (px)</option>
              <option value="cm">Centimeters (cm)</option>
              <option value="in">Inches (in)</option>
            </select>
          </div>
          <div>
            <Label>DPI: {canvas.dpi}</Label>
            <Slider value={canvas.dpi} min={72} max={600} step={1} onChange={(v) => props.onCanvasChange({ dpi: v })} />
          </div>
          <div>
            <Label>Background</Label>
            <ColorInput value={settings.backgroundColor} onChange={(v) => props.onSettingsChange({ backgroundColor: v })} />
          </div>
        </Section>

        {/* Nail Settings */}
        <Section title="Nails" icon={<Circle size={15} />}>
          <div className="flex items-center justify-between text-xs text-secondary">
            <span>{nailCount} nails placed</span>
            <button
              onClick={props.onClearNails}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div>
            <Label>Nail Radius: {settings.nailRadius}px</Label>
            <Slider value={settings.nailRadius} min={1} max={20} step={0.5} onChange={(v) => props.onSettingsChange({ nailRadius: v })} />
          </div>
          <div>
            <Label>Nail Color</Label>
            <ColorInput value={settings.nailColor} onChange={(v) => props.onSettingsChange({ nailColor: v })} />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => props.onSettingsChange({ showNails: !settings.showNails })}
              className="flex items-center gap-2 text-xs text-secondary hover:text-primary transition-colors"
            >
              {settings.showNails ? <Eye size={14} /> : <EyeOff size={14} />}
              {settings.showNails ? "Visible" : "Hidden"}
            </button>
            <button
              onClick={() => props.onSettingsChange({ showGrid: !settings.showGrid })}
              className={`flex items-center gap-2 text-xs transition-colors ${settings.showGrid ? "text-blue-400" : "text-secondary"}`}
            >
              <Grid3x3 size={14} />
              Grid
            </button>
            <button
              onClick={() => props.onSettingsChange({ snapToGrid: !settings.snapToGrid })}
              className={`flex items-center gap-2 text-xs transition-colors ${settings.snapToGrid ? "text-blue-400" : "text-secondary"}`}
            >
              <Magnet size={14} />
              Snap
            </button>
          </div>
          {settings.showGrid && (
            <div>
              <Label>Grid Size</Label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  value={Number(pxToUnit(settings.gridSize, canvas.unit, canvas.dpi).toFixed(2))}
                  min={canvas.unit === "px" ? 1 : 0.01}
                  step={canvas.unit === "px" ? 1 : 0.1}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    props.onSettingsChange({ gridSize: Math.round(unitToPx(Number.isFinite(parsed) ? parsed : 0, canvas.unit, canvas.dpi)) });
                  }}
                  className="flex-1 px-2.5 py-1.5 text-sm bg-input border border-border-input rounded-md text-primary focus:outline-none focus:border-blue-500 transition-colors"
                />
                <span className="px-2.5 py-1.5 text-sm bg-input border border-border-input rounded-md text-secondary min-w-[3.5rem] text-center">
                  {canvas.unit}
                </span>
              </div>
              <Slider
                value={pxToUnit(settings.gridSize, canvas.unit, canvas.dpi)}
                min={canvas.unit === "px" ? 5 : 0.1}
                max={canvas.unit === "px" ? 100 : 10}
                step={canvas.unit === "px" ? 5 : 0.1}
                onChange={(v) => props.onSettingsChange({ gridSize: Math.round(unitToPx(v, canvas.unit, canvas.dpi)) })}
              />
            </div>
          )}
          {/* Distribute */}
          <div className="pt-2 border-t border-border-subtle">
            <Label>Distribute Nails</Label>
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => setDistShape("circle")}
                className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${distShape === "circle" ? "bg-blue-600 text-white" : "bg-input text-secondary"}`}
              >
                Circle
              </button>
              <button
                onClick={() => setDistShape("square")}
                className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${distShape === "square" ? "bg-blue-600 text-white" : "bg-input text-secondary"}`}
              >
                Square
              </button>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Count</Label>
                <NumberInput value={distCount} onChange={setDistCount} min={3} max={500} />
              </div>
              <button
                onClick={() => props.onDistributeNails(distShape, distCount)}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors whitespace-nowrap"
              >
                Place
              </button>
            </div>
          </div>
        </Section>

        {/* Threads */}
        <Section title="Threads" icon={<Spline size={15} />}>
          {/* Global thread defaults */}
          <div className="pb-2 border-b border-border-subtle">
            <Label>Default Color</Label>
            <ColorInput value={globalThreadColor} onChange={props.onGlobalThreadColor} />
            <div className="mt-2">
              <Label>Default Thickness: {globalThreadThickness}px</Label>
              <Slider value={globalThreadThickness} min={0.5} max={10} step={0.5} onChange={props.onGlobalThreadThickness} />
            </div>
            <div className="mt-2">
              <Label>Default Opacity: {Math.round(globalThreadOpacity * 100)}%</Label>
              <Slider value={globalThreadOpacity} min={0.05} max={1} step={0.05} onChange={props.onGlobalThreadOpacity} />
            </div>
          </div>

          {/* Thread list */}
          <div className="space-y-1.5 pt-2">
            {threads.length === 0 && (
              <p className="text-xs text-muted text-center py-2">No threads yet</p>
            )}
            {threads.map((t) => (
              <div
                key={t.id}
                className={`p-2 rounded-lg cursor-pointer transition-colors ${activeThreadId === t.id ? "bg-blue-600/20 border border-blue-500/40" : "bg-input/50 border border-transparent hover:bg-input"}`}
                onClick={() => props.onSetActiveThread(t.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border border-border-input" style={{ background: t.color }} />
                    <span className="text-xs font-medium text-primary">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); props.onUpdateThread(t.id, { visible: !t.visible }); }}
                      className="text-secondary hover:text-primary p-1"
                    >
                      {t.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); props.onDeleteThread(t.id); }}
                      className="text-secondary hover:text-red-400 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {activeThreadId === t.id && (
                  <div className="mt-2 space-y-2 pt-2 border-t border-border-subtle">
                    <div>
                      <Label>Color</Label>
                      <ColorInput value={t.color} onChange={(v) => props.onUpdateThread(t.id, { color: v })} />
                    </div>
                    <div>
                      <Label>Thickness: {t.thickness}px</Label>
                      <Slider value={t.thickness} min={0.5} max={10} step={0.5} onChange={(v) => props.onUpdateThread(t.id, { thickness: v })} />
                    </div>
                    <div>
                      <Label>Opacity: {Math.round(t.opacity * 100)}%</Label>
                      <Slider value={t.opacity} min={0.05} max={1} step={0.05} onChange={(v) => props.onUpdateThread(t.id, { opacity: v })} />
                    </div>
                    <div>
                      <Label>Line Style</Label>
                      <select
                        value={t.lineStyle}
                        onChange={(e) => props.onUpdateThread(t.id, { lineStyle: e.target.value as LineStyle })}
                        className="w-full px-2.5 py-1.5 text-sm bg-input border border-border-input rounded-md text-primary focus:outline-none focus:border-blue-500"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                        <option value="dashdot">Dash-Dot</option>
                        <option value="longdash">Long Dash</option>
                      </select>
                    </div>
                    <div className="text-xs text-muted">{t.nailIds.length} nails in sequence</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={props.onAddThread}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
            >
              <Plus size={14} />
              New Thread
            </button>
            {activeThread && activeThread.nailIds.length >= 2 && (
              <button
                onClick={props.onFinishThread}
                className="flex-1 py-2 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-500 transition-colors"
              >
                Done
              </button>
            )}
          </div>
          {tool === "thread" && (
            <p className="text-xs text-blue-400 mt-2 text-center">
              Click nails to add to active thread
            </p>
          )}
        </Section>

        {/* Image / Tracing */}
        <Section title="Tracing Image" icon={<ImageIcon size={15} />} defaultOpen={false}>
          {!imageLayer ? (
            <label className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-border-input rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
              <ImageIcon size={24} className="text-muted" />
              <span className="text-xs text-secondary">Click to import image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) props.onImportImage(f);
                }}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Opacity: {Math.round(imageLayer.opacity * 100)}%</Label>
                <Slider value={imageLayer.opacity} min={0} max={1} step={0.05} onChange={(v) => props.onImageLayerChange({ opacity: v })} />
              </div>
              <div>
                <Label>Scale: {imageLayer.scale.toFixed(2)}x</Label>
                <Slider value={imageLayer.scale} min={0.1} max={5} step={0.05} onChange={(v) => props.onImageLayerChange({ scale: v })} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => props.onImageLayerChange({ locked: !imageLayer.locked })}
                  className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors"
                >
                  {imageLayer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  {imageLayer.locked ? "Locked" : "Unlocked"}
                </button>
                <span className="text-xs text-muted ml-auto">
                  {imageLayer.locked ? "Use Image tool to move" : "Drag on canvas"}
                </span>
              </div>
              <button
                onClick={props.onRemoveImage}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={13} />
                Remove image
              </button>
            </div>
          )}
        </Section>

        {/* Export */}
        <Section title="Export" icon={<Download size={15} />} defaultOpen={false}>
          <button
            onClick={props.onExportPNG}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors mb-2"
          >
            <Download size={15} />
            Export PNG
          </button>
          <button
            onClick={props.onExportJPEG}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm bg-input text-primary rounded-md hover:bg-input-hover transition-colors mb-2 border border-border-input"
          >
            <Download size={15} />
            Export JPEG
          </button>
          <button
            onClick={props.onExportJSON}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm bg-input text-primary rounded-md hover:bg-input-hover transition-colors border border-border-input"
          >
            <FileJson size={15} />
            Export JSON (nails + sequence)
          </button>
        </Section>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle text-xs text-muted">
        Double-click a nail to delete it
      </div>
    </div>
  );
}
