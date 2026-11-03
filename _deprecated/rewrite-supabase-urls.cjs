/**
 * One-time script: Rewrite all Supabase URLs in projects.json to local /assets/projects/ paths.
 * Run: node rewrite-supabase-urls.js
 */
const fs = require('fs');
const path = require('path');

const PROJECTS_PATH = path.join(__dirname, 'src', 'data', 'projects.json');
const data = JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8'));

const SUPA_RE = /https:\/\/lyrfewqnnnwddqiqhnhq\.supabase\.co\/storage\/v1\/object\/public\/project-media\/([^/]+)\/(.+)/;

function rewriteUrl(url) {
    const m = url.match(SUPA_RE);
    if (m) return '/assets/projects/' + m[1] + '/' + m[2];
    return url;
}

let count = 0;

for (const project of data) {
    if (project.items) {
        for (const item of project.items) {
            if (item.src && SUPA_RE.test(item.src)) {
                item.src = rewriteUrl(item.src);
                count++;
            }
        }
    }
    if (project.thumbnail && SUPA_RE.test(project.thumbnail)) {
        project.thumbnail = rewriteUrl(project.thumbnail);
        count++;
    }
    if (project.defaultBackgroundUrl && SUPA_RE.test(project.defaultBackgroundUrl)) {
        project.defaultBackgroundUrl = rewriteUrl(project.defaultBackgroundUrl);
        count++;
    }
    if (project.assets) {
        for (let i = 0; i < project.assets.length; i++) {
            if (typeof project.assets[i] === 'string' && SUPA_RE.test(project.assets[i])) {
                project.assets[i] = rewriteUrl(project.assets[i]);
                count++;
            }
        }
    }
}

fs.writeFileSync(PROJECTS_PATH, JSON.stringify(data, null, 2));
console.log('Rewrote ' + count + ' Supabase URLs to local paths');

// Verify
const check = JSON.stringify(data);
const remaining = (check.match(/supabase/gi) || []).length;
console.log('Remaining supabase references in data:', remaining);
