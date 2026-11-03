import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only the missing thumbnails
const missingFiles = [
  {
    url: 'https://lyrfewqnnnwddqiqhnhq.supabase.co/storage/v1/object/public/project-media/1/mlqy58j0-ppg0q3-NMS_3.png',
    path: 'public/assets/projects/1/mlqy58j0-ppg0q3-NMS_3.png'
  },
  {
    url: 'https://lyrfewqnnnwddqiqhnhq.supabase.co/storage/v1/object/public/project-media/3/mm48t40r-mh1hya-PDF_Thumbnail.png',
    path: 'public/assets/projects/3/mm48t40r-mh1hya-PDF_Thumbnail.png'
  }
];

async function downloadFile(url, outputPath) {
  const fullPath = path.join(__dirname, outputPath);
  const dir = path.dirname(fullPath);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Skip if file already exists
  if (fs.existsSync(fullPath)) {
    console.log(`⏭️  Already exists: ${path.basename(outputPath)}`);
    return;
  }
  
  return new Promise((resolve) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(fullPath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${path.basename(outputPath)}`);
          resolve();
        });
      } else {
        console.log(`❌ Failed (${response.statusCode}): ${path.basename(outputPath)}`);
        resolve();
      }
    }).on('error', (err) => {
      console.log(`❌ Error: ${err.message}`);
      resolve();
    });
  });
}

async function main() {
  console.log('📥 Downloading 4 missing thumbnails...\n');
  
  for (const file of missingFiles) {
    await downloadFile(file.url, file.path);
  }
  
  console.log('\n✅ Done!');
}

main();
