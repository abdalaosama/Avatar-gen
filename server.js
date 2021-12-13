const cache = require('./cache_manager');
const config = require('./config')
const server = require('./customHttp')
const cookies = require('./cookiesHandler')
const url = require('url');
const fs = require('fs')
const crypto = require('crypto')
const WebServer =  new server.server()
const client = server.client;
exports.client = client;




function getDiscordAccessToken(state, code, cb) {

    cache.isTokenValid(state, (tokenValid, err, session) => {

        if (tokenValid) {
            return cb(session.user_data.access_token, undefined, session);
        }

        //token not valid here
        if (err != undefined) {
            return cb(undefined, new Error("session not valid no form data"));
        } else {
            //exchange code for token
            const exchangeData = {
                client_id: config.client_id,
                client_secret: config.client_secret,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: config.callBackURI
            };
            var DiscordData;
            client.post("discord.com", config.token_exchange_endpoint, client.JSONtoXformat(exchangeData), { 'Content-Type': 'application/x-www-form-urlencoded' }, (res, err) => {
                try {
                    if (err) { return cb(undefined, new Error("exchange failed, code Invalid")); }

                    DiscordData = JSON.parse(res);
                    DiscordData.tokenCreatedAt = Math.floor(Date.now() / 1000);
                    if (DiscordData.code == 0 || DiscordData.message == "401: Unauthorized" || DiscordData.error != undefined) {
                        return cb(undefined, new Error("exchange failed, code Invalid"));
                    }
                    //cache token
                    cache.updateSession(state, DiscordData);
                    return cb(DiscordData.access_token, undefined, session);
                }
                catch (err) {
                    return cb(undefined, new Error("exchange failed, code Invalid"));
                }
            });
        }
    });
}

/*------------------------------------------------------*/
WebServer.register("/", (req, resp) => {
    
        WebServer.send200File(resp, './public/index.html', (error) => {
            console.log(error)
            WebServer.respond(resp, 500, "Server Error: File index.html not Found. Please contanct system administrator")
        })

});

