const pine = require('pine');
const logger = pine();

export class APILogger {
  info(message: string, data?: any) {
    logger.info(`${message} ${data ? JSON.stringify(data) : ''}`);
  }

  error(message: string, data?: any) {
    logger.error(`${message} ${data ? JSON.stringify(data) : ''}`);
  }

  success(message: string, data?: any) {
    logger.info(`${message} ${data ? JSON.stringify(data) : ''}`);
  }
}
