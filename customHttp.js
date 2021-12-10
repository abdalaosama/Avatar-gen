var http = require('http');
var https = require('https')
var fs = require('fs');
var path = require('path');
const config = require('./config');

class WebServer {
    constructor(){
        // super();
        this.port = config.port
        this.endpoints = []
    }

    register(EndPoint, Callback){ // adds endpoint to routing;
        this.endpoints.push({url: EndPoint, cb: Callback});
    }

    start(){
        http.createServer((req, resp) => {
            try{
            for(let i = 0; i < this.endpoints.length;i++){

                if(req.url.split('/')[1] == config.static_image_endpoint){
                    const filename = req.url.split('/')[2];
                    var extname =  path.extname(filename);
                    var contentType = 'text/html';
                    switch (extname) {
                        
                        case '.png':
                            contentType = 'image/png';
                            break;      
                        case '.jpg':
                            contentType = 'image/jpg';
                            break;
                    }
                    fs.readFile('./public/img/'+ req.url.split('/')[2], (error, content) => {
                        if(error) {return this.send404(resp);}

                        resp.writeHead(200, { 'Content-Type': contentType });
                        resp.end(content, 'utf-8');
                        return
                        
                    })
                    return

                }
                
                if(this.endpoints[i].url == (req.url.split('?')[0].toString())){
                    this.endpoints[i].cb(req, resp);
                    return
                }

            }
            return this.send404(resp);
            // const EndpointIndex = this.endpoints.findIndex( x =>{ x.url !=})
        }
        catch(err){
            console.log(err)
            this.send404(resp)
        }
        }).listen(config.port)
        console.log(`Server started @ ${config.domain}:${config.port}/`);
    }

    send404(resp){
        fs.readFile('./public/404.html', function(error, content) {
            resp.writeHead(404, { 'Content-Type': "text/html" });
            resp.end(content, 'utf-8');
        });
    }

    send200File(resp, file){
        fs.readFile(file, function(error, content) {
            if(error) {return this.send404(resp);}

            resp.writeHead(200, { 'Content-Type': "text/html" });
            resp.end(content, 'utf-8');
        });
    }

    sendMessage(resp, message){
        resp.writeHead(200, { 'Content-Type': "text/html" });
        resp.end(message, 'utf-8');
    }
}


module.exports.server = WebServer
module.exports.client = {
    post: function(hostName, path, data, headers, callBack){
          
          const options = {
            hostname: hostName,
            port: 443,
            path: path,
            method: 'POST',
            headers: headers
          }
          
          const req = https.request(options, res => {
            // console.log(res)
            let data =""
            res.on('data', d => {
                data = data + d
            })
            res.on('end',(x)=>{
                callBack(data)
            })
          })
          
          req.on('error', error => {
            throw error
          })
          
          req.write( data )
          req.end()
          return
    },
    get: function(hostName, path, headers, callBack){
          
        const options = {
            hostname: hostName,
            path: path,
            method: 'GET',
            headers : headers
          }
          
          const req = https.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`)
            let data =""
            res.on('data', d => {
                data = data + d
            })
            res.on('end',(x)=>{
                callBack(data)
            })
          })
          
          req.on('error', error => {
            console.error(error)
          })
          
          req.end()
        return
    },
    JSONtoXformat: JSONtoXformat
}

function JSONtoXformat(json){
    const Keys = Object.keys(json);
    let data ="";
    Keys.forEach(x => {
        data = `${data}${encodeURI(x)}=${encodeURI(json[x])}&`
    })
    data = data.slice(0, -1); // to remove the extra & at the end
    return data;
}
