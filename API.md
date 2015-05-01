@fileoverview API.md - 20140531
`Copyright (c) 2014 TipTop Software, Inc.  All rights reserved.`
[info@glideport.aero](mailto:info@glideport.aero)


# GlidePort.aero Hires Track API

The purpose of this API is to push live IGC track data to glideport.aero for
live display.  The API is accessed via the standard HTTP protocol.  There are 3
API calls:

  * `noop` - Check connectivity to the glideport.aero server.
  * `dev` - Register a tracking device, or update device info.
  * `gt` - Push live IGC track data.

The `gt` call is the heart of the API.  It is designed to be as minimal and as
simple as possible.  You essentially pass IGC data (fragment) in the body of an
http POST request.  The arguments are the track token (i.e., a unique track
identifier that you generate) and the devid (i.e., the unique  mobile device
identifier).

If you have a good quality GPS, you should process track data on your mobile
device and optimally reduce it to 4 second fixes.  If you do not have a good
GPS, send all unprocessed/raw GPS data, including ground speed, true track and
fix quality in the IGC format and glideport.aero server will process data. The
penalty is that in this case you are sending a lot more data across.

The `gt` call should be invoked periodically as track data is being collected.
Once every 1-3 minutes is a good interval.  If the `gt` call fails, e.g.,
because there is no cell connection, the track data must not be discarded, it
should be sent in the next gt message.  In other words, when there is
connectivity you send everything that has been accumulated since the last
successful transfer.

