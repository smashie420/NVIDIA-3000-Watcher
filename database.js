const readline = require("readline")
const fs = require("fs")
const path = require('path')
const nodemailer = require("nodemailer") // For sms
const colors = require("colors")
const { Webhook, MessageBuilder } = require('discord-webhook-node');

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
      rl.question(`${consoleTitle}Enter Webhook URL: `, function saveInput(webhookURL){
        rl.question(`${consoleTitle}Do you want to test the discord webhook? (y/n): `, function saveInput(testWebhook){
          if(stringToBoolean(testWebhook)){
            testDiscordWebhook(webhookURL)
          }
          discrodWebHook = webhookURL
          runQuestions()
        })
      })
    }else{
      discrodWebHook = ""
      runQuestions()
    }
  })
}
function testDiscordWebhook(hookUrl){
    const hook = new Webhook(hookUrl);
    const IMAGE_URL = 'https://viterbicareers.usc.edu/wp-content/uploads/2019/01/Nvidia-Logo.jpg';
    hook.setUsername('NVIDIA WATCHER');
    hook.setAvatar(IMAGE_URL);

    const embed = new MessageBuilder()
    .setTitle('🤖 WEBHOOK TEST')
    .setDescription(`If you see this, this means that the webhook is setup and ready to go!, look at readme.md for info on how to run me`)
    .setURL(`https://github.com/smashie420/NVIDIA-3000-Watcher`)
    .setColor('#add8e6')
    .setFooter('Made by smashguns#6175', 'https://cdn.discordapp.com/avatars/242889488785866752/40ee66d845e1a6341e03c450fcf6d221.png?size=256')
    .setTimestamp();

    hook.send(embed).catch(error =>{
        if(error){
            console.error(error)
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
