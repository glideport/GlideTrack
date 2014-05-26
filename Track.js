/** @fileoverview Track.js

TODO:
  * Serialize / deserialize
  * Timeout should be adjusted to the amount of data that's being sent
  * If there is a lot of data to be sent, consider chunking it into multiple
    packets

=============================================================================*/
"use strict";

/** @constructor */
gt.Track=function(){}

/** @define {number} XFER_TIMEOUT [ms]
    Communcation (XHR POST) timeout. Default: 30 sec */
gt.Track.prototype.XFER_TIMEOUT=30000;

/** @define {number} XFER_NOMINAL_INTERVAL [ms]
    Nominal interval between xfers when there are fixes to be sent.
    Default: 2 min. */
gt.Track.prototype.XFER_NOMINAL_INTERVAL=120000;
// gt.Track.prototype.XFER_NOMINAL_INTERVAL=12000;

/** @define {number} XFER_MESSAGE_INTERVAL [ms]
    Interval between xfers when there are messages to be sent.
    Default: 10 sec. */
gt.Track.prototype.XFER_MESSAGE_INTERVAL=10000;

/** @define {number} XFER_RETRY_INTERVAL [ms]
    Amount of time to wait after unsuccessful transmission.  Default: 30 sec. */
gt.Track.prototype.XFER_RETRY_INTERVAL=30000;

/** @define {boolean} EXTENDED_VARS
    Whenter to include all variables (including gs, trk, hacy, vacy) as part
    of each fix, or just basic vars in each IGC B-record. Default: false. */
// gt.Track.prototype.EXTENDED_VARS=false;
gt.Track.prototype.EXTENDED_VARS=true;

/** @define {boolean} DBGINFO
    If true DBG messages (xfer info) are included in the flight track. */
// gt.Track.prototype.DBGINFO=false;
gt.Track.prototype.DBGINFO=true;


/**
  @param {Object=} opt - Optional args: pilot, cn, glider, tail
  @return {gp.Track} - self
*/
gt.Track.prototype.init=function(opt) {
  this.onharderror=undefined;
  this.onxfer=undefined;

  this.token=undefined;

  this.pilot= (opt && opt.pilot );
  this.cn=    (opt && opt.cn    );
  this.glider=(opt && opt.glider);
  this.tail=  (opt && opt.tail  );

  // Data
  this.date0=undefined; // [ms]
  this.cursor=0;
  this.t   =[];
  this.lat =[];
  this.lon =[];
  this.galt=[];

  this.hacy=[];
  this.vacy=[];
  this.gs  =[];
  this.trk =[];

  this.msg= [];

  // Xfer
  this.xhr=undefined;
  this.timer=undefined;
  this.xferNextTime=undefined; // [ms]

  this.xferCount       =0;
  this.xferWaitCount   =0;
  this.xferSuccessCount=0;
  this.xferErrorCount  =0;
  this.xferTimeoutCount=0;
  this.xferAbortCount  =0;
  this.xferLastTime    =undefined; // [ms] - last *attempt*
  this.xferSuccessTime =undefined; // [ms] - last *success*

  this.fixCount=0;

  return this;
}


/**
*/
gt.Track.prototype.destroy=function() {
  delete this.t, this.lat, this.lon, this.galt, this.msg, this.date0, this.cursor;

  if(this.timer) clearTimeout(this.timer);
  delete this.timer;
  delete this.xferNextTime;

  if(this.xhr) this.xhr.abort();
  delete this.xhr;
}


/**
  @return {string} - unique track token
*/
gt.Track.prototype.getToken=function() {
  return this.token || (this.token=gt.GenerateUniqueId('T'));
}


/**
  @param {number|date} d
  @return {number} - [s]

  Side-effect: sets date0 if not set.
*/
gt.Track.prototype.relativeTimeForDate=function(d) {
  if(d instanceof Date) d=d.getTime();
  if(!this.date0) this.date0=Math.floor(d/1000)*1000;
  return (d-this.date0)/1000;
}


/**
  @param {number|Date} d - Date of the fix, [ms] from epoch if number
  @param {number} lat
  @param {number} lon
  @param {number} galt - altitude [m]
  @param {number} gs   - ground speed [m/s]
  @param {number} trk  - track [deg] (True North)
  @param {number} hacy - horizontal accuracy [m]
  @param {number} vacy - vertical accuracy [m]
  @return {undefined}

  NOTE: does not schedule xfer.
*/
gt.Track.prototype.addFix=function(d,lat,lon,galt,gs,trk,hacy,vacy) {
  var t=this.relativeTimeForDate(d);
  var i=this.t.length;

  console.debug('fix[%s]: +%s (%s, %s, %s)',
      i,t,lat.toPrecision(5),lon.toPrecision(6),(galt||NaN).toPrecision(4));
  this.t   [i]=t;
  this.lat [i]=lat;
  this.lon [i]=lon;
  this.galt[i]=galt;

  if(this.EXTENDED_VARS) {
    this.gs  [i]=gs;
    this.trk [i]=trk;
    this.hacy[i]=hacy;
    this.vacy[i]=vacy;
  }

  this.fixCount++;
}


