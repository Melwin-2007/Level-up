module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
