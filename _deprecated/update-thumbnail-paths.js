import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectsPath = path.join(__dirname, 'src', 'data', 'projects.json');
const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

// Update thumbnails to use existing files
let updates = 0;

data.forEach(project => {
  if (project.items) {
    project.items.forEach(item => {
      // Fix project 1 missing thumbnail
      if (item.thumbnail && item.thumbnail.includes('mlqy58j0-ppg0q3-NMS_3.png')) {
        item.thumbnail = '/assets/projects/1/thumbnail.jpg';
        console.log(`✅ Project 1: Updated thumbnail to use thumbnail.jpg`);
        updates++;
      }
      
      // Fix project 3 missing thumbnail
      if (item.thumbnail && item.thumbnail.includes('mm48t40r-mh1hya-PDF_Thumbnail.png')) {
        item.thumbnail = '/assets/projects/3/mm4939wt-4rl6zi-Fn_1.png';
        console.log(`✅ Project 3: Updated thumbnail to use mm4939wt-4rl6zi-Fn_1.png`);
        updates++;
      }
    });
  }
});

fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2));
console.log(`\n✅ Total updates: ${updates}`);
