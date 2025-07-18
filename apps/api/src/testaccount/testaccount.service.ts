import { Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'
import { CustomLogger } from 'src/logger/logger.custom'
import { LoggerService } from 'src/logger/logger.service'
@Injectable()
export class TestAccountService {
  private logger: CustomLogger

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('EmailService')
  }
  async getPhoneVerifyCode(phonenumber: string) {
    const redisdb = 'abc-qa-core-be-redis-qa1.cu5ewp.clustercfg.use1.cache.amazonaws.com'
    const redisClient = new Redis(6379, redisdb)
    try {
      const keys = await redisClient.keys('sea:target:phone*')
      const values = await Promise.all(
        //1753507986,signup,+11234567890,sea:arq:vonage,165202
        keys.map(async (key) => {
          const value = await redisClient.get(key)
          const items = value.split(',')
          if (items[2].includes(phonenumber)) {
            return { key, value: items[4] }
          }
        })
      )

      return values
    } catch (err) {
      console.error('Error:', err)
    } finally {
      await redisClient.quit()
    }
  }
}
