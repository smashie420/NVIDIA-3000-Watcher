const axios = require('axios') // For web scraping
const fs = require('fs') // For reading files
const spawn = require('child_process') // For automaticlly opening database.json
const cheerio = require('cheerio') // Webscraping
const nodemailer = require("nodemailer") // For sms
let request = require("request"); // For url shortener
const colors = require("colors")
const { Webhook, MessageBuilder } = require('discord-webhook-node');


let consoleTitle = "[NVIDIA WATCHER] ".cyan

function format(seconds) { //https://stackoverflow.com/questions/28705009/how-do-i-get-the-server-uptime-in-node-js
    function pad(s) {
        return (s < 10 ? '0' : '') + s;
    }
    var hours = Math.floor(seconds / (60 * 60));
    var minutes = Math.floor(seconds % (60 * 60) / 60);
    var seconds = Math.floor(seconds % 60);

    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

function runScript(scriptPath, callback) {
    // keep track of whether callback has been invoked to prevent multiple invocations
    var invoked = false
    var process = spawn.fork(scriptPath)
        // listen for errors as they may prevent the exit event from firing
    process.on('error', function(err) {
        if (invoked) return
        invoked = true
        callback(err)
    });
    // execute the callback once the process has finished running
    process.on('exit', function(code) {
        if (invoked) return
        invoked = true
        var err = code === 0 ? null : new Error('exit code ' + code)
        callback(err)
    });
}

/* Some Carriers block url shorteners (which is why its not used)
function shortenURL(urlToShorten) {
    let linkRequest = {
        destination: urlToShorten,
        domain: { fullName: "rebrand.ly" }
    }

    let requestHeaders = {
        "Content-Type": "application/json",
        "apikey": "5bfe7d77ff024b048f1bbfbb123da651",
    }
    request({
        uri: "https://api.rebrandly.com/v1/links",
        method: "POST",
        body: JSON.stringify(linkRequest),
        headers: requestHeaders
    }, async(err, response, body) => {
        let link = await JSON.parse(body);
        // console.log(`Long URL was ${link.destination}, short URL is ${link.shortUrl}`);
        return link.shortUrl;
    })
}
*/

async function sendMail(gmailUser, gmailPass, recipiant, message) {
    try {
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            auth: {
                user: gmailUser,
                pass: gmailPass,
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        let info = await transporter.sendMail({
            from: 'NVIDIA 3000 Watcher <random@gmail.com>', // sender address
            to: recipiant, // list of receivers
            text: message, // plain text body

        })
        console.log(consoleTitle + "Message sent: %s", info.messageId)
    } catch (err) {
        console.log(consoleTitle + "sendMail() ERROR " + err)
    }
}

async function webScrape(url) {
    //                            HTTPS:// || HTTP://       www.                        .com .net .org                  
    let site = await url.replace(/(^\w+:|^)\/\//, "").replace("www.","").split(/(?:.com|.org|.net)[/?#]/)[0].toLowerCase() // to get domain host name
    try{
        const html = await axios({
            url: url,
            method: 'get',
            raxConfig: {
                retry: 3,
                retryDelay: 4000
            }
        })
       
        //const html = await axios.get(url);
        const $ = await cheerio.load(html.data);

        if(site == "bestbuy"){
            var datahtml = {
                url: url,
                site: site,
                title: $('div.sku-title h1').text(),
                shortTitle: $('div.sku-title h1').text().split(' ').slice(0,7).join(' '),
                price: $('div.priceView-customer-price span').first().text(),
                rating: $('span.ugc-c-review-average').text(),
                button: $('div button.add-to-cart-button').text(),
            }
        }else{
            var datahtml = {
                url: url,
                site: site,
                title: "NOT SUPPORTED",
                shortTitle: "NOT SUPPORTED",
                price: "NOT SUPPORTED",
                rating: "NOT SUPPORTED",
                button: "NOT SUPPORTED",
            }
            return datahtml
        }
        /* Newegg has bot protection sadly :C https://i.imgur.com/eM7Wua7.png
        if(site == "newegg"){
            var datahtml = {
                url: url,
                site: site,
                title: $('div.product-wrap h1.product-title').text(),
                shortTitle: $('div.product-wrap h1.product-title').text().split(' ').slice(0,7).join(' '),
                button: $('div.product-inventory strong').text().normalize("NFKC"),
            } 
        }
        */
        //console.log(datahtml) 
        return datahtml
    }
    
    catch (error){
        console.error(error.statusText)
    }
}

async function writeLog(text){
    let date_ob =  new Date();
    // YYYY-MM-DD HH:MM:SS format
    let formattedTime = date_ob.getFullYear() + "-" + (date_ob.getMonth() + 1) + "-" + ('0'+date_ob.getDate()).slice(-2) + " " + ('0' + date_ob.getHours()).slice(-2) + ":" + ('0' + date_ob.getMinutes()).slice(-2) + ":" +  ('0'+date_ob.getSeconds()).slice(-2)  +  "       "

    if(fs.existsSync("stock-logs.txt")){
        fs.appendFile('stock-logs.txt', "\n"+formattedTime + text, function (err) {
            if (err) throw (err)
        })
    }else{
        fs.writeFile('stock-logs.txt', formattedTime + text, function (err) {
            if (err) throw (err)
        })
    }
}

function checkStockTxt(txtFromSite){
    switch(txtFromSite.trim()){
        case "In stock.": case "Add to Cart": return true;
        default: return false;
    }
}
function sendWebHook(hookUrl, productSite, productURL, productShortTitle, productPrice, productRating){
    
    let date_ob =  new Date();
    // YYYY-MM-DD HH:MM:SS format
    let formattedTime = date_ob.getFullYear() + "-" + ('0'+date_ob.getMonth()).slice(-2) + "-" + ('0'+date_ob.getDate()).slice(-2) + " " + ('0' + date_ob.getHours()).slice(-2) + ":" + ('0' + date_ob.getMinutes()).slice(-2) + ":" +  ('0'+date_ob.getSeconds()).slice(-2)

    // Converts number rating into stars
    productRating = Math.fround(parseInt(productRating)) + 1
    let stars = ""
    for(let i = 0; i < productRating; i++){
        stars += "⭐"
    }
    const hook = new Webhook(hookUrl);
    const IMAGE_URL = 'https://viterbicareers.usc.edu/wp-content/uploads/2019/01/Nvidia-Logo.jpg';
    hook.setUsername('NVIDIA WATCHER');
    hook.setAvatar(IMAGE_URL);

    const embed = new MessageBuilder()
    .setTitle('📈 STONK ALERT ' + formattedTime)
    //.setDescription(` <@242889488785866752> \`${productSite.toUpperCase()} ${productShortTitle}\` **IS IN STOCK**`)
    .setURL(`${productURL}`)
    .setColor('#33FF00')
    
    .addField('Product', `\`${productShortTitle}\``, true)
    .addField('Price', `\`${productPrice}\``, true)
    .addField('Reviews', `${stars}`, true)
    .setFooter('Made by smashguns#6175', 'https://cdn.discordapp.com/avatars/242889488785866752/40ee66d845e1a6341e03c450fcf6d221.png?size=256')
    .setTimestamp();

    hook.send(embed).catch(error =>{
        if(error){
            console.error(error)
        }
    })
}

// https://stackoverflow.com/questions/48432102/discord-js-cooldown-for-a-command-for-each-user-not-all-users  
// Thanks for posting that ^ ive been using arrays instead of sets which breaks stuff
function cooldown(url){
    inCoolDownArr.add(url)
    setTimeout(() => {
        inCoolDownArr.delete(url)
    },cooldownTime)
}

var checkEvery = 1000 * 4 // seconds
var cooldownTime = 60000 * 5 // minutes
var i = 0
const inCoolDownArr = new Set();

async function myLoop() {
    let rawdata = fs.readFileSync('data.json')
    let data = JSON.parse(rawdata)
    let urlArr = data["url"]
    let reciever = data["sms"]
    let gmailUser = data['gmailUser']
    let gmailPass = data['gmailPass']
    let webhook = data['discordwebhook']
    
    

    await urlArr.forEach( async function(url, index) {
        setInterval(async function(){
            await setTimeout( async function(){
                if(inCoolDownArr.has(url)){return} // Put this above everything so it doesnt run a webScrape, takes up valuable time

                var data = await webScrape(url)
                if(data.title == "NOT SUPPORTED") {console.log(`${consoleTitle}${colors.red(`${data.site} NOT SUPPORTED!`)}`); return} // Check if website is supported

                if(await checkStockTxt(data.button)){ 
                    console.log(`${consoleTitle}[${colors.magenta(data.site.toUpperCase())}] ${data.shortTitle} :: ${colors.green(data.button)} :: Run: ${i} :: Uptime: ${format(process.uptime())}`)
                    console.log(colors.yellow(`${consoleTitle}[${data.site.toUpperCase()}] ${data.shortTitle} is now on cooldown for ${cooldownTime / 60000 }m!`)) // CooldownTime is divided by 60000 because time math
                    await sendMail(gmailUser, gmailPass, reciever, `IN STOCK! [${data.site.toUpperCase()}] ${data.shortTitle}`) // Sends mail to recipiant which is in data.json
                    await writeLog(`[STOCK] [${data.site.toUpperCase()}] ${data.shortTitle}`) // Writes to stock-logs.txt
                    if(webhook){ sendWebHook(webhook, data.site, data.url, data.shortTitle, data.price, data.rating)} // Sends webhook
                    await cooldown(url) // Runs cooldown
                    
                }
                else{ console.log(`${consoleTitle}[${colors.magenta(data.site.toUpperCase())}] ${data.shortTitle} :: ${colors.red(data.button)} :: Run: ${i} :: Uptime: ${format(process.uptime())}`) }
                i++
            }, index * checkEvery) // I used `index * checkEvery` so each site has atleast `checkEvery` seconds before running another site
        },5000)
    })
}

if (!fs.existsSync("data.json")) {
    runScript("./database.js", function(err) {
        if (err) throw err;
        clearInterval(timer);
        console.log(`${consoleTitle}finished running database.js`)
    })
} else {
    myLoop()
}