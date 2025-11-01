import { OWWindow } from "@overwolf/overwolf-api-ts";

type DragEdge =
  | "Top"
  | "Left"
  | "Right"
  | "Bottom"
  | "TopLeft"
  | "TopRight"
  | "BottomLeft"
  | "BottomRight";

// A base class for the app's foreground windows.
// Sets the modal and drag behaviors, which are shared across the desktop and in-game windows.
export class AppWindow {
  protected currWindow: OWWindow;
  protected mainWindow: OWWindow;
  protected maximized: boolean = false;
  private observer: MutationObserver | null = null;

  // cache window id so we don't look it up repeatedly
  private _windowId?: string;

  constructor(windowName: string) {
    this.currWindow = new OWWindow(windowName);

    // Wire anything already in the DOM
    this.tryWireAll();

    // Also watch for future mounts/re-renders
    this.observer = new MutationObserver(() => this.tryWireAll());
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Warm the window id cache in the background (no harm if it fails; we'll re-fetch on demand)
    this.getWindowId().catch(() => { });
  }

  /** Find and wire all relevant UI elements if present (idempotent). */
  private tryWireAll() {
    this.wireButton("closeButton", "click", () => {
      this.mainWindow.close();
    });

    this.wireButton("minimizeButton", "click", () => {
      this.currWindow.minimize();
    });

    this.wireButton("maximizeButton", "click", () => {
      if (!this.maximized) {
        this.currWindow.maximize();
      } else {
        this.currWindow.restore();
      }
      this.maximized = !this.maximized;
    });

    const header = document.getElementById("header");
    if (header && !header.dataset.dragWired) {
      this.setDrag(header);
      header.dataset.dragWired = "1";
    }

    // ✅ Resize wiring (only once)
    const resizeRoot = document.getElementById("resize");
    if (resizeRoot && !resizeRoot.dataset.resizeWired) {
      this.wireResizeHandles(resizeRoot);
      resizeRoot.dataset.resizeWired = "1";
    }
  }

  /** Helper that prevents double-binding by marking the element once wired. */
  private wireButton<K extends keyof HTMLElementEventMap>(
    id: string,
    event: K,
    handler: (ev: HTMLElementEventMap[K]) => void
  ) {
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el || el.dataset.wired === "1") return;

    el.addEventListener(event, handler as unknown as EventListener);
    el.dataset.wired = "1";
  }

  /** Wire all [data-edge] handles inside the given container. Idempotent. */
  private wireResizeHandles(container: HTMLElement) {
    const handles = Array.from(
      container.querySelectorAll<HTMLElement>("[data-edge]")
    );

    handles.forEach((el) => {
      if (el.dataset.wired === "1") return;

      const edge = (el.dataset.edge || "").trim() as DragEdge;

      // Basic guard: only attach to valid edges
      if (
        ![
          "Top",
          "Left",
          "Right",
          "Bottom",
          "TopLeft",
          "TopRight",
          "BottomLeft",
          "BottomRight",
        ].includes(edge)
      ) {
        return;
      }

      const onMouseDown = (e: MouseEvent) => {
        // Prevent text selection / drag ghosting
        e.preventDefault();
        this.startDragResize(edge);
      };

      el.addEventListener("mousedown", onMouseDown);
      el.dataset.wired = "1";
    });
  }

  /** Starts Overwolf's native drag-resize for the given edge. */
  private async startDragResize(edge: DragEdge) {
    const id = await this.getWindowId();
    // Overwolf takes over the mouse until release; no mousemove needed.
    overwolf.windows.dragResize(id, edge as overwolf.windows.enums.WindowDragEdge);
  }

  /** Cache + return the current window id. */
  private async getWindowId(): Promise<string> {
    if (this._windowId) return this._windowId;

    return new Promise<string>((resolve, reject) => {
      overwolf.windows.getCurrentWindow((res) => {
        if (res && res.window && res.window.id) {
          this._windowId = res.window.id;
          resolve(res.window.id);
        } else {
          reject(new Error("Failed to get current window id"));
        }
      });
    });
  }

  /** Optionally call if you tear down this UI/controller. */
  public disconnect() {
    this.observer?.disconnect();
    this.observer = null;
  }

  public async getWindowState() {
    return await this.currWindow.getWindowState();
  }

  public async setDrag(elem: HTMLElement) {
    this.currWindow.dragMove(elem);
  }
}