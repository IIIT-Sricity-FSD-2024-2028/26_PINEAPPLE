const fs = require('fs');
const path = require('path');

const files = ['dashboard.jsx', 'notifications.jsx', 'settings.jsx', 'profile.jsx'];
let cssOutput = '';
let classCounter = 1;

function camelToKebab(str) {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

files.forEach(file => {
  const filePath = path.join('c:/Users/adity/OneDrive/Desktop/26_PINEAPPLE/React-Implementation/React-Implementation/src/pages', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // We will handle constant style objects first if they exist
  // To keep it simple and robust, let's just do manual conversion for the React components 
  // since a regex might break on ternary operators inside styles like `background: notif.isRead ? '...' : '...'`.
});
