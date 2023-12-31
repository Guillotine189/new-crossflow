const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path')
const nodemailer = require('nodemailer');
const fs = require('fs');
const json = require('json');
const csv = require('csv-parser');
const cron = require('node-cron')
const moment = require('moment-timezone');
const { fork } = require('child_process');
const cronstrue = require('cronstrue');
const cronParser = require('cron-parser');
const { format } = require('date-fns');


const isMac = process.platform === 'darwin';

let mainWindow;
let verified=false
let MainUsername = 'TESTING';
let MainPassword;
let LoggedInWith;
let CurrentPath = path;

let EmailtoSendTo = ['sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com', 'sarthaksinghal@proton.me', 'Guillotine189@outlook.com' 
  ];
let sentEmails = [];
let draftedEmails = [];
let folderList = [];

let scheduleEmailsPid = [];
let scheduleEmails = [];

const childProcessesFilePath = 'childProcesses.json';  // path of a running process containing pid
const childProcessesEmailDataPath = 'childProcessesEmailData.json'; // data of the runngin process
const sentMailSchedulePath = 'scheduleSentMail.json' // data by completed process

const EmailtoSendToPath = 'emailHome.json'
const sentMailPath = 'sentMail.json'
const draftedEmailPath = 'draftedMails.json'
const folderDataPath = 'folders.json'

let ChildProcessId = getStoredChildProcesses();

function createMainWindow(){
	mainWindow = new BrowserWindow({
		title: 'Email Client',
		width: 1600, // 1100 correct size without dev tools
		height: 900,
    autoHideMenuBar: true,
		webPreferences: {
		  contextIsolation: true,
		  nodeIntegration: true,
      // enableRemoteModule: true,
	      preload: path.join(__dirname, 'preload.js')
	    }
	});
}




app.whenReady().then(()=> {
  createMainWindow();
  mainWindow.loadFile(path.join(__dirname,'./renderer/choose_email.html'));
  mainWindow.webContents.openDevTools();

  // read scheduled messages
  scheduleEmails = getStoredChildProcessesEmaildata()
  scheduleEmailsPid = getStoredChildProcesses()


  // read all other variables
  EmailtoSendTo = getVariableData(EmailtoSendToPath)
  sentEmails = getVariableData(sentMailPath)
  draftedEmails = getVariableData(draftedEmailPath)
  folderList = getVariableData(folderDataPath)

  // check if the pid indside file (if any) are 
  // const currentPidList = getStoredChildProcesses()
  // currentPidList.forEach((pid) => {
  //   if(isProcessRunning(pid)){}
  //     else{
  //       alert('SOME SCHEDULED EMAILS HAVE BEEN DEPRICIATED')
  //     }
  // })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()

    }
  });

});

function isProcessRunning(pid) {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {

      exec(`tasklist /FI "PID eq ${pid}"`, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.includes(pid.toString()));
        }
      });
    } else {

      exec(`ps -p ${pid}`, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.includes(pid.toString()));
        }
      });
    }
  });
}


let anyFilePath;
async function openDialog() {
  return new Promise((resolve, reject) => {
    dialog.showOpenDialog({
      properties: ['openFile', 'singleSelection'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
      ],
    })
      .then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
          resolve(result.filePaths[0]);
          anyFilePath = result.filePaths[0]
        } else {
          reject(new Error('No file selected or dialog was canceled'));
        }
      })
      .catch(err => {
        reject(err);
      });
  });
}


let csvFilePath;
function openCSVFileDialog() {
  return new Promise((resolve, reject) => {
    dialog.showOpenDialog({
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
      ],
      properties: ['openFile'],
    })
      .then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
          resolve(result.filePaths[0]);
          csvFilePath = result.filePaths[0]
        } else {
          reject(new Error('No file selected or dialog was canceled'));
        }
      })
      .catch(err => {
        reject(err);
      });
  });
}

