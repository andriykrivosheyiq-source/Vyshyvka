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
    /* Запрошення поштою й зміна пароля: справжніх листів у перевірці бути не
       може, тож записуємо, ЩО саме попросили зробити. Саме це й перевіряємо —
       на яку пошту й з якою адресою повернення пішло запрошення. */
    auth:function(){ return {
      onAuthStateChanged:function(cb){ setTimeout(function(){ cb({ uid:'test', email:'test@loomiq' }); }, 0); return function(){}; },
      signInWithEmailAndPassword:function(){ return Promise.resolve(); },
      signOut:function(){ (window.__AUTH=window.__AUTH||[]).push({ op:'signOut' }); return Promise.resolve(); },
      sendSignInLinkToEmail:function(mail, opt){
        (window.__AUTH=window.__AUTH||[]).push({ op:'invite', mail:mail, url:(opt||{}).url });
        return Promise.resolve();
      },
      sendPasswordResetEmail:function(mail){
        (window.__AUTH=window.__AUTH||[]).push({ op:'reset', mail:mail });
        return Promise.resolve();
      },
      isSignInWithEmailLink:function(){ return !!window.__ASLINK; },
      signInWithEmailLink:function(mail){
        (window.__AUTH=window.__AUTH||[]).push({ op:'linkin', mail:mail });
        return Promise.resolve({ user: window.firebase.auth().currentUser });
      },
      currentUser:{ uid:'test', email:'test@loomiq',
        getIdToken:function(){ return Promise.resolve('stub'); },
        updatePassword:function(p){ (window.__AUTH=window.__AUTH||[]).push({ op:'pass', len:p.length }); return Promise.resolve(); },
        updateProfile:function(d){ (window.__AUTH=window.__AUTH||[]).push({ op:'name', name:d.displayName }); return Promise.resolve(); },
        linkWithCredential:function(){ (window.__AUTH=window.__AUTH||[]).push({ op:'link' }); return Promise.resolve({}); } } }; },
    firestore: fs, apps:[]
  };
  window.firebase.auth.EmailAuthProvider = { credential:function(m, p){ return { m:m, p:p }; } };
})();
