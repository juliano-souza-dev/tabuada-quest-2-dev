// Explicit frame-phase contract. The caller supplies operations, not a mutable
// WorldRuntime reference, so this module owns ordering without owning entities.
export function createWorldSimulationPipeline(steps){
  const required=["movePlayer","correctAuthority","renderPlayer","animatePlayerWater","moveEntities","populateTreasures","lockTreasureCombat","collectTreasures","selectCombatTarget","updateCombat","updateTutorial","updateCameraInput","updateCamera","updateEnvironment"];
  for(const key of required){
    if(typeof steps?.[key]!=="function")throw new TypeError("Missing simulation step: "+key);
  }
  return (time,dt)=>{
    steps.movePlayer(time,dt);
    steps.correctAuthority(dt);
    steps.renderPlayer(time,dt);
    steps.animatePlayerWater(time);
    steps.moveEntities(time,dt);
    steps.populateTreasures(time);
    steps.lockTreasureCombat();
    const collecting=steps.collectTreasures();
    if(!collecting&&!steps.challengeActive()){
      steps.selectCombatTarget();
      steps.updateCombat(time);
    }
    steps.updateTutorial();
    steps.updateCameraInput(dt);
    steps.updateCamera(dt);
    steps.updateEnvironment(time);
  };
}
