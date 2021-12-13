module.exports = {

    
    //server settings
    port: 3000,
    domain: "http://localhost",
    static_image_endpoint: "img",

    //cache settings
    cacheFile:"cache.json",

    //Discord API 3L Oauth Settings

    //Register you Application from 
    //https://discord.com/developers/applications
    client_id:"",
    client_secret:"", // as the name implies, this must stay a secret

    discord_api_domain: "https://discord.com",
    base_Oauth_endpoint: "/api/oauth2/authorize",
    token_exchange_endpoint:"/api/oauth2/token",
    scopes_needed: "identify",
    callBackURI: "http://localhost:3000/get_avatar"
}