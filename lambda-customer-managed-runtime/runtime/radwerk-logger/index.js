// runtime/radwerk-logger/index.js
'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function createLogger(service) {
  const minLevel = LEVELS[process.env.RADWERK_LOG_LEVEL] ?? LEVELS.info;

  const write = (level, message, data = {}) => {
    if (LEVELS[level] < minLevel) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      service,
      message,
      ...data,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else console.log(line);
  };

  return {
    debug: (msg, data) => write('debug', msg, data),
    info: (msg, data) => write('info', msg, data),
    warn: (msg, data) => write('warn', msg, data),
    error: (msg, data) => write('error', msg, data),
  };
}

module.exports = { createLogger };
