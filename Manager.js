/** @fileoverview Manager.js

TODO:
  * Existing track continue
  * Completed track save
  * Restore in-progress tracks (e.g., after app restart)

=============================================================================*/
"use strict";

/** @constructor */
gt.Manager=function(){}

/** @define {boolean} LOG_ALL
    Log all fixes without any processing, even bad ones, e.g., for debugging
    purposes. If LOG_ALL is true, FIX_INTERVAL is ignored.
    NOTE: If LOG_ALL is turned on, then gt.Track::EXTENDED_VARS should
    also be true.  Default: false */
gt.Manager.prototype.LOG_ALL=false;
// gt.Manager.prototype.LOG_ALL=true;

/** @define {number} FIX_INTERVAL [ms]
    Time interval at which fixes should be logged.  4 sec is a good compromise.
    [TBD: explain why]
    NOTE: If LOG_ALL is true, FIX_INTERVAL is ignored, and all fixes are
    logged as they come in (raw). */
gt.Manager.prototype.FIX_INTERVAL=4000;

/** @define {number} RESTART_GAP [ms]
    Continue last track if time since the last fix is < RESTART_GAP */
gt.Manager.prototype.RESTART_GAP=15*60*1000;

/** @define {number} CBSZ [count]
    Size of circluar buffer for keeping raw fixes as they are processed, used
    as look-back buffer. Typically raw fixes come in at 1/sec, so the default
    of 300 is way more than enough. */
gt.Manager.prototype.CBSZ=300;

/** @define {number} MIN_ACCURACY [m]
    If fix is worse than MIN_ACCURACY we consider it bad.
    iPhone 5S best accuracy when warm is 5 m. */
gt.Manager.prototype.MIN_ACCURACY=30;

/** @define {number} MIN_ALT_ACCURACY [m]
    If fix is worse than MIN_ALT_ACCURACY we consider it bad.
    iPhone 5S when warm best is 3 m. */
gt.Manager.prototype.MIN_ALT_ACCURACY=30;

/** @define {number} STALE_TIME [ms]
    If fix is older than STALE_TIME consider it bad. */
gt.Manager.prototype.STALE_TIME=2000;

/** @define {number} MAX_SPEED [m/s]
    Maximum reasonable speed.  If GPS-reported speed is higher than MAX_SPEED
    we consider the fix bad. */
gt.Manager.prototype.MAX_SPEED=150;

/** @define {number} MAX_SPEED_DISCREPANCY [m/s]
    If GPS-reported speed is too different from fix-to-fix calculated speed
    then the fix is no good.   This check is only done if fixes are
    less than MAX_SPEED_DISCREPANCY_INTERVAL apart. */
gt.Manager.prototype.MAX_SPEED_DISCREPANCY=10;

/** @define {number} MAX_SPEED_DISCREPANCY_INTERVAL [ms]
    See above. */
gt.Manager.prototype.MAX_SPEED_DISCREPANCY_INTERVAL=2000;

/** @define {number} WARM_MINTIME [ms]
    We must be get at least WARM_MINCOUNT fixes for WARM_MINTIME duration
    in order to transition out of COLD mode. */
gt.Manager.prototype.WARM_MINTIME=10000;

/** @define {number} WARM_MINCOUNT [count]
    See above. */
gt.Manager.prototype.WARM_MINCOUNT=5;

/** @define {number} WARM_MAX_TIMEGAP [ms]
    If we do not see any good fixes for WARM_MAX_TIMEGAP when STATIONARY/MOVING,
    then we go back into COLD mode */
gt.Manager.prototype.WARM_MAX_TIMEGAP=8000;

/** @define {number} COLD_MAX_TIMEGAP [ms]
    While we are in COLD, if we don't see any fixes for COLD_MAX_TIMEGAP, we
    reset warm time calculation from that fix. */
gt.Manager.prototype.COLD_MAX_TIMEGAP=3000;

