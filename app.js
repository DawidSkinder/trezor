const stage = document.querySelector(".stage");
const canvasElement = document.querySelector("[data-infinite-canvas]");
const canvasWorld = document.querySelector("[data-canvas-world]");
const toolButtons = Array.from(document.querySelectorAll("[data-tool-button]"));
const resetViewButtons = Array.from(document.querySelectorAll("[data-reset-view]"));
const zoomToggleButton = document.querySelector("[data-zoom-toggle]");
const zoomMenu = document.querySelector("[data-zoom-menu]");
const zoomMenuButtons = Array.from(document.querySelectorAll("[data-zoom-action]"));
const zoomToHomeLabel = document.querySelector('[data-zoom-action="100"] span:first-child');
const zoomReadout = document.querySelector("[data-zoom-readout]");
const infoPopover = document.querySelector(".info-popover");
const infoPill = document.querySelector(".info-pill");
const keyboardPopover = document.querySelector(".keyboard-popover");
const keyboardPill = document.querySelector(".keyboard-pill");
const mobileUiQuery = window.matchMedia("(max-width: 767px)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

const homeScale = 1;
const resetDurationMs = 520;
const minCanvasScale = 0.05;
const mobileMaxScale = 0.48;

let infiniteCanvas = null;
let isZoomMenuOpen = false;
let pendingCanvasState = null;
let canvasStateFrame = 0;
let appliedCanvasState = null;
let mobileCardPreview = null;

function isCanvasInteractionEnabled() {
  return infiniteCanvas?.getState().interactionEnabled !== false;
}

function setActiveToolButton(mode) {
  for (const button of toolButtons) {
    const isActive = button.dataset.toolButton === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function syncToolButtonsWithCanvasState(state) {
  if (!state) {
    return;
  }

  const activeMode = state.toolMode === "hand" || state.spacePressed ? "hand" : "cursor";
  setActiveToolButton(activeMode);
}

function updateZoomReadout(state) {
  if (!zoomReadout || !state) {
    return;
  }

  zoomReadout.textContent = `${Math.round(state.scale * 100)}%`;
}

function syncCanvasWorld(state) {
  if (!canvasWorld || !state) {
    return;
  }

  canvasWorld.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
}

function applyCanvasState(state) {
  updateZoomReadout(state);
  syncToolButtonsWithCanvasState(state);
  syncCanvasWorld(state);
  appliedCanvasState = state ? { ...state } : null;
}

function scheduleCanvasStateSync(state) {
  pendingCanvasState = state;

  if (canvasStateFrame) {
    return;
  }

  canvasStateFrame = window.requestAnimationFrame(() => {
    canvasStateFrame = 0;
    const nextState = pendingCanvasState;
    pendingCanvasState = null;
    applyCanvasState(nextState);
  });
}

function flushCanvasStateSync() {
  if (!infiniteCanvas) {
    return null;
  }

  if (canvasStateFrame) {
    window.cancelAnimationFrame(canvasStateFrame);
    canvasStateFrame = 0;
  }

  pendingCanvasState = null;

  const state = infiniteCanvas.getState();
  applyCanvasState(state);
  return state;
}

function setZoomMenuOpen(nextOpen) {
  if (!zoomToggleButton || !zoomMenu) {
    return;
  }

  isZoomMenuOpen = nextOpen;
  zoomToggleButton.classList.toggle("is-active", nextOpen);
  zoomToggleButton.setAttribute("aria-expanded", String(nextOpen));
  zoomMenu.hidden = !nextOpen;
}

function closeZoomMenu() {
  setZoomMenuOpen(false);
}

function isMobileUi() {
  return mobileUiQuery.matches;
}

function isMobileInteractionUi() {
  return mobileUiQuery.matches || coarsePointerQuery.matches;
}

function getMaxScaleForViewport() {
  return isMobileUi() ? mobileMaxScale : 1;
}

function getCanvasScaleBounds(state = infiniteCanvas?.getState()) {
  const minScale = Number.isFinite(state?.minScale) ? state.minScale : minCanvasScale;
  const maxScale = Number.isFinite(state?.maxScale) ? state.maxScale : getMaxScaleForViewport();

  return { minScale, maxScale };
}

function clampCanvasScale(scale, state = infiniteCanvas?.getState()) {
  const { minScale, maxScale } = getCanvasScaleBounds(state);

  return Math.min(Math.max(scale, minScale), maxScale);
}

function syncResponsiveZoomCopy() {
  if (!zoomToHomeLabel) {
    return;
  }

  zoomToHomeLabel.textContent = isMobileUi() ? "Zoom to max" : "Zoom to 100%";
}

function closeMobileCardPreview() {
  mobileCardPreview?.remove();
  mobileCardPreview = null;
}

function openMobileCardPreview(card) {
  if (!card || !isMobileInteractionUi()) {
    return;
  }

  const shell = card.querySelector(".card-shell");

  if (!shell) {
    return;
  }

  closeMobileCardPreview();

  const preview = document.createElement("aside");
  preview.className = "mobile-card-preview";
  preview.setAttribute("role", "dialog");
  preview.setAttribute("aria-modal", "true");
  preview.setAttribute("aria-label", card.querySelector(".card-headline")?.textContent?.trim() || "Evidence card preview");

  const backdrop = document.createElement("button");
  backdrop.className = "mobile-card-preview-backdrop";
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Close card preview");

  const panel = document.createElement("section");
  panel.className = "mobile-card-preview-panel";

  const closeButton = document.createElement("button");
  closeButton.className = "mobile-card-preview-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close card preview");
  closeButton.textContent = "Close";

  const content = shell.cloneNode(true);
  content.classList.add("mobile-card-preview-shell");

  for (const mapFrame of content.querySelectorAll("[data-map-card]")) {
    delete mapFrame.dataset.mapCard;
    mapFrame.dataset.mapReady = "static";
  }

  panel.append(closeButton, content);
  preview.append(backdrop, panel);
  document.body.append(preview);

  mobileCardPreview = preview;
  backdrop.addEventListener("click", closeMobileCardPreview, { once: true });
  closeButton.addEventListener("click", closeMobileCardPreview, { once: true });
}

function setInfoPopoverOpen(nextOpen) {
  if (!infoPopover || !infoPill) {
    return;
  }

  if (nextOpen) {
    infoPopover.dataset.mobileOpen = "true";
  } else {
    delete infoPopover.dataset.mobileOpen;
  }

  infoPill.setAttribute("aria-expanded", String(nextOpen));
}

function closeInfoPopover() {
  setInfoPopoverOpen(false);
}

function setKeyboardPopoverOpen(nextOpen) {
  if (!keyboardPopover || !keyboardPill) {
    return;
  }

  if (nextOpen) {
    keyboardPopover.dataset.mobileOpen = "true";
  } else {
    delete keyboardPopover.dataset.mobileOpen;
  }

  keyboardPill.setAttribute("aria-expanded", String(nextOpen));
}

function closeKeyboardPopover() {
  setKeyboardPopoverOpen(false);
}

function getCanvasContentBounds() {
  const customBounds = window.__caseForFitCanvasBounds;

  if (
    customBounds &&
    Number.isFinite(customBounds.x) &&
    Number.isFinite(customBounds.y) &&
    Number.isFinite(customBounds.width) &&
    Number.isFinite(customBounds.height) &&
    customBounds.width > 0 &&
    customBounds.height > 0
  ) {
    return customBounds;
  }

  return null;
}

function getCanvasFitPadding() {
  const customPadding = window.__caseForFitCanvasFitPadding;
  const fallbackPadding = 160;

  if (Number.isFinite(customPadding) && customPadding >= 0) {
    return {
      top: customPadding,
      right: customPadding,
      bottom: customPadding,
      left: customPadding,
    };
  }

  if (customPadding && typeof customPadding === "object") {
    return {
      top: Number.isFinite(customPadding.top) && customPadding.top >= 0 ? customPadding.top : fallbackPadding,
      right: Number.isFinite(customPadding.right) && customPadding.right >= 0 ? customPadding.right : fallbackPadding,
      bottom: Number.isFinite(customPadding.bottom) && customPadding.bottom >= 0 ? customPadding.bottom : fallbackPadding,
      left: Number.isFinite(customPadding.left) && customPadding.left >= 0 ? customPadding.left : fallbackPadding,
    };
  }

  return {
    top: fallbackPadding,
    right: fallbackPadding,
    bottom: fallbackPadding,
    left: fallbackPadding,
  };
}

function getFitView() {
  const state = infiniteCanvas?.getState();

  if (!state?.viewportWidth || !state?.viewportHeight) {
    return null;
  }

  const bounds = getCanvasContentBounds();

  if (bounds) {
    const padding = getCanvasFitPadding();
    const availableWidth = Math.max(state.viewportWidth - padding.left - padding.right, 1);
    const availableHeight = Math.max(state.viewportHeight - padding.top - padding.bottom, 1);
    const safeCenterX = padding.left + availableWidth / 2;
    const safeCenterY = padding.top + availableHeight / 2;
    const scaleX = availableWidth / bounds.width;
    const scaleY = availableHeight / bounds.height;
    const scale = clampCanvasScale(Math.min(scaleX, scaleY), state);

    return {
      scale,
      offsetX: safeCenterX - (bounds.x + bounds.width / 2) * scale,
      offsetY: safeCenterY - (bounds.y + bounds.height / 2) * scale,
    };
  }

  return {
    scale: homeScale,
    offsetX: state.viewportWidth / 2,
    offsetY: state.viewportHeight / 2,
  };
}

function getCenteredWorldView({ x, y, scale = homeScale } = {}) {
  const state = infiniteCanvas?.getState();

  if (
    !state?.viewportWidth ||
    !state?.viewportHeight ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(scale)
  ) {
    return null;
  }

  const clampedScale = clampCanvasScale(scale, state);

  return {
    scale: clampedScale,
    offsetX: state.viewportWidth / 2 - x * clampedScale,
    offsetY: state.viewportHeight / 2 - y * clampedScale,
  };
}

function resetCanvasView({ animate = true, requireBounds = false } = {}) {
  if (!infiniteCanvas) {
    return false;
  }

  if (requireBounds && !getCanvasContentBounds()) {
    return false;
  }

  const homeView = getFitView();

  if (!homeView) {
    if (requireBounds) {
      return false;
    }

    infiniteCanvas.resetView(homeScale);
    return true;
  }

  if (animate) {
    infiniteCanvas.animateViewTo(homeView, resetDurationMs);
    return true;
  }

  infiniteCanvas.setView(homeView);
  return true;
}

function animateCanvasFitToScreen({ duration = resetDurationMs, requireBounds = false } = {}) {
  if (!infiniteCanvas) {
    return Promise.resolve(false);
  }

  const fitView = getFitView();

  if (!fitView) {
    return Promise.resolve(false);
  }

  if (requireBounds && !getCanvasContentBounds()) {
    return Promise.resolve(false);
  }

  return infiniteCanvas.animateViewTo(fitView, duration).then(() => true);
}

function centerOnWorldPoint({ x, y, scale = homeScale, animate = false, duration = resetDurationMs } = {}) {
  if (!infiniteCanvas) {
    return false;
  }

  const nextView = getCenteredWorldView({ x, y, scale });

  if (!nextView) {
    return false;
  }

  if (animate) {
    return infiniteCanvas.animateViewTo(nextView, duration).then(() => true);
  }

  infiniteCanvas.setView(nextView);
  return true;
}

function setCanvasScale(nextScale) {
  if (!infiniteCanvas || !isCanvasInteractionEnabled()) {
    return;
  }

  infiniteCanvas.setScale(nextScale);
}

function handleZoomAction(action) {
  if (!infiniteCanvas || !isCanvasInteractionEnabled()) {
    return;
  }

  const { scale } = infiniteCanvas.getState();

  if (action === "in") {
    setCanvasScale(scale * 1.25);
  } else if (action === "out") {
    setCanvasScale(scale / 1.25);
  } else if (action === "100") {
    setCanvasScale(1);
  } else if (action === "fit") {
    resetCanvasView();
  }

  closeZoomMenu();
}

if (canvasElement && window.InfiniteCanvasBackground) {
  infiniteCanvas = new window.InfiniteCanvasBackground(canvasElement, {
    interactionEnabled: true,
    minScale: minCanvasScale,
    maxScale: getMaxScaleForViewport(),
    initialScale: homeScale,
    onStateChange: (state) => {
      scheduleCanvasStateSync(state);
    },
  });

  infiniteCanvas.mount();
  resetCanvasView({ animate: false, requireBounds: true });

  window.__canvasCopy = {
    infiniteCanvas,
    getState: () => infiniteCanvas?.getState() ?? null,
    getAppliedState: () => appliedCanvasState,
    flushState: flushCanvasStateSync,
    getFitView,
    resetView: resetCanvasView,
    fitToScreen: resetCanvasView,
    animateFitToScreen: animateCanvasFitToScreen,
    centerOnWorldPoint,
    setScale: setCanvasScale,
    setInteractionEnabled: (enabled) => infiniteCanvas?.setInteractionEnabled(enabled),
    setToolMode: (mode) => infiniteCanvas?.setToolMode(mode),
  };
}

for (const toolButton of toolButtons) {
  toolButton.addEventListener("click", () => {
    if (!infiniteCanvas || !isCanvasInteractionEnabled()) {
      return;
    }

    const mode = toolButton.dataset.toolButton;

    if (mode !== "cursor" && mode !== "hand") {
      return;
    }

    infiniteCanvas.setToolMode(mode);
  });
}

for (const resetViewButton of resetViewButtons) {
  resetViewButton.addEventListener("click", () => {
    if (!isCanvasInteractionEnabled()) {
      return;
    }

    resetCanvasView();
  });
}

if (zoomToggleButton) {
  zoomToggleButton.addEventListener("click", () => {
    setZoomMenuOpen(!isZoomMenuOpen);
  });
}

for (const zoomMenuButton of zoomMenuButtons) {
  zoomMenuButton.addEventListener("click", () => {
    handleZoomAction(zoomMenuButton.dataset.zoomAction);
  });
}

if (infoPill) {
  infoPill.addEventListener("click", (event) => {
    if (!isMobileUi()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setInfoPopoverOpen(infoPopover?.dataset.mobileOpen !== "true");
  });
}

if (keyboardPill) {
  keyboardPill.addEventListener("click", (event) => {
    if (!isMobileUi()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setKeyboardPopoverOpen(keyboardPopover?.dataset.mobileOpen !== "true");
  });
}

document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof Node)) {
    return;
  }

  if (isZoomMenuOpen && zoomToggleButton && zoomMenu && !zoomToggleButton.contains(target) && !zoomMenu.contains(target)) {
    closeZoomMenu();
  }

  if (isMobileUi() && infoPopover?.dataset.mobileOpen === "true" && !infoPopover.contains(target)) {
    closeInfoPopover();
  }

  if (isMobileUi() && keyboardPopover?.dataset.mobileOpen === "true" && !keyboardPopover.contains(target)) {
    closeKeyboardPopover();
  }

  if (!isMobileInteractionUi()) {
    return;
  }

  if (!(target instanceof Element) || target.closest("a, button, .corner, .mobile-card-preview")) {
    return;
  }

  const card = target.closest(".evidence-card");

  if (!card || window.__canvasCopy?.infiniteCanvas?.shouldSuppressCanvasClick()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  openMobileCardPreview(card);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeZoomMenu();
    closeInfoPopover();
    closeKeyboardPopover();
    closeMobileCardPreview();
  }

  if (!infiniteCanvas) {
    return;
  }

  if (!isCanvasInteractionEnabled()) {
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === "=") {
    event.preventDefault();
    setCanvasScale(infiniteCanvas.getState().scale * 1.25);
    closeZoomMenu();
  } else if ((event.metaKey || event.ctrlKey) && event.key === "-") {
    event.preventDefault();
    setCanvasScale(infiniteCanvas.getState().scale / 1.25);
    closeZoomMenu();
  } else if (event.shiftKey && event.key === "0") {
    event.preventDefault();
    setCanvasScale(1);
    closeZoomMenu();
  } else if (event.shiftKey && event.key === "1") {
    event.preventDefault();
    resetCanvasView();
    closeZoomMenu();
  } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "r") {
    event.preventDefault();
    resetCanvasView();
    closeZoomMenu();
  }
});

if (mobileUiQuery) {
  mobileUiQuery.addEventListener("change", (event) => {
    infiniteCanvas?.setScaleBounds?.({
      minScale: minCanvasScale,
      maxScale: getMaxScaleForViewport(),
    });
    syncResponsiveZoomCopy();

    if (!event.matches) {
      closeInfoPopover();
      closeKeyboardPopover();
      closeMobileCardPreview();
    }
  });
}

syncResponsiveZoomCopy();
