const fs  = require('fs');
const config = require('./config');

cache_manager = {
    validateCache: () => {
        try {
            if (!fs.existsSync(config.cacheFile)) {
              fs.writeFile(config.cacheFile,'[]', ()=> {return})
            }

            // do checks to validate that cache isn't courrpted

          } catch(err) {
            console.error(err)
            throw err
          }
    },
    
    getWholeCache : (call_back) => {
      cache_manager.validateCache();
      fs.readFile( config.cacheFile, 'utf8', (err, data) =>{
        if (err) throw err
        call_back(JSON.parse(data));
      });

    },

    clearCache : () =>{
      fs.writeFile(config.cacheFile,'[]', ()=> {return})
    },


    getSession: (sessionKey, callBack) =>{
      try{
        cache_manager.validateCache(); // make sure file exists before trying to read from it
        cache_manager.getWholeCache((data) => {
          callBack( data.find( x => x.session_key == sessionKey) )
        })  
      }
      catch(err){
        callback(undefined, err)
      }
    },

    addSession: ( sessionKey, userData ) => {
      cache_manager.validateCache(); // make sure file exists before trying to write to it
      cache_manager.getWholeCache((data) => {

        if( data.find( x => x.session_key == sessionKey)){ // make sure Session_key is unique
          throw new Error("Session already Exists, session_key must be unique");
        }
        data.push({session_key: sessionKey, user_data:userData})
        fs.writeFile(config.cacheFile, JSON.stringify( data ), ()=> {return});
      })
    },

    removeSession: ( sessionKey ) => {
      cache_manager.validateCache(); // make sure file exists before trying to write to it
      cache_manager.getWholeCache((data) => {

        const sessionIndex = data.findIndex( x => x.session_key == sessionKey);
        
        if( sessionIndex > -1 ){ // make sure Session_key is unique
          data.splice(sessionIndex, 1);
        }
       
        fs.writeFile(config.cacheFile, JSON.stringify( data ), ()=> {return});
      })
    },

    updateSession: (sessionKey, newUserData) =>{
      cache_manager.validateCache(); // make sure file exists before trying to read from and write to the File
      cache_manager.getWholeCache((data) => {
        
        const sessionIndex = data.findIndex( x => x.session_key == sessionKey);

        if(sessionIndex < 0){ // if session doesn't exist 
          cache_manager.addSession(sessionKey, newUserData);
          return
        }

        Object.keys(newUserData).forEach(Key => {// to overwrite indivisual fields of userData
          data[sessionIndex].user_data[Key] = newUserData[Key];
        });
        
        fs.writeFile(config.cacheFile, JSON.stringify( data ), ()=> {return});
      })  
    },

    overwriteSession: (sessionKey, newUserData) =>{
      cache_manager.validateCache(); // make sure file exists before trying to read from and write to the File
      cache_manager.getWholeCache((data) => {
        data[data.findIndex( x => x.session_key == sessionKey)].user_data = newUserData
        fs.writeFile(config.cacheFile, JSON.stringify( data ), ()=> {return})
      })  
    },

    isTokenValid: (sessionKey, callback) => { // checks for token expiry time
      cache_manager.validateCache();
      cache_manager.getSession(sessionKey, ( session ) => {

        if (session == undefined ){
          return callback( false, new Error("no session") ) 
        }

        if(session.user_data.access_token == undefined){
          return callback( false, undefined, session ) 
        }

        if ( Math.floor(Date.now() / 1000) > session.user_data.expires_in + session.user_data.tokenCreatedAt ){ // If current time has passed the expiry time
          return callback( false ,undefined, session );
        }
        return callback( true , undefined, session);
      })

    }

}


module.exports = cache_manager