/** @define {number} MIN_MOVING_GROUNDSPEED [m/s]
    To transition into MOVING, the average groundspeed must be
    >MIN_MOVING_GROUNDSPEED for GS_MOVING_TIME/GS_STATIONARY_TIME */
gt.Manager.prototype.MIN_MOVING_GROUNDSPEED=5;

/** @define {number} GS_MOVING_TIME [ms]
    See above. */
gt.Manager.prototype.GS_STATIONARY_TIME=10000;
gt.Manager.prototype.GS_MOVING_TIME=60000;

/** @define {number} MOVE_BACK_TIME [ms]
    When we transition into MOVE mode, we record just prior
    MOVE_BACK_TIME fixes. */
gt.Manager.prototype.MOVE_BACK_TIME=15000;

/** @define {number} F2F_MAX_TIMEGAP [ms]
    Maximum fix-to-fix time allowed for interpolation. */
gt.Manager.prototype.F2F_MAX_TIMEGAP=8000;

/** @enum {number} Mode */
gt.Manager.prototype.Mode={
  COLD: 1,
  STATIONARY: 2,
  MOVING: 3
};
gt.Manager.prototype.ModeStr=['?','COLD','STATIONARY','MOVING'];


/**
  @return {gt.Manager} - this
*/
gt.Manager.prototype.init=function() {
  this.onchange=undefined;

  this.geowatch=null;

  this.geoloc=navigator.geolocation;
  this._geoerr=false; // Used to prevent double error reporting
  // Development - sim track
  // this.geoloc=(new gt.Sim).init('http://glideport.aero/igc/20130829-cai.igc');

  // Preallocate circular buffers
  this.t   =new Array(this.CBSZ); // [ms]
  this.lat =new Array(this.CBSZ);
  this.lon =new Array(this.CBSZ);
  this.galt=new Array(this.CBSZ);
  this.gs  =new Array(this.CBSZ);
  this.trk =new Array(this.CBSZ);
  this.hacy=new Array(this.CBSZ);
  this.vacy=new Array(this.CBSZ);
  this.cursor=0;

  // Indices into circular buffers
  this.modeIdx=0; // Index of last mode transition
  this.warmIdx=undefined;
  this.mode=this.Mode.COLD;

  /** @protected @type {number} tt - time of last fix added to track [ms] */
  this.tt=undefined;

  this.track=null; // current track
  this.hist=[];    // recent tracks not yet sent; this.track===this.hist.last()

  return this;
}


gt.Manager.prototype._reset=function() {
  this.mode=this.Mode.COLD;
  this.modeIdx=0;
  this.cursor=0;
  this.warmIdx=undefined;
  this.tt=undefined;
}


gt.Manager.prototype._newTrack=function() {
  var s=gt.App.app.settings;
  var track=(new gt.Track).init({
    pilot : s.name,
    cn    : s.cn,
    glider: s.glider,
    tail  : s.tail
  });
  track.onharderror=function(err) {
    gt.app.alert("Hard Error: "+err+"\n\nBailing out!",function() {
      gt.App.app.exit();
    });
  }
  track.onxfer=this._notifyChanged.bind(this,track);
  return track;
}


/**
  @return {undefined}
*/
gt.Manager.prototype.destroy=function() {
  if(this.geowatch) {
    this.geoloc.clearWatch(this.geowatch); delete this.geowatch;
  }
  this.geoloc.destroy && this.geoloc.destroy();
}


/**
  @param {Object} err - {code,message}
  navigator.geolocation.watchPosition callback
*/
gt.Manager.prototype._onerr=function(err) {
  console.warn('GEOERR[%d]: %s',err.code,err.message);
  if(err.code===1) {
    if(this._geoerr) return; // Already reported
    this._geoerr=true;
    // code: 1, message: "User denied Geolocation"
    gt.App.alert("GlideTrack cannot run without GPS.  Goodbye.", function() {
      gt.App.app.exit('nogps');
    });
  }
  // code 2: Network location provider at 'https://www.googleapis.com/' : Returned error code 404.
  // code 3: Timeout expired
}


