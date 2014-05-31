/** @fileoverview Settings.js

TODO:
  * Other preferences, e.g.: logall, units
  * On email change, clear all other fields

The Settings class implements the settings GUI page.
Settings include: uname, name, cn, glider, and tail.
Settings values are stored in localStorage.
API_URL can be changed by clicking on it.

=============================================================================*/
"use strict";


/** @constructor */
gt.Settings=function(){}

/** @define {string} API_URL
    Server API URL.  Can be changed by the user by clicking on the element. */
gt.Settings.prototype.API_URL=localStorage['gt:API_URL'] ||
                              'http://'+(window.location.host ||
                              'test.glideport.aero')+'/api'; // Development
                              // 'glideport.aero')+'/api';   // Deployment

/** @define {number} XHR_TIMEOUT
    Timeout for /dev api call. */
gt.Settings.prototype.XHR_TIMEOUT=30000;


/**
  @return {gt.Settings} - this
*/
gt.Settings.prototype.init=function() {
  this.div=undefined;

  this.oncancel=undefined;
  this.onsave  =undefined;

  this.xhr=undefined;

  this.uname =undefined;
  this.name  =undefined;
  this.cn    =undefined;
  this.glider=undefined;
  this.tail  =undefined;

  var d=localStorage['gt:debug'];
  this.debug =d!=null?d&&d!=='false':true;

  this.pullFromLS();

  return this;
}


/**
  @return {undefined}
*/
gt.Settings.prototype.destroy=function() {
  this.delayout();
  this.xhr && this.xhr.abort();
  delete this.xhr;
}



//----------------------------------------------------------------------------
//
//  8888888b.           888 888                                 888
//  888   Y88b          888 888                                 888
//  888    888          888 888                                 888
//  888   d88P 888  888 888 888      88888b.  888  888 .d8888b  88888b.
//  8888888P"  888  888 888 888      888 "88b 888  888 88K      888 "88b
//  888        888  888 888 888      888  888 888  888 "Y8888b. 888  888
//  888        Y88b 888 888 888      888 d88P Y88b 888      X88 888  888
//  888         "Y88888 888 888      88888P"   "Y88888  88888P' 888  888
//                                   888
//                                   888
//                                   888
//
//----------------------------------------------------------------------------
/**
  @param {Object} obj
*/
gt.Settings.prototype.pullFromObj=function(obj) {
  if(!obj) return;
  console.debug("PULL: %o",obj);
  this.uname =obj['uname' ];
  this.name  =obj['name'  ];
  this.cn    =obj['cn'    ];
  this.glider=obj['glider'];
  this.tail  =obj['tail'  ];
}


/**
  @return {Object} - obj
*/
gt.Settings.prototype.pushIntoObj=function() {
  var obj={
    'uname' : this.uname,
    'name'  : this.name,
    'cn'    : this.cn,
    'glider': this.glider,
    'tail'  : this.tail, // registration
    'vendor': 'GP',
    'auth'  : 'TBD'
    // 'about' : ...
    // 'photoUrl': ...
    // tc, cc
  };
  return obj;
}


/**
  @return {undefined}
*/
gt.Settings.prototype.pushIntoUI=function() {
  this.setVal('uname' ,this.uname ||'');
  this.setVal('name'  ,this.name  ||'');
  this.setVal('cn'    ,this.cn    ||'');
  this.setVal('glider',this.glider||'');
  this.setVal('tail'  ,this.tail  ||'');

  this.$id('devid').textContent=gt.App.app.devid;
  this.$id('url'  ).textContent=this.API_URL;
  if(this.$id('debug'))
    this.$id('debug').textContent='DEBUG: '+(this.debug?'ON':'off');

  this.$id('save').disabled=!!this.xhr;
  this.$id('save').textContent='Save';
}


