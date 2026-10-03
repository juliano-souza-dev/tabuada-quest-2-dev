import { SceneRuntime } from "./SceneRuntime.js?v=20260930-2350";
import { WorldRuntime } from "../world/WorldRuntime.js?v=20261003-3445";
import { PedagogyRuntime } from "./pedagogy/PedagogyRuntime.js?v=20261003-1210";
import { ActionRuntime } from "./actions/ActionRuntime.js?v=20261001-1848";

const clone=value=>structuredClone(value);
const isPath=value=>typeof value==="string"&&(value.startsWith("./")||value.startsWith("/")||value.endsWith(".json"));
const unique=list=>[...new Set((Array.isArray(list)?list:[]).map(String).filter(Boolean))];