/**
  @param {string} msg
  @param {string=} tlc
  @param {number|Date=} d - Date of the msg
  @return {undefined}

  NOTE: does not schedule xfer.
*/
gt.Track.prototype.addMsg=function(msg,tlc,d) {
  if(tlc==='DBG' && !this.DBGINFO) return;

  d=d||new Date;
  if(!tlc) tlc='MSG'; else tlc=(tlc+'---').substr(0,3);

  var t=this.relativeTimeForDate(d);
  var i=this.t.length;

  console.debug('msg[%d]: +%f %s',i,t,msg);
  this.t[i]=t;
  this.msg[i]=tlc+':'+msg;
}


/**
  @param {number} i0 - starting index
  @return {string|undefined} - IGC-formatted string
*/
gt.Track.prototype.getIGC=function(i0) {
  var s='';
  if(!this.date0) return undefined;
  var d0=new Date(this.date0);
  var dd=d0.getUTCDate();
  var mm=d0.getUTCMonth();
  var yy=d0.getUTCFullYear();

  if(!i0) {
    i0=0;
    // Format header
    s+="AGTd523\n";
    s+="HFDTE"+('0'+dd).substr(-2)+('0'+(mm+1)).substr(-2)+
       ('0'+(yy%100)).substr(-2)+"\n";
    if(this.pilot)  s+="HFPLTPILOT:"        +this.pilot +"\n";
    if(this.cn)     s+="HFCIDCOMPETITIONID:"+this.cn    +"\n";
    if(this.glider) s+="HFGTYGLIDERTYPE:"   +this.glider+"\n";
    if(this.tail)   s+="HFGIDGLIDERID:"     +this.tail  +"\n";
    if(typeof device === 'undefined') {
      s+="HFRHW:"+navigator.platform+"\n";
      s+="HFRFW:"+navigator.userAgent+"\n";
    } else {
      s+="HFRHW:"+device.model+'/'+device.platform+'/'+device.version+"\n";
      s+="HFRFW:"+device.cordova+"\n";
    }
    if(this.EXTENDED_VARS)
      s+="I043638TDS3941FXA4244VXA4547GSP4850TRT\n";
  }

  var t0=(this.date0-Date.UTC(yy,mm,dd))/1000;
  for(var i=i0; i<this.t.length; i++) {
    var t=t0+this.t[i],
        lat=this.lat[i], lon=this.lon[i], galt=Math.round(this.galt[i]),
        msg=this.msg[i];

    var ti=t|0, ss=ti%60, mm=Math.floor(ti/60)%60, hh=Math.floor(ti/3600)%24;
    var ts=('0'+hh).substr(-2)+('0'+mm).substr(-2)+('0'+ss).substr(-2);

    if(lat!==undefined) { // ---------------------------------- Format B-record
      s+="B"+ts;

      var y=Math.abs(Math.round(lat*60000))|0, latd2=(y/60000)|0, latm5=y%60000;
      s+=('0'+latd2).substr(-2)+('0000'+latm5).substr(-5)+(lat<0?'S':'N');

      var x=Math.abs(Math.round(lon*60000))|0, lond3=(x/60000)|0, lonm5=x%60000;
      s+=('00'+lond3).substr(-3)+('0000'+lonm5).substr(-5)+(lon<0?'W':'E');

      s+='A00000';
      s+=(galt<0?'-':''+Math.floor(galt/10000))+
         ('000'+(Math.abs(galt)%10000)).substr(-4);

      if(this.EXTENDED_VARS) {
        s+=('00'+((this.t[i]*1000)|0)).substr(-3);
        s+=('00'+Math.round(this.hacy[i])).substr(-3); // Accuracy FXA [m]
        s+=('00'+Math.round(this.vacy[i])).substr(-3); // Alt accuracy VXA [m]
        var gs=this.gs[i]*3.6; if(isNaN(gs) || gs<0) gs=999;
        s+=('00'+Math.round(gs )).substr(-3); // Gnd spd GSP [kph]
        var trk=this.trk[i]; if(isNaN(trk) || trk<0) trk=999;
        s+=('00'+Math.round(trk)).substr(-3); // Track [deg]
      }
      s+="\n";
    }

    if(msg!==undefined) { // ------------------------ Format L-record (message)
      var tlc=msg.substr(0,3),txt=msg.substr(4);
      s+='L'+tlc+ts;
      if(this.EXTENDED_VARS) s+=('00'+((this.t[i]*1000)|0)).substr(-3);
      s+=':'+txt+"\n";
    }
  }

  return s;
}


