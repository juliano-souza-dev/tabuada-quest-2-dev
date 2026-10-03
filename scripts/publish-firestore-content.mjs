#!/usr/bin/env node
import {createHash} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PROJECT_ID=process.env.FIREBASE_PROJECT_ID||"tabuadaquest2";
const ACCESS_TOKEN=String(process.env.FIREBASE_ADMIN_ACCESS_TOKEN||"").trim();
const ROOT=process.cwd();
const RELEASE_ID=String(process.env.TQ_RELEASE_ID||new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14));
const DRY_RUN=process.argv.includes("--dry-run");

if(!ACCESS_TOKEN&&!DRY_RUN){
  console.error("FIREBASE_ADMIN_ACCESS_TOKEN is required. Use an admin/service-account OAuth access token.");
  process.exit(2);
}

const firestoreBase=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents`;
const jsonDirs=["src/config","src/scenes","src/world"];

const collectJson=async dir=>{
  const absolute=path.join(ROOT,dir);
  const entries=await readdir(absolute,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    if(entry.name.startsWith("."))continue;
    const relative=path.posix.join(dir,entry.name);
    if(entry.isDirectory()){
      files.push(...await collectJson(relative));
    }else if(entry.isFile()&&entry.name.endsWith(".json")){
      if(/(?:test|prototype)\.world\.json$/i.test(entry.name))continue;
      files.push(relative);
    }
  }
  return files;
};

const fields=value=>Object.fromEntries(Object.entries(value).map(([key,item])=>{
  if(typeof item==="boolean")return [key,{booleanValue:item}];
  if(Number.isInteger(item))return [key,{integerValue:String(item)}];
  if(typeof item==="number")return [key,{doubleValue:item}];
  return [key,{stringValue:String(item??"")}];
}));

const patch=async(documentPath,data)=>{
  const url=firestoreBase+"/"+documentPath.split("/").map(encodeURIComponent).join("/");
  if(DRY_RUN){
    console.log("[dry-run] PATCH",documentPath);
    return;
  }
  const response=await fetch(url,{
    method:"PATCH",
    headers:{
      Authorization:"Bearer "+ACCESS_TOKEN,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({fields:fields(data)})
  });
  if(!response.ok){
    throw new Error(`Firestore PATCH failed ${response.status} ${documentPath}: ${await response.text()}`);
  }
};

const files=[...new Set((await Promise.all(jsonDirs.map(collectJson))).flat())].sort();
const now=new Date().toISOString();
const manifest=[];

for(const file of files){
  const payload=await readFile(path.join(ROOT,file),"utf8");
  JSON.parse(payload);
  const bytes=Buffer.byteLength(payload,"utf8");
  if(bytes>800000)throw new Error(`${file} is too large for a single Firestore resource document (${bytes} bytes)`);
  const sha=createHash("sha256").update(payload).digest("hex");
  const documentId=createHash("sha256").update(file).digest("hex").slice(0,32);
  manifest.push({path:file,sha,bytes,documentId});
  await patch(`gameReleases/${RELEASE_ID}/resources/${documentId}`,{
    path:file,
    payload,
    sha,
    bytes,
    updatedAt:now
  });
}

const manifestJson=JSON.stringify(manifest);
const releaseHash=createHash("sha256").update(manifestJson).digest("hex");

await patch(`gameReleases/${RELEASE_ID}`,{
  schema:"tq.game-release",
  version:1,
  releaseId:RELEASE_ID,
  resourceCount:manifest.length,
  manifestSha:releaseHash,
  createdAt:now
});

await patch("gameConfig/current",{
  schema:"tq.game-content-pointer",
  version:1,
  releaseId:RELEASE_ID,
  resourceCount:manifest.length,
  manifestSha:releaseHash,
  publishedAt:now
});

console.log(JSON.stringify({
  ok:true,
  dryRun:DRY_RUN,
  projectId:PROJECT_ID,
  releaseId:RELEASE_ID,
  resourceCount:manifest.length,
  manifestSha:releaseHash
},null,2));
