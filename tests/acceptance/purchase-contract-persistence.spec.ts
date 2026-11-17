import {expect,test,type Page} from "@playwright/test";

const projectId="33333333-3333-7333-8333-333333333333";
const supplier={id:"55555555-5555-7555-8555-555555555555",reference:"SUP-001",registeredName:"Coast Exporters",displayNameAr:"مصدرو الساحل",status:"ACTIVE",version:1};
const product={id:"22222222-2222-7222-8222-222222222222",reference:"PROD-001",nameEn:"Yemen Matari",nameAr:"مطري يمني",status:"ACTIVE",version:1};
const tolerances={quantityUnder:"0.000000",quantityOver:"0.000000",netWeightUnder:"0.000000",netWeightOver:"0.000000",grossWeightUnder:"0.000000",grossWeightOver:"0.000000"};
const baseProject={id:projectId,reference:"ORB-PRJ-2026-000001",lifecycleState:"DRAFT",managementCurrency:"USD",version:1,customer:{id:"11111111-1111-7111-8111-111111111111",reference:"CUS-001",legalName:"Northstar Roasters",legalNameAr:"محمصة نورث ستار"},salesContract:{id:"44444444-4444-7444-8444-444444444444",reference:"ORB-SC-2026-000001",state:"DRAFT",version:1,activeVersion:{revisionNo:1,effectiveDate:"2026-11-17",product:{id:product.id,reference:product.reference,nameEn:product.nameEn,nameAr:product.nameAr},quantity:"100.000000",unitPrice:"4250.000000",currency:"USD",route:"FOREIGN_TO_FOREIGN",incoterm:"FOB",namedPlace:"Jebel Ali",paymentTerms:"30 days",documentTerms:"Original BL",tolerances}},purchaseContracts:[]};

type MockState={keys:string[];posts:number;commits:number};
async function mockPurchaseApis(page:Page,{loseFirstResponse=false}={}){
  let persisted:any=structuredClone(baseProject),lost=false;
  const byKey=new Map<string,any>();
  const state:MockState={keys:[],posts:0,commits:0};
  await page.route("**/api/suppliers",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items:[supplier],nextCursor:null})}));
  await page.route("**/api/products",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items:[product],nextCursor:null})}));
  await page.route(/\/api\/projects\/[^/?]+(?:\/purchase-contracts)?(?:\?.*)?$/,async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==="GET"){
      await route.fulfill({status:200,headers:{"x-orb-project-write-permitted":"true"},contentType:"application/json",body:JSON.stringify(persisted)});return;
    }
    expect(url.pathname).toBe(`/api/projects/${projectId}/purchase-contracts`);
    state.posts+=1;
    const key=request.headers()["idempotency-key"];
    state.keys.push(key);
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(request.headers()["if-match"]).toBe('"1"');
    const body=request.postDataJSON();
    expect(body).toMatchObject({counterpartyId:supplier.id,coffeeSpecificationId:product.id,effectiveDate:"2026-11-18",quantity:"20",unitPrice:"4100",currency:"USD",route:"DOMESTIC_TO_FOREIGN",incoterm:"FOB",namedPlace:"Aden",paymentTerms:"30 days",documentTerms:"Original BL",tolerances:{quantityUnder:"1",quantityOver:"2"}});
    let saved=byKey.get(key);
    if(!saved){
      const purchase={id:"66666666-6666-7666-8666-666666666666",reference:"ORB-PC-2026-000001",state:"DRAFT",version:1,supplier:{id:supplier.id,reference:supplier.reference,registeredName:supplier.registeredName,displayNameAr:supplier.displayNameAr},activeVersion:{revisionNo:1,effectiveDate:body.effectiveDate,product:{id:product.id,reference:product.reference,nameEn:product.nameEn,nameAr:product.nameAr},quantity:"20.000000",unitPrice:"4100.000000",currency:"USD",route:body.route,incoterm:"FOB",namedPlace:"Aden",paymentTerms:"30 days",documentTerms:"Original BL",tolerances:{quantityUnder:"1.000000",quantityOver:"2.000000",netWeightUnder:"0.000000",netWeightOver:"0.000000",grossWeightUnder:"0.000000",grossWeightOver:"0.000000"}}};
      saved={...persisted,version:2,purchaseContracts:[purchase]};persisted=saved;byKey.set(key,saved);state.commits+=1;
    }
    if(loseFirstResponse&&!lost){lost=true;await route.abort("failed");return;}
    await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify(saved)});
  });
  return state;
}

