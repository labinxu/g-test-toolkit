import { Test, TestingModule } from '@nestjs/testing';
import { ReplayGateway } from './replay.gateway';

describe('ReplayGateway', () => {
  let gateway: ReplayGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReplayGateway],
    }).compile();

    gateway = module.get<ReplayGateway>(ReplayGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
