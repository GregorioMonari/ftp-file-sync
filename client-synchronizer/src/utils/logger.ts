import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} | [${level}] ${message}`;
    })
  ),
  transports: [
    new transports.Console({level:"silly"}), //'silly' is the lowest
    //new transports.File({ filename: 'app.log' })
  ]
});

export default logger;