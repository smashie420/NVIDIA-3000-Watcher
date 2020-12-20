const readline = require("readline")
const fs = require("fs")
const path = require('path')
const nodemailer = require("nodemailer") // For sms
const colors = require("colors")

let consoleTitle = "[NVIDIA WATCHER] ".cyan
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function stringToBoolean(string){
  switch(string.toLowerCase().trim()){
      case "true": case "yes": case "1": case "y": return true;
      case "false": case "no": case "0": case "n": case null: return false;
      default: return Boolean(string);
  }
}
async function sendMail(data){
  try{
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        auth: {
            user: data.gmailUser,
            pass: data.gmailPass,
        },
        tls: {
            rejectUnauthorized: false
        }
    });
    
    let info = await transporter.sendMail({
        from: 'NVIDIA 3000 Watcher <random@gmail.com>', // sender address
        to: data.sms, // list of receivers
        text: "Test SMS message, if you recieved this congratz", // plain text body
        
    })
    
    console.log(consoleTitle + "Message sent: %s", info.messageId)
     
    }catch(err){
        console.log(consoleTitle + err)
    }
}
let urls = [];
let discrodWebHook;

function starter(){
  rl.question(consoleTitle + "Enter Url: ", function saveInput(url){
    urls.push(url)
    enterMoreUrls()
  })
}
function enterMoreUrls(){
  rl.question(consoleTitle + "Would you like to enter another url? (y/n): ", function saveInput(userInput){
    if(stringToBoolean(userInput)){
      rl.question(consoleTitle + "Enter Url: ", function saveInput(url) {
        urls.push(url)
        enterMoreUrls() 
      })
    }else{
      askWebhook()
    }
  })
}
function askWebhook(){
  rl.question(`${consoleTitle}Do you want to use discord webhooks? (y/n): `, function saveInput(webhooksOption){
    if(stringToBoolean(webhooksOption)){
      rl.question(`${consoleTitle} Enter Webhook URL: `, function saveInput(webhookURL){
        discrodWebHook = webhookURL
        runQuestions()
      })
    }else{
      discrodWebHook = ""
      runQuestions()
    }
  })
}

function runQuestions(){
    
  
  rl.question(consoleTitle + "Enter Phone Number: ", function saveInput(phoneNum){
    console.log(consoleTitle + "List of Carriers: AT&T, Verizon, Sprint, TMobile, Virgin Mobile, Nextel, Boost, Alltel, EE")
    rl.question(consoleTitle + "Enter Carrier: ", function saveInput(carrier){
      console.log(consoleTitle + "We need your gmail credentials to send SMS\n" + consoleTitle + "Gmail Username should be something like johndoe@gmail.com")
      rl.question(consoleTitle + "Gmail username: ", function saveInput(gmailUser){
        rl.question(consoleTitle + "Gmail Password: ", function saveInput(gmailPass){
          rl.question(consoleTitle + "Would you like to test SMS? (y/n): ", async function saveInput(testEmail){
            var sms = () => {
              switch(carrier.toLocaleLowerCase().trim()){
                case "at&t": return phoneNum+"@txt.att.net"
                case "verizon": return phoneNum+"@vtext.com"
                case "sprint": return phoneNum+"@messaging.sprintpcs.com"
                case "tmobile": return phoneNum+"@tmomail.net"
                case "virgin mobile": return phoneNum+"@vmobl.com"
                case "nextel": return phoneNum+"@messaging.nextel.com"
                case "boost": return phoneNum+"@myboostmobile.com"
                case "alltel": return phoneNum+"@message.alltel.com"
                case "ee": return phoneNum+"@mms.ee.co.uk"
                default: return "Invalid Carrier Input"
              }
            } 
            
            let data = {
              url : urls,
              phoneNum : phoneNum,
              carrier : carrier,
              sms : sms(),
              gmailUser: gmailUser,
              gmailPass: gmailPass,
              discordwebhook : discrodWebHook
            }
            fs.writeFileSync(path.resolve(__dirname, 'data.json'), JSON.stringify(data));
            
            if(stringToBoolean(testEmail)){
              await sendMail(data)
            }

            rl.close();
          })
        })
      })
    })
  });

  rl.on("close", function saveInput() {
      console.log("\n[NVIDIA WATCHER] Saved to data.json");
      process.exit(0);
  });
}

// Checks if data.json exists
if(fs.existsSync("data.json")){
  let warningTxt = "CONTINUING WILL DELETE CURRENT DATA! ".red
  rl.question(consoleTitle + warningTxt + "Data already exists, do you want to continue? (Y/N): ", function saveInput(input){
    var inputBool = stringToBoolean(input);
    if(inputBool){
      starter()
    }else{
      process.exit(0)
    }
  })
}

starter()
