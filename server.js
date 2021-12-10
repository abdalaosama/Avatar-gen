const cache = require('./cache_manager');
const config = require('./config')
const server = require('./customHttp')
const cookies = require('./cookiesHandler')
const url = require('url');
const fs = require('fs')
const crypto = require('crypto')

const WebServer =  new server.server()
const client = server.client

/*------------------------------------------------------*/
WebServer.register("/", (req, resp) => {
    WebServer.send200File(resp, './public/index.html');
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
            var postData = JSON.parse(body);
            

            if(!(postData.main_seed == "Discord_username" || postData.main_seed == "Discord_avatar_hash")){
                return WebServer.send404(resp);
            }

            if(!(postData.background.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i))){
                return WebServer.send404(resp);
            }

            if(!(postData.mood == "happy" || postData.mood == "sad")){
                return WebServer.send404(resp);
            }

            
            
            if(!( ["Adventurer","Adventurer-Neutral","Avataaars","Big-Ears","Big-Ears-Neutral","Big-Smile","Bottts","Croodles","Croodles-Neutral","Female","Gridy","Human","Identicon","Initials","Jdenticon","Male","Micah","Miniavs","Open-Peeps","Personas","Pixel-Art","Pixel-Art-Neutral"].some(x => x.toLowerCase() == postData.style) )){
                return WebServer.send404(resp);
            }
            // if all checks are passed 
            
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
            resp.end(`${config.discord_api_domain}${config.base_Oauth_endpoint}?response_type=code&client_id=${config.client_id}&scope=${config.scopes_needed}&state=${state_hash}&redirect_uri=${config.callBackURI}&prompt=consent`, 'utf-8')
        });
    
    }

    if(req.method == "GET"){

        const GETparams = url.parse(req.url,true).query;
        if(GETparams.code == undefined){
            return WebServer.send404(resp);
        }
        if(GETparams.state == undefined){
            return WebServer.send404(resp)
        }
        //validate parameters
        
        //check if token is still valid
            // yes, go to First API call Directly
        //no


        //exchange code for token
        const exchangeData = {
            client_id: config.client_id,
            client_secret: config.client_secret,
            grant_type:"authorization_code",
            code: GETparams.code,
            redirect_uri:"http://localhost:3000/get_avatar"
        }
        var DiscordData;
        client.post("discord.com", config.token_exchange_endpoint, client.JSONtoXformat( exchangeData ), {'Content-Type': 'application/x-www-form-urlencoded'},(res) => {
            DiscordData = JSON.parse(res);
            DiscordData.now = Date.now() / 1000
            // console.table(DiscordData)
            if(DiscordData.error){
                throw DiscordData.error
            }
            //cache token
            cache.updateSession(GETparams.state, DiscordData);

            
            // The First API
            client.get("discord.com", "/api/users/@me", {"Authorization": `Bearer ${DiscordData.access_token}`}, (FirstReqData) => {
                FirstReqData = JSON.parse(FirstReqData)
                console.table(FirstReqData)

                //cache userdata from first api call
                cache.updateSession(GETparams.state, FirstReqData);

                cache.getSession(GETparams.state, (session) => {
                    
                    // The Second API
                    //make second api call using userdata
                    const path = `/api/${session.user_data.style}/${(session.user_data.main_seed=="Discord_username"?`${encodeURI( FirstReqData.username )}:${encodeURI(session.user_data.extra_seed)}`:`${encodeURI(FirstReqData.avatar)}:${encodeURI(session.user_data.extra_seed)}`)}.svg?background=${session.user_data.background.replace('#', "%23")}&mood=${session.user_data.mood}`;
                    client.get("avatars.dicebear.com", path,{}, (SecondReqData) => {
                        
                        //cache the svg file from second api call
                        fs.writeFileSync(`./cached_avatars/${GETparams.state}.svg`, SecondReqData, () => {return});

                        // send Redirect to /show_avatar
                        resp.writeHead(302, { 'Content-Type': "text/html", "location":"/show_avatar" });
                        resp.end("success", 'utf-8');
                    });
                })
                
            })
        } )
    return
    }

    // WebServer.send404(resp)
    return
})


WebServer.register("/show_avatar", (req, resp) => {
    WebServer.send200File(resp, "./public/show.html")
})

WebServer.register("/avatar", (req, resp) => {
    const ln_cookies = cookies.parseCookies(req.headers.cookie)
    fs.readFile(`./cached_avatars/${ln_cookies.state}.svg`, (err, content)  => {
        resp.writeHead(200, { 'Content-Type': "image/svg+xml"});
        resp.end(content, 'utf-8'); 
    })
})
/*------------------------------------------------------*/
WebServer.start();