IGC format documentation:

  * [FAI.org Tech Spec](http://www.fai.org/component/phocadownload/category/855-technicalspecifications?download=7571:igc-fr-specification-with-al2-2013-12-31) - see Appendix A.
  * [Digested by Ian Forster-Lewis](http://carrier.csi.cam.ac.uk/forsterlewis/soaring/igc_file_format/igc_format_2008.html)

__See Track.js in the GlideTrack reference implementation for an example how to
use the `gt` call.__


The main purpose of the `dev` call is to establish association between a
tracking device and a GlidePort user.  Each tracking device is identified by a
unique devid, which ideally should be tied to hardware id (e.g., MAC address or
UDID).  If hardware id is not available (such as in the case of JavaScript),
then devid can be generated using a random-number generation scheme and
permanently recorded for subsequent uses.

The simplest use of the API can completely forego use of the `dev` call as
follows:

  1. The mobile device generates devid and presents it to the user
  2. The user enters gt:devid in the GlidePort Settings->Tracking page

The mobile app can then use the `gt` call with that devid to send tracking data
to GlidePort.

However, a more user-friendly approach is to let the user register on the mobile
device itself without having to enter tracker devid into GlidePort.  The `dev`
call is used to register mobile device, query device info, or update device.

Note that if a device is shared amongst GlidePort users, prior to a flight the
user should update tracker registration to his/her user name, otherwise the
track will be associated with the currently registered user for the device.

__See Settings.js in the GlideTrack reference implementation for an example how
to use the `dev` call.__


![GP Cloud](img/gp-cloud.png)

---


### noop

Check connectivity to the server.

    URL: glideport.aero/api/noop

Arguments:

  * none

Return:

  * [200] ok

Example:

    curl http://glideport.aero/api/noop
    => "ok"


### dev

Register new mobile tracking device, query device info, or update device info if
already registered.

    URL: glideport.aero/api/dev/<devid>
    POST (json):
      { uname, name, cn, glider, tail, cc, tc, about, photoUrl, vendor, key }

Arguments:

  * devid must be valid unique device id (ideally tied to hardware id):
      * Exactly 16 characters long, base 64 (0-9,A-Z,a-z,-_)
      * The last character is Luhn checksum (base 64); see the checksum function
        below.
    NOTE: devid is secret, do not share it!  (If someone else were to know your devid, they could impersonate you.)
  * vendor must be a registered vendor
  * key must be a valid vendor key - signed timestamp w/in 5min
  * uname (mandatory/optional) - This is the glideport.aero user name (i.e., email).  When registering first time uname must be provided, and the tracking device is assigned to that user.  When querying device info, it is optional.
  * name (opt) - pilot's full name.  If not specified, user's full name
    associated with uname will be used.
  * cn (opt) - contest number
  * glider (opt) - glider model
  * tail (opt) - tail number
  * cc (opt) - 2-letter country code
  * tc (opt) - team code
  * about (opt) - pilot info, e.g., short bio
  * photoUrl (opt) - url to pilot's photo

Return:

  * [200] json - device info
  * [200] <empty> - if there is no such device and POST is empty
  * [400] error - if there is an error

Note: To manually register a mobile tracker, instead of using the dev call, the
mobile device can produce and display the 16-character devid to the user, and
the user can then enter that devid in the glideport.aero Settings->Tracking page
as `gt:<devid>`.

#### Example (register device):

    curl -H 'Content-Type: raw' -d '{"uname":"pez@glideport.aero","name":"Pez D. Spencer","cn":"PDS","glider":"Lingus 2C","tail":"N99PS","vendor":"glideport.aero","key":"<vendor-signed-key>"}' http://glideport.aero/api/dev/test_tracker_device
    => {
        "uname": "pez@glideport.aero",
        "cn": "PDS",
        "name": "Pez D. Spencer",
        "glider": "Lingus 2C",
        "tail": "N99PS",
        "devid": "test_tracker_device",
        "vendor": "glideport.aero"
    }

#### Example (device info):

    curl http://glideport.aero/api/dev/test_tracker_device
    => { ... }
    => null  - if it does not exist

(Replace `test_tracker_device` with a valid devid.)

### gt (track)

Send tracking data to glideport.aero.

    URL: glideport.aero/api/gt/[<token>][/<devid>]
    POST: IGC fragment

Arguments:

  * devid - see above.
  * token - track token identifies a track; unique, randomly generated:
      * Exactly 16 characters long, base 64 (0-9,A-Z,a-z,-_)
      * The last character is Luhn checksum (base 64); see the checksum function
        below.
    If the track does not exist, it is created; hence the first message
    with a new token must also include a valid devid.  Subsequent messages
    do not need devid included.
    NOTE: The first POST must include a complete valid IGC header.

Return:

  * [200] - if all ok
  * [400] error message - critical: something is fundamentally wrong, subsequent calls to gt with this token are unlikely to succeed

#### Example (new track):

    curl -H 'Content-Type: raw' -d 'A....\nHFDTE....\nHFPLTPILOT: Pez D. Spencer\n...' http://glideport.aero/api/gt/123456789012345g/test_tracker_device

(Replace `test_tracker_device` with a valid devid.)

#### Example (append to track):

    curl -H 'Content-Type: raw' -d 'B1629124002797N10512123WA0177801871\nB...' http://glideport.aero/api/gt/123456789012345g

#### Example (dev info - alternate way to query registered device info):

    curl http://glideport.aero/api/gt//test_tracker_device
    => {
        "devid": "test_tracker_device",
        "cn": "PDS",
        "name": "Pez D. Spencer",
        "glider": "Lingus 2C",
        "registration": "N99PS"
    }

### Luhn Checksum

    /**
      @param {string} str
      @param {number=} base - 10, 16, 36, 64
      @param {number=} i0
      @param {number=} i9
      @return {number} - check digit (Luhn algorithm)

      luhn_checksum('49015420323751?',10) => '8'
      NOTE: base 64 is modified base64 encoding where 0-9 are in front of A-Z
    */
    function luhn_checksum(str,base,i0,i9) {
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
      var r=(base-(s%base))%base;
      if(r<10) return String.fromCharCode(48+r);
      if(r<36) return String.fromCharCode(65+r-10);
      if(r<62) return String.fromCharCode(97+r-36);
      if(r===62) return '-';
      if(r===63) return '_';
      return undefined;
    }


~EOF~
