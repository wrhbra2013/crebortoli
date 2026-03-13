const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const basePath = filePath.includes('html/sig/') ? '../' : 
                     filePath.includes('html/paginas/') ? '../' : './';
    const scriptSrc = basePath === './' ? 'static/js/components.js' : '../static/js/components.js';
    const scriptTag = `<script src="${scriptSrc}"></script>`;
    
    const headerPattern = /<header class="header"[\s\S]*?<\/header>/;
    const footerPattern = /<footer class="footer"[\s\S]*?<\/footer>/;
    
    let modified = false;
    
    if (headerPattern.test(content)) {
        content = content.replace(headerPattern, '<div id="header-placeholder"></div>');
        modified = true;
    }
    
    if (footerPattern.test(content)) {
        content = content.replace(footerPattern, '<div id="footer-placeholder"></div>');
        modified = true;
    }
    
    if (!content.includes('components.js')) {
        content = content.replace('</body>', `${scriptTag}\n</body>`);
        modified = true;
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log('Updated:', filePath);
        return true;
    }
    return false;
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'components') {
            walkDir(fullPath);
        } else if (file.endsWith('.html')) {
            processFile(fullPath);
        }
    });
}

walkDir('./html');
console.log('Done!');
