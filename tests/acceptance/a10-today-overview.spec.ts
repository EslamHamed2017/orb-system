import { expect, test, type Page } from "@playwright/test";


const project={id:"33333333-3333-7333-8333-333333333333",reference:"ORB-PRJ-2026-000001",lifecycleState:"DRAFT",managementCurrency:"USD",version:1,customer:{id:"11111111-1111-7111-8111-111111111111",reference:"CUS-001",legalName:"Northstar Roasters",legalNameAr:"محمصة نورث ستار"},salesContract:{id:"44444444-4444-7444-8444-444444444444",reference:"ORB-SC-2026-000001",state:"DRAFT",version:1,activeVersion:{revisionNo:1,effectiveDate:"2026-11-17",product:{id:"22222222-2222-7222-8222-222222222222",reference:"PROD-001",nameEn:"Yemen Matari",nameAr:"مطري يمني"},quantity:"100.000000",unitPrice:"4250.000000",currency:"USD",route:"FOREIGN_TO_FOREIGN",incoterm:"FOB",namedPlace:"Jebel Ali",paymentTerms:"30 days",documentTerms:"Original BL",tolerances:{quantityUnder:"0.000000",quantityOver:"0.000000",netWeightUnder:"0.000000",netWeightOver:"0.000000",grossWeightUnder:"0.000000",grossWeightOver:"0.000000"}}},purchaseContracts:[]};
function fulfill(page:any,items:any[]){return page.route("**/api/projects",(route:any)=>route.fulfill({status:200,headers:{"x-orb-project-write-permitted":"true"},contentType:"application/json",body:JSON.stringify({items,nextCursor:null})}))}
test("empty persisted project register never invents demo projects",async({page})=>{await fulfill(page,[]);await page.goto("/projects?locale=en");await expect(page.getByRole("heading",{name:"No projects registered yet"})).toBeVisible();await expect(page.locator("body")).not.toContainText(/Pilot Customer|ORB-P-0001|browser only/i)});
test("persisted project register searches shared project, customer, contract, and product facts",async({page})=>{await fulfill(page,[project]);await page.goto("/projects?locale=en");for(const value of ["ORB-PRJ-2026-000001","Northstar","ORB-SC-2026-000001","Yemen Matari","Jebel Ali"]){await page.getByRole("searchbox",{name:"Search projects"}).fill(value);await expect(page.getByText("ORB-PRJ-2026-000001",{exact:true})).toBeVisible()}await expect(page.getByRole("link",{name:"Open project"})).toHaveAttribute("href",/33333333-3333-7333-8333-333333333333/)});
test("Arabic persisted project register is RTL and mobile-safe",async({page})=>{await fulfill(page,[project]);await page.setViewportSize({width:390,height:844});await page.goto("/projects?locale=ar");await expect(page.locator("main > section")).toHaveAttribute("dir","rtl");await expect(page.getByText("مطري يمني",{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1)});
test("project service failure is truthful and keyboard-recoverable",async({page})=>{let failing=true;await page.route("**/api/projects",route=>route.fulfill(failing?{status:503,body:"unavailable"}:{status:200,headers:{"x-orb-project-write-permitted":"true"},contentType:"application/json",body:JSON.stringify({items:[],nextCursor:null})}));await page.goto("/projects?locale=en");await expect(page.locator("main [role=alert]")).toContainText("Project service is unavailable.");const retry=page.getByRole("button",{name:"Retry"});await retry.focus();await expect(retry).toBeFocused();failing=false;await retry.press("Enter");await expect(page.getByRole("heading",{name:"No projects registered yet"})).toBeVisible()});

const shipment=(over:Record<string,unknown>)=>({type:"SALES",id:"44444444-4444-7444-8444-444444444444",reference:"OUT-1",projectId:project.id,projectReference:project.reference,counterpartyName:"Northstar Roasters",quantity:"19.200",state:"CONFIRMED",estimatedDeparture:null,estimatedArrival:null,waitingForApproval:false,hasSource:true,invoiceState:null,...over});
async function stubToday(page:Page,options:{shipments?:unknown[];failShipments?:boolean}={}){
  await fulfill(page,[project]);
  await page.route("**/api/shipments",(route:any)=>options.failShipments?route.fulfill({status:503,contentType:"application/problem+json",body:JSON.stringify({status:503,code:"DEPENDENCY_UNAVAILABLE"})}):route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items:options.shipments??[]})}));
  await page.route("**/api/approvals",(route:any)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items:[{id:"a1"},{id:"a2"}]})}));
  await page.route("**/api/reports/project-profitability",(route:any)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({rows:[{project:{id:project.id,reference:project.reference,customerName:"Northstar Roasters",lifecycleState:"ACTIVE",currency:"USD"},warnings:0,expected:{amount:"89950.00",marginPercent:"14.7"},shipped:{amount:"17270.40",marginPercent:"14.7"},actual:{amount:"15220.40",marginPercent:"13.0"},cash:{amount:"-10000.00",marginPercent:null}}]})}));
}

for (const locale of ["en","ar"] as const) test(`${locale} Today lists next steps from live projects and shipments`,async({page})=>{
  const ar=locale==="ar";
  await stubToday(page,{shipments:[shipment({}),shipment({id:"55555555-5555-7555-8555-555555555555",type:"SUPPLIER",reference:"IN-9",state:"IN_TRANSIT",estimatedArrival:"2000-01-01",invoiceState:"CONFIRMED",hasSource:null})]});
  await page.goto(`/?locale=${locale}`);
  await expect(page.locator("html")).toHaveAttribute("dir",ar?"rtl":"ltr");
  await expect(page.getByRole("heading",{level:1,name:ar?"اليوم":"Today"})).toBeVisible();
  const steps=page.getByTestId("today-steps");
  await expect(steps.getByRole("link",{name:ar?`تفعيل المشروع ${project.reference}`:`Activate project ${project.reference}`})).toHaveAttribute("href",`/projects/${project.id}/overview?locale=${locale}`);
  await expect(steps.getByRole("link",{name:ar?"أصدر فاتورة العميل لـ OUT-1":"Issue the customer invoice for OUT-1"})).toBeVisible();
  await expect(steps.getByRole("link",{name:ar?"IN-9 تجاوزت تاريخ الوصول":"IN-9 is past its arrival date"})).toBeVisible();
  await expect(page.getByTestId("today-kpis")).toContainText("2");
  await expect(page.getByTestId("today-profit").getByRole("link",{name:project.reference})).toHaveAttribute("href",`/projects/${project.id}/profit?locale=${locale}`);
  await expect(page.locator("body")).not.toContainText(/localStorage|this browser/i);
});

test("Today stays usable and truthful when shipments cannot be loaded",async({page})=>{
  await stubToday(page,{failShipments:true});
  await page.goto("/?locale=en");
  await expect(page.getByTestId("today-steps").getByRole("alert")).toContainText("Some records could not be loaded");
  await expect(page.getByTestId("today-steps").getByRole("link",{name:`Activate project ${project.reference}`})).toBeVisible();
});

for (const locale of ["en","ar"] as const) test(`${locale} links to browser-only test projects explain where projects live now`,async({page})=>{
  await page.goto(`/projects/legacy-project-1/overview?locale=${locale}`);
  await expect(page.locator("html")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr");
  await expect(page.getByRole("heading",{level:1,name:locale==="ar"?"المشروع غير موجود":"Project not found"})).toBeVisible();
  await expect(page.getByRole("link",{name:locale==="ar"?"فتح المشاريع":"Open projects"})).toHaveAttribute("href",`/projects?locale=${locale}`);
});
