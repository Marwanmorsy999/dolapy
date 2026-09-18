// Dolapy — Resumable photo processing queue (IndexedDB-backed)
// Solves: closing the tab mid-batch used to lose all unprocessed photos silently.
// Every photo is written to IndexedDB the instant it's queued, before any processing
// starts. If the tab is closed/crashed/backgrounded, the next page load finds the
// unfinished entries and offers to resume — nothing is silently lost.
(()=>{
'use strict';
const DB_NAME='dolapy-queue';
const DB_VERSION=1;
const STORE_NAME='photos';

function openDB(){
  return new Promise((res,rej)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE_NAME)){
        db.createObjectStore(STORE_NAME,{keyPath:'id'});
      }
    };
    req.onsuccess=()=>res(req.result);
    req.onerror=()=>rej(req.error);
  });
}

async function withStore(mode,fn){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE_NAME,mode);
    const store=tx.objectStore(STORE_NAME);
    const result=fn(store);
    tx.oncomplete=()=>res(result);
    tx.onerror=()=>rej(tx.error);
  });
}

// entry: {id, blob, fileName, status:'pending'|'done'|'failed', result:null, error:null, addedAt}
async function addEntry(entry){
  return withStore('readwrite',store=>store.put(entry));
}

async function updateEntry(id,patch){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE_NAME,'readwrite');
    const store=tx.objectStore(STORE_NAME);
    const getReq=store.get(id);
    getReq.onsuccess=()=>{
      const existing=getReq.result;
      if(!existing)return res(null);
      store.put({...existing,...patch});
    };
    tx.oncomplete=()=>res(true);
    tx.onerror=()=>rej(tx.error);
  });
}

async function removeEntry(id){
  return withStore('readwrite',store=>store.delete(id));
}

async function getAllEntries(){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE_NAME,'readonly');
    const store=tx.objectStore(STORE_NAME);
    const req=store.getAll();
    req.onsuccess=()=>res(req.result||[]);
    req.onerror=()=>rej(req.error);
  });
}

async function getPendingEntries(){
  const all=await getAllEntries();
  return all.filter(e=>e.status==='pending');
}

async function clearFinished(){
  const all=await getAllEntries();
  const toRemove=all.filter(e=>e.status==='done'||e.status==='failed');
  for(const e of toRemove)await removeEntry(e.id);
  return toRemove.length;
}

async function clearAll(){
  return withStore('readwrite',store=>store.clear());
}

window.DolapyQueueStore={
  addEntry,updateEntry,removeEntry,getAllEntries,getPendingEntries,clearFinished,clearAll
};
})();