/**
  @return {undefined}
*/
gt.Settings.prototype.pullFromUI=function() {
  this.uname =this.getVal('uname' );
  this.name  =this.getVal('name'  );
  this.cn    =this.getVal('cn'    );
  this.glider=this.getVal('glider');
  this.tail  =this.getVal('tail'  );
}


/**
  @return {undefined}
*/
gt.Settings.prototype.pushIntoLS=function() {
  localStorage['gt:uname' ]=this.uname ||'';
  localStorage['gt:name'  ]=this.name  ||'';
  localStorage['gt:cn'    ]=this.cn    ||'';
  localStorage['gt:glider']=this.glider||'';
  localStorage['gt:tail'  ]=this.tail  ||'';
}


/**
  @return {undefined}
*/
gt.Settings.prototype.pullFromLS=function() {
  this.uname =this.uname ||localStorage['gt:uname' ]||'';
  this.name  =this.name  ||localStorage['gt:name'  ]||'';
  this.cn    =this.cn    ||localStorage['gt:cn'    ]||'';
  this.glider=this.glider||localStorage['gt:glider']||'';
  this.tail  =this.tail  ||localStorage['gt:tail'  ]||'';
}


//----------------------------------------------------------------------------
//
//   .d8888b.  888     888 8888888
//  d88P  Y88b 888     888   888
//  888    888 888     888   888
//  888        888     888   888
//  888  88888 888     888   888
//  888    888 888     888   888
//  Y88b  d88P Y88b. .d88P   888
//   "Y8888P88  "Y88888P"  8888888
//
// GUI
//----------------------------------------------------------------------------
/**
  @param {string} name
  @return {?Element}
*/
gt.Settings.prototype.$id=function(name) {
  return $id('Settings_'+name);
}


/**
  @param {string} name
  @param {string} label
  @param {string} placeholder
  @param {string=} type
*/
gt.Settings.prototype._f=function(name,label,placeholder,type) {
  var div=document.createElement('div');
  div.className='Settings_'+name;

  var ll=document.createElement('label');
  ll.textContent=label;
  div.appendChild(ll);

  var input=document.createElement('input');
  input.id='Settings_'+name;
  if(type) input.type=type;
  input.placeholder=placeholder;
  input.autocapitalize='off';
  input.autocorrect='off';
  div.appendChild(input);

  return div;
}


/**
  @param {string} name
  @return {string} - value
*/
gt.Settings.prototype.getVal=function(name) {
  var f=this.$id(name);
  return f && f.value;
}


/**
  @param {string} name
  @param {string} val
*/
gt.Settings.prototype.setVal=function(name,val) {
  var f=this.$id(name);
  if(f) f.value=val;
}


/**
  @param {Element=} parent
  @param {string=} flavor - check, register, update
  @return {gt.Settings} - this

  This GUI is way too overloaded...
*/
gt.Settings.prototype.layout=function(parent, flavor) {
  if(this.div) return this;

  console.debug("SETTINGS layout: %s",flavor);
  parent=parent||document.body;

  var x,
     div=this.div=document.createElement('div');
  div.className='Settings_container';
  parent.appendChild(div);

  div.appendChild(this._f('uname' ,'Email *'    ,'User name'   ));
  this.$id('uname').onchange=this.doUnameChange.bind(this);

  // div.appendChild(this._f('passwd','Password *','Password'      ,'password'));
  // div.appendChild(this._f('conf'  ,'Confirm *' ,'Retype password','password'));

  if(flavor!=='register') {
    div.appendChild(this._f('name'  ,'Name *'     ,'Full name'   ));
    div.appendChild(this._f('cn'    ,'Contest Id' ,'CN'          ));
    div.appendChild(this._f('glider','Glider'     ,'Model'       ));
    div.appendChild(this._f('tail'  ,'Tail Number','Registration'));
  }

  var onaction=gt.App.app.onaction;

  if(flavor!=='check') {
    x=document.createElement('button');
    x.id='Settings_cancel';
    x.innerHTML=flavor==='register'?'Quit':'Cancel';
    x[onaction]=this.doCancel.bind(this);
    div.appendChild(x);
  }

  x=document.createElement('button');
  x.id='Settings_save';
  x.innerHTML='Save';
  x[onaction]=this.doSave.bind(this);
  div.appendChild(x);

  x=document.createElement('div');
  x.id='Settings_devid';
  x[onaction]=this.doDevid.bind(this);
  div.appendChild(x);

  x=document.createElement('div');
  x.id='Settings_url';
  x[onaction]=this.doChangeUrl.bind(this);
  div.appendChild(x);

  x=document.createElement('div');
  x.id='Settings_message';
  x.textContent='';
  div.appendChild(x);

  x=document.createElement('div');
  x.id='Settings_error';
  x.textContent='';
  div.appendChild(x);

  x=document.createElement('button');
  x.id='Settings_debug';
  x.textContent='Debug';
  x[onaction]=this.doToggleDebug.bind(this);
  div.appendChild(x);

  return this;
}


