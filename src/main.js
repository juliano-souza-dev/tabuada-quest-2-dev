import { SceneRuntime } from "./runtime/SceneRuntime.js?v=20260930-1326";
import { SceneResolver } from "./runtime/SceneResolver.js?v=20260930-1326";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20260930-1326";
import { DevOverlay } from "./dev/DevOverlay.js?v=20260930-1326";
import { launchWorldTest } from "./world/WorldTestLauncher.js?v=20260930-1326";

const app = document.querySelector("#app");
const worldTestParam = new URLSearchParams(location.search).get("worldtest");
const worldTest = Boolean(worldTestParam);

if(worldTest){
  const worldId=worldTestParam==="1"?"ocean-prototype":worldTestParam;
  await launchWorldTest(app,{worldId});
}else{
const resolver = await SceneResolver.load("./src/config/scene-catalog.json?v=20260930-1326");
const resolved = resolver.resolve("login");

const runtime = new SceneRuntime(app, { width: 390, height: 844 }, { editorEnabled: true });
const services = await installAuthRuntime(runtime, {
  configUrl: "./src/config/firebase-public.json?v=20260930-1326"
});
await runtime.load(resolved.scene.path);

const dev = new DevOverlay(document.body, runtime, { sceneResolver: resolver });
dev.mount();

globalThis.TabuadaQuest = {
  ...(globalThis.TabuadaQuest || {}),
  runtime,
  auth: services.auth,
  playerState: services.playerState,
  getAccessStatus: services.getStatus
};
}

// DEV policy: never register a Service Worker and purge old caches/registrations.
// Every reload must request the current repository deployment.
if ("serviceWorker" in navigator) {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(registration => registration.unregister()));
}
if ("caches" in window) {
  const keys = await caches.keys();
  await Promise.all(keys.map(key => caches.delete(key)));
}
