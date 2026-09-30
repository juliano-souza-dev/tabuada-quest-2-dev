export function resolveEntityPresentation(entity={}){
  const renderMode=entity.renderMode || (entity.src ? "sprite" : "logical");
  return {
    renderMode,
    hasSprite: renderMode==="sprite" && Boolean(entity.src),
    showLabel: entity.showLabel===true,
    visualChrome: false
  };
}

export function isLogicalOnlyEntity(entity={}){
  return resolveEntityPresentation(entity).renderMode==="logical";
}
