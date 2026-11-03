import fs from 'fs';
import path from 'path';
import https from 'https';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create base directories
const ASSETS_DIR = path.join(__dirname, 'public', 'assets', 'projects');
fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Helper to download a file
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Skip if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`⏭️  Already exists: ${path.basename(outputPath)}`);
      return resolve();
    }

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(outputPath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${path.basename(outputPath)}`);
          resolve();
        });
      } else {
        console.log(`❌ Failed (${response.statusCode}): ${url}`);
        resolve();
      }
    }).on('error', (err) => {
      console.log(`❌ Error downloading ${url}:`, err.message);
      resolve(); // Continue even if one file fails
    });
  });
}

// Helper to sanitize filename
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Main download function
async function downloadAllAssets() {
  console.log('📡 Fetching projects from Supabase...');
  
  // Fetch all projects
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*');
  
  if (error) {
    console.error('❌ Error fetching projects:', error);
    return;
  }
  
  console.log(`✅ Found ${projects.length} projects\n`);
  
  // Track all downloaded files for reporting
  const stats = {
    projects: 0,
    thumbnails: 0,
    items: 0,
    failed: []
  };
  
  // Process each project
  for (const project of projects) {
    stats.projects++;
    console.log(`\n📁 Project ${stats.projects}/${projects.length}: ${project.name || project.id}`);
    
    // Create project folder
    const projectDir = path.join(ASSETS_DIR, String(project.id));
    fs.mkdirSync(projectDir, { recursive: true });
    
    // Download thumbnail
    if (project.thumbnail) {
      const ext = path.extname(project.thumbnail) || '.jpg';
      const thumbPath = path.join(projectDir, `thumbnail${ext}`);
      try {
        await downloadFile(project.thumbnail, thumbPath);
        stats.thumbnails++;
        
        // Update project.thumbnail to local path
        project.thumbnail_local = `/assets/projects/${project.id}/thumbnail${ext}`;
      } catch (e) {
        stats.failed.push({ type: 'thumbnail', id: project.id, url: project.thumbnail });
      }
    }
    
    // Download all items
    if (project.items && Array.isArray(project.items)) {
      stats.items += project.items.length;
      
      for (let i = 0; i < project.items.length; i++) {
        const item = project.items[i];
        
        if (item.src && item.src.includes('supabase.co')) {
          const url = item.src;
          const parsedUrl = new URL(url);
          const originalFilename = path.basename(parsedUrl.pathname);
          const filename = sanitizeFilename(originalFilename || `item-${i}.bin`);
          const itemPath = path.join(projectDir, filename);
          
          try {
            await downloadFile(url, itemPath);
            
            // Update item.src to local path
            item.src_local = `/assets/projects/${project.id}/${filename}`;
          } catch (e) {
            stats.failed.push({ type: 'item', id: project.id, url, index: i });
          }
        }
        
        // Show progress every 5 items
        if ((i + 1) % 5 === 0) {
          console.log(`   Progress: ${i + 1}/${project.items.length} items`);
        }
      }
    }
  }
  
  // Save updated project data with local paths
  console.log('\n📝 Saving updated project data...');
  
  // Add local paths to projects
  const updatedProjects = projects.map(p => ({
    ...p,
    items: p.items?.map(item => ({
      ...item,
      src: item.src_local || item.src
    })),
    thumbnail: p.thumbnail_local || p.thumbnail
  }));
  
  // Save as JSON for reference
  const dataPath = path.join(__dirname, 'src', 'data');
  fs.mkdirSync(dataPath, { recursive: true });
  fs.writeFileSync(
    path.join(dataPath, 'projects.json'),
    JSON.stringify(updatedProjects, null, 2)
  );
  
  // Also create a JavaScript version for easy import
  fs.writeFileSync(
    path.join(dataPath, 'projects.js'),
    `export const projects = ${JSON.stringify(updatedProjects, null, 2)};`
  );
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 DOWNLOAD SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Projects processed: ${stats.projects}`);
  console.log(`✅ Thumbnails downloaded: ${stats.thumbnails}`);
  console.log(`✅ Items downloaded: ${stats.items}`);
  
  if (stats.failed.length > 0) {
    console.log(`\n⚠️  Failed downloads: ${stats.failed.length}`);
    stats.failed.slice(0, 5).forEach(f => {
      console.log(`   - ${f.type} for project ${f.id}`);
    });
    if (stats.failed.length > 5) {
      console.log(`   ... and ${stats.failed.length - 5} more`);
    }
  }
  
  console.log('\n✅ Asset download complete!');
  console.log(`📁 Assets saved to: ${ASSETS_DIR}`);
  console.log(`📊 Project data saved to: ${dataPath}/projects.json`);
}

// Run the download
downloadAllAssets();