const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set localStorage to bypass login
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.setItem('adminUser', JSON.stringify({ name: 'Admin', email: 'admin@example.com' }));
    localStorage.setItem('adminToken', 'fake-token');
  });

  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
    console.log('PAGE ERROR:', err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  await page.goto('http://localhost:3000/admin-live-detection', { waitUntil: 'networkidle2' });
  
  if (errors.length > 0) {
    console.log('FOUND ERRORS!');
  } else {
    // Check if right overlay exists
    const overlay = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.src.includes('error-overlay')) return true;
      return !!document.querySelector('.react-error-overlay');
    });
    console.log('OVERLAY EXISTS:', overlay);
  }

  await browser.close();
})();
