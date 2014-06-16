/** @fileoverview App.js

TODO:
  * Battery monitoring
  * Connectivity monitoring

The main App class.

To clean local storage:
delete localStorage['gt:devid']; delete localStorage['gt:registered'];
delete localStorage['gt:name']; delete localStorage['gt:cn']; delete localStorage['gt:glider']; delete localStorage['gt:tail'];
delete localStorage['gt:API_URL']

=============================================================================*/
"use strict";

/** @constructor */
gt.App=function(){}

gt.App.app=null;


/**
  @return {gt.App} - this
*/
gt.App.prototype.init=function() {
  this.settings=(new gt.Settings).init();
  this.manager =(new gt.Manager ).init();
  this.dash    =(new gt.Dash    ).init(this.manager);

  this.setDebug(this.settings.debug);

  this.getDevid();

  // Detect platform
  var platform=null;
  if(/iPhone|iPad|iPod/i.test(navigator.userAgent)) platform='iOS'    ;
  else if(/Android/i.test(navigator.userAgent))     platform='Android';
  document.body.className=platform;

  this.onaction=(/Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent))?'ontouchend':'onclick';

  return this;
}


/**
  @return {undefined}
*/
gt.App.prototype.destroy=function() {
  this.settings && this.settings.destroy(); delete this.settings;
  this.manager  && this.manager .destroy(); delete this.manager ;
}


/**
  @return {string} - devid
*/
gt.App.prototype.getDevid=function() {
  if(this.devid) return this.devid;
  this.devid=localStorage['gt:devid'];
  this.registered=localStorage['gt:registered'];
  if(this.devid) return this.devid;
  this.devid=localStorage['gt:devid']=gt.GenerateUniqueId('D');
  this.registered=localStorage['gt:registered']='';
  return this.devid;
}


/**
  @param {function(?string,Object=)=} next - (err,res)
*/
gt.App.prototype.registerDevidIfNeeded=function(next) {
  this.settings.modalQuickCheckDevid(function(err,res) {
    if(err) {
      // Error while checking, eg network conectivity, server down...
      var r=confirm("ERROR: "+err.toString()+"\n\nTry again?");
      if(!r) return next(err);
      return this.registerDevidIfNeeded(next);
    }

    if(!res) { // Never registered before
      this.settings.modalRegisterDevid(function(err/*,res*/) {
        if(err) {
          if(err==='cancel') return next(err);
          // Error while registering, eg network conectivity, server down...
          var r=confirm("ERROR: "+err.toString()+'\n\nTry again?');
          if(!r) return next(err);
          return this.registerDevidIfNeeded(next);
        }

        if(!this.settings.uname) {
          var r=confirm("No such user.  Try again?");
          if(!r) return next('No such user');
          return this.registerDevidIfNeeded(next);
        }

        // OK - successfully registered, now allow for name, cn, etc update
        console.debug('%c registered %s','background:cyan',this.devid);
        this.registered=localStorage['gt:registered']=(new Date);
        this.settings.modalUpdate(function(err/*,res*/) {
          next && next(null);
        }.bind(this));
      }.bind(this));
      return;
    }
    next && next(null);
  }.bind(this));
}


/**
  @param {string} msg
  @return {undefined}
*/
gt.App.prototype.exit=function(page) {
  navigator.app && navigator.app.exitApp && navigator.app.exitApp();
  navigator.device && navigator.device.exitApp && navigator.device.exitApp();
  window.location=(page||'exit')+'.html';
}


/**
  @return {undefined}
*/
gt.App.prototype.run=function() {
  // alert('ok to go');
  this.registerDevidIfNeeded(function(err) {
    if(err) return this.exit('setup');

    // Show Dash...
    this.dash.layout();
  }.bind(this));
}


/**
  @param {function(?string)=} next
*/
gt.App.prototype.settingsUpdate=function() {
  this.settings.modalUpdate();
}


/**
  @param {boolean} yorn
*/
gt.App.prototype.setDebug=function(yorn) {
  this.manager.LOG_ALL=yorn;
  if(this.manager.track) this.manager.track.DBGINFO=yorn;
}

//----------------------------------------------------------------------------
// Class methods
//----------------------------------------------------------------------------
gt.App.Netstat=function() {
  if(!navigator.connection || !navigator.connection.type) return;

  var ns = navigator.connection.type;

  var states = {};
  states[Connection.UNKNOWN]  = 'Unknown connection';
  states[Connection.ETHERNET] = 'Ethernet connection';
  states[Connection.WIFI]     = 'WiFi connection';
  states[Connection.CELL_2G]  = 'Cell 2G connection';
  states[Connection.CELL_3G]  = 'Cell 3G connection';
  states[Connection.CELL_4G]  = 'Cell 4G connection';
  states[Connection.CELL]     = 'Cell generic connection';
  states[Connection.NONE]     = 'No network connection';

  console.debug('Netstat: '+states[ns]);
}


gt.App.RUN=function() {
  if(gt.App.app) return;

  // alert('Ready?'); // If we need to connect debugger at startup

  // if(typeof Keyboard !== 'undefined')
  //   Keyboard.hideFormAccessoryBar(true);

  document.addEventListener('pause', function() {
    console.debug('PAUSED');
  });
  document.addEventListener('resume', function() {
    console.debug('Resumed!');
  });

  window.addEventListener('batterystatus', function(info) {
    console.debug('baterystatus: '+info.level+', plugged: '+info.isPlugged);
  });
  window.addEventListener('batterylow', function(info) {
    console.debug('batterylow: '+info.level);
  });
  window.addEventListener('batterycritical', function(info) {
    console.debug('batterycritical: '+info.level);
  });

  document.addEventListener('offline', function() {
    console.debug('offline');
  });
  document.addEventListener('online', function() {
    console.debug('online');
  });

  // console.debug('%o',device);
  // Device
  // available: true
  // cordova: "3.4.0"
  // model: "x86_64"
  // platform: "iOS"
  // uuid: "BB584D00-2530-4F52-885D-028EDD164256"
  // version: "7.1"

  gt.App.app=(new gt.App);
  gt.App.app.init();
  gt.App.app.run();
}


/**
  @return {undefined}
*/
gt.App.RESTART=function() {
  window.location='index.html';
  // gt.App.app && gt.App.app.destroy();
  // gt.App.app=undefined;
  // gt.App.RUN();
}


/**
  @param {string} msg
  @param {function} next
*/
gt.App.alert=function(msg,next) {
  console.trace();
  console.debug("ALERT: "+msg);
  if(navigator.notification && navigator.notification.alert)
    return navigator.notification.alert(msg,next);
  alert(msg);
  next && next();
}


// EOF
