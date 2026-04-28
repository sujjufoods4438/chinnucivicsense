const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:3000', ['camera']);

  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.setItem('adminUser', JSON.stringify({ name: 'Admin', email: 'admin@example.com' }));
    localStorage.setItem('adminToken', 'fake-token');
  });

  const errors = [];
  page.on('pageerror', err => {
    errors.push('PAGE_ERROR: ' + err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('CONSOLE_ERROR: ' + msg.text());
    }
  });

  await page.goto('http://localhost:3000/admin-live-detection', { waitUntil: 'networkidle2' });
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  // click capture button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const captureBtn = buttons.find(b => b.innerText.includes('Capture'));
    if (captureBtn) captureBtn.click();
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

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
    console.log('NO ERRORS FOUND.');
  }

  await browser.close();
})();