/**
  @param {Object} loc
  @return {undefined}

  navigator.geolocation.watchPosition callback
  Basic validity check.
  If ok, buffers fix into the circular buffer and set this.fix.
  Invoke _processFix()
*/
gt.Manager.prototype._onfix=function(loc) {
  // console.dir(loc);
  var now=(new Date).getTime();
  this.statusTime=now;
  this.fix=null;
  var l=loc.coords,
      t=loc.timestamp.getTime(),
      lat=l.latitude, lon=l.longitude, galt=l.altitude,
      gs=l.speed, trk=l.heading, hacy=l.accuracy, vacy=l.altitudeAccuracy;
  var idx=this.cursor, ii=idx%this.CBSZ;

  if(!this.LOG_ALL) {
    // Obviously bad: drop stale and back-in-time fixes
    if(now-t>this.STALE_TIME
       || (idx && this.t[(idx-1)%this.CBSZ]>t)) {
      // console.debug("dropping... stale or back-in-time");
      this.status='stale';
      console.debug("STATUS --> %s",this.status);
      return;
    }

    // Poor accuracy: also drop
    if(hacy>this.MIN_ACCURACY || vacy>this.MIN_ALT_ACCURACY) {
      // console.debug("dropping... poor accuracy");
      this.status='poor';
      console.debug("STATUS --> %s",this.status);
      return;
    }

    if(!vacy && galt==0) {
      this.status='noalt';
      console.debug("STATUS --> %s",this.status);
      return;
    }

    // Reasonable speed?
    if(gs>this.MAX_SPEED) {
      this.status='fast';
      console.debug("STATUS --> %s",this.status);
      return;
    }

    if(idx) {
      // GPS reported speed not too far from location-calculated speed?
      var ii0=(idx-1)%this.CBSZ;
      var dt=t-this.t[ii0];
      if(dt<this.MAX_SPEED_DISCREPANCY_INTERVAL) {
        var gs2=gt.dist(lat,lon,this.lat[ii0],this.lon[ii0])/dt*1000;
        if(Math.abs(gs2-gs)>this.MAX_SPEED_DISCREPANCY)  {
          this.status='dgs';
          console.debug("STATUS --> %s",this.status);
          return;
        }
      }
    }
  }

  this.status='ok';
  // Buffer raw fix
  this.t   [ii]=t   ;
  this.lat [ii]=lat ;
  this.lon [ii]=lon ;
  this.galt[ii]=galt;
  this.gs  [ii]=gs  ;
  this.trk [ii]=trk ;
  this.hacy[ii]=hacy;
  this.vacy[ii]=vacy;
  this.cursor++;
  this.fix={
    t   : t,
    lat : lat,
    lon : lon,
    galt: galt,
    gs  : gs,
    trk : trk,
    hacy: hacy,
    vacy: vacy
  };
  // console.debug("#%s: (%s,%s,%s,%s)",ii,t,lat,lon,galt);
  this._processFix(idx);
}


