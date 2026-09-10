(function(){
  try{
    const next='dolapy.pages.v3';
    const legacy='dolapy.pages.v2';
    if(!localStorage.getItem(next)){
      const old=localStorage.getItem(legacy);
      if(old) localStorage.setItem(next,old);
    }
  }catch(err){ console.warn('Dolapy local migration skipped',err); }
})();
