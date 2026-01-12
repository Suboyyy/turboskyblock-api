import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const dataDir = path.resolve(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const ensureFile = (fileName: string, defaultJson: unknown) => {
    const filePath = path.join(dataDir, fileName);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultJson, null, 2), 'utf8');
      // eslint-disable-next-line no-console
      console.log(`Created missing data file: ${filePath}`);
    }
  };

  // Ensure base data files exist
  ensureFile('projects.json', []);
  ensureFile('recipes.json', []);

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3001);
  console.log('Backend running on http://localhost:3001');
}
bootstrap();