import { Test, TestingModule } from '@nestjs/testing';
import { ReplayController } from './replay.controller';

describe('ReplayController', () => {
  let controller: ReplayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReplayController],
    }).compile();

    controller = module.get<ReplayController>(ReplayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
