// Add the missing catch block at the end
const fs = require('fs');
const jsContent = fs.readFileSync('./public/js/admin/leads.js', 'utf8');

// Find the last occurrence of "});" and add catch block before it
const lines = jsContent.split('\n');
let lastClosingIndex = -1;

for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === '});') {
    lastClosingIndex = i;
    break;
  }
}

if (lastClosingIndex !== -1) {
  // Insert catch block before the last closing
  lines.splice(lastClosingIndex, 0, '  } catch (error) {');
  lines.splice(lastClosingIndex + 1, 0, '    console.error(\'Error in DOMContentLoaded:\', error);');
  lines.splice(lastClosingIndex + 2, 0, '    console.error(\'Error details:\', {');
  lines.splice(lastClosingIndex + 3, 0, '      message: error.message,');
  lines.splice(lastClosingIndex + 4, 0, '      stack: error.stack,');
  lines.splice(lastClosingIndex + 5, 0, '      name: error.name');
  lines.splice(lastClosingIndex + 6, 0, '    });');
  lines.splice(lastClosingIndex + 7, 0, '  }');
  
  const newContent = lines.join('\n');
  fs.writeFileSync('./public/js/admin/leads.js', newContent);
  console.log('✅ Added catch block to fix syntax error');
} else {
  console.log('❌ Could not find closing bracket to add catch block');
}
