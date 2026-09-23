import { createApp } from './src/app.js';
import { PageStore } from './src/pages.js';
import { config } from './src/config.js';
import { countUsers } from './src/users.js';

const pages = new PageStore().watch();
const app = createApp({ pages });

app.listen(config.port, () => {
  console.log(`${config.siteName} running at http://localhost:${config.port}`);
  console.log(`Loaded ${pages.all().length} pages from ${config.pagesDir}`);
  if (countUsers() === 0) {
    console.log('\nNo users exist yet. Create the first admin with:\n  npm run user -- add <username> --role admin\n');
  }
});
