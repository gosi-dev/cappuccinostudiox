const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/projects.json', 'utf8'));
let missing = [];
for (const p of data) {
    const check = (url, label) => {
        if (!url || !url.startsWith('/assets/')) return;
        const fp = 'public' + url;
        if (!fs.existsSync(fp)) missing.push({ project: p.id, label, url, file: fp });
    };
    if (p.items) p.items.forEach((it, i) => check(it.src, 'item[' + i + ']'));
    check(p.thumbnail, 'thumbnail');
    check(p.defaultBackgroundUrl, 'defaultBackgroundUrl');
    check(p.default_background_url, 'default_background_url');
    if (p.assets) p.assets.forEach((a, i) => check(a, 'asset[' + i + ']'));
}
if (missing.length === 0) console.log('ALL LOCAL ASSETS EXIST');
else { console.log(missing.length + ' MISSING:'); missing.forEach(m => console.log('  Project ' + m.project + ' ' + m.label + ': ' + m.file)); }