/**
  @param {number} idx
  @return {undefined}
*/
gt.Manager.prototype._processFix=function(idx) {
  console.assert(this.isRunning());
  var ii=idx%this.CBSZ, t=this.t[ii];

  // 1) ----------------------------------------------------------- Update mode
  var m0=this.mode;
  switch(m0) {
  case this.Mode.COLD:
    // We are COLD, but we have a good fix
    if(this.warmIdx==null) this.warmIdx=idx;
    if(!idx) break; // Must have more than one good fix

    if(this.t[(idx-1)%this.CBSZ]-t>this.COLD_MAX_TIMEGAP) {
      this.warmIdx=idx;
      break;
    }

    // warm enough?
    if(t-this.t[this.warmIdx%this.CBSZ]<this.WARM_MINTIME
       || idx-this.warmIdx<this.WARM_MINCOUNT) break;

    // Yay!  GPS is warm!  => transition into STATIONARY or MOVING

    // Calculate fix-by-fix average gs for WARM_MINTIME
    for(var ags=0, i=idx;
        i>=this.warmIdx && t-this.t[i%this.CBSZ]<this.WARM_MINTIME; i--)
      ags+=this.gs[i%this.CBSZ];
    ags/=idx-i;

    this.mode=ags>this.MIN_MOVING_GROUNDSPEED?this.Mode.MOVING:
                                              this.Mode.STATIONARY;
    this.modeIdx=idx;
    this.modeTime=t;
    break;

  case this.Mode.STATIONARY:
  case this.Mode.MOVING:
    // Go into COLD if we have not seen any good fixes for a while
    if(t-this.t[(idx-1)%this.CBSZ]>this.WARM_MAX_TIMEGAP) {
      this.mode=this.Mode.COLD;
      this.modeIdx=idx;
      this.modeTime=t;
      this.warmIdx=null;
      break;
    }

    // Calculate fix-by-fix average gs for dt
    var dt=m0===this.Mode.MOVING?this.GS_MOVING_TIME:this.GS_STATIONARY_TIME;
    for(var ags=0, i=idx;
        i>=this.modeIdx && t-this.t[i%this.CBSZ]<dt; i--)
      ags+=this.gs[i%this.CBSZ];
    ags/=idx-i;
    if(t-this.t[i%this.CBSZ]<this.dt) break;
    var m=ags>this.MIN_MOVING_GROUNDSPEED?this.Mode.MOVING:this.Mode.STATIONARY;
    if(m!==this.mode) {
      this.mode=m;
      this.modeIdx=idx;
      this.modeTime=t;
    }
    break;
  }

  if(m0!==this.mode) this.track.addMsg(this.ModeStr[this.mode],'DBG');

  // 2) ---------------------------------------------------------------  Record
  if(this.LOG_ALL) {
    this.track.addFix((this.tt=t),this.lat[ii],this.lon[ii],this.galt[ii],
                      this.gs[ii],this.trk[ii],this.hacy[ii],this.vacy[ii]);
    this.track.scheduleXfer(this.track.XFER_NOMINAL_INTERVAL);
    this._notifyChanged(this.track);
    return;
  }

  switch(this.mode) {
  case this.Mode.COLD: // Nothing to do
    break;

  case this.Mode.STATIONARY:
    if(m0===this.mode) break;
    this._resampleAndRecord(idx);
    break;

  case this.Mode.MOVING:
    if(m0===this.mode) {
      this._resampleAndRecord(idx);
      break;
    }

    // We just changed into MOVING mode: add all fixes since MOVE_BACK_TIME ago
    console.assert(this.modeIdx===idx);
    for(var i=this.modeIdx-1; i>=this.warmIdx; i--)
      if(this.t[ii]-this.t[i%this.CBSZ]>this.MOVE_BACK_TIME) break;
    for(++i; i<=idx; i++)
      this._resampleAndRecord(i);
  }
}


