import assert from "node:assert/strict";import {readFileSync} from "node:fs";import test from "node:test";
test("product UI uses fail-closed server seams and no browser storage",()=>{const p=readFileSync("src/ui/features/masters/ProductsMasterPage.tsx","utf8");assert.match(p,/fetch\(PRODUCTS_ENDPOINT/);assert.match(p,/"PATCH":"POST"/);assert.match(p,/"PATCH":"POST"/);assert.match(p,/"If-Match":`\"\${/);assert.doesNotMatch(p,/localStorage|browser-product-storage|Saved in this browser/i);});
test("product UI has truthful bilingual loading, auth, forbidden, error and empty states",()=>{const p=readFileSync("src/ui/features/masters/ProductsMasterPage.tsx","utf8");for(const c of ["Loading products","جارٍ تحميل المنتجات","Sign in to load and save products","سجّل الدخول لتحميل المنتجات وحفظها","You do not have permission to view products","ليس لديك إذن لعرض المنتجات","Product service is unavailable","خدمة المنتجات غير متاحة","No products registered yet","لم تُسجل منتجات بعد"])assert.ok(p.includes(c),c)});

test("product edit payload omits immutable reference, captures the form before await, and restores bilingual mobile labels",()=>{
 const p=readFileSync("src/ui/features/masters/ProductsMasterPage.tsx","utf8");
 assert.match(p,/const form=e\.currentTarget;[\s\S]*await mutate[\s\S]*form\.reset\(\)/);
 assert.match(p,/editingProduct\?\(\(\{reference:_,\.\.\.values\}\)=>values\)\(inputValues\)/);
 for(const pair of [["المنتج","Product"],["المنشأ","Origin"],["النوع / الدرجة","Type / grade"],["المحصول","Crop"],["العبوة","Pack"],["الحالة","Status"],["الإجراء","Action"]]) assert.ok(p.includes(`data-label={ar?${JSON.stringify(pair[0])}:${JSON.stringify(pair[1])}}`), pair.join(" / "));
 assert.equal((p.match(/data-label=/g)??[]).length,7);
});


test("product actions reveal the form and mixed-direction values remain isolated",()=>{
 const p=readFileSync("src/ui/features/masters/ProductsMasterPage.tsx","utf8");
 assert.match(p,/scrollIntoView/);
 assert.ok((p.match(/<bdi>/g)??[]).length>=5);
});
