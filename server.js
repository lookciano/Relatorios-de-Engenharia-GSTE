const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname);

// Serve static files without any URL rewriting
app.use((req, res, next) => {
  let filePath = path.join(PUBLIC, req.path);
  
  // If the path ends with .html, serve it directly
  if (req.path.endsWith('.html')) {
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  
  // If no extension, try adding .html
  if (!path.extname(req.path)) {
    const htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
  }
  
  // Serve other static files
  const staticPath = path.join(PUBLIC, req.path);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return res.sendFile(staticPath);
  }
  
  // Fallback to index.html only for root
  if (req.path === '/' || req.path === '') {
    return res.sendFile(path.join(PUBLIC, 'index.html'));
  }
  
  // 404 for everything else
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});