/**
  @return {undefind}

  Resample at FIX_INTERVAL using simple linear interpolation.
  In a real app we would want to do something fancier to take advantage of
  all good GPS fixes, e.g., such as polynomial regression fit to reduce
  GPS teleporting.

  Unfortunately, it is not possible to get raw GPS data, the OS always
  processes it.  Usually this is bad for a flying application since the OS
  assumes that you are walking or driving; the OS processing introduces
  (sometimes significant) position and altitude errors.

  Note that the GPS data is already heavily Kalman-filtered, so no
  point in doing that.
*/
gt.Manager.prototype._resampleAndRecord=function(idx) {
  if(!idx) return; // Skip first fix

  var ii1= idx   %this.CBSZ, t1=this.t[ii1];
  var ii0=(idx-1)%this.CBSZ, t0=this.t[ii0];

  // Force onto whole second boundary
  var t=Math.floor(t1/1000)*1000;

  if(this.tt && this.tt+this.FIX_INTERVAL>t) // Time for this fix?
    return; // ... not yet
  if(t1-t0>this.F2F_MAX_TIMEGAP) // Fix-to-fix time gap too big?
    return;

  console.assert(t0<=t && t<=t1);
  var k=(t-t0)/(t1-t0),
      lat =this.lat [ii0]+(this.lat [ii1]-this.lat [ii0])*k,
      lon =this.lon [ii0]+(this.lon [ii1]-this.lon [ii0])*k,
      galt=this.galt[ii0]+(this.galt[ii1]-this.galt[ii0])*k,
      gs  =this.gs  [ii0]+(this.gs  [ii1]-this.gs  [ii0])*k;

  var h1=this.trk[ii1], h0=this.trk[ii0], dh=h1-h0;
  if(dh>180) dh-=360; else if(dh<-180) dh+=360;
  var trk=(h0+360+dh*k)%360;

  var hacy=this.hacy[ii1], vacy=this.vacy[ii1];

  this.track.addFix((this.tt=t),lat,lon,galt,gs,trk,hacy,vacy);
  this.track.scheduleXfer(this.track.XFER_NOMINAL_INTERVAL);
  this._notifyChanged(this.track);
}


//-----------------------------------------------------------------------------
//
// Run/Stop
//-----------------------------------------------------------------------------
/**
  @return {undefined}

  NOTE: this may or may *not* be running.
*/
gt.Manager.prototype._notifyChanged=function(track) {
  this.onchange && this.onchange(this);

  // Can we remove this track from hist?
  if(track.xhr || track.xferNextTime || track===this.hist.last()) return;
  var idx=this.hist.indexOf(track);
  if(idx>=0) this.hist.splice(idx,1); // don't need it anymore
}


/**
  @return {undefined}
*/
gt.Manager.prototype.start=function() {
  if(this.geowatch) return; // already running

  this.geowatch=this.geoloc.watchPosition(
    this._onfix.bind(this),
    this._onerr.bind(this), {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
  });
  this._geoerr=false;

  // Restart last track?
  var last=this.hist.last();
  if(last) {
    var now=(new Date).getTime(),
        t=last.date0+last.t.last()*1000;
    if(now-t>this.RESTART_GAP) last=null; // Time gap too big
  }
  if(last) this.track=last;
  else {
    this._reset();
    this.track=this._newTrack();
    this.hist.push(this.track);
  }

  // prevent device from sleeping
  window.plugins && window.plugins.powerManagement &&
   window.plugins.powerManagement.acquire();
}


/**
  @return {undefined}
*/
gt.Manager.prototype.stop=function() {
  if(!this.geowatch) return; // already stopped

  if(this.track.xhr || this.track.xferNextTime)
    this.track.scheduleXfer(0); // force immediate xfer
  this._notifyChanged(this.track); // death tick
  this.geoloc.clearWatch(this.geowatch); this.geowatch=null;
  this._geoerr=false;

  // allow device to sleep
  window.plugins && window.plugins.powerManagement &&
   window.plugins.powerManagement.release();
}


/**
  @return {boolean}
*/
gt.Manager.prototype.isRunning=function() {
  console.assert(!this.geowatch || this.track); // Must have track when running
  return !!this.geowatch;
}


//-----------------------------------------------------------------------------
//
//-----------------------------------------------------------------------------
/**
  @param {string} msg
*/
gt.Manager.prototype.sendMessage=function(msg) {
  console.assert(this.isRunning());
  this.track.addMsg(msg);
  this.track.scheduleXfer(this.XFER_MESSAGE_INTERVAL);
  this._notifyChanged(this.track);
}


// EOF
