(function(){
  function Snap(id, data){ this.id=id; this._d=data; this.exists=!!data; }
  Snap.prototype.data=function(){ return this._d; };
  function Doc(){}
  Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };
  Doc.prototype.set=function(){ return Promise.resolve(); };
  Doc.prototype.update=function(){ return Promise.resolve(); };
  Doc.prototype.delete=function(){ return Promise.resolve(); };
  Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };
  Doc.prototype.collection=function(){ return new Col(); };
  function Col(){}
  Col.prototype.doc=function(){ return new Doc(); };
  Col.prototype.get=function(){ return Promise.resolve({ docs:[], forEach:function(){}, empty:true }); };
  Col.prototype.where=function(){ return this; };
  Col.prototype.orderBy=function(){ return this; };
  Col.prototype.limit=function(){ return this; };
  Col.prototype.onSnapshot=function(cb){ try{ cb({ docs:[], forEach:function(){}, empty:true }); }catch(e){} return function(){}; };
  /* Записи через .add() складаємо у window.__ADDED: сайт пише так заявки, і
     без цього методу він чесно вважав, що база їх не прийняла. */
  Col.prototype.add=function(d){
    (window.__ADDED=window.__ADDED||[]).push(d);
    return Promise.resolve({ id:'stub' });
  };
  var fs=function(){ return { collection:function(){ return new Col(); },
    doc:function(){ return new Doc(); },
    batch:function(){ return { set:function(){}, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },
    runTransaction:function(f){ return Promise.resolve(); },
    enablePersistence:function(){ return Promise.resolve(); },
    settings:function(){} }; };
  fs.FieldValue={ serverTimestamp:function(){ return new Date().toISOString(); },
    delete:function(){ return null; }, arrayUnion:function(){ return []; } };
  fs.Timestamp={ now:function(){ return { toDate:function(){ return new Date(); } }; } };
  window.firebase={
    initializeApp:function(){ return {}; },
    auth:function(){ return {
      onAuthStateChanged:function(cb){ setTimeout(function(){ cb({ uid:'test', email:'test@loomiq' }); }, 0); return function(){}; },
      signInWithEmailAndPassword:function(){ return Promise.resolve(); },
      signOut:function(){ return Promise.resolve(); },
      currentUser:{ uid:'test', email:'test@loomiq', getIdToken:function(){ return Promise.resolve('stub'); } } }; },
    firestore: fs, apps:[]
  };
})();
