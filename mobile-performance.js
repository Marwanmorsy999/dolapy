(()=>{
'use strict';
const LOW_END=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)&&!navigator.gpu;
const connection=navigator.connection||{};
const slowNetwork=connection.saveData===true||/2g|3g/.test(connection.effectiveType||'');
window.DolapyPerformance={
  mobile:LOW_END||/Mobile/i.test(navigator.userAgent),
  lowPower:LOW_END||slowNetwork,
  imageSize(){return this.lowPower?768:1024},
  // Use the quantized model on CPU/mobile. FP16 is intended for capable GPU paths;
  // forcing it through a mobile CPU/WASM fallback can leave the original image in place.
  segmentationModel(){return this.lowPower?'isnet_quint8':'isnet_fp16'},
  classifierOptions(){return navigator.gpu&&!this.lowPower?{device:'webgpu',dtype:'fp16'}:{device:'wasm',dtype:'q8'}},
  shouldRunSecondPass(score){return Number(score||0)<(this.lowPower?.32:.42)},
  compositeLimit(){return this.lowPower?4:6}
};
})();
