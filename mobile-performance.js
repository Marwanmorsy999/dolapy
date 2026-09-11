(()=>{
'use strict';
const LOW_END=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)&&!navigator.gpu;
const connection=navigator.connection||{};
const slowNetwork=connection.saveData===true||/2g|3g/.test(connection.effectiveType||'');
window.DolapyPerformance={
  mobile:LOW_END||/Mobile/i.test(navigator.userAgent),
  lowPower:LOW_END||slowNetwork,
  imageSize(){return this.mobile?768:1024},
  // fp16+gpu is faster on devices with real WebGPU; quint8+cpu as fallback
  segmentationModel(){return navigator.gpu?'isnet_fp16':'isnet_quint8'},
  segmentationDevice(){return navigator.gpu?'gpu':'cpu'},
  classifierOptions(){return{device:'wasm',dtype:'q8'}},
  shouldRunSecondPass(score){return Number(score||0)<(this.lowPower?.32:.42)},
  compositeLimit(){return this.lowPower?4:6}
};
})();
