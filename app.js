const stage = document.querySelector(".stage");
const canvasElement = document.querySelector("[data-infinite-canvas]");
const canvasWorld = document.querySelector("[data-canvas-world]");
const toolButtons = Array.from(document.querySelectorAll("[data-tool-button]"));
const resetViewButtons = Array.from(document.querySelectorAll("[data-reset-view]"));
const zoomToggleButton = document.querySelector("[data-zoom-toggle]");
const zoomMenu = document.querySelector("[data-zoom-menu]");
const zoomMenuButtons = Array.from(document.querySelectorAll("[data-zoom-action]"));
const zoomReadout = document.querySelector("[data-zoom-readout]");
const infoPopover = document.querySelector(".info-popover");
const infoPill = document.querySelector(".info-pill");
const mobileUiQuery = window.matchMedia("(max-width: 767px)");

const homeScale = 1;
const resetDurationMs = 520;

let infiniteCanvas = null;
let isZoomMenuOpen = false;

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
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.05), 1);

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

function resetCanvasView({ animate = true, requireBounds = false } = {}) {
  if (!infiniteCanvas) {
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

function setCanvasScale(nextScale) {
  if (!infiniteCanvas) {
    return;
  }

  infiniteCanvas.setScale(nextScale);
}

function handleZoomAction(action) {
  if (!infiniteCanvas) {
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
    minScale: 0.05,
    maxScale: 1,
    initialScale: homeScale,
    onStateChange: (state) => {
      updateZoomReadout(state);
      syncToolButtonsWithCanvasState(state);
      syncCanvasWorld(state);
    },
  });

  infiniteCanvas.mount();
  resetCanvasView({ animate: false });

  window.__canvasCopy = {
    infiniteCanvas,
    getState: () => infiniteCanvas?.getState() ?? null,
    resetView: resetCanvasView,
    fitToScreen: resetCanvasView,
    setScale: setCanvasScale,
    setToolMode: (mode) => infiniteCanvas?.setToolMode(mode),
  };
}

for (const toolButton of toolButtons) {
  toolButton.addEventListener("click", () => {
    if (!infiniteCanvas) {
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
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeZoomMenu();
    closeInfoPopover();
  }

  if (!infiniteCanvas) {
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
    if (!event.matches) {
      closeInfoPopover();
    }
  });
}
