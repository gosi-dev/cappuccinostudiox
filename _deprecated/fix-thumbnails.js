import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectsPath = path.join(__dirname, 'src', 'data', 'projects.json');
console.log(`🔍 Looking for: ${projectsPath}`);

// Check if file exists
if (!fs.existsSync(projectsPath)) {
  console.error('❌ projects.json not found at:', projectsPath);
  process.exit(1);
}

// Read the file
const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
console.log(`✅ Found ${data.length} projects`);

// Update projects 3,5,6 to use .png
let updated = 0;
data.forEach(p => {
  if (['3', '5', '6'].includes(p.id)) {
    const oldPath = p.thumbnail;
    p.thumbnail = `/assets/projects/${p.id}/thumbnail.png`;
    console.log(`  📁 Project ${p.id}: ${path.basename(oldPath)} → thumbnail.png`);
    updated++;
  }
});

// Write back to file
fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2));
console.log(`✅ Updated ${updated} thumbnails`);

// Also check if the PNG files exist
console.log('\n🔍 Checking if thumbnail PNGs exist:');
['3', '5', '6'].forEach(id => {
  const pngPath = path.join(__dirname, 'public', 'assets', 'projects', id, 'thumbnail.png');
  if (fs.existsSync(pngPath)) {
    console.log(`  ✅ Project ${id}: thumbnail.png exists`);
  } else {
    console.log(`  ❌ Project ${id}: thumbnail.png MISSING!`);
  }
});
