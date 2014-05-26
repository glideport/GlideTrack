/** @fileoverview Sim.js

TODO:

=============================================================================*/
"use strict";

/** @constructor */
gt.Sim=function(){}


/**
  @param {string} url - igc file to load (sync)
  @return {gt.Sim} - this
*/
gt.Sim.prototype.init=function(url) {
  this.wid=1;
  this.timeout=null;
  this.cursor=0;
  this._hms0=undefined; // used by the igc parser

  var x=(new XMLHttpRequest);
  x.open('GET',url,false);
  x.send(null);
  if(x.status!==200) {
    alert('Error reading '+url);
    return null;
  }
  var igc=x.responseText;
  this.parseIgc(igc);
  console.debug('Loaded %s',url);

  return this;
}


/**
  @return {undefined}
*/
gt.Sim.prototype.destroy=function() {
  if(this.timeout) clearTimeout(this.timeout); delete this.timeout;
}


//----------------------------------------------------------------------------
//
// Watch / clear position; _tick
//----------------------------------------------------------------------------
/**
  @param {function()} onfix
  @param {function()} onerr
  @param {Object=} opt
  @return {nubmer} - watch id

  Emulates navigator.geolocation api
*/
gt.Sim.prototype.watchPosition=function(onfix,onerr,opt) {
  this.onfix=onfix;
  this.onerr=onerr;
  this.sim0=(new Date).getTime()-this.t[this.cursor]*1000;
  this.timeout=setTimeout(this._tick.bind(this),0);
  return this.wid;
}


/**
  @param {number} wid
*/
gt.Sim.prototype.clearWatch=function(wid) {
  console.assert(wid===this.wid);
  if(this.timeout) clearTimeout(this.timeout); this.timeout=null;
}


/**
  @return {undefined}
*/
gt.Sim.prototype._tick=function() {
  if(this.cursor>=this.t.length) // ... done
    return this.clearWatch(this.wid);

  var i=this.cursor,
      gs =gt.dist(this.lat[i-1],this.lon[i-1],
                  this.lat[i  ],this.lon[i  ])/(this.t[i]-this.t[i-1]),
      trk=gt.trk (this.lat[i-1],this.lon[i-1],
                  this.lat[i  ],this.lon[i  ])*180/Math.PI,
      loc={
    timestamp: new Date(this.sim0+this.t[this.cursor]*1000),
    coords: {
      latitude : this.lat [i],
      longitude: this.lon [i],
      altitude : this.galt[i],
      speed    : gs,
      heading  : trk,
      accuracy : 10,
      altitudeAccuracy: 10
    }
  };
  this.onfix && this.onfix(loc);
  this.cursor++;

  // Schedule next tick
  if(this.cursor>=this.t.length) return; // ... done
  var dt=this.sim0+this.t[this.cursor]*1000-(new Date).getTime();
  if(dt<0) dt=0;
  this.timeout=setTimeout(this._tick.bind(this),dt);
}


//----------------------------------------------------------------------------
//
// Super-simple IGC parser
//----------------------------------------------------------------------------
/**
  @param {string} str - time string
  @return {number} t - time in seconds relative to _hms0

  Side-effect: sets this._hms0 if not set (on first call)
*/
gt.Sim.prototype._parseIgcTime=function(str) {
  var t=parseInt(str.substr(0,2),10)*3600 +
        parseInt(str.substr(2,2),10)*60 +
        parseInt(str.substr(4,2),10);
  if(this._hms0==null) this._hms0=t; // First B-record
  else if(t<this._hms0) t+=24*3600; // roll over
  t-=this._hms0;
  return t;
}


/**
  @param {string} igc
*/
gt.Sim.prototype.parseIgc=function(igc) {
  this.t   =this.t   ||[];
  this.lat =this.lat ||[];
  this.lon =this.lon ||[];
  this.palt=this.palt||[];
  this.galt=this.galt||[];

  var lineArray=igc.split('\n');
  for(var i=0; i<lineArray.length; i++) {
    var line=lineArray[i];
    if(line.length===0) continue;
    switch(line[0]) {
    case 'B':
      if(line[24]!=='A') break; // Skip (ignore) bad fix
      var t=this._parseIgcTime(line.substr(1,6));
      if(t==null) break;

      var slat=line.substr(7,8);
      var lat=parseInt(slat.substr(0,2),10)+parseInt(slat.substr(2,5),10)/60000;
      if(slat[7]==='S') lat=-lat;

      var slon=line.substr(15,9);
      var lon=parseInt(slon.substr(0,3),10)+parseInt(slon.substr(3,5),10)/60000;
      if(slon[8]==='W') lon=-lon;

      var palt=parseInt(line.substr(25,5),10),
          galt=parseInt(line.substr(30,5),10);

      this.t.push(t);
      this.lat.push(lat);
      this.lon.push(lon);
      this.galt.push(galt);
      this.palt.push(palt);
      break;
    }
  }
}

// EOF