/**
  @return {undefined}
*/
gt.Settings.prototype.delayout=function() {
  if(!this.div) return;
  this.div.parentElement.removeChild(this.div);
  delete this.div;
}


//----------------------------------------------------------------------------
//
//         d8888          888    d8b
//        d88888          888    Y8P
//       d88P888          888
//      d88P 888  .d8888b 888888 888  .d88b.  88888b.  .d8888b
//     d88P  888 d88P"    888    888 d88""88b 888 "88b 88K
//    d88P   888 888      888    888 888  888 888  888 "Y8888b.
//   d8888888888 Y88b.    Y88b.  888 Y88..88P 888  888      X88
//  d88P     888  "Y8888P  "Y888 888  "Y88P"  888  888  88888P'
//
// Actions
//----------------------------------------------------------------------------
/**
  @return {undefined}
*/
gt.Settings.prototype.doSave=function() {
  this.pullFromUI();
  this.$id('error'  ).textContent='';
  this.$id('message').textContent="Saving...";
  this.$id('save'   ).textContent="Saving...";
  this.$id('save').disabled=true;

  this.xfer(this.pushIntoObj(), function(err,res) {
    var e;
    if((e=this.$id('save'))) {
      e.disabled=false;
      e.textContent='Save';
    }
    if(err) {
      (e=this.$id('message')) && (e.textContent='');
      (e=this.$id('error'  )) && (e.textContent=err.toString());
      return;
    }
    this.pullFromObj(res);
    this.pushIntoLS();
    this.delayout();
    this.onsave && this.onsave(this);
  }.bind(this));
}


/**
  @return {undefined}
*/
gt.Settings.prototype.doCancel=function() {
  this.delayout();
  this.xhr && this.xhr.abort();
  this.oncancel && this.oncancel(this);
}


/**
  @return {undefined}
*/
gt.Settings.prototype.doChangeUrl=function() {
  var url=prompt('Enter API URL',this.API_URL);
  if(!url) return;
  this.API_URL=localStorage['gt:API_URL']=url;
  this.$id('url').textContent=this.API_URL;
}


/**
  @return {undefined}
  noop for now...
*/
gt.Settings.prototype.doDevid=function() {
  // window.location='mailto:'+this.uname+'?subject=GT-devid&body='+gt.App.app.devid;
}

/**
  @return {undefined}
  noop for now...
*/
gt.Settings.prototype.doToggleDebug=function() {
  this.debug=!this.debug;
  gt.App.app.setDebug(this.debug);
  localStorage['gt:debug']=this.debug;
  this.$id('debug').textContent='DEBUG: '+(this.debug?'ON':'off');
}


gt.Settings.prototype.doUnameChange=function() {
  // return;
  if(this.getVal('uname').trim()===(this.uname||'').trim())
    return;
  this.setVal('name'  ,'');
  this.setVal('cn'    ,'');
  this.setVal('glider','');
  this.setVal('tail'  ,'');
}


