const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export const DEFAULT_WORLD_WEATHER_CYCLE=Object.freeze({
  active:false,
  normalDurationMs:720000,
  rainDurationMs:180000,
  normalWeather:"halloween",
  rainWeather:"halloween-rain"
});

export function normalizeWorldWeatherCycle(input={}){
  const source=input&&typeof input==="object"?input:{};
  return {
    active:source.active===true,
    normalDurationMs:clamp(Math.round(Number(source.normalDurationMs)||DEFAULT_WORLD_WEATHER_CYCLE.normalDurationMs),1000,3600000),
    rainDurationMs:clamp(Math.round(Number(source.rainDurationMs)||DEFAULT_WORLD_WEATHER_CYCLE.rainDurationMs),1000,3600000),
    normalWeather:String(source.normalWeather||DEFAULT_WORLD_WEATHER_CYCLE.normalWeather),
    rainWeather:String(source.rainWeather||DEFAULT_WORLD_WEATHER_CYCLE.rainWeather)
  };
}

export function computeWorldWeatherCycle(input={},elapsedMs=0){
  const cycle=normalizeWorldWeatherCycle(input);
  if(!cycle.active){
    return {active:false,phase:"static",weather:null,elapsedMs:0,remainingMs:0,totalDurationMs:0};
  }
  const totalDurationMs=cycle.normalDurationMs+cycle.rainDurationMs;
  const safeElapsed=Math.max(0,Number(elapsedMs)||0);
  const offset=safeElapsed%totalDurationMs;
  const raining=offset>=cycle.normalDurationMs;
  const phase=raining?"rain":"normal";
  const weather=raining?cycle.rainWeather:cycle.normalWeather;
  const phaseEnd=raining?totalDurationMs:cycle.normalDurationMs;
  return {
    active:true,
    phase,
    weather,
    elapsedMs:offset,
    remainingMs:Math.max(0,phaseEnd-offset),
    totalDurationMs
  };
}
