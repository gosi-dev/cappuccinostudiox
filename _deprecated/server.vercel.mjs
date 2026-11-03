import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============= REQUEST LOGGING =============
app.use((req, res, next) => {
  console.log('\n=== INCOMING REQUEST ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Original URL:', req.originalUrl);
  console.log('Path:', req.path);
  console.log('Host:', req.headers.host);
  console.log('========================\n');
  next();
});

// Serve local project assets
app.use('/assets/projects', express.static(path.join(__dirname, 'public/assets/projects')));

// Helper to convert Vercel function to Express handler (kept for fallback)
function createHandler(handlerFunction) {
  return async (req, res) => {
    try {
      console.log(`🔧 Handling ${req.method} ${req.url}`);
      
      const vercelReq = {
        method: req.method,
        headers: req.headers,
        url: req.url,
        body: req.body,
        query: req.query,
        params: req.params,
        json: () => Promise.resolve(req.body)
      };

      const response = await handlerFunction(vercelReq);
      
      if (response && typeof response === 'object') {
        let body;
        try {
          body = await response.json();
        } catch {
          body = { message: 'No content' };
        }
        res.status(response.status || 200).json(body);
      } else {
        res.status(200).json({ message: 'Success' });
      }
    } catch (error) {
      console.error('❌ Handler error:', error);
      res.status(500).json({ error: error.message });
    }
  };
}

// ============= EXPLICIT ROUTES (NO REDIRECTS) =============

// 1. Project Files Config
app.get('/api/project-files-config', async (req, res) => {
  console.log('✅ GET /api/project-files-config');
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data, error } = await supabase
      .from('site_config')
      .select('value')
      .eq('key', 'project_files_3d')
      .single();
    
    if (error) throw error;
    res.json({ config: data.value });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. Projects List - Handles BOTH /api/projects and /api/projects/ without redirect
app.get(['/api/projects', '/api/projects/'], async (req, res) => {
  console.log('✅ GET /api/projects (or with slash)');
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, thumbnail');
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. Project Detail by ID
app.get('/api/projects/:id', async (req, res) => {
  console.log(`✅ GET /api/projects/${req.params.id}`);
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4. Availability
app.get('/api/availability', async (req, res) => {
  console.log('✅ GET /api/availability');
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data, error } = await supabase
      .from('bookings')
      .select('*');
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 5. Bookings - POST
app.post('/api/bookings', async (req, res) => {
  console.log('✅ POST /api/bookings');
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data, error } = await supabase
      .from('bookings')
      .insert(req.body)
      .select();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 6. Waitlist - POST
app.post('/api/waitlist', async (req, res) => {
  console.log('✅ POST /api/waitlist');
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data, error } = await supabase
      .from('waitlist')
      .insert(req.body)
      .select();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============= LOCAL DATA API (no Supabase) =============

// Serve projects list from local file
app.get('/api/local/projects', (req, res) => {
  try {
    const projectsPath = path.join(__dirname, 'src', 'data', 'projects.json');
    const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    
    // Return just id, name, thumbnail for list view
    const projectList = projectsData.map(p => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail ? `/assets/projects/${p.id}/thumbnail.jpg` : null
    }));
    
    res.json(projectList);
  } catch (error) {
    console.error('Error reading projects.json:', error);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

// Serve single project from local file
app.get('/api/local/projects/:id', (req, res) => {
  try {
    const projectsPath = path.join(__dirname, 'src', 'data', 'projects.json');
    const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    
    const project = projectsData.find(p => p.id === req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Update asset paths to use local URLs
    if (project.items) {
      project.items = project.items.map(item => {
        if (item.src) {
          const filename = path.basename(item.src);
          item.src = `/assets/projects/${project.id}/${filename}`;
        }
        return item;
      });
    }
    
    if (project.thumbnail) {
      project.thumbnail = `/assets/projects/${project.id}/thumbnail.jpg`;
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error reading projects.json:', error);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

console.log('✅ Added local data API endpoints:');
console.log('  - GET /api/local/projects');
console.log('  - GET /api/local/projects/:id');

console.log('\n✅ EXPLICIT ROUTES REGISTERED:');
console.log('  - GET  /api/project-files-config');
console.log('  - GET  /api/projects  (handles both with/without slash)');
console.log('  - GET  /api/projects/:id');
console.log('  - GET  /api/availability');
console.log('  - POST /api/bookings');
console.log('  - POST /api/waitlist');

// ============= FALLBACK: Serve static files =============
app.use((req, res) => {
  const filePath = path.join(__dirname, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.status(404).send('Not Found');
});

// ============= START SERVER =============
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${__dirname}`);
});
