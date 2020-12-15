const axios = require('axios') // For web scraping
const fs = require('fs') // For reading files
const spawn = require('child_process') // For automaticlly opening database.json
const cheerio = require('cheerio') // Webscraping
const nodemailer = require("nodemailer") // For sms
let request = require("request"); // For url shortener
const colors = require("colors")
const { stringify } = require('querystring')
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

    var datahtml = {
        url: url,
        title: $('div.sku-title h1').text(),
        button: $('div button.add-to-cart-button').text(),
    }
    return datahtml
    }
    catch (error){
        console.error(error.statusText)
    }
}

async function writeLog(text){
    let date_ob =  new Date();
    // YYYY-MM-DD HH:MM:SS format
    let formattedTime = date_ob.getFullYear() + "-" + ('0'+date_ob.getMonth()).slice(-2) + "-" + ('0'+date_ob.getDate()).slice(-2) + " " + ('0' + date_ob.getHours()).slice(-2) + ":" + ('0' + date_ob.getMinutes()).slice(-2) + ":" +  ('0'+date_ob.getSeconds()).slice(-2)  +  "       "

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

var checkEvery = 1000 * 5 // seconds
var cooldownTime = 60000 * 5 // minutes
var i = 0 // For counting how many times myloop() been called
function myLoop() {
    let rawdata = fs.readFileSync('data.json')
    let data = JSON.parse(rawdata)
    let urlArr = data["url"]
    let sms = data["sms"]
    let gmailUser = data['gmailUser']
    let gmailPass = data['gmailPass']
        urlArr.forEach( url => {
            var timer = setInterval(async () => {
                try{
                    var webScrapeRes = await webScrape(url)  // Start the web scraping and return result || webScrapeRes = { url, title, button } 
                    if(webScrapeRes == null && webScrapeRes == "") {return}
                    let shortTitle = webScrapeRes.title.split(' ').slice(0,7).join(' ') // Shortened title so its readable in SMS :D
                    if(webScrapeRes.button == "Add to Cart"){ // If button from bestBuy = Add to Cart then
                        
                        console.log(`${consoleTitle}${shortTitle} :: ${colors.green("IN STOCK")} :: Run: ${i} :: Uptime: ${format(process.uptime())}`)
                        console.log(colors.yellow(`${consoleTitle}${shortTitle} is now on  cooldown for ${cooldownTime / 60000 }m!`)) // CooldownTime is divided by 60000 because time math
                        await sendMail(gmailUser, gmailPass, sms, `IN STOCK! ${shortTitle}`)
                        await writeLog("[STOCK] " + shortTitle) // Writes to stock-logs.txt

                        await setTimeout(() => {
                            console.log(colors.magenta(`${consoleTitle}${shortTitle} is now out of cooldown` ))
                            myLoop()
                        }, cooldownTime);
                        
                        await clearInterval(timer)
                    }else{
                        console.log(`${consoleTitle}${shortTitle} :: ${colors.red("OUT OF STOCK")} :: Run: ${i} :: Uptime: ${format(process.uptime())}`)
                    }
                    i++
                }catch(err){
                    console.error(err)
                }
            }, checkEvery)
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