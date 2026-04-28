const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:3000', ['camera']);

  const page = await browser.newPage();
  
  // Set localStorage to bypass login
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.setItem('adminUser', JSON.stringify({ name: 'Admin', email: 'admin@example.com' }));
    localStorage.setItem('adminToken', 'fake-token');
  });

  const errors = [];
  page.on('pageerror', err => {
    errors.push('PAGE_ERROR: ' + err.message);
  });

  await page.goto('http://localhost:3000/admin-live-detection', { waitUntil: 'networkidle2' });
  
  // Wait a bit to let the page run
  await page.waitForTimeout(3000);

  // Check for React error overlay
  const overlayText = await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      const overlay = iframe.contentDocument.querySelector('.react-error-overlay');
      if (overlay) return overlay.innerText;
    }
    const html = document.body.innerText;
    if (html.includes('Uncaught runtime errors')) return html;
    return null;
  });

  if (overlayText) {
    console.log('REACT ERROR OVERLAY:');
    console.log(overlayText);
  } else if (errors.length > 0) {
    console.log('JS ERRORS:');
    console.log(errors.join('\n'));
  } else {
    console.log('NO ERRORS FOUND. Page rendered successfully.');
  }

  await browser.close();
})();
