import { config } from '@repo/jest-config/nest';
export default {
  ...config,
  moduleNameMapper: {
    ...config.moduleNameMapper,
    '^@repo/(.*)$': '<rootDir>/../packages/$1',
    '^src/(.*)$': '<rootDir>/$1', // Map src/ to apps/api/src/
  },
};
