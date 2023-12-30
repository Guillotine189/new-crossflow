		        // NOTIFICATION SCRIPT
const showNotificationTimeOut = (text) => {
  const notificationElement = document.getElementById('notification');
  notificationElement.textContent = text;
  notificationElement.style.display = 'block';
  console.log('done made the display')

  setTimeout(() => {
    notificationElement.style.display = 'none';
  }, 3000); // Adjust the timeout value (in milliseconds) as needed
};


function deleteFolder(event,id){
  const index = id.split('F')[1]
  console.log(index)
  const name = folderList[index]['content']['name']
  folderList.splice(index,1)
  console.log(folderList)
  updateFolderList()
  console.log('sending request to update Folder List')
  ipcRenderer.send('updateFolderList', btoa(JSON.stringify(folderList)))
  showNotificationTimeOut('Removed Folder ' + name)


}