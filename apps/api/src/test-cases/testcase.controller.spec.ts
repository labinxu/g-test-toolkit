import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { TestCasesController } from './testcases.controller';
import { TestCasesService } from './testcases.service';
import { RunTestCaseDto } from './dto/start-testcase-dto';
import { FilesService } from '../files/files.service';

describe('TestCasesController', () => {
  let controller: TestCasesController;
  let service: TestCasesService;

  // Mock TestCasesService
  const mockTestCasesService = {
    runInSandbox: jest.fn(),
  };
  const mockFilesService = {
    log: jest.fn(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestCasesController],
      providers: [
        {
          provide: TestCasesService,
          useValue: mockTestCasesService,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
      ],
    }).compile();

    controller = module.get<TestCasesController>(TestCasesController);
    service = module.get<TestCasesService>(TestCasesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /testcases/run', () => {
    it('should call runInSandbox with the testCode from the request body and return its result', async () => {
      // Request body
      const runTestCaseDto: RunTestCaseDto = {
        testCode: `
          import {TestCase, Test, withBrowser, useBrowser} from 'core-lib';
          import {GettrHelper} from 'gettr-lib';
            @Test()
            @withBrowser({ headless: false, debug: false })
            class TestBreakingNews extends TestCase {
              constructor() {
        LOGGER.info('test constructor')
        }
              test_case() {
                 const gt = new GettrHelper();
                 gt.goto('urltest');
                console.log('test case from test code');
              }
            }
          `,
      };

      // Mock return value from runInSandbox
      const expectedResult = 'Hello from core-lib main with params: {}';
      mockTestCasesService.runInSandbox.mockResolvedValue(expectedResult);

      // Call the endpoint
      const result = await controller.runTestCase(runTestCaseDto);

      // Assertions
      expect(service.runInSandbox).toHaveBeenCalledWith(
        runTestCaseDto.testCode,
      );
      expect(service.runInSandbox).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
    });

    it('should handle errors thrown by runInSandbox', async () => {
      // Request body
      const runTestCaseDto: RunTestCaseDto = {
        testCode: `
          import {TestCase, Test, withBrowser, useBrowser} from 'core-lib';
          import {GettrHelper} from 'gettr-lib';
            @Test()
            @withBrowser({ headless: false, debug: false })
            class TestBreakingNews extends TestCase {
              test_case() {
                 const gt = new GettrHelper();
                 gt.goto('urltest');
                console.log('test case from test code');
              }
            }
          `,
      };

      // Mock runInSandbox to throw an error
      const errorMessage = 'Sandbox execution failed';
      mockTestCasesService.runInSandbox.mockRejectedValue(
        new Error(errorMessage),
      );

      // Call the endpoint and expect an error
      await expect(controller.runTestCase(runTestCaseDto)).rejects.toThrow(
        errorMessage,
      );
      expect(service.runInSandbox).toHaveBeenCalledWith(
        runTestCaseDto.testCode,
      );
      expect(service.runInSandbox).toHaveBeenCalledTimes(1);
    });

    it('should throw a validation error for empty testCode', async () => {
      // Invalid request body
      const runTestCaseDto: RunTestCaseDto = {
        testCode: '',
      };

      // Call the endpoint and expect a validation error
      await expect(controller.runTestCase(runTestCaseDto)).rejects.toThrow();
    });
  });
});
