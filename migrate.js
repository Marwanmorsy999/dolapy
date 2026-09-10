(function(){
  try{
    const next='dolapy.pages.v4';
    const sources=['dolapy.pages.v3','dolapy.pages.v2','dolapy.static.v1'];
    if(!localStorage.getItem(next)){
      for(const key of sources){
        const old=localStorage.getItem(key);
        if(old){localStorage.setItem(next,old);break;}
      }
    }
  }catch(err){ console.warn('Dolapy local migration skipped',err); }
})();
