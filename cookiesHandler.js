module.exports = {
    parseCookies: function (str) {
        let rx = /([^;=\s]*)=([^;]*)/g;
        let obj = { };
        for ( let m ; m = rx.exec(str) ; )
          obj[ m[1] ] = decodeURIComponent( m[2] );
        return obj;
      },
    stringifyCookies: function (cookies) {
        return Object.entries( cookies )
          .map( ([k,v]) => k + '=' + encodeURIComponent(v) )
          .join( '; ');
    }
}