WebServer.register('/get_avatar', (req,resp) => {

    if(req.method == "POST"){
        var body = '';

        req.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6) req.connection.destroy();
        });

        req.once('end', function () {
            try {

                var postData = JSON.parse(body);
                

                if(!(postData.main_seed == "Discord_username" || postData.main_seed == "Discord_avatar_hash")){
                    return WebServer.respond(resp, 404, 'Malformed Input. Incorrect Main-seed <a href="\/">go Back</a>');
                }

                if(!(postData.background.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i))){
                    return WebServer.respond(resp, 404, 'Malformed Input. Incorrect Color <a href="\/">go Back</a>');
                }

                if(!(postData.mood == "happy" || postData.mood == "sad")){
                    return WebServer.respond(resp, 404, 'Malformed Input. Incorrect Mood <a href="\/">go Back</a>');
                }

                if(!( ["Adventurer","Adventurer-Neutral","Avataaars","Big-Ears","Big-Ears-Neutral","Big-Smile","Bottts","Croodles","Croodles-Neutral","Female","Gridy","Human","Identicon","Initials","Jdenticon","Male","Micah","Miniavs","Open-Peeps","Personas","Pixel-Art","Pixel-Art-Neutral"].some(x => x.toLowerCase() == postData.style) )){
                    return WebServer.respond(resp, 404, 'Malformed Input. Incorrect Style <a href="\/">go Back</a>');
                }
                // if all checks are passed 

                postData.extra_seed = encodeURIComponent( postData.extra_seed )

                const ln_cookies = cookies.parseCookies(req.headers.cookie)
                console.log("cookies Gotten : ")
                console.table(ln_cookies)

                if (ln_cookies.state == undefined){ // Caching sessions
                    var state_hash = crypto.randomBytes(20).toString('hex');
                    cache.addSession(state_hash, postData);
                }
                else{
                    state_hash = ln_cookies.state;
                    cache.updateSession(state_hash, postData);
                }

                console.log(`state_hash = ${state_hash}`);

                resp.writeHead(200,{"Content-Type":"text/plain",'Set-Cookie': `state=${state_hash}`})
                resp.end(`${config.discord_api_domain}${config.base_Oauth_endpoint}?response_type=code&client_id=${config.client_id}&scope=${config.scopes_needed}&state=${state_hash}&redirect_uri=${config.callBackURI}&prompt=none`, 'utf-8')
            } catch (error) {
                console.log(error)
                return WebServer.respond(resp, 500, 'Internal Server Error: Please try again later <a href="\/">go Back</a>');
            }
        });
    
    }
    else if(req.method == "GET"){

        try {
            
            //validate parameters
            const GETparams = url.parse(req.url,true).query;
            if(GETparams.code == undefined){
                return WebServer.respond(resp, 404, 'Missing code parameter,  <a href="\/">go Back</a>');
            }
            if(GETparams.state == undefined){
                return WebServer.respond(resp, 404, 'Missing state parameter,  <a href="\/">go Back</a>');
            }

           getDiscordAccessToken(GETparams.state, GETparams.code, (token, err, session) => {
            try{
                if(err || token == undefined){
                    return WebServer.respond(resp, 500, "Internal Server Error, token invalid,<a href=\"\/\">go Back</a>")
                }

                client.get("discord.com", "/api/users/@me", {"Authorization": `Bearer ${token}`}, (FirstReqData, err) => {

                    if(err){ return WebServer.respond(resp, 500, 'Internal Server Error, First Api Request failed, Couldn\'t Fetch data from discord, <a href="\/">go Back</a>')}

                    FirstReqData = JSON.parse(FirstReqData)
                    console.table(FirstReqData)

                    if(FirstReqData.code == 0 || FirstReqData.message == "401: Unauthorized"){
                        return WebServer.respond(resp, 500, 'Internal Server Error, First Api Request failed, invalid access token, <a href="\/">go Back</a>')
                    }
                    //cache userdata from first api call
                    cache.updateSession(GETparams.state, FirstReqData);


                    // The Second API
                    //make second api call using userdata
                    const path = `/api/${session.user_data.style}/${(session.user_data.main_seed=="Discord_username"?`${encodeURI( FirstReqData.username )}:${encodeURI(session.user_data.extra_seed)}`:`${encodeURI(FirstReqData.avatar)}:${encodeURI(session.user_data.extra_seed)}`)}.svg?background=${session.user_data.background.replace('#', "%23")}&mood=${session.user_data.mood}`;
                    client.get("avatars.dicebear.com", path,{}, (SecondReqData, err) => {

                        try{
                            if(err){ return WebServer.respond(resp, 500, 'Internal Server Error, Second Request failed, Couldn\'t Fetch avatar from Dicebear, <a href="\/">go Back</a>')}
                            //cache the svg file from second api call
                            fs.writeFileSync(`./cached_avatars/${GETparams.state}.svg`, SecondReqData, () => {return});
                            // send Redirect to /show_avatar
                            resp.writeHead(302, { 'Content-Type': "text/html", "location":"/show_avatar" });
                            resp.end("success", 'utf-8');
                        }catch(err){
                            WebServer.respond(resp, 404, 'your session cookies are invalid, <a href="\/">go Back</a>') 
                        }
                    });
                    
                })
                }
                catch(err){
                    return WebServer.respond(resp, 500, 'Internal Server Error, First Api Request failed, please try again later, <a href="\/">go Back</a>')
                }
           })
        } catch (error) {
            console.log(error)
            return WebServer.respond(resp, 500, 'Internal Server Error: Please try again later <a href="\/">go Back</a>');
        }
    }
    else{
        WebServer.respond(resp, 404, 'wrong Method Please use GET or POST, <a href="\/">Go back</a>')
    }
    return

})

WebServer.register("/show_avatar", (req, resp) => {
    WebServer.send200File(resp, "./public/show.html", (err) => {
        console.log(error)
        WebServer.respond(resp, 500, "Server Error: File show.html not Found. Please contanct system administrator") 
    })
})

WebServer.register("/avatar", (req, resp) => {
    try{
        const ln_cookies = cookies.parseCookies(req.headers.cookie)
        fs.readFile(`./cached_avatars/${ln_cookies.state}.svg`, (err, content)  => {
            if(err) return WebServer.respond(resp, 404, "your session cookies are invalid") 
            resp.writeHead(200, { 'Content-Type': "image/svg+xml"});
            resp.end(content, 'utf-8'); 
        })
    }catch(err){
        WebServer.respond(resp, 404, "your session cookies are invalid") 
    }
})
/*------------------------------------------------------*/
WebServer.start();







