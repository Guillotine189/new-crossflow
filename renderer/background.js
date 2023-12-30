// background.js
const path = require('path')
const nodemailer = require('nodemailer');
const fs = require('fs');
const json = require('json');
const cron = require('node-cron');
const Store = require('electron-store');
const moment = require('moment-timezone');

const store = new Store();

let MainUsername;
let MainPassword;
let datetime;
let LoggedInWith;
let attachmentArr;

let attachmentRam = [];
let attachmentNames = [];


const childProcessesFilePath = 'childProcesses.json';
const childProcessesEmailDataPath = 'childProcessesEmailData.json';
const sentMailSchedulePath = 'scheduleSentMail.json'

function startBackgroundProcess(data) {
  let attachmentPaths = data[4]
  const localTimezone = moment.tz.guess();
  console.log(localTimezone)
  console.log('started background process')

  // setTimeout(() => {
  //   exitChildProcess()
  //   console.log('Timeout reached! Do something here.');
  // }, 3000000);

  attachmentNames = [];
  if(attachmentPaths.length > 0){
    let arrName = [];
    let pathName = [];
    attachmentPaths.forEach(filepath => {
      arrName.push(path.basename(filepath));
      pathName.push(filepath);
      attachmentRam.push({ filename: path.basename(filepath), content: fs.readFileSync(filepath) });
      attachmentNames.push(path.basename(filepath));
    })
  }else{
    attachmentRam = []
  }


  console.log(data)
  cron.schedule(data[0], () => {
    sendScheduledEmail(data);
  }, {
    scheduled: true,
    timezone: localTimezone,
  });
}


async function returnAttachments(){
  return attachmentRam
}


process.on('message', (message) => {
  console.log('Received message from main process:', message);


  // const originalString = message;
  // const encodedString = Buffer.from(originalString).toString('base64');
  // console.log('Encoded:', message);
  // const decodedString = Buffer.from(message, 'base64').toString('utf-8');


  MainUsername = message[0]
  MainPassword = message[1]
  LoggedInWith = message[2]

  const datetime = message[3][0]
  const recipient = message[3][1]
  const subject = message[3][2]
  const text = message[3][3]
  attachmentArr = message[3][4]
  console.log(recipient, subject, text, attachmentArr)
  console.log('indside child process')
  startBackgroundProcess([datetime,recipient,subject,text,attachmentArr])
});


async function sendScheduledEmail(data){
  console.log('STARTING SCHEDULE MAIL DELIVERY')
  let [scheduledTimeCron, Emailrecipient, Emailsubject, Emailbody, attachmentPaths] = data
  console.log('indside sending final mail')
  console.log(scheduledTimeCron, Emailrecipient, Emailsubject, Emailbody, attachmentPaths)

  EmailrecipientList = Emailrecipient.split(' ')
  const gmail_smtpPort = 587;
  const gmail_smtpServer = 'smtp.gmail.com';
  const outlook_smtpServer = 'smtp-mail.outlook.com'
  const outlook_smtpPort = 587
  const yahoo_smtpPort = 587;
  const yahoo_smtpServer = 'smtp.mail.yahoo.com';
  let server;
  let port;

  if(LoggedInWith == 'Gmail'){
    server = gmail_smtpServer
    port = gmail_smtpPort
  }else if(LoggedInWith == 'Outlook'){
    server = outlook_smtpServer
    port = outlook_smtpPort
  }else if(LoggedInWith == 'Yahoo'){
    server = yahoo_smtpServer
    port = yahoo_smtpPort
  }

  const transporter = nodemailer.createTransport({
    host: server,
    port: port,
    secureConnection: true,
    auth: {
      user: MainUsername,
      pass: MainPassword,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });


  try {
    console.log('Connecting to server..');
    await transporter.verify();
    console.log('Connected to server!\n');
      
    for (let everyEmailRecipient of EmailrecipientList) {
      if(everyEmailRecipient === ''){
        console.log('got a blank username. SKIPPING!!')
        continue
      }

      const mailOptions = {
        from: MainUsername,
        to: everyEmailRecipient,
        subject: Emailsubject,
        text: Emailbody,
        attachments: await returnAttachments()
      };

      console.log(`Sending email to ${everyEmailRecipient}`);
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${everyEmailRecipient}`);



      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', options);
      console.log(formattedDate);
      mailOptions.date = `${formattedDate}`

      if(mailOptions.attachments.length > 0){
        mailOptions.attachments = attachmentNames
      }else{
        mailOptions.attachments = 0
      }
      console.log(mailOptions)
      console.log('original LIST SENT')
      // get the sent email every time
      let sentMailSchedule = getSentScheduledemail()
      console.log('got the sent list')
      console.log(sentMailSchedule)
      sentMailSchedule.splice(0,0,mailOptions)
      fs.writeFileSync(sentMailSchedulePath, JSON.stringify(sentMailSchedule)); 

      sentMailSchedule = getSentScheduledemail()
      console.log('After adding email data')
      console.log(sentMailSchedule)
      
    }

  } catch (error) {
    console.error(error);
  } finally {
    transporter.close();
    console.log('Connection closed.\n');
    exitChildProcess()
  }

}

function exitChildProcess() {
  const currentProcessId = process.pid;

  removeScheduledEmail(currentProcessId)

  process.exit();
}

function removeChildProcessPid(childProcessId) {

  let childProcesses = getStoredChildProcesses();

  childProcesses = childProcesses.filter(id => id !== childProcessId);
  fs.writeFileSync(childProcessesFilePath, JSON.stringify(childProcesses)); // remove from file
  console.log('removed childProcess with id ' + childProcessId)
}

function removeChildProcessEmailData(childProcessId) {

  let childProcesses = getStoredChildProcesses();
  const index = childProcesses.indexOf(childProcessId) // get index from the pid list
  let scheduleEmails = getStoredChildProcessesEmaildata()
  console.log('before removing from child process')
  console.log(scheduleEmails)
  scheduleEmails.splice(index,1)
  console.log('after')
  console.log(scheduleEmails)
  fs.writeFileSync(childProcessesEmailDataPath, JSON.stringify(scheduleEmails)); // remove email data file
  console.log('removed email data')

}

function removeScheduledEmail(pid){
  removeChildProcessEmailData(pid) // remove this first 
  removeChildProcessPid(pid)
}


function getStoredChildProcesses() {
  try {
    const data = fs.readFileSync(childProcessesFilePath);
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function getStoredChildProcessesEmaildata(){
  try {
      const data = fs.readFileSync(childProcessesEmailDataPath);
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
}


function getSentScheduledemail(){
  try {
    const data = fs.readFileSync(sentMailSchedulePath);
    console.log(data)
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}