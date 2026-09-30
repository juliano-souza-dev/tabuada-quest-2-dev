export function computeViewportMetrics(host, reference) {
  const hostWidth = Math.max(1, Number(host?.width ?? host?.clientWidth ?? 1));
  const hostHeight = Math.max(1, Number(host?.height ?? host?.clientHeight ?? 1));
  const referenceWidth = Math.max(1, Number(reference?.width ?? 390));
  const referenceHeight = Math.max(1, Number(reference?.height ?? 844));

  const viewportScale = Math.max(
    0.01,
    Math.min(hostWidth / referenceWidth, hostHeight / referenceHeight)
  );

  const logicalViewport = {
    width: hostWidth / viewportScale,
    height: hostHeight / viewportScale
  };

  const sceneOffset = {
    x: (logicalViewport.width - referenceWidth) / 2,
    y: (logicalViewport.height - referenceHeight) / 2
  };

  return { viewportScale, logicalViewport, sceneOffset };
}

export function isViewportBackgroundNode(node) {
  const src = String(node?.src || "");
  const id = String(node?.id || "");
  return node?.kind === "image" && (
    src.startsWith("./assets/backgrounds/") ||
    id.endsWith(".background")
  );
}

export function enforceViewportBackgroundLayout(node) {
  if (isViewportBackgroundNode(node) && node?.layout?.mode == null) {
    node.layout = { ...(node.layout || {}), mode: "viewport-cover" };
  }
  return node;
}

export function resolveViewportNodeLayout(
  node,
  { reference, logicalViewport, sceneOffset } = {}
) {
  const refWidth = Math.max(1, Number(reference?.width ?? 390));
  const refHeight = Math.max(1, Number(reference?.height ?? 844));
  const ox = Number(sceneOffset?.x ?? 0);
  const oy = Number(sceneOffset?.y ?? 0);
  const x = Number(node?.x ?? 0);
  const y = Number(node?.y ?? 0);
  const baseWidth = Math.max(1, Number(node?.width ?? 1));
  const baseHeight = Math.max(1, Number(node?.height ?? 1));

  if (node?.layout?.mode !== "viewport-cover") {
    return { x: x + ox, y: y + oy, width: baseWidth, height: baseHeight };
  }

  const viewportWidth = Math.max(1, Number(logicalViewport?.width ?? refWidth));
  const viewportHeight = Math.max(1, Number(logicalViewport?.height ?? refHeight));
  const coverScale = Math.max(
    viewportWidth / baseWidth,
    viewportHeight / baseHeight
  );

  const authoredCenterX = x + baseWidth / 2;
  const authoredCenterY = y + baseHeight / 2;
  const referenceCenterX = refWidth / 2;
  const referenceCenterY = refHeight / 2;
  const offsetX = (authoredCenterX - referenceCenterX) * coverScale;
  const offsetY = (authoredCenterY - referenceCenterY) * coverScale;
  const width = baseWidth * coverScale;
  const height = baseHeight * coverScale;

  return {
    x: viewportWidth / 2 + offsetX - width / 2,
    y: viewportHeight / 2 + offsetY - height / 2,
    width,
    height
  };
}
