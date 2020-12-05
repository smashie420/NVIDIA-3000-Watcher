const axios = require('axios') // For web scraping
const fs = require('fs') // For reading files
const spawn = require('child_process') // For automaticlly opening database.json
const cheerio = require('cheerio') // Webscraping
const nodemailer = require("nodemailer") // For sms
let request = require("request"); // For url shortener
const colors = require("colors")

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

async function webScrape(url, callback) {
        const html = await axios.get(url);
        const $ = await cheerio.load(html.data);

        var datahtml = {
            url: url,
            title: $('div.sku-title h1').text(),
            button: $('div button.add-to-cart-button').text(),
        }
        callback(datahtml)
}

var i = 0;
var minutesToCoolDown = 5 // 5 minutes
var MilisecondsToMin = minutesToCoolDown * 60000

function myLoop() {
    let rawdata = fs.readFileSync('data.json')
    let data = JSON.parse(rawdata)
    let urlArr = data["url"]
    let sms = data["sms"]
    let gmailUser = data['gmailUser']
    let gmailPass = data['gmailPass']

    urlArr.forEach(async url => {
        var timer = await setInterval(async() => {
            await webScrape(url, async function(res){ // Start the web scraping and return result
                //res = { url, title, button }
                let shortTitle = await res.title.split(' ').slice(0,7).join(' ') // Shortened title so its readable in SMS :D

                if(res.button == "Add to Cart"){ // If button from bestBuy = Add to Cart then
                    let stockTxt = "IN STOCK".green
                    console.log(`${consoleTitle}${shortTitle} :: ${stockTxt} :: Run: ${i} :: Uptime:${await format(process.uptime())}`)
                    await sendMail(gmailUser, gmailPass, sms, `IN STOCK! ${shortTitle}`)
                    let yellowtxt = `cooldown for ${minutesToCoolDown}m!`.yellow
                    console.log(`${consoleTitle}${shortTitle} is now on ${yellowtxt}`)
                    
                    await setTimeout(() => {
                        let outOfCoolDownMagenta = consoleTitle + shortTitle.magenta + " is now out of cooldown" .magenta
                        console.log(outOfCoolDownMagenta)
                        myLoop()
                    }, MilisecondsToMin);
                    clearInterval(timer)

                }else{
                    let outOfStockTxt = "OUT OF STOCK".red
                    console.log(consoleTitle + `${shortTitle} :: ${outOfStockTxt} :: Run: ${i} :: Uptime:${await format(process.uptime())}`)
                }
            })
            i++
        }, 2500)
    })
}

if (!fs.existsSync("data.json")) {
    runScript("./database.js", function(err) {
        if (err) throw err;
        clearInterval(timer);
        console.log(consoleTitle + "finished running database.js")
    })
} else {
    myLoop()
}