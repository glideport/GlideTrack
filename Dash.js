/** @fileoverview Dash.js

TODO:
  * Add indicators: battery, connectivity
  * CSS cleanup

The Dash class implements the main GUI page.
START/STOP button - toggle tracking;
Message box - enter message to send;
Value boxes show various values;
Settings button brings the settings page;

=============================================================================*/
"use strict";

/** @constructor */
gt.Dash=function(){}

/** @define {number} MAX_MSG_COUNT
    Number of recent messages to be shown in the GUI. */
gt.Dash.prototype.MAX_MSG_COUNT=5;


/**
  @param {gt.Manager} manager
  @return {gt.Dash} - this
*/
gt.Dash.prototype.init=function(manager) {
  this.manager=manager;
  this.div=undefined;

  var msg=[]; // Recent messages
  try { msg=JSON.parse(localStorage['gt:messages']) } catch(err) {}
  this.messages=msg;

  this.onaction=gt.App.app.onaction;

  return this;
}


/**
  @return {undefined}
*/
gt.Dash.prototype.destroy=function() {
  if(this.timer) clearInterval(this.timer);
  delete this.timer;
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
gt.Dash.prototype.$id=function(name) {
  return $id('Dash_'+name);
}


/**
  @return {undefined}
*/
gt.Dash.prototype.pushIntoUI=function() {
  var m=this.manager,
     running=m.isRunning(),
     track=m.track,
     now=(new Date).getTime();

  // Read from manager, update field values
  this.$id('run').textContent=running?'STOP':'START';
  this.$id('mode').textContent=m.mode&&m.ModeStr[m.mode]||'?';
  this.$id('status').textContent=m.status||'?';
  this.$id('time').textContent=m.statusTime &&
                      new Date(m.statusTime).toTimeString().substr(0,8)||'?';
  if(m.fix) {
    this.$id('loc').textContent=m.fix.lat.toPrecision(7)+','+
                                m.fix.lon.toPrecision(8);
    this.$id('alt').textContent=Math.round(m.fix.galt)||'?';
    this.$id('gs' ).textContent=m.fix.gs ==null||isNaN(m.fix.gs ) ?
                                '?' : Math.round(m.fix.gs );
    this.$id('trk').textContent=m.fix.trk==null||isNaN(m.fix.trk) ?
                                '?' : Math.round(m.fix.trk);
  } else {
    this.$id('loc').textContent='?';
    this.$id('alt').textContent='?';
    this.$id('gs' ).textContent='?';
    this.$id('trk').textContent='?';
  }
  this.$id('last').textContent='-';
  this.$id('next').textContent='-';

  this.$id('boxes').style.opacity=running?1:.33;
  this.$id('send').disabled=!running;
  this.$id('settings').disabled=running;
  if(this.$id('email'))
    this.$id('email').disabled=running || !track || !track.t.length;

  // Track-related display
  if(track) {
    var next=(track.xferNextTime-now)/1000;
    this.$id('next').textContent=track.xhr?'send':
                                   next>=0?gt.fmt_dt(next):
                                           next||'-';
    var last=(now-track.xferSuccessTime)/1000;
    this.$id('last').textContent=last!=null&&!isNaN(last)?gt.fmt_dt(last):'-';

    // if(gt.App.app.settings.debug) {
      this.$id('debug').textContent=(new Date).toTimeString().substr(0,8)+
        ' '+track.cursor+'/'+track.t.length+
        ' s'+track.xferSuccessCount+
        ' e'+(track.xferErrorCount-track.xferTimeoutCount)+
        ' t'+track.xferTimeoutCount+
        ' w'+track.xferWaitCount+
        ' a'+track.xferAbortCount+
        ' x'+track.xferCount+
        ' '+(track.token||'-');
    // } else {
    //   this.$id('debug').textContent='';
    // }
    if(this.timer && !this.manager.isRunning()
        && !track.xhr && !track.xferNextTime) {
      clearInterval(this.timer); delete this.timer;
      this.$id('last').textContent='-';
    }
  } else {
    this.$id('next').textContent='-';
    this.$id('last').textContent='-';
    this.$id('debug').textContent='';
  }
}


/**
  @param {string} name
  @param {string} label
  @param {string=} unit
  @return {Element} - div
*/
gt.Dash.prototype._f=function(name,label,unit) {
  var x=document.createElement('div');
  x.className='Dash_vbox';
  x.id='Dash_vbox_'+name;

  var y=document.createElement('div');
  y.className='Dash_vbox_label';
  y.textContent=label;
  x.appendChild(y);

  var y=document.createElement('div');
  y.className='Dash_vbox_val';
  y.id='Dash_'+name;
  x.appendChild(y);

  if(unit) {
    var y=document.createElement('div');
    y.className='Dash_vbox_unit';
    y.textContent=unit;
    x.appendChild(y);
  }

  return x;
}


/**
  @return {undefined}

  Push recent messages into GUI.
*/
gt.Dash.prototype._msgboxUpdate=function() {
  var onaction=gt.App.app.onaction,
      box=this.$id('quickmsg');
  box.innerHTML='';
  for(var i=0; i<this.messages.length; i++) {
    var msg=this.messages[i],
        x=document.createElement('div');
    x.textContent=msg;
    x[onaction]=this.doQuickMsg.bind(this,msg);
    box.appendChild(x);
  }
}


/**
  @return {undefined}
*/
gt.Dash.prototype._msgboxLayout=function() {
  var onaction=gt.App.app.onaction,
      y, x=document.createElement('div');
  x.className='Dash_messagebox';
  x.id='Dash_messagebox';

  y=document.createElement('span');
  y.innerHTML='&times;';
  y.id='Dash_clearmsg';
  y[onaction]=this.doMessageClear.bind(this);
  x.appendChild(y);

  y=document.createElement('input');
  y.placeholder='Mesage...';
  y.id='Dash_message';
  x.appendChild(y);

  y=document.createElement('button');
  y.textContent='Send';
  y.id='Dash_send';
  y[onaction]=this.doMessageSend.bind(this);
  x.appendChild(y);

  y=document.createElement('div');
  y.id='Dash_quickmsg';
  x.appendChild(y);

  return x;
}


/**
  @param {Element=} parent
  @return {gt.Dash} - this
*/
gt.Dash.prototype.layout=function(parent) {
  var y, onaction=gt.App.app.onaction;

  if(this.div) return this;
  parent=parent||document.body;

  this.manager.onchange=this.pushIntoUI.bind(this);

  var div=this.div=document.createElement('div');
  div.className='Dash_container';
  parent.appendChild(div);

  y=document.createElement('button');
  y.textContent='START';
  y.id='Dash_run';
  y[onaction]=this.doRunStop.bind(this);
  div.appendChild(y);

  y=document.createElement('span');
  y.id='Dash_debug';
  div.appendChild(y);

  y=document.createElement('div');
  y.id='Dash_boxes';
  div.appendChild(y);

  var l1=document.createElement('div');
  l1.className='Dash_box_line';
  y.appendChild(l1);
  l1.appendChild(this._f('mode'  ,'Mode'));
  l1.appendChild(this._f('status','Status'));
  l1.appendChild(this._f('time'  ,'Time'));
  l1.appendChild(this._f('last'  ,'Last'));
  l1.appendChild(this._f('next'  ,'Next'));

  var l2=document.createElement('div');
  l2.className='Dash_box_line';
  y.appendChild(l2);
  l2.appendChild(this._f('gs'    ,'Gsp'/*,'mph'*/));
  l2.appendChild(this._f('trk'   ,'Trk'/*,'deg'*/));
  l2.appendChild(this._f('loc',   'Location'));
  l2.appendChild(this._f('alt'   ,'Alt'/*,'ft' */));

  div.appendChild(this._msgboxLayout());
  this._msgboxUpdate();

  y=document.createElement('button');
  y.textContent='Settings';
  y.id='Dash_settings';
  y[onaction]=this.doSettingsUpdate.bind(this);
  div.appendChild(y);

  y=document.createElement('button');
  y.textContent='Email IGC';
  y.id='Dash_email';
  // y.style.display='none';
  y[onaction]=this.doEmailIgc.bind(this);
  div.appendChild(y);

  window.plugin && window.plugin.email &&
    window.plugin.email.isServiceAvailable(function(gotmail) {
      this.$id('email').style.display=null;
    });

  this.pushIntoUI();
  return this;
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
gt.Dash.prototype.doMessageSend=function() {
  if(this.$id('send').disabled) return;

  var msg=this.$id('message').value.trim();
  if(!msg) return;

  this.manager.sendMessage(msg);

  // blur
  document.activeElement && document.activeElement.blur();
  this.$id('message').blur();
  this.$id('message').value=''; // Remove message so that new one can be typed

  // user feedback
  gt.beep();

  // Add new message to this.messages
  for(var i=this.messages.length; i>=0; i--)
    if(this.messages[i]==msg) break;
  if(i<0) {
    this.messages.unshift(msg);
    if(this.messages.length>this.MAX_MSG_COUNT)
      this.messages.splice(this.MAX_MSG_COUNT,
                           this.messages.length-this.MAX_MSG_COUNT);
    localStorage['gt:messages']=JSON.stringify(this.messages);
    this._msgboxUpdate();
  }
}


/**
  @return {undefined}
*/
gt.Dash.prototype.doMessageClear=function() {
  this.$id('message').value='';
  this.$id('message').focus();
}


/**
  @param {string} msg
*/
gt.Dash.prototype.doQuickMsg=function(msg) {
  this.$id('message').value=msg;
}


/**
  @return {undefined}
*/
gt.Dash.prototype.doSettingsUpdate=function() {
  if(this.$id('settings').disabled) return;
  gt.App.app.settings.modalUpdate();
}


/**
  @return {undefined}
*/
gt.Dash.prototype.doRunStop=function() {
  gt.beep();
  if(this.manager.isRunning()) {
    this.manager.stop();
    this.$id('run').textContent='START';

    var track=this.track;
    if(this.timer && !this.manager.isRunning()
        && (!track || !track.xhr && !track.xferNextTime)) {
      clearInterval(this.timer); delete this.timer;
    }
  } else {
    this.manager.start();
    this.$id('run').textContent='STOP';

    if(!this.timer) this.timer=setInterval(this.pushIntoUI.bind(this),1000);
  }
  this.pushIntoUI();
}


gt.Dash.prototype.doEmailIgc=function() {
  if(!this.$id('email') || this.$id('email').disabled) return;

  var m=this.manager, track=m.track, settings=gt.App.app.settings;
  if(!track) return;

  var day=(new Date(track.date0)).toISOString().substr(0,10),
      igc=track.getIGC();

  window.plugin.email.open({
    to: [settings.uname],
    subject: 'IGC File '+day,
    body: 'IGC file recorded by GlideTrack...',
    attachments:['base64:'+day+'.igc//'+btoa(unescape(encodeURIComponent(igc)))]
  });
}


// EOF