async function fillAndSubmit(page:Page,locale:"en"|"ar"){
  const ar=locale==="ar";
  const label=(en:string,arText:string)=>ar?arText:en;
  const supplierSelect=page.getByLabel(label("Supplier","المورد"));
  await supplierSelect.focus();await supplierSelect.press("ArrowDown");await supplierSelect.press("Enter");
  const productSelect=page.getByLabel(label("Product","المنتج"));
  await productSelect.focus();await productSelect.press("ArrowDown");await productSelect.press("Enter");
  await page.getByLabel(label("Effective date","تاريخ السريان")).fill("2026-11-18");
  await page.getByLabel(label("Quantity","الكمية"),{exact:true}).fill("20");
  await page.getByLabel(label("Unit price","سعر الوحدة")).fill("4100");
  await page.getByLabel(label("Currency","العملة")).fill("USD");
  await page.getByLabel(label("Trade route","مسار التجارة")).selectOption("DOMESTIC_TO_FOREIGN");
  await page.getByLabel(label("Incoterm","شرط التسليم")).fill("FOB");
  await page.getByLabel(label("Named place","المكان المسمى")).fill("Aden");
  await page.getByLabel(label("Payment terms","شروط السداد")).fill("30 days");
  await page.getByLabel(label("Document terms","شروط المستندات")).fill("Original BL");
  const quantityTolerance=page.getByRole("group",{name:label("Quantity tolerance","تحمل الكمية")});
  await quantityTolerance.getByLabel(label("Under tolerance","النقص")).fill("1");
  await quantityTolerance.getByLabel(label("Over tolerance","الزيادة")).fill("2");
  const save=page.getByRole("button",{name:label("Save purchase contract","حفظ عقد الشراء")});
  await save.focus();await page.keyboard.press("Enter");
  return save;
}

for(const locale of ["en","ar"] as const)for(const mobile of [false,true])test(`${locale} ${mobile?"mobile":"desktop"} purchase contract persists and reads back locally`,async({page},testInfo)=>{
  if(mobile)await page.setViewportSize({width:390,height:844});
  const state=await mockPurchaseApis(page);
  await page.goto(`/projects/${projectId}/contracts?locale=${locale}`);
  await expect(page.locator("main > section")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr");
  await fillAndSubmit(page,locale);
  await expect(page.getByText(locale==="ar"?"تم حفظ عقد الشراء.":"Purchase contract saved.")).toBeVisible();
  await expect(page.getByText("ORB-PC-2026-000001",{exact:true})).toBeVisible();
  await expect(page.getByText(locale==="ar"?"مسودة":"Draft",{exact:true})).toBeVisible();
  await expect(page.getByRole("article").getByText(locale==="ar"?"محلي إلى دولي":"Domestic to foreign",{exact:true})).toBeVisible();
  expect(state.posts).toBe(1);expect(state.commits).toBe(1);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/contracts\\?locale=${locale}`));
  await expect(page.getByText("ORB-PC-2026-000001",{exact:true})).toBeVisible();
  await expect(page.getByText(locale==="ar"?supplier.displayNameAr:supplier.registeredName,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:testInfo.outputPath(`${locale}-${mobile?"mobile":"desktop"}-purchase.png`),fullPage:true});
});

test("committed purchase response loss retries with the same logical submission key",async({page})=>{
  const state=await mockPurchaseApis(page,{loseFirstResponse:true});
  await page.goto(`/projects/${projectId}/contracts?locale=en`);
  await fillAndSubmit(page,"en");
  await expect(page.getByText("The request may have been saved, but its response could not be verified. Check saved contracts or retry with the same key.")).toBeVisible();
  const retry=page.getByRole("button",{name:"Retry with the same key"});
  const refresh=page.getByRole("button",{name:"Check saved contracts"});
  await expect(retry).toBeVisible();
  await expect(refresh).toBeVisible();
  await retry.click();
  await expect(page.getByText("Purchase contract saved.")).toBeVisible();
  await expect(page.getByText("ORB-PC-2026-000001",{exact:true})).toBeVisible();
  expect(state.posts).toBe(2);expect(state.commits).toBe(1);expect(state.keys[0]).toBe(state.keys[1]);
});