let csvData = [];
function readCSVFile(filePath) {
  const results = [];

  csvData = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => {
      // Convert each entry in the CSV to a key in the JSON object with an empty string value
      results.push(data)
    })
    .on('end', () => {
      console.log(results)
      csvData = results;
      let emailList = [];
      console.log(results.length)
      for(let i=results.length-1; i>=0; i--){
        if (results[i].Email) {
          emailList.push(results[i].Email);
        }

        if (results[i].Emails) {
          emailList.push(results[i].Emails);
        }
        if (results[i].email) {
          emailList.push(results[i].email);
        }

        if (results[i].emails) {
          emailList.push(results[i].emails);
        }
        console.log(results[i].Email)
      }
      console.log('this is elail list data')
      console.log(emailList)
      console.log('this is variable data')
      console.log(csvData);
      mainWindow.webContents.executeJavaScript(`addEmailFromFile("${emailList}")`);
    });
}




ipcMain.on('authenticate-gmail', async (event, data) => {

	const username = data[0];
	const password = data[1];
	// console.log(username,password)
  console.log('GMAIL LOGIN TRIED')

  const gmail_smtpPort = 587;
  const gmail_smtpServer = 'smtp.gmail.com';

  const transporter = nodemailer.createTransport({
    host: gmail_smtpServer,
    port: gmail_smtpPort,
    secureConnection: true,
    auth: {
      user: username,
      pass: password,
    }
  });

  try {
	console.log('verifying Cradentials');
    await transporter.verify();
    console.log('Cradentials verified')
    LoggedInWith='Gmail'
    MainUsername=username
    MainPassword=password
    verified=true
    mainWindow.loadFile(path.join(__dirname,'./renderer/home.html'))
    mainWindow.webContents.executeJavaScript(`updateUsername('${MainUsername}')`)
  } catch (error) {
    console.log('ERROR VERIFYING Cradentials')
    console.error(error);
    verified=false
    if(!verified){
      console.log('sending request to load notification for failed auth')
      mainWindow.webContents.executeJavaScript('validationFailed()')
    }
  } finally {
    transporter.close();
    console.log('Connection closed.\n');
  }

});


ipcMain.on('authenticate-outlook', async (event, data) => {
	
  const username = data[0];
  const password = data[1];
  // console.log(username,password)

  const outlook_smtpServer = 'smtp-mail.outlook.com'
  const outlook_smtpPort = 587

  const transporter = nodemailer.createTransport({
    host: outlook_smtpServer,
    port: outlook_smtpPort,
    secureConnection: true,
    auth: {
      user: username,
      pass: password,
    }
  });

  try {
	console.log('verifying Cradentials');
    await transporter.verify()
    // .then(() => {
    //   // Check if the connection is secure
    //   if (transporter.transporter.options.secureConnection) {
    //     console.log('Connection was secure.');
    //   } else {
    //     console.log('Connection is not secure.');
    //   }
    // })
    console.log('Cradentials verified')
    LoggedInWith='Outlook'
    MainUsername=username
    MainPassword=password
    verified=true
    mainWindow.loadFile(path.join(__dirname,'./renderer/home.html'))
    mainWindow.webContents.executeJavaScript(`updateUsername('${MainUsername}')`)
  } catch (error) {
    console.log('ERROR VERIFYING Cradentials')
    console.error(error);
    verified=false
    if(!verified){
      console.log('sending request to load notification for failed auth')
      mainWindow.webContents.executeJavaScript('validationFailed()')
    }
  } finally {
    transporter.close();
    console.log('Connection closed.\n');
    
  }

});


ipcMain.on('authenticate-yahoo', async (event, data) => {

	const username = data[0];
	const password = data[1];
	// console.log(username,password)

  const yahoo_smtpPort = 587;
  const yahoo_smtpServer = 'smtp.mail.yahoo.com';



  const transporter = nodemailer.createTransport({
    host: yahoo_smtpServer,
    port: yahoo_smtpPort,
    secureConnection: true,
    auth: {
      user: username,
      pass: password,
    }
  });

  try {
	console.log('verifying Cradentials');
    await transporter.verify();
    console.log('Cradentials verified')
    LoggedInWith='Yahoo'
    MainUsername=username
    MainPassword=password
    verified=true
    mainWindow.loadFile(path.join(__dirname,'./renderer/home.html'))
    mainWindow.webContents.executeJavaScript(`updateUsername('${MainUsername}')`)
  } catch (error) {
    console.log('ERROR VERIFYING Cradentials')
    console.error(error);
    verified=false
    if(!verified){
      console.log('sending request to load notification for failed auth')
      mainWindow.webContents.executeJavaScript('validationFailed()')
    }
  } finally {
    transporter.close();
    console.log('Connection closed.\n');
  }

});

