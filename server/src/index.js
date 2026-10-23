import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`C++ 练习站后端已启动: http://${config.host}:${config.port}`);
});