//----------------------------------------------------------------------------
//
// Modal
//----------------------------------------------------------------------------
/**
  @param {function(?string,Object=)=} next - (err,res)
  @param {Element=} parent - div
*/
gt.Settings.prototype.modalUpdate=function(next,parent) {
  this.layout(parent||document.body, 'update');

  this.pullFromLS();
  this.pushIntoUI();

  this.onsave  =function() { next && next(null    ); };
  this.oncancel=function() { next && next('cancel'); };
}


/**
  @param {function(?string,Object=)=} next - (err,res)
  @param {Element=} parent - div into which GUI is overlaid

Checks with server if devid is already registered.

 * If registered, settings is populated with values (uname,name,cn,glider,tail)
   from the server.  next is called with res=true.

 * If not registered, next is called with res=null.

 * On error (xfer), err=error string
*/
gt.Settings.prototype.modalQuickCheckDevid=function(next,parent) {
  this.pullFromLS();
  if(gt.App.app.registered) {
    console.debug('... looks ok - registered before');
    return next(null,true);
  }

  this.layout(parent||document.body, 'check');
  this.pushIntoUI();
  this.$id('message').textContent='Checking...';

  console.debug('quickcheck');
  this.xfer(null, function(err,res) {
    console.log(this,err,res);
    this.$id('message').textContent='';
    this.delayout();

    if(err) return next && next(err);

    this.pullFromObj(res);
    this.pushIntoLS();
    next && next(null);
  }.bind(this));
}


/**
  @param {function(?string,Object=)=} next - (err,res)
  @param {Element=} parent

  Register uname+devid with server.
  err='cancel' if failed to register because user canceled out
*/
gt.Settings.prototype.modalRegisterDevid=function(next,parent) {
  this.pullFromLS();
  this.layout(parent||document.body, 'register');
  this.pushIntoUI();
  this.onsave  =function() { next && next(null    ); };
  this.oncancel=function() { next && next('cancel'); };
}


//----------------------------------------------------------------------------
//
//  Y88b   d88P  .d888
//   Y88b d88P  d88P"
//    Y88o88P   888
//     Y888P    888888 .d88b.  888d888
//     d888b    888   d8P  Y8b 888P"
//    d88888b   888   88888888 888
//   d88P Y88b  888   Y8b.     888
//  d88P   Y88b 888    "Y8888  888
//
// Xfer
//----------------------------------------------------------------------------
/**
  @param {?Object} obj -  data to POST as JSON
  @param {function(string,?Object)=} next - (err,obj)
*/
gt.Settings.prototype.xfer=function(obj,next) {
  var url=this.API_URL+'/dev/'+gt.App.app.devid;
  var packet=obj&&JSON.stringify(obj)||'';

  console.debug("%cPOST: %s\n%s",'background:yellow',url,packet);
  var x=this.xhr=new XMLHttpRequest;
  x.open("POST",url,true);
  x.timeout=this.XHR_TIMEOUT;
  x.setRequestHeader('Content-type','application/json');

  x.onreadystatechange=function() {
    console.assert(!this.timer);
    var x=this.xhr; console.assert(x);
    if(!x || x.readyState!==x.DONE) return; // not done yet
    this.xhr=undefined;

    if(x.status===200) { // onsuccess:
      console.debug('%c--> %s','background:yellow',x.responseText);
      var jobj=null, err=null;
      try {
        if(x.responseText && x.responseText!=='null')
          jobj=JSON.parse(x.responseText);
      } catch(err) {
        console.warn('BAD JSON: '+err.toString());
      }
      return next && next(err,jobj);
    }

    // onerror:
    console.debug('%c--> %s','background:pink',x.responseText);
    console.warn("XFER[%s]: %s (%s)",
                 x.status,x.statusText||'???',x.responseText);
    return next && next(x.responseText||x.statusText||'Unknown Error');
  }.bind(this);

  x.send(packet);
  return null;
}


// EOF
