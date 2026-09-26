import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startJobs } from './jobs';

app.listen(env.PORT, () => logger.info(`API berjalan di http://localhost:${env.PORT}/api/v1`));
startJobs();