//=============================================================================
//
//  Y88b   d88P  .d888
//   Y88b d88P  d88P"
//    Y88o88P   888
//     Y888P    888888  .d88b.  888d888
//     d888b    888    d8P  Y8b 888P"
//    d88888b   888    88888888 888
//   d88P Y88b  888    Y8b.     888
//  d88P   Y88b 888     "Y8888  888
//
//=============================================================================
/**
	@param {number=} dt - ms from now
	@return {undefined}

	Sets timer, xferNextTime
*/
gt.Track.prototype.scheduleXfer=function(dt) {
  // if(this.timer || this.xhr) return; // already scheduled or in progress
  var now=(new Date).getTime(), t;
  if(dt>=0) {
    t=now+dt;
  } else {
    if(!this.xferNextTime) {
      console.assert(!this.timer);
      return;
    }
    t=this.xferNextTime;
    dt=t-now;
  }
  if(this.xferNextTime && this.xferNextTime<=t) {
    if(this.timer) return;
    t=this.xferNextTime;
    dt=t-now;
  } else {
    if(this.timer) clearTimeout(this.timer);
    // console.debug('  ... timer %s -> %s',(this.xferNextTime-now)/1000,(t-now)/1000);
    this.timer=undefined;
    this.xferNextTime=t;
  }
  if(this.xhr) return; // xfer already in progress

  if(!this.timer) {
    if(dt<0) dt=0;
    this.xferNextTime=now+dt;
    this.timer=setTimeout(function(){
      if(this.timer) clearTimeout(this.timer);
      this.timer=undefined;
      this.xferNextTime=undefined;
    	this.xfer();
    }.bind(this), dt);
    // console.debug('TIMER %d in %s',this.timer,dt/1000);
  }
}


/**
	@return {undefined}

	Asynchronous XHR.
  Send track data from cursor to the end, encoded as IGC text.
*/
gt.Track.prototype.xfer=function() {
  var ts=(new Date).getTime();
  if(this.xhr) {
  	// this.addMsg(ts,'XFR:inprogress');
  	console.warn('XFR in progress');
  	return;
  }
  this.addMsg('snd#'+this.xferCount+'('+this.cursor+':'+this.t.length+')','DBG');
  this.xferCount++;

  var devid=gt.App.app.getDevid();
  if(!devid) {
    // Just wait if we don't have deviceId yet
    this.xferWaitCount++;
    this.scheduleXfer(this.XFER_RETRY_INTERVAL);
    return;
  }

  // Format packet to send
  var url=gt.App.app.settings.API_URL+'/gt/'+this.getToken();
  if(!this.cursor) url+='/'+devid;

  var packet=this.getIGC(this.cursor);
  this._cursor1=this.t.length;
  console.debug('XFER[%s-%s): %s\n%s',this.cursor,this._cursor1,url,packet);
  this.xferLastTime=this.date0+this.t.last()*1000;
  // console.debug(" ... last: %s, now: %s",new Date(this.xferLastTime),new Date);

  var x=new XMLHttpRequest;
  this.xhr=x;
  x.open("POST",url,true);
  x.timeout=this.XFER_TIMEOUT;
  x.setRequestHeader('Content-type','application/octet-stream');

  x.onreadystatechange=function() {
  	console.assert(!this.timer);
    var x=this.xhr; console.assert(x);
    // console.debug('XHR[%s]: %s',x.readyState,x.status);
    if(!x || x.readyState!==x.DONE) return; // not done yet
    this.xhr=undefined;

    if(x.status===200) { // onsuccess:
      console.debug('XHR success')
      this.addMsg('ok#'+(this.xferCount-1)+'('+this.cursor+'/'+this.t.length+')','DBG');
      this.xferSuccessCount++;
      this.xferSuccessTime=this.xferLastTime;
      this.cursor=this._cursor1;
      // Schedule xfer of data that accumulated meanwhile
      this.scheduleXfer();
      // this.scheduleXfer(this.XFER_NOMINAL_INTERVAL);
      this.onxfer && this.onxfer();

    } else { // onerror:
      // console.dir(x);
      console.debug('XHR error')
      this.addMsg('err#'+x.status+': '+x.statusText,'DBG');
      this.xferErrorCount++;
      // Depending on the server response, we may want to give up...
      console.warn("XFER[%s]: %s (%s)",x.status,x.statusText,x.responseText);
      if(x.status===400) {
        // Notify and give up...
        this.onharderror &&
           this.onharderror(x.responseText||x.statusText||x.status);
      } else {
        // Try again...
        this.scheduleXfer(this.XFER_RETRY_INTERVAL);
      }
    }
    this._cursor1=undefined;
  }.bind(this);

  x.ontimeout=function() { // ontimeout:
    // console.assert(!this.timer);
    console.debug('XHR timeout');
    this.addMsg('timeout','DBG');
    this.xferTimeoutCount++;
    // NOTE: Timeout invokes onreadystatechange
    // this.scheduleXfer(this.XFER_RETRY_INTERVAL);
    //  this.xhr=undefined; this._cursor1=undefined;
  }.bind(this);

  x.onabort=function() {
    console.debug('XHR abort');
    this.addMsg('abort','DBG');
    this.xferAbortCount++;
  }.bind(this);

  x.onloadstart=function() {
    console.debug('XHR start');
    this.addMsg('start','DBG');
  }.bind(this);

  x.onloadend=function() {
    console.debug('XHR end');
    this.addMsg('end','DBG');
  }.bind(this);

  x.onerror=function() {
    console.debug('XHR error');
    this.addMsg('error','DBG');
    // this.xferErrorCount++;
  }.bind(this);

  x.send(packet);
}


// EOF
