import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use port 3001 directly (bypass nginx)
const API_BASE = 'http://localhost:3001';

async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchAllProjects() {
  console.log(`🔍 Fetching projects from ${API_BASE}/api/projects/...`);
  
  try {
    // Fetch project list
    const listResponse = await fetchWithTimeout(`${API_BASE}/api/projects/`);
    
    if (!listResponse.ok) {
      throw new Error(`HTTP error! status: ${listResponse.status}`);
    }
    
    const projectList = await listResponse.json();
    console.log(`✅ Found ${projectList.length} projects\n`);
    
    const projects = [];
    
    // Fetch details for each project
    for (let i = 0; i < projectList.length; i++) {
      const proj = projectList[i];
      console.log(`📁 [${i+1}/${projectList.length}] Fetching details for project ${proj.id}...`);
      
      try {
        const detailResponse = await fetchWithTimeout(`${API_BASE}/api/projects/${proj.id}`);
        
        if (!detailResponse.ok) {
          throw new Error(`HTTP error! status: ${detailResponse.status}`);
        }
        
        const details = await detailResponse.json();
        projects.push(details);
        console.log(`   ✅ Project: ${details.name || proj.id}`);
      } catch (err) {
        console.log(`   ❌ Failed to fetch project ${proj.id}:`, err.message);
      }
    }
    
    // Save to file
    const dataDir = path.join(__dirname, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    
    const outputPath = path.join(dataDir, 'projects.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify(projects, null, 2)
    );
    
    console.log(`\n✅ Saved ${projects.length} projects to ${outputPath}`);
    
    // Show summary
    console.log('\n📊 Summary:');
    projects.forEach(p => {
      const itemCount = p.items?.length || 0;
      console.log(`   - ${p.name || p.id}: ${itemCount} items`);
    });
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.log('\n💡 Make sure your server is running on port 3001');
    console.log('   Run: node server.vercel.mjs');
  }
}

// Check if server is reachable first
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/api/projects/`, { method: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}

// Main execution
console.log('🚀 Project Data Export Script');
console.log('============================\n');

checkServer().then(isRunning => {
  if (!isRunning) {
    console.error('❌ Cannot reach server at', API_BASE);
    console.log('\n📋 Please start your server first:');
    console.log('   cd ~/projects/portfolio');
    console.log('   node server.vercel.mjs\n');
    process.exit(1);
  }
  fetchAllProjects();
});
