/* Portrait matting: MODNet (Apache-2.0) with ONNX Runtime Web 1.20.1 (MIT).
   All resources are served from the same website. No employee image is uploaded. */
let sessionPromise;
async function loadModel(id) {
  if (!sessionPromise) sessionPromise = (async () => {
    importScripts('ort.min.js');
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = new URL('./', self.location.href).href;
    ort.env.logLevel = 'error';
    const response = await fetch(new URL('modnet.onnx', self.location.href));
    if (!response.ok) throw new Error('模型文件未找到，请确认 assets 文件夹已完整上传。');
    const reader = response.body && response.body.getReader();
    let model;
    if (reader) {
      const total = Number(response.headers.get('Content-Length')) || 25888640;
      const chunks=[]; let received=0;
      while (true) {
        const {done,value}=await reader.read(); if(done)break;
        chunks.push(value);received+=value.length;
        self.postMessage({id, type:'progress', progress:Math.min(70,Math.round(received/total*70)), message:'正在加载本地人像模型…'});
      }
      model = new Uint8Array(received);let offset=0;
      for(const chunk of chunks){model.set(chunk,offset);offset+=chunk.length;}
    } else model=new Uint8Array(await response.arrayBuffer());
    self.postMessage({id,type:'progress',progress:75,message:'正在初始化抠像引擎…'});
    return await ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  })().catch(error=>{sessionPromise=undefined;throw error;});
  return sessionPromise;
}
self.onmessage = async ({data}) => {
  const {id, width, height, pixels}=data;
  try {
    const session=await loadModel(id);
    self.postMessage({id,type:'progress',progress:85,message:'正在识别人像与发丝边缘…'});
    const tensor=new ort.Tensor('float32',pixels,[1,3,height,width]);
    const started=performance.now();
    const result=await session.run({[session.inputNames[0]]:tensor});
    const output=result[session.outputNames[0]];
    const mask=new Float32Array(output.data);
    self.postMessage({id,type:'result',mask,inferenceMs:performance.now()-started,width:output.dims[3],height:output.dims[2]},[mask.buffer]);
    tensor.dispose();Object.values(result).forEach(t=>t.dispose());
  } catch(error) {self.postMessage({id,type:'error',message:error.message||String(error)});}
};
