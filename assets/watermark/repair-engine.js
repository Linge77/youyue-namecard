/* Local-only repair engine. MI-GAN MIT; ONNX Runtime MIT. */
export class RepairEngine {
  constructor({onProgress} = {}) { this.onProgress=onProgress; this.worker=null; this.pending=null; this.serial=0; }
  _stop(error) {
    if(this.worker) this.worker.terminate(); this.worker=null;
    if(this.pending) { const p=this.pending; this.pending=null; clearTimeout(p.timer); p.reject(error); }
  }
  cancel() { const e=new Error('已取消修复，原图和选区保留。'); e.name='AbortError'; this._stop(e); }
  dispose() { this.cancel(); }
  run(input, options={}) {
    const {imageData,mask,width,height}=input||{};
    if(this.pending) return Promise.reject(new Error('已有任务正在处理，请等待或取消。'));
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4194304||!imageData?.data||imageData.data.length!==width*height*4||!mask||typeof mask.some!=='function'||mask.length!==width*height)
      return Promise.reject(new Error('图片工作尺寸无效，请重新载入图片（最长边不超过 2048）。'));
    if(!mask.some(v=>v>127)) return Promise.reject(new Error('请先涂选需要修复的区域。'));
    const id=++this.serial,started=performance.now();
    return new Promise((resolve,reject)=>{
      try {
        if(!this.worker) {
          this.worker=new Worker(new URL('./assets/ai/repair-worker.js',import.meta.url));
          const worker=this.worker;
          this.worker.onmessage=({data})=>{
            if(this.worker!==worker)return;
            const p=this.pending; if(!p||data.id!==p.id) return;
            if(data.type==='progress') { try{this.onProgress?.(data);p.onProgress?.(data);}catch(e){console.warn(e);}return; }
            if(data.type==='error') { this._stop(new Error(data.message));return; }
            if(data.type==='result') {
              clearTimeout(p.timer);this.pending=null;
              try { p.resolve({imageData:new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),inferenceMs:data.inferenceMs,elapsedMs:performance.now()-p.started}); }
              catch(e){p.reject(e);}
            }
          };
          this.worker.onerror=()=>{if(this.worker===worker)this._stop(new Error('修复引擎启动失败。请使用本地预览地址打开，并确认模型与运行文件完整。'));};
        }
        const timer=setTimeout(()=>this._stop(new Error('本机处理超过 180 秒，任务已停止。可缩小涂选区域后重试。')),180000);
        this.pending={id,resolve,reject,timer,started,onProgress:options.onProgress};
        // Copy before transfer: the UI keeps its original image and mask for undo/export.
        const pixels=new Uint8ClampedArray(imageData.data),selection=new Uint8Array(mask);
        this.worker.postMessage({id,width,height,pixels:pixels.buffer,mask:selection.buffer},[pixels.buffer,selection.buffer]);
      } catch(e) { this._stop(e); if(!this.pending)reject(e); }
    });
  }
}
