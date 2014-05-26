/** @fileoverview gt.js

  Miscellaneous gt namespace utility functions.

=============================================================================*/
gt={};


/**
  @param {string} id
  @return {?Element}
*/
function $id(id) {
  if('string' === typeof id) return document.getElementById(id);
  return id;
}


/**
  @param {number} lat1
  @param {number} lon1
  @param {number} lat2
  @param {number} lon2
  @return {number} - distance from (lat1,lon1, lat2,lon2)
 */
gt.dist_af=function(lat1,lon1,lat2,lon2) {
  // From aviation formulary
  var RAD_PER_DEG=Math.PI/180, KM_PER_NM=1.852;
  lat1*=RAD_PER_DEG; lon1*=RAD_PER_DEG; lat2*=RAD_PER_DEG; lon2*=RAD_PER_DEG;
  var d=2*Math.asin(Math.sqrt(Math.pow(Math.sin((lat1-lat2)/2),2)
                + Math.cos(lat1)*Math.cos(lat2)*Math.pow(Math.sin((lon1-lon2)/2), 2)));
  d*=(1000*KM_PER_NM)*60/RAD_PER_DEG;
  return d;
}

/**
  @param {number} lat1
  @param {number} lon1
  @param {number} lat2
  @param {number} lon2
  @return {number} - haversine distance from (lat1,lon1, lat2,lon2)
 */
gt.dist_h=function(lat1,lon1,lat2,lon2) {
  // Haversine distance
  var REarth = 6371000; // [m]
  var RAD_PER_DEG=Math.PI/180;
  lat1*=RAD_PER_DEG; lon1*=RAD_PER_DEG; lat2*=RAD_PER_DEG; lon2*=RAD_PER_DEG;
  var dLat=lat2-lat1, dLon=lon2-lon1;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2) +
        Math.sin(dLon/2)*Math.sin(dLon/2) * Math.cos(lat1)*Math.cos(lat2);
  return REarth*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

gt.dist=gt.dist_af;


/**
  @param {number} lat1
  @param {number} lon1
  @param {number} lat2
  @param {number} lon2
  @return {number} - [rad] track from #1 to #2 [0,2*pi)
 */
gt.trk=function(lat1,lon1,lat2,lon2) {
  var RAD_PER_DEG=Math.PI/180;
  lat1*=RAD_PER_DEG; lon1*=RAD_PER_DEG; lat2*=RAD_PER_DEG; lon2*=RAD_PER_DEG;
  if(Math.cos(lat1)<.00000001) { // starting from N or S pole
    if(lat1>0) return Math.PI; // starting from N pole
    else return 0; // starting from S pole
  }

  var d=Math.atan2(Math.sin(lon2-lon1)*Math.cos(lat2),
                   Math.cos(lat1)*Math.sin(lat2)
                   - Math.sin(lat1)*Math.cos(lat2)*Math.cos(lon2-lon1));
  if(d<0) d+=2*Math.PI;
  if(d>=2*Math.PI) d-=2*Math.PI;
  return d;
}


/**
  @param {number} dt - [s]
  @return {string}
*/
gt.fmt_dt=function(dt) { // [HH]:MM:SS
  dt=Math.round(dt);

  var h=Math.floor(dt/3600);
  var m=Math.floor(dt/60)-60*h;
  var s=dt-60*m-3600*h;

  var str="";
  if(h>0) str+=h+":";
  if(m>0 || h>0) {
    if(str.length && m<10) str+='0';
    str+=m;
  }
  str+=':';
  if(s<10) str+='0';
  str+=s;
  return str;
}


/**
  @param {string} str
  @param {number=} base - 10, 16, 36, 64
  @param {number=} i0
  @param {number=} i9
  @return {number} - imei check digit (Luhn algorithm)

  luhn_checksum('49015420323751?',10) => '8'
  NOTE: base 64 is not real base64 encoding but rotated (0-9 go infront of A-Z)
*/
gt.luhn_checksum=function(str,base,i0,i9) {
  base=base||10;
  i0=i0||0;
  i9=i9||(str.length-1);
  for(var i=i0, s=0; i<i9; i++) {
    var d=str.charCodeAt(i);
    if(d>=48 && d<=57) d-=48; // 0-9
    else if(d>=65 && d<=90) d=d-65+10; // A-Z
    else if(d>=97 && d<=122) d=d-97+36; // a-z
    else if(d===45) d=62; // -
    else if(d===95) d=63; // _
    else return undefined;
    if(i%2) d*=2;
    var d2=(d/(base*base))|0, d1=((d/base)|0)-d2*base, d0=d%base;
    s+=d2+d1+d0;
  }
  var r=base-(s%base);
  if(r<10) return String.fromCharCode(48+r);
  if(r<36) return String.fromCharCode(65+r-10);
  if(r<62) return String.fromCharCode(97+r-36);
  if(r===62) return '-';
  if(r===63) return '_';
  return undefined;
}


/**
  @param {string=} pfx - def ''
  @param {number=} len - def 16
  @return {string} - luhn-checksumed
*/
gt.GenerateUniqueId=function(pfx,len) {
  var len=len||16;
  var id=((pfx||'')+(new Date).getTime().toString(36)+
          'xxxxxxxx'.replace(/[x]/g,
              function(c){ return (Math.random()*36|0).toString(36); })
         ).substr(0,len-1);
  id+=gt.luhn_checksum(id,64,0,len-1);
  return id;
}


/**
  @return {undefined}
*/
gt.beep=function() {
  if(navigator.notification && navigator.notification.beep)
    navigator.notification.beep();
  if(navigator.notification && navigator.notification.vibrate)
    navigator.notification.vibrate(250);
}


if(!Array.prototype.last)
/**
  @return {?Object}
*/
  Array.prototype.last=function() { return this[this.length-1]; }


// EOF
