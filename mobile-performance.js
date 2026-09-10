(()=>{
'use strict';
const LOW_END=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)&&!navigator.gpu;
const connection=navigator.connection||{};
const slowNetwork=connection.saveData===true||/2g|3g/.test(connection.effectiveType||'');
window.DolapyPerformance={
  mobile:LOW_END||/Mobile/i.test(navigator.userAgent),
  lowPower:LOW_END||slowNetwork,
  imageSize(){return this.lowPower?768:1024},
  // Keep the proven browser-compatible IS-Net FP16 model. Full IS-Net is WebGPU-oriented and can fail or time out on mobile CPU fallback.
  segmentationModel(){return 'isnet_fp16'},
  classifierOptions(){return navigator.gpu&&!this.lowPower?{device:'webgpu',dtype:'fp16'}:{device:'wasm',dtype:'q8'}},
  shouldRunSecondPass(score){return Number(score||0)<(this.lowPower?.32:.42)},
  compositeLimit(){return this.lowPower?4:6}
};
})();
