import "dotenv/config";
import childProcess from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const root = path.resolve(__dirname, "../..");
const formal = path.join(root, "benchmarks/formal-evaluation");
const results = path.join(formal, "results");
const fixtureSrc = path.join(root, "benchmarks/raw/fixtures/benchmark-fixtures.json");
const loads = [10,25,50,75,100,125,150,175,200];
const reps = [1,2,3,4,5];
const warmup = 60, measure = 300, fixtureCount = 75000;
type Mode = "baseline" | "vcem";

function die(m:string):never { throw new Error(m); }
function sync(cmd:string,args:string[],opts:childProcess.SpawnSyncOptions={}) {
  return childProcess.spawnSync(cmd,args,{cwd:root,encoding:"utf8",...opts});
}
function req(cmd:string,args:string[],opts:childProcess.SpawnSyncOptions={}) {
  const r=sync(cmd,args,opts);
  if(r.status!==0) die(`${cmd} ${args.join(" ")} failed: ${String(r.stderr||r.stdout||"").trim()}`);
  return r;
}
function text(cmd:string,args:string[]) { return String(req(cmd,args).stdout||"").trim(); }
function sha(file:string) { return text("shasum",["-a","256",file]).split(/\s+/)[0]; }
function write(file:string,v:any) { fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(v,null,2)); }
function sleep(ms:number) { return new Promise(r=>setTimeout(r,ms)); }
function swapMiB() {
  const s=text("sysctl",["-n","vm.swapusage"]);
  const m=s.match(/used\s*=\s*([0-9.]+)([MGT])/i); if(!m) die(`cannot parse swap: ${s}`);
  const n=Number(m[1]),u=m[2].toUpperCase(); return u==="G"?n*1024:u==="T"?n*1048576:n;
}
function bootMs() {
  const s=text("sysctl",["-n","kern.boottime"]); const m=s.match(/sec\s*=\s*(\d+)/);
  if(!m) die(`cannot parse boot time: ${s}`); return Number(m[1])*1000;
}
function outDir(mode:Mode,u:number,r:number) { return path.join(results,mode,`${u}u`,`run-${r}`); }
function prev(mode:Mode,u:number,r:number) {
  if(r>1) return {mode,u,r:r-1};
  if(mode==="vcem") return {mode:"baseline" as Mode,u,r:5};
  const i=loads.indexOf(u); return i>0?{mode:"vcem" as Mode,u:loads[i-1],r:5}:null;
}
function next(mode:Mode,u:number,r:number) {
  if(r<5) return {mode,u,r:r+1};
  if(mode==="baseline") return {mode:"vcem" as Mode,u,r:1};
  const i=loads.indexOf(u); return i<loads.length-1?{mode:"baseline" as Mode,u:loads[i+1],r:1}:null;
}
function previousMetadata(mode:Mode,u:number,r:number) {
  const p=prev(mode,u,r); if(!p) return null;
  const f=path.join(outDir(p.mode,p.u,p.r),"metadata.json");
  if(!fs.existsSync(f)) die(`previous planned repetition missing: ${p.mode} ${p.u} VU run ${p.r}`);
  const m=JSON.parse(fs.readFileSync(f,"utf8"));
  if(m.status!=="executed") die(`previous planned repetition is ${m.status}, not executed`);
  return m;
}
function parseArgs() {
  const mode=process.argv[2] as Mode,u=Number(process.argv[3]),r=Number(process.argv[4]);
  if(!["baseline","vcem"].includes(mode)||!loads.includes(u)||!reps.includes(r))
    die("usage: ts-node benchmarks/formal-evaluation/runFormal.ts baseline|vcem USERS RUN");
  return {mode,u,r};
}
async function postgresReady() {
  const i=sync("docker",["inspect","vcem-postgres","--format","{{.State.Running}}"]);
  if(i.status!==0) die("vcem-postgres container missing");
  if(String(i.stdout).trim()!=="true") req("docker",["start","vcem-postgres"]);
  for(let n=0;n<60;n++){ if(sync("docker",["exec","vcem-postgres","pg_isready"]).status===0) return; await sleep(500); }
  die("vcem-postgres not ready");
}
function portOf(url:string){ const u=new URL(url); return Number(u.port||(u.protocol==="https:"?443:80)); }
function portFree(port:number){
  const r=sync("lsof",["-nP",`-iTCP:${port}`,"-sTCP:LISTEN"]);
  if(r.status===0&&String(r.stdout).trim()) die(`TCP port ${port} already in use`);
}
function start(cmd:string,args:string[],log:string,env:NodeJS.ProcessEnv) {
  const fd=fs.openSync(log,"a"); const c=childProcess.spawn(cmd,args,{cwd:root,env,stdio:["ignore",fd,fd]}); fs.closeSync(fd); return c;
}
async function stop(c:childProcess.ChildProcess|undefined) {
  if(!c||c.exitCode!==null) return; c.kill("SIGTERM");
  for(let n=0;n<50;n++){ if(c.exitCode!==null)return; await sleep(100); } c.kill("SIGKILL"); await sleep(200);
}
async function waitHttp(url:string,c:childProcess.ChildProcess) {
  for(let n=0;n<100;n++){ if(c.exitCode!==null) die(`server exited code=${c.exitCode}`); try{ await fetch(url); return; }catch{} await sleep(300); }
  die(`server not reachable: ${url}`);
}
async function waitFile(f:string,c:childProcess.ChildProcess) {
  for(let n=0;n<50;n++){ if(fs.existsSync(f))return; if(c.exitCode!==null)die(`monitor exited code=${c.exitCode}`); await sleep(200); }
  die(`monitor file missing: ${f}`);
}
async function logged(cmd:string,args:string[],log:string,env:NodeJS.ProcessEnv=process.env) {
  const s=fs.createWriteStream(log,{flags:"a"});
  return await new Promise<number>((resolve,reject)=>{
    const c=childProcess.spawn(cmd,args,{cwd:root,env,stdio:["ignore","pipe","pipe"]});
    c.stdout.on("data",x=>{process.stdout.write(x);s.write(x)}); c.stderr.on("data",x=>{process.stderr.write(x);s.write(x)});
    c.on("error",e=>{s.end();reject(e)}); c.on("close",code=>{s.end();resolve(code??1)});
  });
}
function seed(mode:Mode,log:string) {
  const fd=fs.openSync(log,"a");
  const r=sync("npm",["run",mode==="baseline"?"benchmark:seed":"benchmark:vcem:seed","--silent"],{
    env:{...process.env,BENCHMARK_FIXTURE_COUNT:String(fixtureCount)},stdio:["ignore",fd,fd]
  }); fs.closeSync(fd); if(r.status!==0) die(`seed failed code=${r.status}`);
  const f=JSON.parse(fs.readFileSync(fixtureSrc,"utf8"));
  if(!Array.isArray(f.requests)||f.requests.length!==fixtureCount) die(`fixture count mismatch`);
}
function preserve(out:string,name:string,src:string) {
  if(!fs.existsSync(src)) return null; const d=path.join(out,name); fs.copyFileSync(src,d);
  return {path:d,sha256:sha(d),bytes:fs.statSync(d).size};
}
function metric(summary:any,name:string,key:string) {
  const m=summary?.metrics?.[name];
  if(m===undefined || m===null) return undefined;

  const v=
    m?.values?.[key] ??
    m?.[key] ??
    (key==="rate" ? m?.value : undefined);

  return Number.isFinite(v) ? Number(v) : undefined;
}
function validate(mode:Mode,file:string) {
  if(!fs.existsSync(file)) return {ok:false,failures:["summary missing"],metrics:null};
  const s=JSON.parse(fs.readFileSync(file,"utf8"));
  const c=mode==="baseline"?"baseline_workflows_completed":"vcem_workflows_completed";
  const f=mode==="baseline"?"baseline_workflows_failed":"vcem_workflows_failed";
  const rel=mode==="baseline"?"baseline_release_rate":"vcem_proxy_release_rate";
  const den=mode==="baseline"?"baseline_denial_rate":"vcem_proxy_denial_rate";
  const completed=metric(s,c,"count")||0, failed=metric(s,f,"count")||0;
  const release=metric(s,rel,"rate"), denial=metric(s,den,"rate"); const failures:string[]=[];
  if(completed<=0)failures.push(`${c}=0`); if(failed!==0)failures.push(`${f}=${failed}`);
  if(release===undefined||release<1)failures.push(`${rel}=${release}`); if(denial===undefined||denial>0)failures.push(`${den}=${denial}`);
  const latency=mode==="baseline"?"baseline_latency_ms":"vcem_app_latency_ms";
  const vals=
    s?.metrics?.[latency]?.values ||
    s?.metrics?.[latency] ||
    {};
  return {ok:failures.length===0,failures,metrics:{
    completedWorkflows:completed,failedWorkflows:failed,throughputPerSecond:completed/measure,
    appLatencyMs:{avg:vals.avg,p50:vals["p(50)"] ?? vals.med,p95:vals["p(95)"],min:vals.min,max:vals.max}
  }};
}
async function main() {
  const {mode,u,r}=parseArgs(); previousMetadata(mode,u,r);
  if(mode==="vcem"&&u>=150){ const p=previousMetadata(mode,u,r); if(p&&bootMs()<=Date.parse(p.finishedAt||""))die("PRECONDITION_FAILED: mandatory reboot required before high-load VCEM repetition"); }
  const out=outDir(mode,u,r); if(fs.existsSync(out)&&fs.readdirSync(out).length)die(`result directory non-empty: ${out}`);
  const preSwap=swapMiB(); if(preSwap>0)die(`PRECONDITION_FAILED: host swap ${preSwap} MiB`);
  const needed=mode==="baseline"?["BASELINE_DATABASE_URL","BASELINE_API_URL"]:["DATABASE_URL","VCEM_API_URL"];
  const missing=needed.filter(x=>!process.env[x]); if(missing.length)die(`missing environment variables: ${missing.join(", ")}`);
  await postgresReady();
  if(mode==="baseline"){
    const running=text("docker",["ps","--format","{{.Names}}"]).split("\n").filter(x=>x.startsWith("vcem-besu-"));
    if(running.length)die(`baseline requires Besu stopped: ${running.join(",")}`);
  }
  fs.mkdirSync(out,{recursive:true}); const metaFile=path.join(out,"metadata.json");
  const meta:any={protocolVersion:1,status:"preparing",mode,users:u,run:r,warmupSeconds:warmup,measureSeconds:measure,fixtureCount,
    startedAt:new Date().toISOString(),gitCommit:text("git",["rev-parse","HEAD"]),host:{platform:os.platform(),release:os.release(),cpus:os.cpus().length,memoryBytes:os.totalmem()},preRunSwapMiB:preSwap};
  write(metaFile,meta); let app:childProcess.ChildProcess|undefined,mon:childProcess.ChildProcess|undefined;
  try{
    if(mode==="vcem"){
      const code=await logged("npx",["ts-node","benchmarks/formal-evaluation/restoreFormalBesu.ts"],path.join(out,"besu-restore.log"));
      if(code!==0)die(`Besu restore failed code=${code}`);
    }
    seed(mode,path.join(out,"seed.log"));
    meta.fixture=preserve(out,"benchmark-fixtures.json",fixtureSrc);
    meta.manifest=preserve(out,"vcem-manifest.json",path.join(root,"deployments/vcem-manifest.json"));
    const url=mode==="baseline"?process.env.BASELINE_API_URL!:process.env.VCEM_API_URL!; const port=portOf(url); portFree(port);
    app=start("npx",["ts-node",mode==="baseline"?"benchmarks/formal-evaluation/baseline-server.ts":"benchmarks/scripts/vcemServer.ts"],path.join(out,"application.log"),
      mode==="baseline"?{...process.env,BASELINE_PORT:String(port)}:{...process.env,VCEM_API_PORT:String(port),VCEM_RELAY_MODE:"fast",VCEM_DIAGNOSTIC_LOG:path.join(out,"vcem-events.jsonl")});
    await waitHttp(url,app);
    const md=path.join(out,"monitor"); fs.mkdirSync(md,{recursive:true});
    mon=start("npx",["ts-node","benchmarks/formal-evaluation/formalMonitor.ts"],path.join(out,"monitor.log"),
      {...process.env,FORMAL_MODE:mode,VCEM_DIAGNOSTIC_DIR:md,VCEM_DIAGNOSTIC_INTERVAL_MS:"5000",POSTGRES_CONTAINER:"vcem-postgres"});
    await waitFile(path.join(md,"monitor-metadata.json"),mon);
    meta.status="running"; meta.workloadStartedAt=new Date().toISOString(); write(metaFile,meta);
    const summary=path.join(out,"k6-summary.json");
    const kcode=await logged("k6",["run","--summary-export",summary,mode==="baseline"?"benchmarks/formal-evaluation/k6/baseline-access.js":"benchmarks/formal-evaluation/k6/vcem-access.js"],path.join(out,"k6.log"),
      {...process.env,USERS:String(u),WARMUP_SECONDS:String(warmup),MEASURE_SECONDS:String(measure),BENCHMARK_FIXTURES:"benchmarks/raw/fixtures/benchmark-fixtures.json"});
    const v=validate(mode,summary); meta.k6ExitCode=kcode; meta.validationFailures=v.failures; meta.formalMetrics=v.metrics;
    if(kcode!==0)meta.validationFailures.push(`k6 exit code=${kcode}`); meta.status=meta.validationFailures.length?"failed":"executed";
  }catch(e:any){ meta.status="failed"; meta.failure=String(e?.stack||e); console.error(meta.failure); }
  finally{
    await stop(mon); await stop(app);
    if(mode==="vcem") sync("docker",["compose","--project-directory","infrastructure/besu","-f","infrastructure/besu/docker-compose.yml","stop"],{stdio:"inherit"});
    meta.finishedAt=new Date().toISOString(); meta.postRunSwapMiB=swapMiB(); meta.nextPlanned=next(mode,u,r);
    meta.rebootRequiredBeforeNext=meta.postRunSwapMiB>0||Boolean(meta.nextPlanned?.mode==="vcem"&&meta.nextPlanned?.u>=150);
    meta.nextAction=meta.status!=="executed"?"INSPECT_FAILED_REPETITION":meta.rebootRequiredBeforeNext?"REBOOT_REQUIRED":meta.nextPlanned?"RUN_NEXT_PLANNED_REPETITION":"FORMAL_CAMPAIGN_COMPLETE";
    write(metaFile,meta);
  }
  console.log(JSON.stringify({status:meta.status,mode,users:u,run:r,formalMetrics:meta.formalMetrics,postRunSwapMiB:meta.postRunSwapMiB,rebootRequiredBeforeNext:meta.rebootRequiredBeforeNext,nextPlanned:meta.nextPlanned,nextAction:meta.nextAction,outputDir:out},null,2));
  if(meta.status!=="executed")process.exitCode=1;
}
main().catch(e=>{console.error(String(e?.stack||e));process.exitCode=1});
