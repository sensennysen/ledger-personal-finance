// Reuse the repository's existing scan unmodified; only adapt browser loading and launch.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const source=await readFile('scripts/sweep.mjs','utf8')
const scanSource=source.slice(source.indexOf('function contrastScan('),source.indexOf('/** Home widgets'))
const sandbox={};vm.createContext(sandbox);vm.runInContext(scanSource+';this.scan=contrastScan',sandbox)
const scanText=sandbox.scan.toString()
const out=process.env.QA_VISUAL_OUT || 'docs/qa/runs/QA-20261006-visual-final';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
let results=[]
try { results=JSON.parse(await readFile(`${out}/results.json`,'utf8')).results } catch { /* New run. */ }
const navigationIssues=[]
const routes=['/','/accounts','/accounts/22222222-0000-4000-8000-000000000002','/transactions','/budgets','/categories','/reports','/thirteenth-month','/settings','/more']
for(const theme of ['light','dark'])for(const [width,height] of [[390,844],[768,1024],[1920,1080]]){
 const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce',timezoneId:'Asia/Shanghai'})
 const page=await context.newPage();page.setDefaultTimeout(12000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5173/login')
 await page.getByRole('button',{name:'Sign in with email',exact:true}).click();await page.waitForURL('http://127.0.0.1:5173/')
 // Profile preferences take precedence over legacy local storage. Apply appearance via Settings.
 await page.goto('http://127.0.0.1:5173/settings')
 await page.getByRole('button',{name:theme==='light'?'Light':'Dark',exact:true}).click()
 await page.waitForFunction(t=>document.documentElement.classList.contains('dark')===(t==='dark'),theme)
 for(const route of routes){
  if(results.some(r=>r.route===route&&r.width===width&&r.theme===theme))continue
  try { await page.goto('http://127.0.0.1:5173'+route,{waitUntil:'domcontentloaded'}) }
  catch(error) { navigationIssues.push({route,width,theme,error:error.message});await page.goto('http://127.0.0.1:5173'+route,{waitUntil:'domcontentloaded'}) }
  await page.waitForLoadState('networkidle',{timeout:12000}).catch(()=>{})
  await page.mouse.move(0,0)
  const scan=await page.evaluate(`(${scanText})()`)
  const name=`${route==='/'?'home':route.slice(1).replaceAll('/','-')}-${width}-${theme}`
  await page.screenshot({path:`${out}/${name}.png`,fullPage:true})
  const result={route,width,height,theme,actualUrl:page.url(),scan,errors:[...errors],screenshot:`${name}.png`}
  results.push(result);console.log(`${name} contrast=${scan.failures.length} overflow=${scan.overflowX}`)
  await writeFile(`${out}/results.json`,JSON.stringify({browser:browser.version(),results,navigationIssues},null,2))
 }
 await context.close()
}
await browser.close()
assert.equal(results.length,60)
console.log(`Finished ${results.length} route/viewport/theme combinations`)
