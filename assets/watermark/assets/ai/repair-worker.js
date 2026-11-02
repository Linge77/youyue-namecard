/* MI-GAN-512 Places2 official ONNX pipeline (MIT).
   ORT Web 1.20.1 (MIT). All fetches are same-origin static assets. */
let sessionPromise;
let busy=false;
function progress(id,stage,message,loaded,total) { self.postMessage({id,type:'progress',stage,message,loaded,total}); }
async function loadSession(id) {
  if(!sessionPromise) sessionPromise=(async()=>{
    importScripts('ort.min.js');
    ort.env.wasm.numThreads=1;
    ort.env.wasm.proxy=false;
    ort.env.wasm.wasmPaths=new URL('./',self.location.href).href;
    ort.env.logLevel='error';
    progress(id,'loading','正在读取本地修复模型…',0,28079181);
    const descriptorResponse=await fetch(new URL('migan-manifest.json',self.location.href));
    if(!descriptorResponse.ok)throw new Error('修复模型清单缺失，请保留完整 assets 文件夹。');
    const descriptor=await descriptorResponse.json();
    if(descriptor.size!==28079181||!Array.isArray(descriptor.parts)||descriptor.parts.length<1||descriptor.parts.length>8||descriptor.parts.some(p=>!p||!/^[a-zA-Z0-9_.-]+$/.test(p.file)||!Number.isInteger(p.size)||p.size<=0)||descriptor.parts.reduce((n,p)=>n+p.size,0)!==28079181)throw new Error('修复模型清单无效。');
    const model=new Uint8Array(descriptor.size);let received=0;
    for(const part of descriptor.parts){
      const response=await fetch(new URL(part.file,self.location.href));
      if(!response.ok)throw new Error('修复模型文件缺失：'+part.file);
      const start=received;
      if(response.body?.getReader){
        const reader=response.body.getReader();
        while(true){const {value,done}=await reader.read();if(done)break;if(received+value.byteLength>model.length||received-start+value.byteLength>part.size){await reader.cancel();throw new Error('模型文件大小异常。');}model.set(value,received);received+=value.byteLength;progress(id,'loading','正在读取本地修复模型…',received,descriptor.size);}
      }else{const value=new Uint8Array(await response.arrayBuffer());if(value.byteLength!==part.size)throw new Error('模型文件未下载完整。');model.set(value,received);received+=value.byteLength;}
      if(received-start!==part.size)throw new Error('模型分片不完整：'+part.file);
    }
    if(model.byteLength!==28079181)throw new Error('修复模型大小不正确，可能未下载完整。');
    if(self.crypto?.subtle){
      const digest=await crypto.subtle.digest('SHA-256',model);
      const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!=='6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b')throw new Error('修复模型完整性验证失败。');
    }
    progress(id,'initializing','正在初始化本机修复引擎…');
    return await ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  })().catch(e=>{sessionPromise=null;throw e;});
  return await sessionPromise;
}
self.onmessage=async({data})=>{
  const {id,width,height}=data;
  if(busy){self.postMessage({id,type:'error',message:'修复引擎正在处理另一个任务。'});return;}
  busy=true;let imageTensor,maskTensor,outputs;
  try{
    const session=await loadSession(id),rgba=new Uint8ClampedArray(data.pixels),selection=new Uint8Array(data.mask),length=width*height;
    const rgb=new Uint8Array(length*3),keep=new Uint8Array(length);
    for(let i=0;i<length;i++){rgb[i]=rgba[i*4];rgb[length+i]=rgba[i*4+1];rgb[length*2+i]=rgba[i*4+2];keep[i]=selection[i]>127?0:255;}
    imageTensor=new ort.Tensor('uint8',rgb,[1,3,height,width]);maskTensor=new ort.Tensor('uint8',keep,[1,1,height,width]);
    progress(id,'running','正在本机修复涂选区域…');
    const start=performance.now();
    outputs=await session.run({image:imageTensor,mask:maskTensor});
    const inferenceMs=performance.now()-start,output=outputs.result||outputs[session.outputNames[0]];
    if(output.type!=='uint8'||output.dims[2]!==height||output.dims[3]!==width)throw new Error('模型输出尺寸不匹配。');
    const result=output.data;
    // Enforce exact untouched pixels outside the user's binary selection.
    for(let i=0;i<length;i++)if(selection[i]>127){rgba[i*4]=result[i];rgba[i*4+1]=result[length+i];rgba[i*4+2]=result[length*2+i];}
    progress(id,'complete','本机修复完成');
    self.postMessage({id,type:'result',width,height,pixels:rgba.buffer,inferenceMs},[rgba.buffer]);
  }catch(e){self.postMessage({id,type:'error',message:e?.message||String(e)});}
  finally{imageTensor?.dispose();maskTensor?.dispose();if(outputs)Object.values(outputs).forEach(t=>t.dispose());busy=false;}
};