let emailsBeingsent = false;
ipcMain.on('sendMail', async (event, data) => {

  if(!verified){
    console.log('not varified user, will not send mail')
    mainWindow.webContents.executeJavaScript('showNotificationTimeOut("YOU NEED TO LOGIN FIRST!")')
    return
  }

  mainWindow.webContents.executeJavaScript("showNotificationTimeOut('Sending email')")
  emailsBeingsent = true
  let [Emailrecipient, Emailsubject, Emailbody, attachmentPaths] = data

  EmailrecipientList = Emailrecipient.split(' ')
  // console.log(attachmentPaths)
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
      let attachmentNames = [];
      let myAttachments = [];
      if(attachmentPaths.length > 0){
        let arrName = [];
        let pathName = [];
        attachmentPaths.forEach(filepath => {
          arrName.push(path.basename(filepath));
          pathName.push(filepath);
          myAttachments.push({ filename: path.basename(filepath), content: fs.createReadStream(filepath) });
          attachmentNames.push(path.basename(anyFilePath));
        })
      }else{
        myAttachments = []
      }


      const mailOptions = {
        from: MainUsername,
        to: everyEmailRecipient,
        subject: Emailsubject,
        text: Emailbody,
        attachments: myAttachments
      };
      try{
        console.log(`Sending email to ${everyEmailRecipient}`);
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${everyEmailRecipient}`);
      }catch(error){
        console.log('not a valid email')
        continue
      }
        

      const options = { year: 'numeric', month: 'short', day: 'numeric' };

      today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', options);
      console.log(formattedDate);
      mailOptions.date = `${formattedDate}`

      if(mailOptions.attachments.length > 0){
        mailOptions.attachments = attachmentNames
      }else{
        mailOptions.attachments = 0
      }
      console.log(mailOptions)
      sentEmails.splice(0,0,mailOptions)
    }
  } catch (error) {
    console.error(error);
  } finally {
    transporter.close();
    console.log('Connection closed.\n');
    console.log('THIS IS SENT EMAILS')
    emailsBeingsent = false
    console.log(sentEmails)
  }

})


ipcMain.on('openCsv',async (event, data) => {
  openCSVFileDialog()
  .then(GotfilePath =>{
    csvFilePath = GotfilePath
    readCSVFile(csvFilePath)
  })
  
})

ipcMain.on('skipLogin', async (event,data) => {
  MainUsername='';
  MainPassword='';
  LoggedInWith='';
  verified=false;

  mainWindow.loadFile(path.join(__dirname,`./renderer/home.html`));
})


ipcMain.on('logout',async (event, data) => {
  MainUsername = '';
  MainPassword = '';
  LoggedInWith = '';
  verified = false;
  mainWindow.loadFile(path.join(__dirname,`./renderer/choose_email.html`));

})


ipcMain.on('navigate', async (event, pageTo) => {

	selectedMail = pageTo
	console.log(pageTo + 'Login.html')
	mainWindow.loadFile(path.join(__dirname,`./renderer/${pageTo}Login.html`));
})


ipcMain.on('changeOption', async (event, pageTo) => {

  selectedOption = pageTo
  console.log("Received request to navigate to " + pageTo + '.html')
  mainWindow.loadFile(path.join(__dirname,`./renderer/${pageTo}.html`));
})


ipcMain.on('EmailToData', async (event, data) => {
    const dataSend = data;
    console.log('Received Email data that will be given to the newly loaded page:', data);
    mainWindow.webContents.executeJavaScript(`updateData('${data}')`)
})

ipcMain.on('getLogin', async () => {
  
  console.log('Received request to get Username')
  mainWindow.webContents.executeJavaScript(`updateUsername('${MainUsername}')`)  
  
})


ipcMain.on('getEmailList', async (event, data) => {

  mainWindow.webContents.executeJavaScript(`updateEmailList('${EmailtoSendTo}')`)
  console.log('Received request to send the Email list')
  console.log(EmailtoSendTo)
})

ipcMain.on('updateEmailList', async (event, data) => {
  console.log('Received request to update the main emailTo variable')
  if(data == ''){EmailtoSendTo = []}
    else{
      EmailtoSendTo = data
    }
})

// ipcMain.on('updateSentList', async (event,data) => {
//   sentEmails = data;
// })

ipcMain.on('emailsBeingSent', async(event, data) => {
  let answer;
  if(emailsBeingsent){
    answer = 1
  }else{
    answer = 0
  }
  mainWindow.webContents.executeJavaScript(`emailsBeingSent(${answer})`)
})


ipcMain.on('send-scheduledEmails', async (event,data) => {

  console.log('Received request to send scheduled EmailList')
  let currentPidList = getStoredChildProcesses()
  let currentEmailList = getStoredChildProcessesEmaildata()

  // convert date from cron format to readable

  currentEmailList.forEach((emailData,index) => {
    const cronExpression = emailData.date
    const interval = cronParser.parseExpression(cronExpression);
    const nextOccurrence = interval.next().toDate();
     const formattedDate = format(nextOccurrence, 'MMM dd, yyyy hh:mm a');
    console.log(`Next occurrence: ${formattedDate}`);
    currentEmailList[index].date = formattedDate
  })

  let newData = [currentEmailList, currentPidList]
  newData = JSON.stringify(newData)
  newData = btoa(newData)
  console.log('now executing function')
  mainWindow.webContents.executeJavaScript(`updateEmailList('${newData}')`)
})

ipcMain.on('stopEmail', async(event, data) => { // kill the process then update the data
  console.log(data)
  data.forEach((pid) => {
    if(pid === '' || pid === ' '){
      return
    }
    console.log('now removing ID' + pid)

    scheduleEmailsPid = getStoredChildProcesses()  // get updated pid list
    scheduleEmails = getStoredChildProcessesEmaildata()  // get updated email data list


    const index = scheduleEmailsPid.indexOf(pid)

    // try {
    //   process.kill(childProcessId, 'SIGTERM');
    //   console.log(`Child process with PID ${childProcessId} has been stopped.`);
    //   } catch (error) {
    //     console.error(`Error stopping child process with PID ${childProcessId}: ${error.message}`);
    //     if(isProcessRunning(childProcessId)){
    //       console.log('THE PROCESS WAS RUNNNING')
    //       process.kill(childProcessId, 'SIGKILL');
    //   }else{
    //     console.log('THE PROCESS WAS NOT RUNNING')
    //   }
    // }
    process.kill(pid) // kill the process first
    // scheduleEmailsPid.splice(index,1) // update local pid list
    // scheduleEmails.splice(index,1) // update local email list
    removeScheduledEmail(pid)  // update both the files
  })

})

ipcMain.on('send-folderList', async (event,data) => {
  console.log('Received request to send Folder list')
  const newData = JSON.stringify(folderList)
  mainWindow.webContents.executeJavaScript(`updateFolders('${btoa(newData)}')`)
  console.log('sent' + btoa(newData))
})

ipcMain.on('updateFolderList', async (event, data) =>{
  console.log('Received request to update Folder list')
  let newData = JSON.parse(atob(data))
  console.log(newData)
  folderList = newData

  // newData = JSON.stringify(folderList)
  // mainWindow.webContents.executeJavaScript(`updateFolders('${btoa(newData)}')`)
})

ipcMain.on('showFolderContent', async(event, data) => { // data has the index/folder
  console.log(data)
  const newData = JSON.stringify(folderList)
  mainWindow.loadFile(path.join(__dirname,`./renderer/folderEmail.html`));
  mainWindow.webContents.executeJavaScript(`updateglobalId('${btoa(data)}')`)
  mainWindow.webContents.executeJavaScript(`updateFolders('${btoa(newData)}')`)
  console.log('sent' + btoa(newData))
})

ipcMain.on('send-sentEmails', async(event, data)=>{
  console.log('Received request to send Sent emails')

  // check if any scheduled emails have been sent
  let newData = sentEmails
  let sentMailsBackground = getSentScheduledemail()
  sentMailsBackground.forEach((emailData) => {
    newData.splice(0,0,emailData)
  })
  sentMailsBackground = []
  fs.writeFileSync(sentMailSchedulePath, JSON.stringify(sentMailsBackground)); // remove from file
  newData = JSON.stringify(sentEmails)
  mainWindow.webContents.executeJavaScript(`updateEmailList('${btoa(newData)}')`)
  console.log("sent")
  console.log(`${btoa(newData)}`)
})

ipcMain.on('updateSentList' ,async (event, data) => {
  console.log('Received request to update sent mails')  
  console.log('data recived')
  console.log(data)
  sentEmails = JSON.parse(atob(data))
  console.log(sentEmails)
})

ipcMain.on('addToDraft', async(event, data) => {
  console.log('Received request to ADD a drafted email')
  const options = { year: 'numeric', month: 'short', day: 'numeric' };

  today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', options);
  console.log(formattedDate);
  let EmailDraftData = {
    from: MainUsername,
    to: data[0] ? data[0] : "(No recipient)",
    subject: data[1] ? data[1] : "(No subject)",
    body: data[2],
    date: formattedDate
  }

  // EmailDraftData = JSON.stringify(EmailDraftData)
  // console.log(EmailDraftData)
  // EmailDraftData = JSON.parse(EmailDraftData)

  draftedEmails.splice(0,0,EmailDraftData)
  console.log(EmailDraftData)

})

ipcMain.on('updateDraft', async (event, data) => {
  console.log('Received request to update draft')  
  console.log('data recived')
  console.log(data)
  draftedEmails = JSON.parse(atob(data))
  console.log(draftedEmails)
})

ipcMain.on('send-draftedEmails', async(event, data)=>{
  console.log('Received request to send drafted emails')
  let newData = JSON.stringify(draftedEmails)
  mainWindow.webContents.executeJavaScript(`updateEmailList('${btoa(newData)}')`)
  console.log("sent")
  console.log(`${btoa(newData)}`)
})


ipcMain.on('send-DraftedToCompose', async (event, data) => { // data comes encrypted
  console.log('sending draft data to compose')
  console.log(data)
  mainWindow.loadFile(path.join(__dirname,`./renderer/composeEmail.html`));
  mainWindow.webContents.executeJavaScript(`dataFromDraft('${data}')`)
  console.log(`'{${data}}'`)
    
})


ipcMain.on('send-toOpenEmail', async(event, data) => { //  data comes encrypted 
  console.log('Received request to send data to open mail')
  console.log(data)
  mainWindow.loadFile(path.join(__dirname,`./renderer/showEmail.html`));
  mainWindow.webContents.executeJavaScript(`emailData('${data}')`)
  console.log("DECODED DATA")
  console.log(atob(data))

})


ipcMain.on('openCsvDialog', async (event, data) => {
  console.log('request to open csv dialog Received')
  csvFilePath = await openCSVFileDialog();
  console.log(csvFilePath)
  await readCSVFile(csvFilePath)
})


ipcMain.on('openDialog', async (event, data) =>{
  console.log('Received request to open dialog for attachment')
  anyFilePath = await openDialog()
  console.log('Selected file path:', anyFilePath);
  console.log('sending Any file path')
  const fileName = path.basename(anyFilePath);
  console.log('file selected: ' + fileName)
  const dataToSend = [anyFilePath, fileName]
  mainWindow.webContents.executeJavaScript(`showAttachment('${dataToSend}')`)

})


ipcMain.on('scheduleMail', async (event,data) => {

  if(!verified){
    mainWindow.webContents.executeJavaScript('showNotificationTimeOut("YOU NEED TO LOGIN FIRST!")')
    return
  }
  console.log(atob(data))
  
  const localTimezone = moment.tz.guess();
  console.log(localTimezone)

  startBackgroundProcess(data)
})



// ipcMain.on('sendPath', async (event, data) =>{
//   mainWindow.webContents.executeJavaScript(`addPath('${CurrentPath}')`)
// })


function startBackgroundProcess(data) {
  console.log('Fork the background process as a child process')
  

  let newData = atob(data)
  data = JSON.parse(newData)

  console.log(data)

  const backgroundProcess = fork(path.join(__dirname,'renderer/background.js'), [], {
    detached: true,
    stdio: 'ignore'
  });

  // FROM HERE
  const childProcessId = backgroundProcess.pid;
  console.log(childProcessId)
  

  // TO HERE

  const payload = [MainUsername, MainPassword, LoggedInWith, data]
  backgroundProcess.send(payload);

  backgroundProcess.on('error', (err) => {
    console.error('Background process error:', err);
  });

  backgroundProcess.on('close', (code) => {
    console.log(`Background process exited with code ${code}`);
    // removeScheduledEmail(childProcessId)  // remove the actual process
  });

  backgroundProcess.on('exit', (code, signal) => {
    console.log(`Child process with ID ${childProcessId} exited with code ${code} and signal ${signal}`);

    // removeScheduledEmail(childProcessId)  // remove the actual process
  });
  // Unref the child process to allow the main process to exit independently
  backgroundProcess.unref();

  scheduleEmailsPid = getStoredChildProcesses()   /// get the lates pid list
  scheduleEmailsPid.push(childProcessId) // update it locally
  storeChildProcess(childProcessId); // update pid file

  const mailData = {
    from: MainUsername,
    to: data[1] ? data[1] : "(No recipient)",
    subject: data[2] ? data[2] : "(No subject)",
    text: data[3],
    date: data[0],
    attachments: data[4]
  }
  scheduleEmails = getStoredChildProcessesEmaildata()  // get updated email data
  scheduleEmails.push(mailData) // update it locally
  storeChildProcessEmailData(childProcessId)  // update the file
}


function storeChildProcess(childProcessId) {
  fs.writeFileSync(childProcessesFilePath, JSON.stringify(scheduleEmailsPid)); // file
}

function storeChildProcessEmailData(childProcessId){
  fs.writeFileSync(childProcessesEmailDataPath, JSON.stringify(scheduleEmails)); // update email file
}

function removeChildProcessPid(childProcessId) {

  let scheduleEmailsPid = getStoredChildProcesses(); // get the updated process list
  console.log('before removing pid list main process')
  console.log(scheduleEmails)
  const index = scheduleEmailsPid.indexOf(childProcessId) // get index from the pid list
  scheduleEmailsPid.splice(index,1) // remove from local list
  console.log('after removing pid from list')
  console.log(scheduleEmailsPid)
  fs.writeFileSync(childProcessesFilePath, JSON.stringify(scheduleEmailsPid)); // update the process file 
  console.log('removed childProcess (from file too) with id ' + childProcessId)
  
}

function removeChildProcessEmailData(childProcessId) {
  console.log('before stopping srocess')

  let scheduleEmailsPid = getStoredChildProcesses();  // get updated email data
  const index = scheduleEmailsPid.indexOf(childProcessId) // get index from the pid list
  console.log('before removing from main process')
  console.log(scheduleEmails)
  scheduleEmails.splice(index,1)  // remove email data locally
  console.log('after removing email data ')
  console.log(scheduleEmails)

  fs.writeFileSync(childProcessesEmailDataPath, JSON.stringify(scheduleEmails)); // update email data file 

}

function removeScheduledEmail(pid){  //// rmeove data from file
  removeChildProcessEmailData(pid) // this should be first
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
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function getVariableData(path){
  try {
    const data = fs.readFileSync(path);
    return JSON.parse(data);
  } catch (error) {
    return [];
  }

}

function writeDataToFile(path, data){
  fs.writeFileSync(path, JSON.stringify(data));
}



// when child process is done it makes the request to be removed from the list
ipcMain.on('requestRemoveChildProcess', (event, childProcessId) => {
  try {
    // Attempt to remove the child process from the file

    removeScheduledEmail(childProcessId)  // remove the actual process
  } catch (error) {
    console.error('Error removing child process entry:', error.message);
  }
});


ipcMain.handle('checkCronTime', (_, cronTime) => {
  try {
    const interval = cronParser.parseExpression(cronTime);
    const nextScheduledTime = interval.next().toDate();
    return nextScheduledTime > new Date();
  } catch (error) {
    console.error(`Error parsing cron time: ${error.message}`);
    return false;
  }
});


app.on('window-all-closed', () => {

  writeDataToFile(EmailtoSendToPath,EmailtoSendTo)
  writeDataToFile(sentMailPath,sentEmails)
  writeDataToFile(draftedEmailPath,draftedEmails)
  writeDataToFile(folderDataPath,folderList)

  if (!isMac) {
    app.quit();
  }
});
