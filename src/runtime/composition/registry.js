import { CompositionEngine } from "./CompositionEngine.js?v=20260930-0018";
import { OceanEffect } from "../OceanEffect.js?v=20260930-0018";
import { ShipEffect } from "../ShipEffect.js?v=20260930-0018";

export function createCompositionEngine(runtime) {
  return new CompositionEngine(runtime, {
    ocean: OceanEffect,
    ship: ShipEffect
  });
}
