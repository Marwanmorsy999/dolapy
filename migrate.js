(function(){
  try{
    // Single source of truth is 'dolapy.pages.v3'. Remove the stray v4 copy
    // an old migration script created so storage never splits.
    localStorage.removeItem('dolapy.pages.v4');
  }catch(err){console.warn('Dolapy storage cleanup skipped',err);}
})();
